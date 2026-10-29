/**
 * Mercury benchmark harness.
 *
 *   DB_PATH=/tmp/bench.db OPENROUTER_API_KEY=... npx tsx benchmark/run.ts --arms single:openai/gpt-6.1-sol,mercury:quick --trials 2
 *
 * Results are appended to benchmark/results.jsonl; finished (arm, trial, question) triples are skipped, so
 * the run can be interrupted and resumed.
 */
import fs from "fs";
import path from "path";
import { storage } from "../server/storage";
import { callModel, runOrchestration } from "../server/orchestrator";
import { QUICK_PANEL, QUICK_TEMPERATURE } from "../shared/defaults";

// Optional proxy support for sandboxed environments (HTTPS_PROXY), no effect elsewhere.
if (process.env.HTTPS_PROXY && process.env.BENCH_USE_PROXY === "1") {
  const { setGlobalDispatcher, ProxyAgent } = await import(process.env.UNDICI_PATH ?? "undici");
  setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));
}

const apiKey = process.env.OPENROUTER_API_KEY ?? "injected";
const dir = path.dirname(new URL(import.meta.url).pathname);
const questions: Array<{ id: string; kind: string; prompt: string; answer: string }> =
  JSON.parse(fs.readFileSync(path.join(dir, "questions.json"), "utf8"));
const resultsFile = path.join(dir, "results.jsonl");

const arg = (name: string, d: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : d; };
const arms = arg("arms", "").split(",").filter(Boolean);
const trials = parseInt(arg("trials", "1"), 10);
const concurrency = parseInt(arg("concurrency", "6"), 10);
const only = arg("only", "").split(",").filter(Boolean);

const SUFFIX = "\n\nThink carefully. End your reply with a final line of the form `ANSWER: <answer>`. " +
  "If the question rests on a false premise, write `ANSWER: NONE`.";

// ─── Grading ────────────────────────────────────────────────
function extract(text: string): string {
  const m = Array.from(text.matchAll(/ANSWER\s*:\s*(.+)/gi)).pop();
  return (m ? m[1] : text.trim().split("\n").pop() ?? "").replace(/[*`_]/g, "").trim();
}
const norm = (s: string) => s.toLowerCase().replace(/[,\s$.]/g, "").replace(/\.$/, "");
function grade(q: { answer: string }, text: string): { extracted: string; correct: boolean } {
  const extracted = extract(text);
  if (q.answer === "NONE") {
    return { extracted, correct: /^none\b|no such|did not|does not exist|never/i.test(extracted) };
  }
  const e = norm(extracted);
  const a = norm(q.answer);
  const ok = e === a || e === `"${a}"` || (/^[a-z]+$/.test(a) && e.replace(/[^a-z]/g, "") === a);
  return { extracted, correct: ok };
}

// ─── Arms ───────────────────────────────────────────────────
interface Outcome { text: string; costUsd: number }
async function runArm(arm: string, prompt: string): Promise<Outcome> {
  const [kind, spec] = [arm.slice(0, arm.indexOf(":")), arm.slice(arm.indexOf(":") + 1)];
  if (kind === "single") {
    const r = await callModel(apiKey, spec, [{ role: "user", content: prompt }], undefined, QUICK_TEMPERATURE);
    return { text: r.content, costUsd: r.costUsd };
  }
  if (kind === "mercury") {
    const panels: Record<string, string[]> = {
      quick: QUICK_PANEL.map(p => p.id),
      frontier: ["anthropic/claude-opus-5.5", "openai/gpt-6.1-sol", "google/gemini-4-argon"],
      mid: ["anthropic/claude-sonnet-5.5", "openai/gpt-6.1-terra", "x-ai/grok-4.7"],
    };
    const [panel, rounds = "4"] = spec.split("@");
    const models = panels[panel] ?? panel.split("+");
    const s = storage.createSession({
      title: "bench", query: prompt, files: "[]", selectedModels: JSON.stringify(models), status: "running",
      currentIteration: 0, totalIterations: +rounds, finalAnswer: null, quickAnswer: null, workflowId: null,
    });
    const r = await runOrchestration(s.id, prompt, models, +rounds, apiKey, () => {}, QUICK_TEMPERATURE, 0.7);
    return { text: r.finalAnswer, costUsd: r.costUsd };
  }
  throw new Error(`Unknown arm ${arm}`);
}

// ─── Driver ─────────────────────────────────────────────────
const done = new Set<string>();
if (fs.existsSync(resultsFile)) {
  for (const l of fs.readFileSync(resultsFile, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(l); if (!r.error) done.add(`${r.arm}|${r.trial}|${r.qid}`);
  }
}
const jobs: Array<() => Promise<void>> = [];
for (const arm of arms) for (let t = 1; t <= trials; t++) for (const q of questions) {
  if (only.length && !only.includes(q.id)) continue;
  if (done.has(`${arm}|${t}|${q.id}`)) continue;
  jobs.push(async () => {
    const t0 = Date.now();
    let rec: Record<string, unknown>;
    try {
      const out = await runArm(arm, q.prompt + SUFFIX);
      rec = { arm, trial: t, qid: q.id, kind: q.kind, expected: q.answer, ...grade(q, out.text), costUsd: out.costUsd, latencyMs: Date.now() - t0, answer: out.text.slice(-600) };
    } catch (e) {
      rec = { arm, trial: t, qid: q.id, kind: q.kind, expected: q.answer, error: String(e instanceof Error ? e.message : e).slice(0, 300), latencyMs: Date.now() - t0 };
    }
    fs.appendFileSync(resultsFile, JSON.stringify(rec) + "\n");
    console.log(`${arm} t${t} ${q.id}: ${rec.error ? "ERROR " + rec.error : rec.correct ? "ok" : "WRONG (" + rec.extracted + ")"} ${(Number(rec.latencyMs) / 1000).toFixed(0)}s`);
  });
}
console.log(`${jobs.length} jobs to run`);
let next = 0;
await Promise.all(Array.from({ length: concurrency }, async () => { while (next < jobs.length) await jobs[next++](); }));
console.log("done");
