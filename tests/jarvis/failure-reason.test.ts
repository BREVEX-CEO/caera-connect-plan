/** REPO-51: a step that did not happen says why, in words for the person; nothing is invented. */
import assert from "node:assert/strict";
import test from "node:test";
import { failureReason } from "../../src/lib/jarvis/failure-reason.ts";

test("a known refusal has a sentence for the person, and an unknown one has none", () => {
  assert.match(failureReason("file_changed") ?? "", /never overwrite|did not overwrite/);
  assert.match(failureReason("stopped") ?? "", /You stopped/);
  assert.equal(failureReason("some_new_code"), null);
  assert.equal(failureReason(undefined), null);
  assert.equal(failureReason("toString"), null, "inherited names are not reasons");
});

test("no sentence is written for the model: no operation names, codes or JSON", () => {
  for (const code of [
    "element_stale",
    "window_gone",
    "output_exists",
    "file_open_in_app",
    "insufficient_storage",
    "timeout",
  ]) {
    const reason = failureReason(code) ?? "";
    assert.ok(reason.length > 10 && reason.endsWith("."), code);
    assert.doesNotMatch(reason, /[a-z]+_[a-z_]+|\bui\.|\bfs\.|sha256|\{/, code);
  }
});
