# Benchmark: Mercury versus single models

Run on 29 October 2026 through OpenRouter. This document says what was measured, how, and what it does and does not show.

## Question

Does a short Mercury debate between three small, cheap models answer objectively checkable questions better than one model asked once, including the current frontier models?

## Method

- 30 questions with exact answers computed by script (`benchmark/make_questions.py`). 16 are routine (large multiplication, date arithmetic, counting, sorting, two false-premise questions) and 14 are harder multi-step computations (Collatz length, longest increasing subsequence, edit distance, shortest path, lattice paths with obstacles, a 5x5 determinant, a permutation count, and similar). Most cannot be answered by recall alone.
- Every arm gets the same prompt, plus one instruction to end with `ANSWER: <answer>` (or `ANSWER: NONE` for a false premise). No arm has tools; every arm computes in its head.
- Each question was run twice per arm (60 runs per arm), temperature 0.3, up to 3 attempts per call with backoff.
- Arms:
  - Single frontier models: `anthropic/claude-opus-5.5` ($4 in / $20 out per million tokens), `openai/gpt-6.1-sol` ($2 / $10), `google/gemini-4-argon` ($2 / $10).
  - Single small models: `anthropic/claude-haiku-5.5` ($0.10 / $0.50), `openai/gpt-6-luna` ($0.10 / $0.50), `deepseek/deepseek-v4.1-flash-1017` ($0.15 / $0.60).
  - Mercury `quick@4`: those same three small models as a panel, 4 rounds (research, debate, synthesis, final), run through the real orchestrator in this repository.
- Grading is automatic and is applied by `benchmark/report.py` to the extracted `ANSWER:` line. Numeric answers compare by value. A run that produced no answer after all retries counts as wrong.
- Cost is the figure OpenRouter reports for each call (`usage.cost`). The whole benchmark, including reruns, used roughly $3 of credit.

## Results

| Arm | Correct | Accuracy | Median latency | Mean cost per answered question | No answer (counted wrong) |
|---|---|---|---|---|---|
| `single:anthropic/claude-haiku-5.5` | 58/60 | 97% | 4 s | $0.0007 | 2 |
| `single:anthropic/claude-opus-5.5` | 58/60 | 97% | 6 s | $0.0214 | 2 |
| `single:deepseek/deepseek-v4.1-flash-1017` | 54/60 | 90% | 3 s | $0.0008 | 6 |
| `single:google/gemini-4-argon` | 58/60 | 97% | 17 s | $0.0111 | 0 |
| `single:openai/gpt-6-luna` | 55/60 | 92% | 4 s | $0.0005 | 0 |
| `single:openai/gpt-6.1-sol` | 60/60 | 100% | 5 s | $0.0040 | 0 |
| `mercury:quick@4` | 58/60 | 97% | 30 s | $0.0082 | 0 |


Per-question results are in the appendix. Raw records, including the final answer text, are in `benchmark/results.jsonl`.

## What this shows

1. The test is close to saturated. Almost every arm scores 90 to 100 percent, so it cannot separate models that are within a few points of each other. With 60 runs per arm, one or two wrong answers is within noise.
2. Mercury `quick@4` scored the same as the best single models (97 percent against 97 to 100 percent). It did not beat the frontier models, and it did not beat its own best member (Claude Haiku 5.5, 97 percent).
3. Mercury cost more and took longer than the cheapest option: about 12 times the cost of one Haiku call and roughly 7 times its median latency (30 seconds against 4). Its mean cost per question was in the same range as the frontier singles (above GPT-6.1 Sol, below Claude Opus 5.5 and Gemini 4 Argon).
4. Mercury never failed to answer. Three of the six single-model arms had runs with no answer at all (Claude Haiku 5.5 and Claude Opus 5.5 two each, DeepSeek V4.1 Flash six), as empty completions on long computations, most likely because the model's reasoning used up its output budget (for example the prime-counting question). A panel with fallbacks absorbs those failures. That is a real robustness benefit, and the only advantage this benchmark shows.
5. A debate can also hurt. On the Collatz question the panel's final answer was 350 in one run (the correct answer is 351), although Claude Haiku 5.5 and GPT-6 Luna each answered it correctly in both of their runs. The panel's second wrong answer was 47 on the prime-counting question (correct: 43). A debate can talk itself out of a right answer, and nothing here shows that it talks itself into one more often than not.
6. The consensus percentage is the models' own report of how much they agree. It is not a measure of correctness, and the benchmark gives no evidence that a higher consensus means a more accurate answer.

