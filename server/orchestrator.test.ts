// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { planPhases, parseVote } from "./orchestrator";

test("every plan ends with a final answer and has the requested length (2 or more rounds)", () => {
  for (let n = 2; n <= 30; n++) {
    const plan = planPhases(n);
    assert.equal(plan.length, n, `length for n=${n}`);
    assert.equal(plan[0], "research");
    assert.equal(plan[plan.length - 1], "final");
  }
});

test("plans of 3 or more rounds contain a debate round", () => {
  for (let n = 3; n <= 30; n++) assert.ok(planPhases(n).includes("debate"), `n=${n}`);
});

test("plans of 4 or more rounds synthesise before the final answer", () => {
  for (let n = 4; n <= 30; n++) {
    const plan = planPhases(n);
    assert.equal(plan[plan.length - 2], "synthesis", `n=${n}`);
  }
});

test("a single round is just the final answer", () => {
  assert.deepEqual(planPhases(1), ["final"]);
});

test("parseVote reads the standard footer", () => {
  assert.deepEqual(parseVote("Reasoning...\nVOTE: AGREE | SCORE: 9"), { vote: "AGREE", agreement: 0.9 });
  assert.deepEqual(parseVote("VOTE: PARTIALLY_AGREE | SCORE: 6/10"), { vote: "PARTIALLY_AGREE", agreement: 0.6 });
  assert.deepEqual(parseVote("VOTE: DISAGREE | SCORE: 2"), { vote: "DISAGREE", agreement: 0.2 });
});

test("parseVote tolerates markdown and falls back to the vote keyword", () => {
  assert.equal(parseVote("**VOTE:** AGREE | **SCORE:** 10").agreement, 1);
  assert.equal(parseVote("VOTE: partially agree").agreement, 0.5);
  assert.equal(parseVote("VOTE: DISAGREE").agreement, 0);
});

test("parseVote returns nothing when no vote is present, and clamps absurd scores", () => {
  assert.deepEqual(parseVote("I think the answer is 42."), { vote: undefined, agreement: undefined });
  assert.equal(parseVote("VOTE: AGREE | SCORE: 99").agreement, 1);
});

test("parseVote uses the last footer when the text quotes earlier ones", () => {
  assert.equal(parseVote("Earlier someone wrote VOTE: DISAGREE | SCORE: 1.\nVOTE: AGREE | SCORE: 8").agreement, 0.8);
});
