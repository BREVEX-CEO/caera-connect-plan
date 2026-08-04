/**
 * H3 evidence: real DOM control on a real public site, in Chrome and Edge.
 *
 * One ordinary public site with a simple form (Wikipedia search, a real HTML GET form). OCADE
 * fills a real field and submits a real form through the extension's own
 * `form.fill` / `form.submit` protocol, and the outcome is then read back
 * INDEPENDENTLY from the page — the resulting URL and the value actually
 * sitting in the DOM — rather than trusting the extension's own reply.
 *
 * The origin permission is granted with a real user activation
 * (Runtime.evaluate userGesture), because `chrome.permissions.request` requires
 * one. That is the same consent a user gives; it is not a way around the check.
 *
 * Usage: node --experimental-strip-types scripts/browser-h3-evidence.mts [--write]
 */
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { browserFor, EXTENSION_DIR } from "./browser-harness.mts";

const write = process.argv.includes("--write");
const OUT = "release/OCADE_H3_DOM_CONTROL.json";
const SITE = "https://en.wikipedia.org/wiki/Main_Page?useskin=monobook";
const ORIGIN = "https://en.wikipedia.org/*";
const QUERY = "Extensible Markup Language";
const CONTROL_PORT = 8793;

// OCADE-side control page, served from an origin the extension actually trusts.
const server = createServer((_q, r) => {
  r.writeHead(200, { "content-type": "text/html" });
  r.end("<!doctype html><html><body>OCADE control</body></html>");
});
await new Promise<void>((r) => server.listen(CONTROL_PORT, "127.0.0.1", () => r()));

const results: Record<string, unknown>[] = [];
let failed = false;

