/**
 * H5 negative evidence: the reconnect path must be a memory, not a backdoor.
 *
 * `connect {reconnect:true}` lets a previously paired origin get a fresh token
 * without re-reading a popup code. That is only defensible if it is refused
 * everywhere consent is absent, so this proves the three ways it must fail:
 *
 *   1. NEVER PAIRED — a clean profile. If this succeeded, the pairing code
 *      would be decorative and any pinned origin could grant itself control.
 *   2. AFTER EMERGENCY STOP — stop must mean stop. If consent survived it, the
 *      page could reconnect its way straight back in after the user hit the
 *      brake.
 *   3. AFTER EXPIRY — the record carries a TTL, and a stale one must not open
 *      the door. Tested by writing an already-expired record directly.
 *
 * Each refusal is checked as "not ok AND no token", because a reply that said
 * no while still handing back a token would be the worst of both.
 *
 * Usage: node --experimental-strip-types scripts/browser-h5-reconnect-negative.mts [--write]
 */
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { browserFor, EXTENSION_DIR } from "./browser-harness.mts";

const write = process.argv.includes("--write");
const OUT = "release/OCADE_H5_RECONNECT_NEGATIVE.json";
const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;

const server = createServer((_q, r) => {
  r.writeHead(200, { "content-type": "text/html" });
  r.end("<!doctype html><html><body>OCADE control</body></html>");
});
await new Promise<void>((r) => server.listen(PORT, "127.0.0.1", () => r()));

const results: Record<string, unknown>[] = [];
let failed = false;

for (const [name, port] of [
  ["chrome", 9491],
  ["edge", 9492],
] as const) {
  const browser = browserFor(name, port);
  try {
    // Fresh profile on purpose: no prior pairing exists anywhere.
    await browser.launch({ headless: false });
    const extId = String(await browser.installExtension(EXTENSION_DIR));
    if (!(await browser.extensionActive(extId)).active) throw new Error("extension not active");

    const popup = await browser.attachToPage(`chrome-extension://${extId}/popup.html`);
    await new Promise((r) => setTimeout(r, 1000));
    const control = await browser.attachToPage(`${BASE}/`);
    await new Promise((r) => setTimeout(r, 1000));

    const send = (msg: Record<string, unknown>) =>
      browser.evaluate(
        control,
        `new Promise(res => chrome.runtime.sendMessage(${JSON.stringify(extId)}, ${JSON.stringify(msg)}, r => res(r ?? {noReply:true})))`,
      ) as Promise<Record<string, unknown>>;

    const reconnect = () => send({ v: 1, kind: "connect", reconnect: true });
    const tokenOf = (r: Record<string, unknown>) =>
      (r?.data as { token?: string } | undefined)?.token ?? null;

    // ---- 1. never paired
    const neverPaired = await reconnect();
    const neverPairedRefused = neverPaired?.ok !== true && tokenOf(neverPaired) === null;
    if (!neverPairedRefused) failed = true;

    // Pair for real, so the following cases start from genuine consent.
    const p = (await browser.evaluate(
      popup,
      `new Promise(res => chrome.runtime.sendMessage({kind:'pairing.begin'}, r => res(r ?? {})))`,
    )) as { pairingCode?: string };
    const paired = await send({ v: 1, kind: "connect", pairingCode: p.pairingCode });
    const token = tokenOf(paired);
    if (!token) throw new Error("could not establish the baseline pairing");

    // Sanity: with consent present, reconnect DOES work — otherwise the
    // refusals below would prove nothing but a broken code path.
    const afterConsent = await reconnect();
    const reconnectWorksWithConsent = afterConsent?.ok === true && tokenOf(afterConsent) !== null;
    if (!reconnectWorksWithConsent) failed = true;

    // ---- 2. emergency stop revokes consent
    await send({ v: 1, kind: "emergency.stop", token: tokenOf(afterConsent) });
    const afterStop = await reconnect();
    const refusedAfterStop = afterStop?.ok !== true && tokenOf(afterStop) === null;
    if (!refusedAfterStop) failed = true;

    // ---- 3. expired consent
    const p2 = (await browser.evaluate(
      popup,
      `new Promise(res => chrome.runtime.sendMessage({kind:'pairing.begin'}, r => res(r ?? {})))`,
    )) as { pairingCode?: string };
    await send({ v: 1, kind: "connect", pairingCode: p2.pairingCode });
    // Age the stored record past its TTL, from the extension's own context.
    await browser.evaluate(
      popup,
      `new Promise(res => chrome.storage.local.get("ocade.pairedOrigins", s => {
         const rec = s["ocade.pairedOrigins"] || {};
         for (const k of Object.keys(rec)) rec[k] = {pairedAt: 1, expiresAt: 1};
         chrome.storage.local.set({"ocade.pairedOrigins": rec}, () => res(true));
       }))`,
    );
    const afterExpiry = await reconnect();
    const refusedAfterExpiry = afterExpiry?.ok !== true && tokenOf(afterExpiry) === null;
    if (!refusedAfterExpiry) failed = true;

    results.push({
      browser: name,
      version: browser.versionString,
      neverPaired: { refused: neverPairedRefused, reply: neverPaired },
      reconnectWorksWithConsent,
      afterEmergencyStop: { refused: refusedAfterStop, reply: afterStop },
      afterExpiry: { refused: refusedAfterExpiry, reply: afterExpiry },
    });

    console.log(`--- ${name} (${browser.versionString}) ---`);
    console.log(`  never paired      refused : ${neverPairedRefused}`);
    console.log(`  with consent      works   : ${reconnectWorksWithConsent}`);
    console.log(`  after e-stop      refused : ${refusedAfterStop}`);
    console.log(`  after expiry      refused : ${refusedAfterExpiry}\n`);
  } catch (error) {
    results.push({ browser: name, error: String(error) });
    console.error(`${name}: FAILED — ${error}`);
    failed = true;
  } finally {
    await browser.close();
  }
}

server.close();

const doc = {
  schemaVersion: 1,
  item: "H5 - reconnect refuses without live consent",
  generatedAt: new Date().toISOString(),
  verdict: failed ? "FAILED" : "PROVEN",
  method:
    "The reconnect path is exercised in three states where it must fail — never paired, after emergency stop, and after the consent record expired — and once in the state where it must succeed. Each refusal requires both a non-ok reply AND no token in it. The positive case is included so the refusals cannot be a dead code path passing by accident.",
  whyThisExists:
    "Reconnection without a popup code is only safe if consent is genuinely required. Without these four checks, 'remembers the pairing' and 'lets any pinned origin in' look identical from the outside.",
  browsers: results,
};

console.log(`H5 reconnect negative: ${doc.verdict}`);
if (write) {
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
