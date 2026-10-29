"""Summarises benchmark/results.jsonl into a Markdown table (latest successful record per arm/trial/question)."""
import json, collections, statistics, sys, pathlib
import re
here = pathlib.Path(__file__).parent
QUESTIONS = {q["id"]: q for q in json.loads((here / "questions.json").read_text())}


def grade(qid, extracted):
    """Single source of truth for grading; re-applied to the stored `extracted` answer line.
    Numeric answers compare by value (so 049 equals 49), LaTeX fractions are flattened, and
    false-premise questions pass only if the model rejects the premise."""
    exp = QUESTIONS[qid]["answer"]
    e = extracted.strip()
    if exp == "NONE":
        return bool(re.match(r"(none\b|no such|did not|does not exist|never)", e, re.I))
    e = re.sub(r"\\\\?\(|\\\\?\)|\$", "", e)                    # strip \( \) and $ math delimiters
    e = re.sub(r"\\d?frac\{(\d+)\}\{(\d+)\}", r"\1/\2", e)          # \frac{a}{b} -> a/b
    e = re.sub(r"[,\s.*`_]", "", e).lower().strip('"\'')
    if re.fullmatch(r"\d+", exp):
        return bool(re.fullmatch(r"\d+", e)) and int(e) == int(exp)
    return e == exp.lower()
rows = {}
errors = collections.Counter()
attempted = set()
for l in (here / "results.jsonl").read_text().splitlines():
    r = json.loads(l)
    k = (r["arm"], r["trial"], r["qid"])
    attempted.add(k)
    if r.get("error"):
        continue
    r["correct"] = grade(r["qid"], r["extracted"])
    rows[k] = r
arms = sorted({k[0] for k in rows}, key=lambda a: (a.startswith("mercury"), a))
qids = [q["id"] for q in json.loads((here / "questions.json").read_text())]
for k in attempted:
    if k not in rows: errors[k[0]] += 1          # never produced an answer: counted as wrong below
out = ["| Arm | Correct | Accuracy | Median latency | Mean cost per answered question | No answer (counted wrong) |", "|---|---|---|---|---|---|"]
per_q = collections.defaultdict(dict)
for a in arms:
    rs = [r for k, r in rows.items() if k[0] == a]
    ok = sum(r["correct"] for r in rs)
    n = len(rs) + errors[a]
    lat = statistics.median(r["latencyMs"] for r in rs) / 1000
    cost = statistics.mean(r.get("costUsd", 0) for r in rs)
    out.append(f"| `{a}` | {ok}/{n} | {100*ok/n:.0f}% | {lat:.0f} s | ${cost:.4f} | {errors[a]} |")
    for r in rs: per_q[r["qid"]].setdefault(a, []).append(r["correct"])
    for k in attempted:
        if k[0] == a and k not in rows: per_q[k[2]].setdefault(a, []).append(False)
print("\n".join(out))
print("\nPer question (correct trials / trials):\n")
print("| Question | " + " | ".join(f"`{a.split(':',1)[1].split('/')[-1]}`" for a in arms) + " |")
print("|---|" + "---|" * len(arms))
for q in qids:
    print(f"| {q} | " + " | ".join(f"{sum(per_q[q].get(a, []))}/{len(per_q[q].get(a, []))}" for a in arms) + " |")
