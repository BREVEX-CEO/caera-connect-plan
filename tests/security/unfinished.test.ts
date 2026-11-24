import assert from "node:assert/strict";
import { test } from "node:test";
import { unfinishedByConversation } from "../../src/lib/jarvis/unfinished.ts";

test("only open statuses are unfinished, and needing the person outranks working", () => {
  const found = unfinishedByConversation([
    { conversation_id: "a", status: "running" },
    { conversation_id: "a", status: "waiting" },
    { conversation_id: "b", status: "taken_over" },
    { conversation_id: "c", status: "completed" },
    { conversation_id: "d", status: "stopped" },
    { conversation_id: "e", status: "running" },
  ]);
  assert.deepEqual(Object.fromEntries(found), {
    a: "Needs you",
    b: "You have control",
    e: "Working",
  });
});

test("no tasks, no labels", () => {
  assert.equal(unfinishedByConversation([]).size, 0);
});
