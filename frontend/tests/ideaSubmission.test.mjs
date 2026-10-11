import assert from "node:assert/strict";
import { test } from "node:test";
import { ideaError, ideaSubmission } from "../src/ideaSubmission.ts";

test("preserves proposed and working project descriptions without assigning implementation status", () => {
  for (const text of [
    "Campus Queue\n\nI would use Gemini to explain shuttle options. Nothing is built yet.",
    "Campus Queue\n\nWe built and tested a working Gemini route guide. The deployed demo answers shuttle questions.",
  ]) {
    const submission = ideaSubmission(`  ${text}  `, ["gemini"]);
    assert.equal(submission.what_it_does, text);
    assert.equal(submission.name, "Campus Queue");
    for (const key of ["tagline", "inspiration", "how_we_built_it", "challenges_we_ran_into", "accomplishments", "what_we_learned", "whats_next"]) {
      assert.equal(submission[key], "not described");
    }
    assert.deepEqual(submission.built_with, ["not described"]);
    assert.deepEqual(submission.challenges, ["gemini"]);
  }
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
