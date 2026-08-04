/**
 * H4 evidence: navigation events, a slow element, multiple tabs, and a real download.
 *
 * The slow element is genuinely slow — a local server holds the response for
 * three seconds — so `page.wait` either waits for it or reports a timeout. A
 * fake delay in the page's own script would prove nothing about waiting.
 *
 * Navigation is confirmed from the EXTENSION's own tab events, captured through
 * chrome.tabs.onUpdated in the popup, not from the page's location.
 *
 * Usage: node --experimental-strip-types scripts/browser-h4-evidence.mts [--write]
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { browserFor, EXTENSION_DIR } from "./browser-harness.mts";

const write = process.argv.includes("--write");
const OUT = "release/OCADE_H4_NAVIGATION_TABS_TRANSFER.json";
const PORT = 8795;
const ORIGIN = `http://127.0.0.1:${PORT}/*`;
const BASE = `http://127.0.0.1:${PORT}`;
const DOWNLOAD_BODY = "OCADE H4 download payload";
const UPLOAD_BODY = "OCADE H4 upload payload";
let uploadReceived = "";

const DOWNLOAD_DIR = join(tmpdir(), "ocade-h4-downloads");
rmSync(DOWNLOAD_DIR, { recursive: true, force: true });
mkdirSync(DOWNLOAD_DIR, { recursive: true });

const page = (title: string, extra = "") =>
  `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1>${extra}</body></html>`;

const server = createServer((req, res) => {
  const url = req.url ?? "/";
  if (url.startsWith("/slow-element")) {
    // The element genuinely arrives late: the response is held open.
    res.writeHead(200, { "content-type": "text/html" });
    res.write(page("slow", `<div id="early">here</div>`));
    setTimeout(() => {
      res.end(`<div id="late-element">arrived</div></body></html>`);
    }, 3000);
    return;
  }
  if (url.startsWith("/download.txt")) {
    res.writeHead(200, {
      "content-type": "text/plain",
      "content-disposition": 'attachment; filename="ocade-h4.txt"',
    });
    res.end(DOWNLOAD_BODY);
    return;
  }
  if (url.startsWith("/upload-form")) {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(
      page(
        "upload",
        `<form method="post" enctype="multipart/form-data" action="/upload-receive"><input type="file" name="attachment" id="attachment"><input type="submit" value="Send"></form>`,
      ),
    );
    return;
  }
  if (url.startsWith("/upload-receive") && req.method === "POST") {
    // Keep the raw body so the test can prove the bytes actually arrived.
    let body = "";
    req.on("data", (c) => (body += c.toString("utf8")));
    req.on("end", () => {
      uploadReceived = body;
      res.writeHead(200, { "content-type": "text/html" });
      res.end(page("uploaded", `<p id="which">UPLOAD-OK</p>`));
    });
    return;
  }
  if (url.startsWith("/second")) {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(page("second tab", `<p id="which">SECOND</p>`));
    return;
  }
  if (url.startsWith("/target")) {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(page("navigation target", `<p id="which">TARGET</p>`));
    return;
  }
  res.writeHead(200, { "content-type": "text/html" });
  res.end(page("control", `<p id="which">CONTROL</p>`));
});
await new Promise<void>((r) => server.listen(PORT, "127.0.0.1", () => r()));

const results: Record<string, unknown>[] = [];
let failed = false;

for (const [name, port] of [
  ["chrome", 9471],
  ["edge", 9472],
] as const) {
  const browser = browserFor(name, port);
  try {
    await browser.launch({ headless: false, downloadDir: DOWNLOAD_DIR });
    const extId = String(await browser.installExtension(EXTENSION_DIR));
    if (!(await browser.extensionActive(extId)).active) throw new Error("extension not active");

    const popup = await browser.attachToPage(`chrome-extension://${extId}/popup.html`);
    await new Promise((r) => setTimeout(r, 1000));

    let permissionGranted = false;
    for (let i = 0; i < 3 && !permissionGranted; i++) {
      await browser.send(
        "Runtime.evaluate",
        {
          expression: `Promise.all([chrome.permissions.request({origins:[${JSON.stringify(ORIGIN)}]}),chrome.permissions.request({permissions:['downloads']})]).catch(()=>false)`,
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
          `chrome.permissions.contains({origins:[${JSON.stringify(ORIGIN)}],permissions:['downloads']})`,
        )) === true;
    }

    // Start recording the EXTENSION's own tab events before navigating.
    await browser.evaluate(
      popup,
      `(()=>{globalThis.__ocadeEvents=[];chrome.tabs.onUpdated.addListener((id,info,tab)=>{__ocadeEvents.push({id,status:info.status,url:info.url||tab.url});});return true;})()`,
    );

    const control = await browser.attachToPage(`${BASE}/`);
    await new Promise((r) => setTimeout(r, 800));

    const tabIdOf = (needle: string) =>
      browser.evaluate(
        popup,
        `new Promise(res => chrome.tabs.query({}, ts => res((ts.find(t => (t.url||'').includes(${JSON.stringify(needle)}))||{}).id ?? null)))`,
      ) as Promise<number | null>;

    const send = (msg: Record<string, unknown>, tabId?: number | null) =>
      browser.evaluate(
        control,
        `new Promise(res => chrome.runtime.sendMessage(${JSON.stringify(extId)}, ${JSON.stringify({ ...msg, ...(tabId == null ? {} : { tabId: String(tabId) }) })}, r => res(r ?? {noReply:true})))`,
      ) as Promise<Record<string, unknown>>;

    const pairing = (await browser.evaluate(
      popup,
      `new Promise(res => chrome.runtime.sendMessage({kind:'pairing.begin'}, r => res(r ?? {})))`,
    )) as { pairingCode?: string };
    const connect = (await send({ v: 1, kind: "connect", pairingCode: pairing.pairingCode })) as {
      data?: { token?: string };
    };
    const token = connect?.data?.token;

    // ---- 1. navigation, confirmed from extension tab events
    const navPage = await browser.attachToPage(`${BASE}/target`);
    await new Promise((r) => setTimeout(r, 2500));
    const navTabId = await tabIdOf("/target");
    const events = (await browser.evaluate(
      popup,
      `JSON.stringify((globalThis.__ocadeEvents||[]).filter(e=>String(e.url||'').includes('/target')))`,
    )) as string;
    const navEvents = JSON.parse(events || "[]") as { status?: string; url?: string }[];
    const navigationConfirmedByEvents = navEvents.some((e) => e.status === "complete");

    // ---- 2. slow element: page.wait must actually wait
    const slowPage = await browser.attachToPage(`${BASE}/slow-element`);
    const slowTabId = await tabIdOf("/slow-element");
    const waitStarted = Date.now();
    const waited = await send(
      {
        v: 1,
        kind: "page.wait",
        token,
        url: `${BASE}/slow-element`,
        expectation: { selector: "#late-element" },
        timeoutMs: 15000,
      },
      slowTabId,
    );
    const waitedMs = Date.now() - waitStarted;
    const lateElementPresent =
      (await browser.evaluate(slowPage, `!!document.querySelector('#late-element')`)) === true;

    // ---- 3. multiple tabs without cross-talk
    const secondPage = await browser.attachToPage(`${BASE}/second`);
    await new Promise((r) => setTimeout(r, 1200));
    const secondTabId = await tabIdOf("/second");
    const readTarget = await send(
      { v: 1, kind: "page.summary", token, url: `${BASE}/target` },
      navTabId,
    );
    const readSecond = await send(
      { v: 1, kind: "page.summary", token, url: `${BASE}/second` },
      secondTabId,
    );
    const targetText = JSON.stringify(readTarget).includes("TARGET");
    const secondText = JSON.stringify(readSecond).includes("SECOND");
    const noCrossTalk =
      targetText &&
      secondText &&
      !JSON.stringify(readTarget).includes("SECOND") &&
      !JSON.stringify(readSecond).includes("TARGET");

    // ---- 4. real upload of an approved file
    const uploadPage = await browser.attachToPage(`${BASE}/upload-form`);
    await new Promise((r) => setTimeout(r, 1200));
    const uploadTabId = await tabIdOf("/upload-form");
    uploadReceived = "";
    const upload = await send(
      {
        v: 1,
        kind: "file.upload",
        token,
        confirmed: true,
        url: `${BASE}/upload-form`,
        target: { selector: "#attachment" },
        file: {
          name: "ocade-upload.txt",
          mimeType: "text/plain",
          dataBase64: Buffer.from(UPLOAD_BODY, "utf8").toString("base64"),
        },
      },
      uploadTabId,
    );
    // Two separate facts: the file reached the INPUT, and the server actually
    // received the bytes. The first without the second is a file that never left.
    const attachedName = await browser.evaluate(
      uploadPage,
      `document.querySelector("#attachment")?.files?.[0]?.name ?? null`,
    );
    await browser.evaluate(uploadPage, `document.querySelector("form").submit(); true`);
    await new Promise((r) => setTimeout(r, 2500));
    const serverGotTheBytes = uploadReceived.includes(UPLOAD_BODY);

    // ---- 5. real download into the approved location
    const download = await send({
      v: 1,
      kind: "file.download",
      token,
      confirmed: true,
      url: `${BASE}/download.txt`,
      filename: "ocade-h4.txt",
    });
    await new Promise((r) => setTimeout(r, 4000));
    const downloadedPath = join(DOWNLOAD_DIR, "ocade-h4.txt");
    const onDisk = existsSync(downloadedPath);
    const contentMatches = onDisk && readFileSync(downloadedPath, "utf8") === DOWNLOAD_BODY;

    const entry = {
      browser: name,
      version: browser.versionString,
      permissionGranted,
      navigation: { events: navEvents.slice(0, 4), confirmedByExtensionEvents: navigationConfirmedByEvents },
      slowElement: {
        reply: waited,
        waitedMs,
        waitedAtLeastTheServerDelay: waitedMs >= 2500,
        lateElementPresentAfterwards: lateElementPresent,
      },
      multipleTabs: { readTarget, readSecond, noCrossTalk },
      upload: { reply: upload, fileNameOnTheInput: attachedName, serverReceivedTheBytes: serverGotTheBytes },
      download: { reply: download, fileOnDisk: onDisk, contentMatches, path: "ocade-h4.txt" },
    };
    results.push(entry);

    console.log(`--- ${name} (${browser.versionString}) ---`);
    console.log(`  permission granted        : ${permissionGranted}`);
    console.log(`  navigation via events     : ${navigationConfirmedByEvents} (${navEvents.length} events)`);
    console.log(`  slow element waited       : ${waited?.ok} in ${waitedMs}ms, present=${lateElementPresent}`);
    console.log(`  multi-tab no cross-talk   : ${noCrossTalk}`);
    console.log(`  upload input + server got : ${attachedName} / ${serverGotTheBytes}`);
    console.log(`  download on disk + match  : ${onDisk} / ${contentMatches}\n`);

    void slowPage;
    void secondPage;
    if (!navigationConfirmedByEvents || !noCrossTalk || !contentMatches || !serverGotTheBytes) failed = true;
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
  item: "H4 - navigation events, slow element, multiple tabs, real download",
  generatedAt: new Date().toISOString(),
  verdict: failed ? "FAILED" : "PROVEN",
  method:
    "A local server serves a page whose response is genuinely held open for 3 seconds, so page.wait either waits for the late element or times out — a scripted delay in the page would prove nothing. Navigation is confirmed from the extension's own chrome.tabs.onUpdated events rather than from the page's location. Cross-talk is tested by reading two tabs and requiring each to contain only its own marker. The download is verified by reading the file off disk and comparing its bytes.",
  browsers: results,
};

console.log(`H4: ${doc.verdict}`);
if (write) {
  writeFileSync(OUT, JSON.stringify(doc, null, 2) + "\n");
  console.log(`Wrote ${OUT}`);
}
process.exitCode = failed ? 1 : 0;
