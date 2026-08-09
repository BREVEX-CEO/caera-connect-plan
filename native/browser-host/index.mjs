#!/usr/bin/env node
/**
 * OCADE managed-browser host.
 *
 * A supervised, local-only Playwright/CDP process for Chrome and Edge. The
 * host accepts newline-delimited JSON on stdin and emits one bounded response
 * per request on stdout. It never opens a network listener, never loads an
 * extension, and never accepts an unrestricted JavaScript expression.
 */
import { createHash } from "node:crypto";
import { access, mkdir, realpath } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { homedir, platform } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { chromium } from "playwright-core";

const PROTOCOL_VERSION = 1;
const MAX_TEXT = 20_000;
const MAX_REQUEST_BYTES = 256 * 1024;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,199}$/i;
const PROTECTED_FIELD =
  /(password|passcode|passphrase|otp|one[-_ ]?time|verification|captcha|cvv|cvc|card|iban|routing|pin|biometric|secret|token|private[-_ ]?key)/i;
const PROTECTED_VALUE = /\b\d{4,}\b|password|passcode|otp|cvv|private key|seed phrase/i;

const sessions = new Map();
const activeRuns = new Map();

function browserPaths(kind) {
  if (platform() === "win32") {
    return kind === "edge"
      ? [
          join(
            process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)",
            "Microsoft/Edge/Application/msedge.exe",
          ),
          join(
            process.env.PROGRAMFILES || "C:\\Program Files",
            "Microsoft/Edge/Application/msedge.exe",
          ),
        ]
      : [
          join(
            process.env.PROGRAMFILES || "C:\\Program Files",
            "Google/Chrome/Application/chrome.exe",
          ),
          join(
            process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)",
            "Google/Chrome/Application/chrome.exe",
          ),
        ];
  }
  if (platform() === "darwin") {
    return kind === "edge"
      ? ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
      : ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  }
  return kind === "edge"
    ? ["/usr/bin/microsoft-edge", "/usr/bin/microsoft-edge-stable"]
    : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"];
}

async function detectBrowser(kind) {
  for (const candidate of browserPaths(kind)) {
    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // Keep looking.
    }
  }
  return null;
}

function managedRoot() {
  const base =
    process.env.LOCALAPPDATA || process.env.XDG_DATA_HOME || join(homedir(), ".local/share");
  return resolve(base, "OCADE", "browser-profiles");
}

function isInside(candidate, root) {
  const delta = relative(resolve(root), resolve(candidate));
  return delta === "" || (!delta.startsWith("..") && !isAbsolute(delta));
}

function parseOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function requireAllowedOrigin(url, origins) {
  const origin = parseOrigin(url);
  if (!origin || !Array.isArray(origins) || !origins.includes(origin)) {
    throw new Error(`Origin is not approved for this session: ${origin || "invalid URL"}`);
  }
}

function requireLocalEndpoint(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (!new Set(["127.0.0.1", "localhost", "::1", "[::1]"]).has(host)) {
    throw new Error("CDP attachment is restricted to a loopback endpoint.");
  }
  if (!new Set(["http:", "https:", "ws:", "wss:"]).has(url.protocol)) {
    throw new Error("The CDP endpoint protocol is unsupported.");
  }
  return url.toString();
}

function boundedText(value, name, max = 2_000) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`${name} must be non-empty bounded text.`);
  }
  return value;
}

function safeId(value, name) {
  if (typeof value !== "string" || !SAFE_ID.test(value)) throw new Error(`${name} is invalid.`);
  return value;
}

async function launchSession(request) {
  const sessionId = safeId(request.sessionId, "sessionId");
  const browserKind =
    request.browser === "edge" ? "edge" : request.browser === "chrome" ? "chrome" : null;
  if (!browserKind) throw new Error("Browser must be chrome or edge.");
  if (sessions.has(sessionId)) return sessionStatus(sessions.get(sessionId));

  if (request.connectEndpoint) {
    if (request.explicitAttachApproval !== true) {
      throw new Error("Attaching to an existing browser requires explicit approval.");
    }
    const endpoint = requireLocalEndpoint(request.connectEndpoint);
    const browser = await chromium.connectOverCDP(endpoint);
    const context = browser.contexts()[0];
    if (!context) {
      await browser.close();
      throw new Error("The approved CDP browser exposed no usable context.");
    }
    const session = { sessionId, browserKind, browser, context, attached: true, userDataDir: null };
    sessions.set(sessionId, session);
    browser.on("disconnected", () => sessions.delete(sessionId));
    return sessionStatus(session);
  }

  const executablePath = await detectBrowser(browserKind);
  if (!executablePath) throw new Error(`${browserKind} is not installed in a supported location.`);
  const root = managedRoot();
  const requestedDir = request.userDataDir
    ? resolve(request.userDataDir)
    : join(root, browserKind, sessionId);
  if (!isInside(requestedDir, root) && request.explicitProfileApproval !== true) {
    throw new Error(
      "Using a browser profile outside OCADE-managed storage requires explicit approval.",
    );
  }
  await mkdir(requestedDir, { recursive: true });
  const context = await chromium.launchPersistentContext(requestedDir, {
    executablePath,
    headless: request.headless === true,
    acceptDownloads: true,
    viewport: request.headless === true ? { width: 1280, height: 800 } : null,
    args: ["--remote-debugging-address=127.0.0.1", "--no-first-run", "--no-default-browser-check"],
  });
  const session = {
    sessionId,
    browserKind,
    browser: null,
    context,
    attached: false,
    userDataDir: requestedDir,
  };
  sessions.set(sessionId, session);
  context.on("close", () => sessions.delete(sessionId));
  return sessionStatus(session);
}

function sessionStatus(session) {
  return {
    sessionId: session.sessionId,
    browser: session.browserKind,
    connected: true,
    attached: session.attached,
    pages: session.context.pages().map((page, index) => ({ index, url: page.url() })),
    profile: session.userDataDir ? "ocade-managed" : "approved-cdp-attach",
  };
}

function pageFor(session, target = {}) {
  const pages = session.context.pages();
  if (Number.isInteger(target.pageIndex) && pages[target.pageIndex]) return pages[target.pageIndex];
  return pages.at(-1) || null;
}

function locatorFor(page, target) {
  if (!target || typeof target !== "object")
    throw new Error("A bounded browser target is required.");
  if (typeof target.selector === "string") return page.locator(target.selector).first();
  if (typeof target.role === "string" && typeof target.name === "string") {
    return page.getByRole(target.role, { name: target.name, exact: target.exact === true }).first();
  }
  if (typeof target.text === "string")
    return page.getByText(target.text, { exact: target.exact === true }).first();
  throw new Error("The browser target needs a selector, role/name, or visible text.");
}

async function protectedLocator(locator) {
  const attrs = await locator.evaluate((element) => ({
    type: element.getAttribute("type") || "",
    name: element.getAttribute("name") || "",
    id: element.getAttribute("id") || "",
    autocomplete: element.getAttribute("autocomplete") || "",
    aria: element.getAttribute("aria-label") || "",
  }));
  return PROTECTED_FIELD.test(Object.values(attrs).join(" "));
}

async function observe(page, expectation = {}) {
  const observation = { url: page.url(), title: await page.title(), verified: true, failures: [] };
  if (expectation.url && observation.url !== expectation.url) {
    observation.verified = false;
    observation.failures.push("URL did not match.");
  }
  if (expectation.urlContains && !observation.url.includes(expectation.urlContains)) {
    observation.verified = false;
    observation.failures.push("URL did not contain the expected text.");
  }
  if (expectation.titleContains && !observation.title.includes(expectation.titleContains)) {
    observation.verified = false;
    observation.failures.push("Title did not contain the expected text.");
  }
  if (expectation.selector) {
    const count = await page.locator(expectation.selector).count();
    if (count < 1) {
      observation.verified = false;
      observation.failures.push("Expected selector was absent.");
    }
  }
  if (expectation.text) {
    const body = (await page.locator("body").innerText()).slice(0, MAX_TEXT);
    if (!body.includes(expectation.text)) {
      observation.verified = false;
      observation.failures.push("Expected text was absent.");
    }
  }
  return observation;
}

async function readPage(page) {
  const summary = await page.evaluate((maxText) => {
    const fields = [...document.querySelectorAll("input,textarea,select")]
      .slice(0, 250)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute("type") || "",
        name: element.getAttribute("name") || "",
        id: element.getAttribute("id") || "",
        ariaLabel: element.getAttribute("aria-label") || "",
        autocomplete: element.getAttribute("autocomplete") || "",
      }));
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .slice(0, 50)
      .map((element) => element.textContent || "");
    const links = [...document.querySelectorAll("a[href]")]
      .slice(0, 100)
      .map((element) => ({ text: element.textContent || "", href: element.href }));
    const frames = [...document.querySelectorAll("iframe")].slice(0, 100).map((element) => ({
      src: element.src || "",
      title: element.title || "",
      sameOrigin: (() => {
        try {
          return new URL(element.src, document.baseURI).origin === location.origin;
        } catch {
          return false;
        }
      })(),
    }));
    const openShadowRoots = [...document.querySelectorAll("*")].filter(
      (element) => element.shadowRoot,
    ).length;
    return {
      title: document.title,
      text: (document.body?.innerText || "").slice(0, maxText),
      headings,
      links,
      frames,
      openShadowRoots,
      fields,
    };
  }, MAX_TEXT);
  return {
    url: page.url(),
    ...summary,
    fields: summary.fields.map((field) => ({
      ...field,
      protected: PROTECTED_FIELD.test(Object.values(field).join(" ")),
    })),
  };
}

async function approvedFile(candidate, roots) {
  if (!isAbsolute(candidate) || !Array.isArray(roots) || roots.length === 0) {
    throw new Error("Uploads require an absolute path and at least one approved root.");
  }
  const actual = await realpath(candidate);
  const approved = await Promise.all(
    roots.map(async (root) => realpath(root).catch(() => resolve(root))),
  );
  if (!approved.some((root) => isInside(actual, root)))
    throw new Error("Upload path is outside approved roots.");
  return actual;
}

async function executeAction(request, signal) {
  const session = sessions.get(safeId(request.sessionId, "sessionId"));
  if (!session) throw new Error("The managed browser session is not connected.");
  const action = request.action;
  if (!action || typeof action !== "object") throw new Error("A typed browser action is required.");
  let page = pageFor(session, action.target);
  if (action.kind === "tab.new") page = await session.context.newPage();
  if (!page) page = await session.context.newPage();
  if (signal.aborted) throw new Error("Browser action cancelled before execution.");

  let output = null;
  switch (action.kind) {
    case "tab.new":
      output = { pageIndex: session.context.pages().indexOf(page) };
      break;
    case "page.read":
      output = await readPage(page);
      break;
    case "media.read":
      output = await page.locator("audio,video").evaluateAll((elements) =>
        elements.slice(0, 25).map((element) => ({
          tag: element.tagName.toLowerCase(),
          paused: element.paused,
          ended: element.ended,
          currentTime: Number(element.currentTime.toFixed(3)),
          duration: Number.isFinite(element.duration) ? Number(element.duration.toFixed(3)) : null,
          readyState: element.readyState,
          networkState: element.networkState,
          muted: element.muted,
          volume: Number(element.volume.toFixed(3)),
        })),
      );
      break;
    case "navigate":
      requireAllowedOrigin(boundedText(action.url, "url", 8_000), request.approvedOrigins);
      await page.goto(action.url, {
        waitUntil: "domcontentloaded",
        timeout: action.timeoutMs || 30_000,
      });
      break;
    case "click":
      await locatorFor(page, action.target).click({ timeout: action.timeoutMs || 15_000 });
      break;
    case "type": {
      const value = boundedText(action.value, "value", 50_000);
      const locator = locatorFor(page, action.target);
      if ((await protectedLocator(locator)) || PROTECTED_VALUE.test(value)) {
        throw new Error("Protected fields and credential-like values remain human-controlled.");
      }
      await locator.fill(value, { timeout: action.timeoutMs || 15_000 });
      break;
    }
    case "wait":
      if (action.target) {
        await locatorFor(page, action.target).waitFor({
          state: "visible",
          timeout: action.timeoutMs || 15_000,
        });
      } else if (typeof action.text === "string" && action.text) {
        await page
          .getByText(action.text)
          .first()
          .waitFor({ state: "visible", timeout: action.timeoutMs || 15_000 });
      } else {
        throw new Error("A wait action needs expected text or a target.");
      }
      output = { waited: true };
      break;
    case "tab.list":
      output = await Promise.all(
        session.context
          .pages()
          .map(async (item, index) => ({ index, url: item.url(), title: await item.title() })),
      );
      break;
    case "tab.activate":
      await page.bringToFront();
      break;
    case "tab.close":
      await page.close();
      break;
    case "upload": {
      const path = await approvedFile(action.path, request.approvedFileRoots);
      await locatorFor(page, action.target).setInputFiles(path);
      output = { filename: basename(path) };
      break;
    }
    case "download": {
      if (request.allowDownloads !== true)
        throw new Error("Downloads are not approved for this run.");
      const root = resolve(boundedText(request.downloadRoot, "downloadRoot", 8_000));
      await mkdir(root, { recursive: true });
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: action.timeoutMs || 30_000 }),
        locatorFor(page, action.target).click({ timeout: action.timeoutMs || 15_000 }),
      ]);
      const suggested = basename(download.suggestedFilename());
      const destination = join(root, `${Date.now()}-${suggested}`);
      await download.saveAs(destination);
      output = { filename: suggested, path: destination };
      break;
    }
    case "screenshot": {
      const masks = [];
      for (const selector of [
        "input[type=password]",
        "input[autocomplete*=one-time-code]",
        "input[autocomplete*=cc-]",
      ]) {
        const locator = page.locator(selector);
        if ((await locator.count()) > 0) masks.push(locator);
      }
      const bytes = await page.screenshot({ fullPage: action.fullPage === true, mask: masks });
      output = { sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
      break;
    }
    default:
      throw new Error("Unsupported browser action.");
  }
  if (signal.aborted) throw new Error("Browser action cancelled before verification.");
  const observation = await observe(page, request.expectation || {});
  return { output, observation };
}

