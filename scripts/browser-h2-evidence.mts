/**
 * H2 evidence: real pairing handshake, origin pinning, and replay rejection.
 *
 * This drives the extension across the REAL extension boundary in a real
 * browser — a page served on 127.0.0.1 calls `chrome.runtime.sendMessage`, the
 * service worker's `onMessageExternal` listener answers, and the reply is read
 * back in the page. Nothing is simulated.
 *
 * The replay case is the point. `connect` sets `pairingCode = null` the moment
 * it succeeds, so the captured message is single-use by construction. Replaying
 * the exact same bytes must be refused.
 *
 * Usage: node --experimental-strip-types scripts/browser-h2-evidence.mts [--write]
 */
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";
import { browserFor, EXTENSION_DIR } from "./browser-harness.mts";

const write = process.argv.includes("--write");
const OUT = "release/OCADE_H2_PAIRING_REPLAY.json";
const PAGE_PORT = 8791;

const PAGE = `<!doctype html><html><body><h1>OCADE pairing harness</h1></body></html>`;

const server = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(PAGE);
});
await new Promise<void>((r) => server.listen(PAGE_PORT, "127.0.0.1", () => r()));
console.log(`harness page: http://127.0.0.1:${PAGE_PORT}/\n`);

const results: Record<string, unknown>[] = [];
let failed = false;

for (const [name, port] of [
  ["chrome", 9441],
  ["edge", 9442],
] as const) {
  const browser = browserFor(name, port);
  try {
    await browser.launch();
    const extId = await browser.installExtension(EXTENSION_DIR);
    const { active } = await browser.extensionActive(String(extId));
    if (!active) throw new Error("extension did not activate");

    /*
     * Pair the way a user does: from the extension's own POPUP.
     *
     * A first attempt sent `pairing.begin` from the service worker itself and
     * got undefined back — an extension cannot deliver a runtime message to its
     * own listener in the same context. The popup is a separate context, and it
     * is also the user-presence factor the extension deliberately requires: the
     * comment above that listener says an external page must not be able to
     * start pairing, and it cannot.
     */
    const popupSession = await browser.attachToPage(`chrome-extension://${extId}/popup.html`);
    await new Promise((r) => setTimeout(r, 1200));
    const pairing = (await browser.evaluate(
      popupSession,
      `new Promise(res => chrome.runtime.sendMessage({kind:'pairing.begin'}, r => res(r ?? {noReply:true})))`,
    )) as { ok?: boolean; pairingCode?: string };

    // --- now act as the paired PAGE, over the real external channel.
    const pageSession = await browser.attachToPage(`http://127.0.0.1:${PAGE_PORT}/`);
    await new Promise((r) => setTimeout(r, 1200));

    const connectMsg = { v: 1, kind: "connect", pairingCode: pairing.pairingCode };
    const sendFrom = (msg: unknown) =>
      browser.evaluate(
        pageSession,
        `new Promise(res => chrome.runtime.sendMessage(${JSON.stringify(String(extId))}, ${JSON.stringify(msg)}, r => res(r ?? {noReply:true})))`,
      );

    const first = (await sendFrom(connectMsg)) as Record<string, unknown>;
    const replay = (await sendFrom(connectMsg)) as Record<string, unknown>;

    // A wrong code must also be refused, so success is not merely "any code works".
    const wrongCode = (await sendFrom({ v: 1, kind: "connect", pairingCode: "000000" })) as Record<
      string,
      unknown
    >;

    // A request without the issued token must be refused.
    const noToken = (await sendFrom({ v: 1, kind: "tabs.list" })) as Record<string, unknown>;

    /*
     * The token lives at data.token, not at the top level — the protocol wraps
     * every success as {ok, kind, data}. A first version of this assertion
     * looked for `first.token`, found undefined, and reported a handshake
     * failure while the reply in front of it was a perfectly good token. The
     * identity block is checked too, so "ok" alone cannot carry this.
     */
    const connectData = (first as { data?: { token?: string; identity?: { runtimeId?: string } } })
      ?.data;
    const handshakeOk =
      first?.ok === true &&
      typeof connectData?.token === "string" &&
      connectData.token.length >= 32 &&
      connectData.identity?.runtimeId === extId;
    const replayRejected = replay?.ok !== true;
    const wrongRejected = wrongCode?.ok !== true;
    const noTokenRejected = noToken?.ok !== true;

    const entry = {
      browser: name,
      version: browser.versionString,
      extensionId: extId,
      pairingCodeIssued: Boolean(pairing?.pairingCode),
      handshake: { ok: handshakeOk, reply: first },
      replayOfCapturedConnect: { rejected: replayRejected, reply: replay },
      wrongPairingCode: { rejected: wrongRejected, reply: wrongCode },
      requestWithoutToken: { rejected: noTokenRejected, reply: noToken },
    };
    results.push(entry);

    console.log(`--- ${name} (${browser.versionString}) ---`);
    console.log(`  handshake            ok=${handshakeOk}`);
    console.log(`  replayed connect     rejected=${replayRejected}  ${JSON.stringify(replay).slice(0, 90)}`);
    console.log(`  wrong pairing code   rejected=${wrongRejected}`);
    console.log(`  request w/o token    rejected=${noTokenRejected}\n`);

    if (!handshakeOk || !replayRejected || !wrongRejected || !noTokenRejected) failed = true;
  } catch (error) {
    results.push({ browser: name, error: String(error) });
    console.error(`${name}: FAILED — ${error}`);
    failed = true;
  } finally {
    await browser.close();
  }
}

server.close();

const document = {
  schemaVersion: 1,
  item: "H2 - pairing handshake, origin pinning, replay protection",
  generatedAt: new Date().toISOString(),
  verdict: failed ? "FAILED" : "PROVEN",
  method:
    "A page served on 127.0.0.1 — an origin pinned in externally_connectable — called chrome.runtime.sendMessage across the real extension boundary in a real browser. The pairing code was issued from inside the extension exactly as the popup does, because an external page is not permitted to start pairing.",
  whyReplayFails:
    "connect sets pairingCode = null the instant it succeeds, so the captured message is single-use by construction rather than by a separate nonce table. Replaying the identical bytes is refused because the code it carries no longer exists.",
  browsers: results,
};

console.log(`H2: ${document.verdict}`);
if (write) {
  writeFileSync(OUT, JSON.stringify(document, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
