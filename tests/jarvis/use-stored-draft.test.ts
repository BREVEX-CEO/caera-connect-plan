import assert from "node:assert/strict";
import test from "node:test";
import { DRAFT_MAX_LENGTH, draftKey, loadDraft, saveDraft } from "../../src/lib/use-stored-draft.ts";

function memory() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

test("a draft round-trips and is scoped to surface and account", () => {
  const store = memory();
  saveDraft(store, draftKey("chat", "a"), "hello");
  assert.equal(loadDraft(store, draftKey("chat", "a")), "hello");
  assert.equal(loadDraft(store, draftKey("chat", "b")), "");
  assert.equal(loadDraft(store, draftKey("jarvis", "a")), "");
});

test("an empty or blank draft removes the saved copy", () => {
  const store = memory();
  const key = draftKey("chat", "a");
  saveDraft(store, key, "x");
  saveDraft(store, key, "   ");
  assert.equal(store.map.size, 0);
});

test("a very long draft is bounded", () => {
  const store = memory();
  const key = draftKey("chat", "a");
  saveDraft(store, key, "y".repeat(DRAFT_MAX_LENGTH + 500));
  assert.equal(loadDraft(store, key).length, DRAFT_MAX_LENGTH);
});

test("missing or throwing storage never throws", () => {
  const broken = {
    getItem: () => { throw new Error("denied"); },
    setItem: () => { throw new Error("full"); },
    removeItem: () => { throw new Error("denied"); },
  };
  assert.doesNotThrow(() => saveDraft(broken, "k", "text"));
  assert.equal(loadDraft(broken, "k"), "");
  assert.equal(loadDraft(null, "k"), "");
});
