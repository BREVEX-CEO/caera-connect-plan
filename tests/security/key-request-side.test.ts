/** KEY-16: the send paths call the secret guard, and no prompt or reply text asks a person for a key. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("both composers pass the message through the secret guard before sending", () => {
  for (const file of ["src/components/chat/ChatWorkspace.tsx", "src/jarvis/JarvisWorkspace.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /secret-shape/, `${file} imports the guard`);
    assert.match(
      source,
      /confirmSend|secretShape|confirmSecret|looksLikeSecret|\bconfirm[A-Z]\w*\(/,
      `${file} calls it`,
    );
  }
});

test("no system prompt or fixed reply tells a person to paste a key, token or password into the chat", () => {
  const asks =
    /(paste|send|type|enter|share|give)\s+(me\s+)?(your|the)\s+(api[ -]?key|secret key|password|token|private key|recovery code)/i;
  for (const file of [
    "src/lib/intelligence/contract.ts",
    "src/lib/intelligence/edge-handler.ts",
    "src/lib/jarvis/planner.server.ts",
    "src/lib/jarvis/contracts.ts",
  ])
    assert.doesNotMatch(readFileSync(file, "utf8"), asks, file);
});
