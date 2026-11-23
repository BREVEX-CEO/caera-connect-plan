/**
 * UPLOAD-06: an upload begun before the person emptied their Library, or whose object was
 * deleted, is never listed afterwards.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { fencedUpload, timeOrderedId, uploadBeganAt } from "../../src/lib/library/upload-fence.ts";

test("an upload id records when it began and is a valid version 7 UUID", () => {
  const at = Date.UTC(2026, 10, 23, 12, 0, 0, 123);
  const id = timeOrderedId(at);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(uploadBeganAt(id), at);
  assert.notEqual(timeOrderedId(at), id, "random bits differ");
  assert.equal(uploadBeganAt(crypto.randomUUID()), 0, "a version 4 id carries no time");
});

test("emptying the Library fences uploads begun before it, not after", () => {
  const cleared = "2026-11-23T12:00:00.000Z";
  const before = timeOrderedId(Date.parse(cleared) - 1);
  const after = timeOrderedId(Date.parse(cleared) + 1);
  assert.match(fencedUpload(before, false, cleared) ?? "", /emptied/);
  assert.equal(fencedUpload(after, false, cleared), null);
  assert.equal(fencedUpload(before, false, null), null, "never emptied: nothing fenced");
  assert.match(fencedUpload(crypto.randomUUID(), false, cleared) ?? "", /emptied/);
});

test("a deleted upload is never listed again, whatever its time", () => {
  assert.match(fencedUpload(timeOrderedId(), true, null) ?? "", /deleted/);
});
