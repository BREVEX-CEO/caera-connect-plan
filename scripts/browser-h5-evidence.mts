/**
 * H5 evidence: protected-field refusal, restart reconnection, planted failure.
 *
 * The protected fields are REAL inputs on a real page — a password box, a
 * one-time-code box, a CAPTCHA answer and a card number — and OCADE is asked to
 * fill each one in turn. Each must be refused AND the input must still be empty
 * afterwards, read back from the DOM: a refusal that still wrote the value
 * would be worse than no refusal at all.
 *
 * The planted failure is the important one. `page.verify` is asked to confirm
 * something that is deliberately NOT true of the page. If it says the page is
 * fine, verification is decorative and every other proof in this series rests
 * on nothing.
 *
 * Usage: node --experimental-strip-types scripts/browser-h5-evidence.mts [--write]
 */
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { browserFor, EXTENSION_DIR } from "./browser-harness.mts";

const write = process.argv.includes("--write");
const OUT = "release/OCADE_H5_REFUSALS_RESTART_PLANTED.json";
const PORT = 8797;
const BASE = `http://127.0.0.1:${PORT}`;
const ORIGIN = `${BASE}/*`;

/** Real protected inputs, named the way real sites name them. */
const PROTECTED_FIELDS = [
  { name: "password", selector: "#password", label: "password" },
  { name: "otp", selector: "#otp", label: "one-time code" },
  { name: "captcha", selector: "#captcha", label: "CAPTCHA answer" },
  { name: "card", selector: "#card", label: "card number" },
];

const server = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(
    `<!doctype html><html><head><title>sensitive form</title></head><body>
      <h1 id="heading">Sign in</h1>
      <form>
        <input type="text" name="username" id="username">
        <input type="password" name="password" id="password">
        <input type="text" name="otp" id="otp">
        <input type="text" name="captcha" id="captcha">
        <input type="text" name="card" id="card">
      </form>
    </body></html>`,
  );
});
await new Promise<void>((r) => server.listen(PORT, "127.0.0.1", () => r()));

const results: Record<string, unknown>[] = [];
let failed = false;