## What this does not show

- It does not show that Mercury is never better. Questions with no single checkable answer (strategy, judgement, research synthesis), which is what Mercury is meant for, are not covered. Whether a panel helps there is untested.
- The sample is small (30 questions, 2 runs each) and there is one panel and one prompt style.
- The false-premise instruction (`ANSWER: NONE`) misfired once for a model: Gemini 4 Argon answered `NONE` to the Collatz question in both runs. That counts as wrong, and it is a prompt-design effect, not only a model effect.
- Pricing and models change often. The numbers describe 29 October 2026.

## Mistakes found while building the benchmark

- One expected answer (`h_binary`) was wrong in the first version, off by one index in the generator. Every model disagreed with it in the same way, which exposed it; brute force confirmed the models. It is fixed in `make_questions.py`.
- The first grader compared `049` with `49` as different strings and wrote LaTeX fractions off as wrong. Grading now compares numerically and strips math delimiters.
- Two overlapping runs wrote duplicate records for part of the hard set. `report.py` keeps the latest record per arm, trial and question, so the table is not double counted, but the cost total includes the duplicates.

## Reproduce

```bash
python3 benchmark/make_questions.py              # regenerates questions.json with computed answers
export OPENROUTER_API_KEY=sk-or-...
DB_PATH=/tmp/bench.db npx tsx benchmark/run.ts \
  --arms single:openai/gpt-6.1-sol,single:anthropic/claude-haiku-5.5,mercury:quick@4 --trials 2
python3 benchmark/report.py                      # prints the tables above
python3 benchmark/verify_models.py               # checks every hard-coded model ID against OpenRouter
```

Arms are written as `single:<model id>` or `mercury:<panel>@<rounds>`, where the panel is `quick`, `mid`, `frontier`, or model IDs joined with `+`. The run is resumable: finished runs in `results.jsonl` are skipped.

## Appendix: per question (correct runs out of runs)


| Question | `claude-haiku-5.5` | `claude-opus-5.5` | `deepseek-v4.1-flash-1017` | `gemini-4-argon` | `gpt-6-luna` | `gpt-6.1-sol` | `quick@4` |
|---|---|---|---|---|---|---|---|
| mul | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| modexp | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| digsum | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| primes | 0/2 | 2/2 | 0/2 | 2/2 | 0/2 | 2/2 | 1/2 |
| digit7 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| mississippi | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| letters | 2/2 | 2/2 | 2/2 | 2/2 | 1/2 | 2/2 | 2/2 |
| weekday | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| fri13 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| days | 2/2 | 2/2 | 2/2 | 2/2 | 1/2 | 2/2 | 2/2 |
| sort9 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| reverse | 2/2 | 0/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| dice | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| pi | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| falsepremise | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| falsepremise2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| h_collatz | 2/2 | 2/2 | 0/2 | 0/2 | 2/2 | 2/2 | 1/2 |
| h_lis | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| h_edit | 2/2 | 2/2 | 0/2 | 2/2 | 1/2 | 2/2 | 2/2 |
| h_graph | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| h_lattice | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| h_zeros | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| h_primesq | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| h_date | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| h_div357 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| h_binary | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| h_hex | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| h_letters2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| h_det | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |
| h_perm | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |

