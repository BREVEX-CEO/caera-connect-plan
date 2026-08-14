#!/usr/bin/env node
/** Real Chrome + Edge parity check for the extensionless OCADE browser host. */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

const hostPath = resolve("native/browser-host/index.mjs");

function startFixture() {
  const server = createServer((request, response) => {
    if (request.url === "/download") {
      response.writeHead(200, {
        "content-type": "text/plain",
        "content-disposition": 'attachment; filename="ocade-parity.txt"',
      });
      response.end("verified extensionless download");
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><html><head><title>OCADE CDP parity</title></head><body>
      <label>Name <input id="name" name="display-name"></label>
      <label>Password <input id="password" name="password" type="password"></label>
      <label>Upload <input id="upload" type="file"></label>
      <button id="change" onclick="document.querySelector('#status').textContent='Changed safely'">Change</button>
      <a id="download" href="/download">Download</a>
      <div id="status">Ready</div>
    </body></html>`);
  });
  return new Promise((resolveStart, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        return reject(new Error("Fixture did not bind."));
      resolveStart({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

function startHost() {
  const child = spawn(process.execPath, [hostPath], { stdio: ["pipe", "pipe", "pipe"] });
  const pending = new Map();
  let sequence = 0;
  const stderr = [];
  child.stderr.on("data", (chunk) => stderr.push(String(chunk)));
  createInterface({ input: child.stdout, crlfDelay: Infinity }).on("line", (line) => {
    const response = JSON.parse(line);
    const waiter = pending.get(response.id);
    if (!waiter) return;
    pending.delete(response.id);
    waiter.resolve(response);
  });
  child.once("exit", (code) => {
    for (const waiter of pending.values()) {
      waiter.reject(new Error(`Browser host exited ${code}: ${stderr.join("")}`));
    }
    pending.clear();
  });
  const raw = (request) =>
    new Promise((resolveCall, reject) => {
      const id = `parity-${++sequence}`;
      pending.set(id, { resolve: resolveCall, reject });
      child.stdin.write(`${JSON.stringify({ id, version: 1, ...request })}\n`);
    });
  return {
    child,
    raw,
    call: async (request) => {
      const response = await raw(request);
      if (!response.ok) throw new Error(response.error);
      return response.data;
    },
  };
}

async function runBrowser(browser, origin, tempRoot) {
  const host = startHost();
  const sessionId = `parity-${browser}`;
  const profile = join(tempRoot, `${browser}-profile`);
  const downloads = join(tempRoot, `${browser}-downloads`);
  const upload = join(tempRoot, `${browser}-upload.txt`);
  await writeFile(upload, `verified ${browser} upload`, "utf8");
  try {
    const launched = await host.call({
      command: "launch",
      sessionId,
      browser,
      headless: true,
      userDataDir: profile,
      explicitProfileApproval: true,
    });
    if (!launched.connected || launched.browser !== browser)
      throw new Error(`${browser} did not connect.`);
    const common = { sessionId, approvedOrigins: [origin] };
    const navigated = await host.call({
      command: "perform",
      runId: `${browser}-navigate`,
      ...common,
      action: { kind: "navigate", url: origin },
      expectation: { titleContains: "OCADE CDP parity", selector: "#status" },
    });
    if (!navigated.observation.verified) throw new Error(`${browser} navigation was not verified.`);
    await host.call({
      command: "perform",
      runId: `${browser}-type`,
      ...common,
      action: { kind: "type", target: { selector: "#name" }, value: "OCADE" },
      expectation: { selector: "#name" },
    });
    const protectedAttempt = await host.raw({
      version: 1,
      command: "perform",
      runId: `${browser}-protected`,
      ...common,
      action: { kind: "type", target: { selector: "#password" }, value: "must-not-type" },
    });
    /*
     * Asserted on the STRUCTURED refusal, not on the sentence.
     *
     * This used to match /Protected fields/ against the error prose, which
     * made the wording of a user-facing message load-bearing: improving the
     * sentence broke the gate, and the gate could not tell a refusal apart
     * from any other failure that happened to contain the phrase. The host now
     * carries `code: "blocked"` and a `handover` reason, so the contract is
     * checkable directly and the sentence is free to be good English.
     */
    if (
      protectedAttempt.ok ||
      protectedAttempt.code !== "blocked" ||
      protectedAttempt.handover?.what !== "protected_field"
    ) {
      throw new Error(
        `${browser} did not refuse a protected field with a hand-over ` +
          `(ok=${protectedAttempt.ok}, code=${protectedAttempt.code}, ` +
          `handover=${JSON.stringify(protectedAttempt.handover)}).`,
      );
    }
    const clicked = await host.call({
      command: "perform",
      runId: `${browser}-click`,
      ...common,
      action: { kind: "click", target: { selector: "#change" } },
      expectation: { text: "Changed safely" },
    });
    if (!clicked.observation.verified)
      throw new Error(`${browser} click was not independently observed.`);
    const read = await host.call({
      command: "perform",
      runId: `${browser}-read`,
      ...common,
      action: { kind: "page.read" },
    });
    if (
      !read.output.text.includes("Changed safely") ||
      !read.output.fields.some((field) => field.protected)
    ) {
      throw new Error(`${browser} DOM reading or protected-field classification failed.`);
    }
    await host.call({
      command: "perform",
      runId: `${browser}-upload`,
      ...common,
      approvedFileRoots: [tempRoot],
      action: { kind: "upload", path: upload, target: { selector: "#upload" } },
      expectation: { selector: "#upload" },
    });
    const downloaded = await host.call({
      command: "perform",
      runId: `${browser}-download`,
      ...common,
      allowDownloads: true,
      downloadRoot: downloads,
      action: { kind: "download", target: { selector: "#download" } },
    });
    const downloadedText = await readFile(downloaded.output.path, "utf8");
    if (downloadedText !== "verified extensionless download")
      throw new Error(`${browser} download bytes differ.`);
    const tab = await host.call({
      command: "perform",
      runId: `${browser}-tab-new`,
      ...common,
      action: { kind: "tab.new" },
    });
    if (!tab.observation.verified) throw new Error(`${browser} could not create a tab.`);
    const tabs = await host.call({
      command: "perform",
      runId: `${browser}-tabs`,
      ...common,
      action: { kind: "tab.list" },
    });
    if (tabs.output.length < 2) throw new Error(`${browser} did not retain both tabs.`);
    const cancelStarted = Date.now();
    const pendingWait = host.raw({
      version: 1,
      command: "perform",
      runId: `${browser}-cancel-me`,
      ...common,
      action: { kind: "wait", target: { selector: "#never-appears" }, timeoutMs: 30_000 },
    });
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    const cancelled = await host.call({ command: "cancel", runId: `${browser}-cancel-me` });
    const cancelledRun = await pendingWait;
    if (!cancelled.acknowledged || cancelledRun.ok || Date.now() - cancelStarted > 5_000) {
      throw new Error(`${browser} cancellation did not interrupt the in-flight Playwright call.`);
    }
    const afterCancel = await host.call({ command: "status", sessionId });
    if (afterCancel.connected !== false)
      throw new Error(`${browser} cancellation left its managed session connected.`);
    await host.call({
      command: "launch",
      sessionId,
      browser,
      headless: true,
      userDataDir: profile,
      explicitProfileApproval: true,
    });
    await host.call({ command: "emergency_stop" });
    const status = await host.call({ command: "status", sessionId });
    if (status.connected !== false)
      throw new Error(`${browser} emergency stop left a session connected.`);
    return {
      browser,
      protectedFieldRefused: true,
      verifiedDomAction: true,
      upload: true,
      download: true,
      tabs: true,
      immediateCancel: true,
      emergencyStop: true,
    };
  } finally {
    host.child.kill();
  }
}

const fixture = await startFixture();
const tempRoot = await mkdtemp(join(tmpdir(), "ocade-cdp-parity-"));
try {
  const results = [];
  for (const browser of ["chrome", "edge"])
    results.push(await runBrowser(browser, fixture.origin, tempRoot));
  process.stdout.write(
    `${JSON.stringify({ ok: true, architecture: "playwright-cdp-no-extension", results }, null, 2)}\n`,
  );
} finally {
  await new Promise((resolveClose) => fixture.server.close(resolveClose));
  if (!tempRoot.startsWith(join(tmpdir(), "ocade-cdp-parity-"))) {
    throw new Error("Refusing to remove a directory outside the parity-test temp scope.");
  }
  await rm(tempRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
}