for (const [name, port] of [
  ["chrome", 9461],
  ["edge", 9462],
] as const) {
  const browser = browserFor(name, port);
  try {
    /*
     * HEADFUL on purpose.
     *
     * `chrome.permissions.request` needs a user activation AND a renderer that
     * can actually present the consent dialog. Under --headless=new the prompt
     * is auto-denied and the call returns false, so a headless run records a
     * permission failure that says nothing about the extension. Measured: the
     * identical call returns {granted:true} headful, and `permissions.contains`
     * flips false to true.
     */
    await browser.launch({ headless: false });
    const extId = String(await browser.installExtension(EXTENSION_DIR));
    if (!(await browser.extensionActive(extId)).active) throw new Error("extension not active");

    const popup = await browser.attachToPage(`chrome-extension://${extId}/popup.html`);
    await new Promise((r) => setTimeout(r, 1000));

    /*
     * Grant the site permission from the POPUP, with a real user activation,
     * and then VERIFY it landed.
     *
     * The request's return value alone was not reliable here — it came back
     * false in the full harness while the identical call succeeded in
     * isolation. `permissions.contains` is the authority: it reports what the
     * browser actually holds, rather than what the request believed happened.
     */
    let permissionGranted = false;
    for (let attempt = 0; attempt < 3 && !permissionGranted; attempt++) {
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

    /*
     * OCADE's OWN page drives; the extension acts on the target tab.
     *
     * A first version sent the control messages from the DuckDuckGo page itself
     * and every reply came back undefined. That was the extension being right:
     * `externally_connectable` pins to caeracadane.com, localhost and 127.0.0.1,
     * so an arbitrary site cannot message it at all. Origin pinning working, not
     * a bug — and a reminder that the controlling origin and the controlled page
     * are deliberately different things.
     */
    const control = await browser.attachToPage(`http://127.0.0.1:${CONTROL_PORT}/`);
    await new Promise((r) => setTimeout(r, 1200));

    const page = await browser.attachToPage(SITE);
    await new Promise((r) => setTimeout(r, 4500));

    // The extension needs the numeric id of the tab it should act on.
    const tabId = (await browser.evaluate(
      popup,
      `new Promise(res => chrome.tabs.query({}, ts => res((ts.find(t => (t.url||'').startsWith(${JSON.stringify(SITE)}))||{}).id ?? null)))`,
    )) as number | null;

    const send = (msg: Record<string, unknown>) =>
      browser.evaluate(
        control,
        `new Promise(res => chrome.runtime.sendMessage(${JSON.stringify(extId)}, ${JSON.stringify({ ...msg, tabId: tabId === null ? undefined : String(tabId) })}, r => res(r ?? {noReply:true})))`,
      ) as Promise<Record<string, unknown>>;

    /*
     * Pair LAST, immediately before use.
     *
     * A first ordering paired from the popup and only then opened two tabs and
     * waited for a real site to load. By the time `connect` arrived the reply
     * was "This page is not paired with the OCADE extension" — the MV3 service
     * worker had idled out and been restarted, and `pairingCode` and
     * `pairingToken` are module-level state that does not survive that. The
     * extension is right to drop them; the harness was wrong to assume they
     * would still be there minutes later.
     */
    const pairing = (await browser.evaluate(
      popup,
      `new Promise(res => chrome.runtime.sendMessage({kind:'pairing.begin'}, r => res(r ?? {})))`,
    )) as { pairingCode?: string };

    const connect = (await send({ v: 1, kind: "connect", pairingCode: pairing.pairingCode })) as {
      data?: { token?: string };
    };
    const token = connect?.data?.token;
    console.log(
      `  pairing code issued    : ${Boolean(pairing?.pairingCode)}  token: ${token ? "yes" : "NO — " + JSON.stringify(connect).slice(0, 80)}`,
    );

    const fill = await send({
      v: 1,
      kind: "form.fill",
      token,
      confirmed: true,
      url: SITE,
      /*
       * `name` is REQUIRED, and its absence was the whole H3 failure.
       *
       * fillApprovedFields rejects any field where `typeof field.name !==
       * "string"` with "A protected or malformed form field was refused." — the
       * same message it uses for a genuinely protected field. Sending
       * {target, value} with no name looked like a protected-field refusal for
       * two rounds of debugging. The name is also what the semantic-healing
       * path matches on when a selector goes stale, so it is not redundant.
       */
      fields: [{ name: "search", target: { selector: "input[name='search']" }, value: QUERY }],
    });

    // INDEPENDENT read: what is actually in the DOM now?
    const valueInDom = await browser.evaluate(
      page,
      `document.querySelector("input[name='search']")?.value ?? null`,
    );

    const submit = await send({
      v: 1,
      kind: "form.submit",
      token,
      confirmed: true,
      url: SITE,
      // Target the real submit BUTTON, not the text input. Submitting via the
      // input succeeded but never navigated: the requirement is a button click,
      // and on this form that is what actually triggers the GET.
      target: { selector: "input[type='submit']" },
    });
    await new Promise((r) => setTimeout(r, 6000));

    // INDEPENDENT read of the resulting page state.
    const afterUrl = (await browser.evaluate(page, `location.href`)) as string;
    const afterTitle = (await browser.evaluate(page, `document.title`)) as string;
    const navigated = typeof afterUrl === "string" && afterUrl !== SITE;
    // Wikipedia's search is a real HTML GET form, so a successful submit lands
    // on a URL that carries the query — unlike a JS single-page search box,
    // where `form.submit()` succeeds and the location never changes.
    const carriesQuery =
      typeof afterUrl === "string" && /search=|Extensible|Markup|\/XML/i.test(afterUrl);

    const entry = {
      browser: name,
      version: browser.versionString,
      site: SITE,
      permissionGranted,
      fillReply: fill,
      valueReadBackFromDom: valueInDom,
      fillVerifiedIndependently: valueInDom === QUERY,
      submitReply: submit,
      urlAfterSubmit: afterUrl,
      titleAfterSubmit: afterTitle,
      navigated,
      resultingUrlCarriesTheQuery: carriesQuery,
    };
    results.push(entry);

    console.log(`--- ${name} (${browser.versionString}) ---`);
    console.log(`  permission granted     : ${permissionGranted}`);
    console.log(`  fill ok                : ${fill?.ok}`);
    console.log(`  value read back in DOM : ${JSON.stringify(valueInDom)}`);
    console.log(`  submit ok              : ${submit?.ok}`);
    console.log(`  url after submit       : ${String(afterUrl).slice(0, 90)}`);
    console.log(`  navigated + has query  : ${navigated} / ${carriesQuery}\n`);

    if (!permissionGranted || fill?.ok !== true || valueInDom !== QUERY || !navigated) failed = true;
  } catch (error) {
    results.push({ browser: name, error: String(error) });
    console.error(`${name}: FAILED — ${error}`);
    failed = true;
  } finally {
    await browser.close();
  }
}

const document_ = {
  schemaVersion: 1,
  item: "H3 - real DOM control on a real public site, Chrome and Edge",
  generatedAt: new Date().toISOString(),
  site: SITE,
  verdict: failed ? "FAILED" : "PROVEN",
  method:
    "OCADE filled a real input and submitted a real form through its own form.fill / form.submit protocol. Every outcome was then read back independently from the page — the value sitting in the DOM, and the URL and title after submission — rather than trusting the extension's reply.",
  permissionNote:
    "chrome.permissions.request requires a user activation, so it was called with Runtime.evaluate userGesture. That supplies the same activation a real click does; it does not bypass the consent check, which still had to return true.",
  browsers: results,
};

server.close();
console.log(`H3: ${document_.verdict}`);
if (write) {
  writeFileSync(OUT, JSON.stringify(document_, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
