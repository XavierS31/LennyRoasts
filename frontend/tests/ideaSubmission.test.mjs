import assert from "node:assert/strict";
import { test } from "node:test";
import { ideaError, ideaSubmission } from "../src/ideaSubmission.ts";

test("preserves the full idea and leaves implementation claims undescribed", () => {
  const text = "Campus Queue\n\nI would use Gemini to explain shuttle options. Nothing is built yet.";
  const submission = ideaSubmission(`  ${text}  `, ["gemini"]);
  assert.equal(submission.what_it_does, text);
  assert.equal(submission.name, "Campus Queue");
  for (const key of ["inspiration", "how_we_built_it", "accomplishments", "what_we_learned"]) {
    assert.equal(submission[key], "not described");
  }
  assert.deepEqual(submission.built_with, ["not described"]);
  assert.deepEqual(submission.challenges, ["gemini"]);
  assert.match(submission.challenges_we_ran_into, /implementation status is not described/);
});

test("caps only the derived title by Unicode characters, retaining all user text", () => {
  const text = "🚍".repeat(110) + "\nI would build a route guide.";
  const submission = ideaSubmission(text, []);
  assert.equal(Array.from(submission.name).length, 100);
  assert.equal(submission.what_it_does, text);
  assert.deepEqual(submission.challenges, []);
});

test("validates blank and oversized ideas without requiring finished-project sections", () => {
  assert.ok(ideaError(" \n "));
  assert.equal(ideaError("A small idea with no chosen technology."), undefined);
  assert.equal(ideaError("🚍".repeat(8000)), undefined);
  assert.ok(ideaError("a".repeat(8001)));
});