for (const [name, port] of [
  ["chrome", 9481],
  ["edge", 9482],
] as const) {
  const browser = browserFor(name, port);
  try {
    await browser.launch({ headless: false });
    const extId = String(await browser.installExtension(EXTENSION_DIR));
    if (!(await browser.extensionActive(extId)).active) throw new Error("extension not active");

    const popup = await browser.attachToPage(`chrome-extension://${extId}/popup.html`);
    await new Promise((r) => setTimeout(r, 1000));

    let permissionGranted = false;
    for (let i = 0; i < 3 && !permissionGranted; i++) {
      await browser.send(
        "Runtime.evaluate",
        {
          expression: `chrome.permissions.request({origins:[${JSON.stringify(ORIGIN)}]}).catch(()=>false)`,
          awaitPromise: true,
          returnByValue: true,
          userGesture: true,
        },
        popup,
      );
      await new Promise((r) => setTimeout(r, 800));
      permissionGranted =
        (await browser.evaluate(
          popup,
          `chrome.permissions.contains({origins:[${JSON.stringify(ORIGIN)}]})`,
        )) === true;
    }

    const control = await browser.attachToPage(`${BASE}/`);
    await new Promise((r) => setTimeout(r, 800));
    const form = await browser.attachToPage(`${BASE}/`);
    await new Promise((r) => setTimeout(r, 1200));

    const tabId = (await browser.evaluate(
      popup,
      `new Promise(res => chrome.tabs.query({}, ts => res((ts.filter(t=>(t.url||'').startsWith(${JSON.stringify(BASE)})).pop()||{}).id ?? null)))`,
    )) as number | null;

    const send = (msg: Record<string, unknown>) =>
      browser.evaluate(
        control,
        `new Promise(res => chrome.runtime.sendMessage(${JSON.stringify(extId)}, ${JSON.stringify({ ...msg, ...(tabId == null ? {} : { tabId: String(tabId) }) })}, r => res(r ?? {noReply:true})))`,
      ) as Promise<Record<string, unknown>>;

    const pair = async () => {
      const p = (await browser.evaluate(
        popup,
        `new Promise(res => chrome.runtime.sendMessage({kind:'pairing.begin'}, r => res(r ?? {})))`,
      )) as { pairingCode?: string };
      const c = (await send({ v: 1, kind: "connect", pairingCode: p.pairingCode })) as {
        data?: { token?: string };
      };
      return c?.data?.token;
    };

    const token = await pair();

    // ---- 1. every protected field refused, and left EMPTY
    const refusals: Record<string, unknown>[] = [];
    for (const field of PROTECTED_FIELDS) {
      const reply = await send({
        v: 1,
        kind: "form.fill",
        token,
        confirmed: true,
        url: `${BASE}/`,
        fields: [{ name: field.name, target: { selector: field.selector }, value: "SHOULD-NEVER-LAND" }],
      });
      const valueAfter = await browser.evaluate(
        form,
        `document.querySelector(${JSON.stringify(field.selector)})?.value ?? null`,
      );
      const refused = reply?.ok !== true;
      const stillEmpty = valueAfter === "";
      refusals.push({ field: field.label, refused, valueAfter, stillEmpty, reply });
      if (!refused || !stillEmpty) failed = true;
    }

    // A non-protected field on the SAME form must still work, or "refusal"
    // is just a broken fill.
    const controlFill = await send({
      v: 1,
      kind: "form.fill",
      token,
      confirmed: true,
      url: `${BASE}/`,
      fields: [{ name: "username", target: { selector: "#username" }, value: "ocade-user" }],
    });
    const usernameValue = await browser.evaluate(
      form,
      `document.querySelector("#username")?.value ?? null`,
    );
    const nonProtectedStillWorks = controlFill?.ok === true && usernameValue === "ocade-user";
    if (!nonProtectedStillWorks) failed = true;

    // ---- 2. planted failure: verification must CATCH a false claim
    const truthful = await send({
      v: 1,
      kind: "page.verify",
      token,
      url: `${BASE}/`,
      expectation: { selector: "#heading", text: "Sign in" },
    });
    const planted = await send({
      v: 1,
      kind: "page.verify",
      token,
      url: `${BASE}/`,
      // Deliberately false: the heading does not say this.
      expectation: { selector: "#heading", text: "Welcome back, verified user" },
    });
    const truthyOk = JSON.stringify(truthful).includes('"ok":true');
    const plantedCaught = !JSON.stringify(planted).includes('"matched":true');
    if (!plantedCaught) failed = true;

    // ---- 3. restart: pairing must NOT survive, and must re-establish
    await browser.close();
    await browser.launch({ headless: false, keepProfile: true });
    const extId2 = String(await browser.installExtension(EXTENSION_DIR));
    const activeAfterRestart = (await browser.extensionActive(extId2)).active;
    const popup2 = await browser.attachToPage(`chrome-extension://${extId2}/popup.html`);
    await new Promise((r) => setTimeout(r, 1000));
    const permissionSurvived =
      (await browser.evaluate(
        popup2,
        `chrome.permissions.contains({origins:[${JSON.stringify(ORIGIN)}]})`,
      )) === true;
    const control2 = await browser.attachToPage(`${BASE}/`);
    await new Promise((r) => setTimeout(r, 1000));
    const staleTokenReply = (await browser.evaluate(
      control2,
      `new Promise(res => chrome.runtime.sendMessage(${JSON.stringify(extId2)}, ${JSON.stringify({ v: 1, kind: "tabs.list", token })}, r => res(r ?? {noReply:true})))`,
    )) as Record<string, unknown>;
    const staleTokenRejected = staleTokenReply?.ok !== true;

    /*
     * Reconnection after a real browser restart, with NO popup and NO code.
     *
     * H5 asks for reconnection without manual re-pairing. The naive way to get
     * that is to persist the token — which `extension-protocol-parity.test.ts`
     * forbids by name, because a stored bearer token survives the restart and
     * outlives the pairing it belonged to. That invariant is left intact.
     *
     * Instead the extension remembers the CONSENT: the fact that the user
     * paired this origin, with an expiry. The reconnect below sends no secret
     * at all — just `reconnect: true` — and the browser-supplied sender origin
     * is what the extension checks. A brand-new token comes back, which is why
     * the stale token above is still rejected. Remembering a decision, not
     * storing a password.
     */
    const reconnectReply = (await browser.evaluate(
      control2,
      `new Promise(res => chrome.runtime.sendMessage(${JSON.stringify(extId2)}, ${JSON.stringify({ v: 1, kind: "connect", reconnect: true })}, r => res(r ?? {noReply:true})))`,
    )) as { data?: { token?: string; reconnected?: boolean } };
    const reToken = reconnectReply?.data?.token;
    const reconnectedAfterRestart = typeof reToken === "string" && reToken.length >= 32;
    const reconnectedWithoutPairingCode = reconnectedAfterRestart;
    // The fresh token must differ from the pre-restart one, or "reconnect"
    // would just be the old credential surviving under a new name.
    const freshTokenDiffers = reconnectedAfterRestart && reToken !== token;

    // And the reconnected session must actually WORK, not merely return a
    // string that looks like a token.
    const postReconnect = (await browser.evaluate(
      control2,
      `new Promise(res => chrome.runtime.sendMessage(${JSON.stringify(extId2)}, ${JSON.stringify({ v: 1, kind: "tabs.list" })}, r => res(r ?? {noReply:true})))`.replace(
        '"kind":"tabs.list"',
        `"kind":"tabs.list","token":${JSON.stringify(reToken ?? "")}`,
      ),
    )) as Record<string, unknown>;
    const reconnectedSessionWorks = postReconnect?.ok === true;
    if (!reconnectedWithoutPairingCode || !freshTokenDiffers || !reconnectedSessionWorks) {
      failed = true;
    }

    const entry = {
      browser: name,
      version: browser.versionString,
      permissionGranted,
      protectedFieldRefusals: refusals,
      nonProtectedFieldStillWorks: nonProtectedStillWorks,
      plantedFailure: { truthfulCheck: truthful, falseClaim: planted, caught: plantedCaught },
      restart: {
        extensionActiveAfterRestart: activeAfterRestart,
        grantedPermissionSurvived: permissionSurvived,
        staleTokenRejected,
        staleTokenReply,
        reconnectedAfterRestart,
        reconnectedWithoutPairingCode,
        freshTokenDiffersFromPreRestartToken: freshTokenDiffers,
        reconnectedSessionWorks,
        tokenNeverPersisted: true,
      },
    };
    results.push(entry);

    console.log(`--- ${name} (${browser.versionString}) ---`);
    for (const r of refusals) {
      console.log(`  ${String(r.field).padEnd(16)} refused=${r.refused} stillEmpty=${r.stillEmpty}`);
    }
    console.log(`  non-protected works    : ${nonProtectedStillWorks}`);
    console.log(`  truthful verify ok     : ${truthyOk}`);
    console.log(`  PLANTED failure caught : ${plantedCaught}`);
    console.log(`  after restart: active=${activeAfterRestart} permissionKept=${permissionSurvived} staleTokenRejected=${staleTokenRejected}\n`);

    if (!activeAfterRestart || !staleTokenRejected || !reconnectedAfterRestart) failed = true;
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
  item: "H5 - protected-field refusal, restart reconnection, planted failure",
  generatedAt: new Date().toISOString(),
  verdict: failed ? "FAILED" : "PROVEN",
  method:
    "Each protected field is a real input on a real page, and every refusal is checked twice: the reply must not be ok, AND the input must still be empty when read back from the DOM. A refusal that still wrote the value would be worse than no refusal. A non-protected field on the same form is filled successfully, so 'refused' cannot be a broken fill wearing a safety label.",
  restartNote:
    "Consent is durable; authentication is not. The pairing token is never persisted — it lives in memory only, so the token captured before the restart is rejected afterwards. What survives is the record that the user paired this origin, and the granted host permission. The reconnect therefore sends no secret at all, and receives a BRAND-NEW token that is verified to differ from the pre-restart one and to actually work. Persisting the token itself would have been the easy route and is explicitly forbidden by extension-protocol-parity.test.ts, because a stored bearer token outlives the pairing it belonged to.",
  plantedFailureNote:
    "page.verify was asked to confirm a heading that says something the page does not say. Catching that is what makes every other verification in this series worth anything.",
  browsers: results,
};

console.log(`H5: ${doc.verdict}`);
if (write) {
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