async function handle(request) {
  if (!request || request.version !== PROTOCOL_VERSION)
    throw new Error("Unsupported browser-host protocol.");
  const command = boundedText(request.command, "command", 40);
  if (command === "launch" || command === "connect") return launchSession(request);
  if (command === "status") {
    if (request.sessionId) {
      const session = sessions.get(safeId(request.sessionId, "sessionId"));
      return session ? sessionStatus(session) : { sessionId: request.sessionId, connected: false };
    }
    return { sessions: [...sessions.values()].map(sessionStatus) };
  }
  if (command === "perform") {
    const runId = safeId(request.runId, "runId");
    if (activeRuns.has(runId)) throw new Error("That browser run is already active.");
    const controller = new AbortController();
    const sessionId = safeId(request.sessionId, "sessionId");
    activeRuns.set(runId, { controller, sessionId });
    try {
      return await executeAction(request, controller.signal);
    } finally {
      activeRuns.delete(runId);
    }
  }
  if (command === "cancel") {
    const active = activeRuns.get(safeId(request.runId, "runId"));
    if (!active) return { acknowledged: false, detail: "Browser run is not active." };
    active.controller.abort();
    const session = sessions.get(active.sessionId);
    if (session) {
      await session.context.close().catch(() => undefined);
      if (session.browser) await session.browser.close().catch(() => undefined);
      sessions.delete(active.sessionId);
    }
    return {
      acknowledged: true,
      detail: "Browser run cancelled and its managed session closed.",
    };
  }
  if (command === "close") {
    const sessionId = safeId(request.sessionId, "sessionId");
    const session = sessions.get(sessionId);
    if (!session) return { closed: false };
    await session.context.close();
    if (session.browser) await session.browser.close();
    sessions.delete(sessionId);
    return { closed: true };
  }
  if (command === "emergency_stop") {
    for (const active of activeRuns.values()) active.controller.abort();
    const closing = [...sessions.values()].map(async (session) => {
      await session.context.close().catch(() => undefined);
      if (session.browser) await session.browser.close().catch(() => undefined);
    });
    await Promise.all(closing);
    sessions.clear();
    return { acknowledged: true, detail: "All browser runs stopped and managed sessions closed." };
  }
  throw new Error("Unsupported browser-host command.");
}

async function selfTest() {
  const [chrome, edge] = await Promise.all([detectBrowser("chrome"), detectBrowser("edge")]);
  process.stdout.write(
    `${JSON.stringify({ protocolVersion: PROTOCOL_VERSION, playwright: true, chrome, edge })}\n`,
  );
}

async function main() {
  if (process.argv.includes("--self-test")) {
    await selfTest();
    return;
  }
  process.stdin.setEncoding("utf8");
  let buffered = "";
  const handleLine = async (line) => {
    let id = null;
    try {
      if (Buffer.byteLength(line, "utf8") > MAX_REQUEST_BYTES)
        throw new Error("Browser request is too large.");
      const request = JSON.parse(line);
      id = request.id ?? null;
      const data = await handle(request);
      process.stdout.write(`${JSON.stringify({ id, ok: true, data })}\n`);
    } catch (error) {
      process.stdout.write(
        `${JSON.stringify({ id, ok: false, error: error instanceof Error ? error.message : "Browser host failed." })}\n`,
      );
    }
  };
  process.stdin.on("data", (chunk) => {
    buffered += chunk;
    if (Buffer.byteLength(buffered, "utf8") > MAX_REQUEST_BYTES * 2) {
      process.stdout.write(
        `${JSON.stringify({ id: null, ok: false, error: "Browser request is too large." })}\n`,
      );
      buffered = "";
      return;
    }
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) void handleLine(line);
    }
  });
  process.stdin.on("end", () => {
    if (buffered.trim()) void handleLine(buffered);
  });
}

void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "The browser host could not start."}\n`,
  );
  process.exitCode = 1;
});
