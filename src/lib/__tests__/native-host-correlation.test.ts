/**
 * A REPLY MUST BELONG TO THE REQUEST THAT ASKED FOR IT.
 *
 * The native host client used to correlate replies by POSITION: every reply
 * was handed to `waiters.shift()`. That holds only while the queue and the
 * reply stream stay in step, and one timeout is enough to break it. The waiter
 * is spliced out of the queue when its deadline passes, the host answers a
 * moment later anyway, and that late reply is given to the NEXT request. From
 * then on every answer belongs to the previous question, permanently.
 *
 * This is a computer-control channel. The command whose answer goes astray is
 * the verification step of OBSERVE → ACT → OBSERVE → VERIFY, so the failure is
 * not a stale field on a screen — it is an agent being told that a click it
 * never checked succeeded, because some earlier command said so.
 *
 * The host now echoes `runId` and the client matches on it.
 */
import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NativeHostClient } from "../native/native-host-client.node";

/**
 * A host that answers SLOWLY the first time and promptly afterwards, which is
 * all it takes to desynchronise a position-matched stream. It echoes `id`,
 * exactly as both real hosts do.
 */
const SLOW_HOST = `
let first = true;
process.stdin.setEncoding("utf8");
let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let i;
  while ((i = buffer.indexOf("\\n")) >= 0) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!line) continue;
    const request = JSON.parse(line);
    const reply = JSON.stringify({ ok: true, id: request.id, data: { echo: request.command } });
    if (first) {
      first = false;
      setTimeout(() => { process.stdout.write(reply + "\\n"); }, 400);
    } else {
      process.stdout.write(reply + "\\n");
    }
  }
});
`;

describe("native host replies are matched to their own request", () => {
  const dir = mkdtempSync(join(tmpdir(), "ocade-host-"));
  const hostPath = join(dir, "slow-host.mjs");
  writeFileSync(hostPath, SLOW_HOST);

  it("does not hand a timed-out request's late reply to the next request", async () => {
    const client = new NativeHostClient({
      command: process.execPath,
      args: [hostPath],
      label: "test host",
    });
    try {
      // "slow.one" is given a deadline it cannot meet, so it times out and its
      // late reply arrives while the next request is in flight.
      const slow = await client.request("slow.one", {}, { timeoutMs: 120 });
      expect(slow.ok).toBe(false);
      expect(slow.code).toBe("retryable_failure");

      // The reply this receives must be its OWN. Under position matching it
      // used to receive slow.one's.
      const second = await client.request<{ echo: string }>(
        "second.command",
        {},
        {
          timeoutMs: 5000,
        },
      );
      expect(second.ok, second.error ?? "").toBe(true);
      expect(second.data?.echo).toBe("second.command");

      const third = await client.request<{ echo: string }>(
        "third.command",
        {},
        {
          timeoutMs: 5000,
        },
      );
      expect(third.ok, third.error ?? "").toBe(true);
      expect(third.data?.echo).toBe("third.command");
    } finally {
      client.dispose();
    }
  }, 30_000);

  it("gives every concurrent request the answer to its own question", async () => {
    const client = new NativeHostClient({
      command: process.execPath,
      args: [hostPath],
      label: "test host",
    });
    try {
      // The first is slow; the rest are not, so the replies come back OUT OF
      // ORDER. Position matching cannot survive that at all.
      const commands = ["a.one", "b.two", "c.three", "d.four"];
      const replies = await Promise.all(
        commands.map((c) => client.request<{ echo: string }>(c, {}, { timeoutMs: 5000 })),
      );
      for (const [index, reply] of replies.entries()) {
        expect(reply.ok, reply.error ?? "").toBe(true);
        expect(reply.data?.echo).toBe(commands[index]);
      }
    } finally {
      client.dispose();
    }
  }, 30_000);
});
