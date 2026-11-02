import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { openapiDocument, resolveDebateConfig, listWorkflowInfos } from "./api";
import { SEED_TEXT } from "./seedText";
import { VERSION, SEED_WORKFLOWS, PANELS } from "@shared/defaults";

const ctx = { owner: null, apiKey: "test" };

test("VERSION matches package.json", () => {
  const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(VERSION, pkg.version);
});

test("the OpenAPI document describes the debate endpoints", () => {
  const doc = openapiDocument() as any;
  for (const p of ["/api/v1/debates", "/api/v1/debates/{id}", "/api/v1/quick", "/api/v1/workflows", "/mcp"]) assert.ok(doc.paths[p], p);
  assert.equal(doc.info.version, VERSION);
});

test("built-in workflows are listed and resolve by name or id", () => {
  const names = listWorkflowInfos(ctx).map(w => w.id);
  assert.ok(names.includes("precision") && names.includes("budget"));
  const r = resolveDebateConfig(ctx, { workflow: "Budget" }) as any;
  assert.equal(r.cfg.rounds, 4);
  assert.equal(r.cfg.models.length, 3);
});

test("explicit settings override the workflow", () => {
  const r = resolveDebateConfig(ctx, { workflow: "precision", rounds: 5, models: ["a/b", "c/d"] }) as any;
  assert.equal(r.cfg.rounds, 5);
  assert.deepEqual(r.cfg.models, ["a/b", "c/d"]);
});

test("unknown workflows and invalid models are rejected with a message", () => {
  assert.match(resolveDebateConfig(ctx, { workflow: "nope" }) as string, /Unknown workflow/);
  assert.match(resolveDebateConfig(ctx, { models: ["not a model"] }) as string, /valid OpenRouter model IDs/);
});

test("with no workflow or models the quick panel is used", () => {
  const r = resolveDebateConfig(ctx, {}) as any;
  assert.deepEqual(r.cfg.models, PANELS[0].models);
});

test("seeded workflows have a name and description in all 15 languages", () => {
  assert.equal(Object.keys(SEED_TEXT).length, 15);
  for (const [lang, t] of Object.entries(SEED_TEXT)) for (const w of SEED_WORKFLOWS) {
    assert.ok(t[w.slug].name.length > 0 && t[w.slug].desc.length > 0, `${lang}/${w.slug}`);
  }
});
