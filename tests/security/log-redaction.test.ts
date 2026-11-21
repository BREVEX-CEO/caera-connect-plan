/**
 * KEY-13: a canary credential logged by server code never reaches the log, in strings, objects
 * or errors; ordinary text passes unchanged; both the Worker and the Edge Functions install it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { redactConsole, redactSecrets } from "../../src/lib/security/secret-shape.ts";

const CANARY = `sk-proj-${"Zc4n4ry".repeat(5)}`;
const JWT = `eyJhbGciOiJIUzI1NiJ9.${"eyJzdWIiOiIxIn0".repeat(2)}.${"c2lnbmF0dXJl".repeat(2)}`;

test("credentials are replaced by a marker that names only their kind", () => {
  assert.equal(redactSecrets(`key=${CANARY}`), "key=[redacted an OpenAI-style API key]");
  assert.equal(redactSecrets(`Authorization: Bearer ${JWT}`), "Authorization: [redacted token]");
  assert.equal(redactSecrets('schedules.sweep {"claimed":2}'), 'schedules.sweep {"claimed":2}');
});

test("every console path is redacted, including objects and errors", () => {
  const lines: string[] = [];
  const sink = {
    log: (...a: unknown[]) => lines.push(a.join(" ")),
    info: (...a: unknown[]) => lines.push(a.join(" ")),
    warn: (...a: unknown[]) => lines.push(a.join(" ")),
    error: (...a: unknown[]) => lines.push(a.join(" ")),
    debug: (...a: unknown[]) => lines.push(a.join(" ")),
  };
  redactConsole(sink);
  redactConsole(sink); // installing twice wraps once
  sink.error("provider failed", new Error(`401 for ${CANARY}`));
  sink.warn({ headers: { authorization: `Bearer ${JWT}` } });
  sink.info(`token ${JWT}`);
  const all = lines.join("\n");
  assert.equal(all.includes(CANARY), false);
  assert.equal(all.includes(JWT), false);
  assert.match(all, /provider failed Error: 401 for \[redacted/);
  assert.equal(lines.length, 3);
});

test("the Worker and every Edge Function install the redaction", () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  assert.match(read("src/cloudflare-entry.ts"), /redactConsole\(console\)/);
  assert.match(read("supabase/functions/_shared/boundary.ts"), /redactConsole\(console\)/);
});
