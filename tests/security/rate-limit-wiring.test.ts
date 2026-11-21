/**
 * SEC-04 wiring: every server action that starts work or reaches outside OCADE passes the
 * per-person limit before it acts (the counting itself is tested in rate-limits.test.sql).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { RATE_LIMITS } from "../../src/lib/security/rate-limit.server.ts";

const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("each limited action is counted where it happens", () => {
  const where: Record<keyof typeof RATE_LIMITS, string> = {
    start_task: "src/lib/jarvis/functions.ts",
    replay_task: "src/lib/jarvis/functions.ts",
    instruct_task: "src/lib/jarvis/functions.ts",
    save_watch: "src/lib/jarvis/functions.ts",
    save_skill: "src/lib/jarvis/skills.functions.ts",
    save_chat_hook: "src/lib/notifications/chat.functions.ts",
    begin_upload: "src/lib/library/library.functions.ts",
  };
  for (const [action, path] of Object.entries(where))
    assert.match(source(path), new RegExp(`admit\\(context\\.userId, "${action}"\\)`), action);
  for (const [limit, seconds] of Object.values(RATE_LIMITS))
    assert.ok(limit >= 1 && seconds >= 1 && seconds <= 86_400);
});
