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

/**
 * Where a real Chrome or Edge is actually found, per platform.
 *
 * DEFECT BR-01. This list used to be three paths on Linux —
 * /usr/bin/google-chrome, -stable, and /usr/bin/chromium — and a machine with
 * Chromium genuinely installed anywhere else was told "chrome is not installed
 * in a supported location". That is the wrong answer for the most ordinary
 * Linux install there is: Ubuntu ships Chromium as a snap at /snap/bin/chromium,
 * and Debian and its derivatives name the binary chromium-browser. Windows had
 * the same hole from the other direction: Chrome installs PER USER under
 * LOCALAPPDATA whenever the installer is run without administrator rights, and
 * only the two machine-wide Program Files paths were consulted.
 *
 * `OCADE_BROWSER_PATH` comes first so a user whose browser lives somewhere this
 * list will never guess — a portable build, a Nix store path, a Flatpak wrapper
 * — can simply say where it is instead of being told it does not exist.
 */
function browserPaths(kind) {
  const override = process.env.OCADE_BROWSER_PATH;
  const explicit = override ? [override] : [];

  if (platform() === "win32") {
    const local = process.env.LOCALAPPDATA || join(homedir(), "AppData/Local");
    const programFiles = process.env.PROGRAMFILES || "C:\\Program Files";
    const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
    return kind === "edge"
      ? [
          ...explicit,
          join(programFilesX86, "Microsoft/Edge/Application/msedge.exe"),
          join(programFiles, "Microsoft/Edge/Application/msedge.exe"),
          join(local, "Microsoft/Edge/Application/msedge.exe"),
        ]
      : [
          ...explicit,
          join(programFiles, "Google/Chrome/Application/chrome.exe"),
          join(programFilesX86, "Google/Chrome/Application/chrome.exe"),
          // A non-administrator install lands here, and is very common.
          join(local, "Google/Chrome/Application/chrome.exe"),
          join(local, "Chromium/Application/chrome.exe"),
        ];
  }

  if (platform() === "darwin") {
    return kind === "edge"
      ? [
          ...explicit,
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          join(homedir(), "Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"),
        ]
      : [
          ...explicit,
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          join(homedir(), "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ];
  }

  return kind === "edge"
    ? [
        ...explicit,
        "/usr/bin/microsoft-edge",
        "/usr/bin/microsoft-edge-stable",
        "/opt/microsoft/msedge/msedge",
        "/snap/bin/microsoft-edge",
      ]
    : [
        ...explicit,
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/opt/google/chrome/chrome",
        "/usr/bin/chromium",
        // Debian, Ubuntu and derivatives name it this.
        "/usr/bin/chromium-browser",
        // Ubuntu's default Chromium is a snap.
        "/snap/bin/chromium",
        "/usr/local/bin/chromium",
        "/usr/local/bin/google-chrome",
      ];
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

/**
 * Where the browser keeps the profile the USER actually signs in with.
 *
 * This is the whole point of the attachment work. An OCADE-managed profile is a
 * brand-new browser: no cookies, no sessions, no history. WhatsApp Web shows a
 * QR code, YouTube shows no subscriptions, and webmail shows a login form —
 * every task that depends on being signed in fails at the first step, and it
 * fails in a way that looks like OCADE being broken rather than logged out.
 */
function realProfileDir(browserKind) {
  const local = process.env.LOCALAPPDATA;
  const home = homedir();
  if (platform() === "win32" && local) {
    return browserKind === "edge"
      ? join(local, "Microsoft", "Edge", "User Data")
      : join(local, "Google", "Chrome", "User Data");
  }
  if (platform() === "darwin") {
    return browserKind === "edge"
      ? join(home, "Library/Application Support/Microsoft Edge")
      : join(home, "Library/Application Support/Google/Chrome");
  }
  return browserKind === "edge"
    ? join(home, ".config/microsoft-edge")
    : join(home, ".config/google-chrome");
}

const DEFAULT_CDP_PORT = 9222;
const DEFAULT_CDP_ENDPOINT = `http://127.0.0.1:${DEFAULT_CDP_PORT}`;

/**
 * Is a debuggable browser already listening?
 *
 * Deliberately a plain HTTP probe with a short timeout rather than an attempted
 * `connectOverCDP`: a failed connect can hang for its full timeout, and this
 * runs on the fast path of every attach. `/json/version` is the cheapest
 * endpoint that proves a real DevTools host rather than something else on 9222.
 */
async function probeCdp(endpoint, timeoutMs = 1_500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const base = new URL(endpoint);
    base.protocol = base.protocol.replace(/^ws/, "http");
    const response = await fetch(new URL("/json/version", base), { signal: controller.signal });
    if (!response.ok) return null;
    const info = await response.json();
    return info?.webSocketDebuggerUrl ? info : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/*
 * Playwright's wording when the user data directory is already held by a
 * running browser. Matched on the stable half of the sentence — the second
 * half varies by version and by whether it says "Chromium" or "Chrome".
 */
const PROFILE_LOCKED =
  /already in use|Opening in existing browser session|ProcessSingleton|SingletonLock/i;

/**
 * Attach to the browser the user is actually signed into.
 *
 * TWO ROUTES, TRIED IN THIS ORDER, AND THE ORDER IS THE DESIGN.
 *
 *   1. CDP to a browser that is ALREADY RUNNING. This is preferred whenever it
 *      is available because it takes over nothing: the user's windows stay
 *      open, their tabs stay put, and OCADE works alongside them.
 *
 *   2. `launchPersistentContext` against the real user-data directory. This
 *      gives the same cookies and sessions, but it has to OWN the browser
 *      process — which is why it can only work when Chrome is closed.
 *
 * WHY THE FALLBACK ORDER CANNOT BE REVERSED. Route 2 fails when the browser is
 * running, and the browser running is the ordinary state of a user's machine.
 * Trying it first would mean the common case is always an error recovered from,
 * and every attach would pay a failed browser launch before succeeding.
 */
async function attachToRealBrowser(request, browserKind) {
  const endpoint = requireLocalEndpoint(request.connectEndpoint || DEFAULT_CDP_ENDPOINT);
  const attempts = [];

  const viaCdp = await probeCdp(endpoint);
  if (viaCdp) {
    const browser = await chromium.connectOverCDP(endpoint);
    const context = browser.contexts()[0];
    if (context) {
      return {
        browser,
        context,
        attached: true,
        userDataDir: null,
        how: "cdp",
        detail: `Attached to the running ${viaCdp.Browser || browserKind} over DevTools.`,
      };
    }
    await browser.close();
    attempts.push("the running browser exposed no usable context");
  } else {
    attempts.push(`nothing is listening for DevTools on ${endpoint}`);
  }

  const executablePath = await detectBrowser(browserKind);
  if (!executablePath) throw new Error(`${browserKind} is not installed in a supported location.`);

  const profileDir = request.userDataDir
    ? resolve(request.userDataDir)
    : realProfileDir(browserKind);
  try {
    const context = await chromium.launchPersistentContext(profileDir, {
      executablePath,
      headless: false,
      acceptDownloads: true,
      viewport: null,
      // See the note in the managed branch of `launchSession`: Playwright turns
      // the renderer sandbox OFF by default here, and this is the user's own
      // signed-in profile, so it is the last place to accept that.
      chromiumSandbox: true,
      args: [
        // Opened WITH the debugging port so the next attach can take route 1
        // and leave this window where it is, rather than repeating this launch.
        `--remote-debugging-port=${new URL(endpoint).port || 9222}`,
        "--remote-debugging-address=127.0.0.1",
        "--no-first-run",
        "--no-default-browser-check",
        ...(typeof request.profileDirectory === "string" && request.profileDirectory
          ? [`--profile-directory=${request.profileDirectory}`]
          : []),
      ],
    });
    return {
      context,
      browser: null,
      attached: false,
      userDataDir: profileDir,
      how: "persistent",
      detail: `Opened ${browserKind} with the signed-in profile at ${profileDir}.`,
    };
  } catch (error) {
    const message = String(error?.message || error);
    if (!PROFILE_LOCKED.test(message)) throw error;

    /*
     * LOCK RECOVERY. The profile is held by the browser the user has open. Try
     * DevTools once more first — they may have started it with the port, or
     * started it since the probe above — and only then give up.
     *
     * Giving up says exactly what to do. "Profile is locked" is a true sentence
     * that leaves the user stuck; the two things that actually resolve it are
     * closing the browser or restarting it with the debugging port, so those
     * are what the message contains.
     */
    const retry = await probeCdp(endpoint, 2_500);
    if (retry) {
      const browser = await chromium.connectOverCDP(endpoint);
      const context = browser.contexts()[0];
      if (context) {
        return {
          browser,
          context,
          attached: true,
          userDataDir: null,
          how: "cdp-after-lock",
          detail: "The profile was in use, so OCADE attached to the running browser instead.",
        };
      }
      await browser.close();
    }

    /*
     * A QUESTION THE USER CAN ANSWER, NOT A PARAGRAPH THEY HAVE TO PARSE.
     *
     * The previous message was accurate and useless: it explained the lock,
     * then printed a command line and left a person to open a terminal and run
     * it. The only two things that resolve this are closing the browser or
     * restarting it with the port, and OCADE can do the second itself.
     *
     * So it goes back as a HANDOVER with a `relaunch` offer attached rather
     * than a bare Error. `handover` already travels to the caller as `blocked`,
     * which is terminal — the model stops retrying — and the structured fields
     * let the UI put a real button on it instead of rendering the prose.
     */
    const port = new URL(endpoint).port || String(DEFAULT_CDP_PORT);
    const handover = new HandoverRequired(
      "browser_profile_locked",
      `${browserKind === "edge" ? "Edge" : "Chrome"} is open without debugging. ` +
        `Close and reopen it with your tabs restored?`,
    );
    handover.handover.offer = {
      action: "relaunch_with_debugging",
      browser: browserKind,
      executablePath,
      port: Number(port),
      // Spelled out so a UI can describe the consequence before the user
      // agrees: this closes their windows and brings them back.
      consequence:
        `OCADE will close ${browserKind}, reopen it with remote debugging on ` +
        `127.0.0.1:${port}, and restore the tabs that were open.`,
      manualCommand: `"${executablePath}" --remote-debugging-port=${port}`,
    };
    handover.handover.tried = attempts;
    throw handover;
  }
}

async function launchSession(request) {
  const sessionId = safeId(request.sessionId, "sessionId");
  const browserKind =
    request.browser === "edge" ? "edge" : request.browser === "chrome" ? "chrome" : null;
  if (!browserKind) throw new Error("Browser must be chrome or edge.");
  if (sessions.has(sessionId)) return sessionStatus(sessions.get(sessionId));

  /*
   * "Use my real browser" — the signed-in path.
   *
   * THE APPROVAL GATE STAYS. Reaching the user's own profile means reaching
   * every session in it: their mail, their bank, their messages. That is the
   * capability being asked for and it is theirs to grant, but it is granted
   * per session and never inferred. `explicitProfileApproval` is the same flag
   * the managed-profile path below already requires for a directory outside
   * OCADE's own storage, so this adds a capability, not an exception.
   */
  if (request.profile === "real" || request.useSignedInProfile === true) {
    if (request.explicitProfileApproval !== true) {
      throw new Error(
        "Using your signed-in browser profile requires explicit approval, because it " +
          "gives OCADE the sessions you are logged into.",
      );
    }
    const attached = await attachToRealBrowser(request, browserKind);
    const session = { sessionId, browserKind, ...attached };
    sessions.set(sessionId, session);
    if (session.browser) session.browser.on("disconnected", () => sessions.delete(sessionId));
    else session.context.on("close", () => sessions.delete(sessionId));
    return sessionStatus(session);
  }

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
    /*
     * PLAYWRIGHT TURNS THE SANDBOX OFF HERE, AND IT HAD TO BE TURNED BACK ON.
     *
     * `chromiumSandbox` defaults to FALSE for `launchPersistentContext`, so
     * `--no-sandbox` was on the real command line of every browser OCADE
     * opened. Verified by launching Playwright with no `args` override at all
     * and reading the flag back off the running process — it is Playwright's
     * default, not something in this file.
     *
     * Two things came from it. Chrome showed the yellow "unsupported
     * command-line flag" bar, which reads as OCADE being broken; and the
     * renderer sandbox was genuinely disabled in a browser pointed at
     * arbitrary web pages under automation. The second is the one that matters.
     */
    chromiumSandbox: true,
    /*
     * NO DEBUGGING PORT ON THE THROWAWAY BROWSER, AND THAT IS THE FIX.
     *
     * This branch used to pass `--remote-debugging-address=127.0.0.1` with no
     * port, which is inert — Chrome opens no listener without one, and
     * Playwright supplies `--remote-debugging-pipe` instead. So the flag did
     * nothing, and it has been removed rather than completed.
     *
     * COMPLETING IT WOULD HAVE BEEN WORSE THAN LEAVING IT BROKEN. Putting 9222
     * here means the next `attachToRealBrowser` probe finds THIS browser — an
     * empty OCADE profile — takes route 1, and reports `signed-in-cdp`. The
     * receipt would then say "signed in" about a browser with no cookies,
     * which is the same lie the whole profile fix exists to stop, wearing a
     * different hat. 9222 belongs to the user's real browser alone; the
     * signed-in branch above opens it there, where re-attachment is the point.
     */
    args: ["--no-first-run", "--no-default-browser-check"],
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
    /*
     * Which profile is in play, reported rather than assumed. "signed-in" and
     * "ocade-managed" behave completely differently — one has the user's
     * cookies and one does not — and a caller that cannot tell them apart will
     * report "you are not logged in" as a site problem.
     */
    profile: session.how
      ? session.how.startsWith("cdp")
        ? "signed-in-cdp"
        : "signed-in-profile"
      : session.userDataDir
        ? "ocade-managed"
        : "approved-cdp-attach",
    ...(session.how ? { attachedVia: session.how, detail: session.detail } : {}),
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

/**
 * A refusal that means "a person has to take this one", not "this failed".
 *
 * WHY A DISTINCT ERROR TYPE. The host previously threw a plain Error for a
 * password field, which reached the loop as `retryable_failure` — the one
 * category that gets RETRIED. So the model tried the credential field again,
 * failed again, and burned its attempts on the one action that must never
 * succeed. Carrying `handover` through the reply lets the adapter map it to
 * `blocked`, which is terminal, and lets the UI say what the user has to do.
 */
class HandoverRequired extends Error {
  constructor(what, detail) {
    super(detail);
    this.name = "HandoverRequired";
    this.handover = { what, detail };
  }
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

/**
 * Is this page asking a human to prove they are one?
 *
 * DETECTED, REPORTED, NEVER SOLVED. A CAPTCHA is a site saying "not automation,
 * please"; the correct response is to stop and hand the keyboard back, not to
 * find a way through. OCADE has no CAPTCHA-solving path and this function is
 * not the first step towards one — it exists so the loop STOPS instead of
 * clicking blindly at a challenge frame and reporting that it searched.
 *
 * Checked structurally rather than by scraping text, because the text is
 * localised and the structure is not: reCAPTCHA and hCaptcha both mount named
 * iframes, and Google's interstitial lives at a recognisable path.
 */
async function detectHumanCheck(page) {
  try {
    const url = page.url();
    if (/\/sorry\/index|\/recaptcha\/|captcha|challenges?\.cloudflare\.com/i.test(url)) {
      return { present: true, kind: "interstitial", where: url.slice(0, 200) };
    }
    const found = await page.evaluate(() => {
      const frames = [...document.querySelectorAll("iframe")].map((f) => f.src || "");
      const recaptcha = frames.some((src) => /recaptcha|hcaptcha|turnstile/i.test(src));
      const widget = Boolean(
        document.querySelector(
          ".g-recaptcha, #captcha, [data-sitekey], .h-captcha, .cf-turnstile, form[action*='sorry']",
        ),
      );
      const heading = (document.body?.innerText || "").slice(0, 400);
      const wording =
        /unusual traffic|are you a robot|verify (that )?you'?re human|confirm you'?re not a robot|prove you'?re human/i.test(
          heading,
        );
      return { recaptcha, widget, wording };
    });
    if (found.recaptcha || found.widget || found.wording) {
      return {
        present: true,
        kind: found.recaptcha ? "recaptcha" : found.widget ? "widget" : "wording",
        where: url.slice(0, 200),
      };
    }
  } catch {
    /* a page that cannot be inspected is not evidence of a challenge */
  }
  return { present: false };
}

/* ------------------------------------------------------- site helpers -- */

/**
 * Is an advert playing, and can it be skipped yet?
 *
 * READ THE PLAYER, NOT THE PAGE. YouTube marks an advert by putting `ad-showing`
 * on `#movie_player`; the skip control only exists inside that player while the
 * advert runs. Both facts are checked against the player element because the
 * page-wide alternative is actively wrong — see `skipYoutubeAd`.
 */
async function youtubeAdState(page) {
  return page.evaluate(() => {
    const player = document.querySelector("#movie_player");
    if (!player) return { onVideoPage: false, adShowing: false, skippable: false };
    const skip = player.querySelector(
      ".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, button[class*='skip']",
    );
    return {
      onVideoPage: true,
      adShowing: player.classList.contains("ad-showing"),
      overlay: Boolean(
        player.querySelector(".ytp-ad-player-overlay, .ytp-ad-player-overlay-layout"),
      ),
      skippable: Boolean(skip && !skip.disabled && skip.offsetParent !== null),
    };
  });
}

/**
 * Press YouTube's Skip control, and only YouTube's Skip control.
 *
 * THE OBVIOUS IMPLEMENTATION IS A BUG. `getByRole("button", { name: /skip/i })`
 * across the page matches "Skip navigation" — YouTube's accessibility link for
 * keyboard users — on EVERY page, advert or not. Measured on a live watch page
 * with no advert playing: one page-wide match, zero matches scoped to
 * `#movie_player`. A helper written the obvious way would therefore report
 * "skipped the ad" while having moved the user's focus to the page content.
 *
 * So every lookup here is scoped inside the player, and the whole thing is
 * gated on `ad-showing` first: no advert means nothing to press, which is a
 * success ("there is no ad") rather than a failure.
 */
async function skipYoutubeAd(page, timeoutMs = 8_000) {
  const state = await youtubeAdState(page);
  if (!state.onVideoPage) {
    return {
      ...state,
      skipped: false,
      verified: true,
      detail: "This is not a YouTube video page.",
    };
  }
  if (!state.adShowing) {
    return { ...state, skipped: false, verified: true, detail: "No advert is playing." };
  }

  const player = page.locator("#movie_player");
  const candidates = [
    player.locator(".ytp-ad-skip-button-modern"),
    player.locator(".ytp-ad-skip-button"),
    player.locator(".ytp-skip-ad-button"),
    // Accessibility-first, but still scoped to the player so "Skip navigation"
    // can never be the thing that gets pressed.
    player.getByRole("button", { name: /skip/i }),
  ];

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const candidate of candidates) {
      try {
        if ((await candidate.count()) === 0) continue;
        const first = candidate.first();
        if (!(await first.isVisible())) continue;
        await first.click({ timeout: 2_000 });
        await page.waitForTimeout(600);
        const after = await youtubeAdState(page);
        return {
          ...after,
          skipped: !after.adShowing,
          // Verified by re-reading the player, not by the click resolving.
          verified: !after.adShowing,
          detail: after.adShowing
            ? "Pressed Skip but the advert is still playing."
            : "Skipped the advert.",
        };
      } catch {
        /* try the next candidate */
      }
    }
    // Most YouTube adverts are unskippable for their first seconds. Waiting is
    // the correct behaviour; returning "cannot skip" would be true only for now.
    await page.waitForTimeout(700);
  }
  const after = await youtubeAdState(page);
  return {
    ...after,
    skipped: false,
    verified: false,
    detail: after.adShowing
      ? "An advert is playing but no Skip control appeared in time — it may be unskippable."
      : "The advert ended on its own.",
  };
}

/**
 * WhatsApp Web landmarks.
 *
 * HONESTY NOTE: unlike the YouTube helpers above, these selectors could NOT be
 * verified against the live site — that needs a signed-in session, and signing
 * in is the user's to do. They are written defensively for that reason: several
 * candidates per landmark, `role`/`aria` first because WhatsApp's CSS class
 * names are generated and change between releases, and every function reports
 * what it actually found instead of assuming the first candidate hit.
 */
const WHATSAPP_SEARCH = [
  '[data-testid="chat-list-search"]',
  'div[contenteditable="true"][data-tab="3"]',
  'div[role="textbox"][title*="Search" i]',
  'div[contenteditable="true"][aria-label*="Search" i]',
];
const WHATSAPP_PANEL = [
  '[data-testid="conversation-panel-messages"]',
  "#main div.copyable-area",
  "#main",
];

async function whatsappFocusSearch(page) {
  for (const selector of WHATSAPP_SEARCH) {
    const box = page.locator(selector).first();
    try {
      if ((await box.count()) === 0) continue;
      await box.click({ timeout: 3_000 });
      const focused = await page.evaluate(
        (s) => document.activeElement === document.querySelector(s),
        selector,
      );
      return {
        found: true,
        selector,
        verified: focused,
        detail: focused
          ? "The WhatsApp search box has focus."
          : "Clicked the search box but focus did not land there.",
      };
    } catch {
      /* next candidate */
    }
  }
  return {
    found: false,
    verified: false,
    detail:
      "No WhatsApp search box was found. Check WhatsApp Web is open and signed in — " +
      "a signed-out session shows a QR code and has no search box.",
  };
}

async function whatsappActiveChat(page) {
  for (const selector of WHATSAPP_PANEL) {
    const panel = page.locator(selector).first();
    try {
      if ((await panel.count()) === 0) continue;
      const header = await page
        .locator("#main header")
        .first()
        .innerText()
        .catch(() => "");
      return {
        found: true,
        selector,
        // The conversation title, so a caller can confirm it is talking to the
        // person it meant to before anything is sent.
        chat: header.split("\n")[0]?.slice(0, 120) || null,
        verified: true,
        detail: header
          ? `The open conversation is with ${header.split("\n")[0]}.`
          : "A conversation is open.",
      };
    } catch {
      /* next candidate */
    }
  }
  return {
    found: false,
    verified: false,
    detail: "No open WhatsApp conversation was found. Open the chat first.",
  };
}

async function observe(page, expectation = {}) {
  const observation = { url: page.url(), title: await page.title(), verified: true, failures: [] };

  const humanCheck = await detectHumanCheck(page);
  if (humanCheck.present) {
    observation.humanCheck = humanCheck;
    observation.verified = false;
    // Said in the words the user needs, because this failure ends the task and
    // the next move belongs to a person.
    observation.failures.push(
      "This site is asking for human verification. OCADE does not complete those — take over in the browser window, or try somewhere else.",
    );
  }

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
    case "navigate":
      requireAllowedOrigin(boundedText(action.url, "url", 8_000), request.approvedOrigins);
      await page.goto(action.url, {
        waitUntil: "domcontentloaded",
        timeout: action.timeoutMs || 30_000,
      });
      break;
    case "site.youtube.ad":
      output = await youtubeAdState(page);
      break;
    case "site.youtube.skip":
      output = await skipYoutubeAd(page, action.timeoutMs || 8_000);
      break;
    case "site.whatsapp.search":
      output = await whatsappFocusSearch(page);
      break;
    case "site.whatsapp.chat":
      output = await whatsappActiveChat(page);
      break;
    case "click": {
      /*
       * CLICKING WAS THE UNGUARDED HALF.
       *
       * `type` refused protected fields from the start, but `click` did not
       * check anything — so nothing stopped OCADE ticking a reCAPTCHA "I am
       * not a robot" box, or pressing Submit on a login form it had been
       * forbidden from filling. Both are the same mistake as typing the
       * password: a human decision taken by a machine.
       */
      const challenge = await detectHumanCheck(page);
      if (challenge.present) {
        throw new HandoverRequired(
          "captcha",
          "This page is asking for human verification. OCADE does not answer those. " +
            "Take over in the browser window, then tell OCADE to carry on.",
        );
      }
      const locator = locatorFor(page, action.target);
      if (await protectedLocator(locator)) {
        throw new HandoverRequired(
          "protected_field",
          "That control belongs to a password, one-time code or payment field, " +
            "so it stays with you. Do it in the browser window yourself.",
        );
      }
      await locator.click({ timeout: action.timeoutMs || 15_000 });
      break;
    }
    case "type": {
      const value = boundedText(action.value, "value", 50_000);
      const locator = locatorFor(page, action.target);
      if (await protectedLocator(locator)) {
        throw new HandoverRequired(
          "protected_field",
          "That field is a password, one-time code or payment detail. OCADE never " +
            "types those — enter it yourself in the browser window.",
        );
      }
      if (PROTECTED_VALUE.test(value)) {
        throw new HandoverRequired(
          "credential_value",
          "That text looks like a credential or card number, so OCADE will not type it.",
        );
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
    /*
     * SCROLLING IS A READ THAT MOVES THE PAGE.
     *
     * It mutates nothing, but without it a page longer than the viewport is a
     * page OCADE can only see the top of — and "read the rest" was previously
     * only reachable by clicking something and hoping. Bounded to one viewport
     * at a time so a runaway loop cannot end up ten thousand pixels down with
     * no idea where it is.
     */
    case "scroll": {
      const direction = action.direction === "up" ? -1 : 1;
      const amount = Math.min(4000, Math.max(50, Number(action.amount) || 0));
      const before = await page.evaluate(() => window.scrollY);
      await page.mouse.wheel(0, direction * amount);
      // Momentum and lazy-loading both need a beat before the position settles.
      await page.waitForTimeout(220);
      const after = await page.evaluate(() => window.scrollY);
      output = {
        from: before,
        to: after,
        moved: after !== before,
        // A page already at the bottom genuinely cannot scroll further, and
        // saying so stops the model retrying the same call.
        atEnd: await page.evaluate(
          () => window.innerHeight + window.scrollY >= document.body.scrollHeight - 2,
        ),
      };
      break;
    }
    /*
     * A KEY, FROM A CLOSED SET. Enter to submit a search, Escape to dismiss a
     * dialog, PageDown to move through a document. Deliberately not a
     * passthrough: `page.keyboard.press` accepts anything, and "anything"
     * includes chords that reach the browser's own chrome.
     */
    case "key": {
      const allowed = new Set([
        "Enter",
        "Escape",
        "Tab",
        "Backspace",
        "Delete",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "PageUp",
        "PageDown",
        "Home",
        "End",
        "Space",
      ]);
      const key = boundedText(action.key, "key", 20);
      if (!allowed.has(key)) throw new Error(`OCADE does not send the ${key} key to a page.`);
      const beforeUrl = page.url();
      await page.keyboard.press(key);
      await page.waitForTimeout(250);
      output = { pressed: key, urlChanged: page.url() !== beforeUrl };
      break;
    }
    /*
     * MEDIA, THROUGH THE PAGE'S OWN ELEMENTS rather than through the operating
     * system's media keys. A system media key goes to whatever the OS decided
     * owns media focus, which on a machine with Spotify open is not the tab the
     * user is looking at. This acts on the video or audio element in front of
     * them and reports what it actually did.
     */
    case "media": {
      const wanted = boundedText(action.action, "action", 12);
      if (!["play", "pause", "mute", "unmute", "seek", "forward", "back"].includes(wanted)) {
        throw new Error(`Unsupported media action: ${wanted}`);
      }
      const seconds = Number.isFinite(Number(action.seconds)) ? Number(action.seconds) : 10;
      output = await page.evaluate(
        ({ operation, amount }) => {
          const elements = [...document.querySelectorAll("video, audio")];
          if (elements.length === 0) return { found: 0, applied: false };
          const element = elements.find((item) => !item.paused) ?? elements[0];
          if (operation === "play") void element.play?.();
          if (operation === "pause") element.pause?.();
          if (operation === "mute") element.muted = true;
          if (operation === "unmute") element.muted = false;
          /*
           * SEEK IS ABSOLUTE, FORWARD AND BACK ARE RELATIVE, and the difference
           * matters because people say both. "forward it to 10 seconds" means
           * position 10; "skip forward 10 seconds" means +10 from here.
           *
           * Clamped to the media's own duration: assigning past the end makes
           * some players stall on a frame that never advances rather than
           * ending cleanly, which looks exactly like a hang.
           */
          if (operation === "seek" || operation === "forward" || operation === "back") {
            const duration = Number.isFinite(element.duration) ? element.duration : Infinity;
            const target =
              operation === "seek"
                ? amount
                : element.currentTime + (operation === "back" ? -amount : amount);
            element.currentTime = Math.max(0, Math.min(target, duration - 0.25));
          }
          return {
            found: elements.length,
            applied: true,
            paused: element.paused,
            muted: element.muted,
            currentTime: element.currentTime,
            duration: Number.isFinite(element.duration) ? element.duration : null,
          };
        },
        { operation: wanted, amount: seconds },
      );
      break;
    }

    /*
     * SKIPPING AN AD IS CLICKING A BUTTON, NOT A MEDIA OPERATION.
     *
     * An ad is a real video element -- seeking it does nothing, because the
     * player refuses, and muting it just makes you wait in silence. The only
     * thing that ends one is the button the site itself provides, and that
     * button is found by its TEXT rather than by a class name: YouTube renames
     * its classes constantly and "Skip" is the one part that cannot change
     * without the user no longer understanding the page.
     *
     * Reports honestly when there is nothing to skip. "No skip button" is a
     * normal state -- most of the time there is no ad -- and must not read as
     * a failure.
     */
    case "skip_ad": {
      output = await page.evaluate(() => {
        /*
         * "SKIP NAVIGATION" IS NOT AN ADVERT, AND IT IS ON EVERY YOUTUBE PAGE.
         *
         * Measured on a live run: this clicked "Skip navigation" -- the
         * accessibility link every well-built site puts first in the tab order
         * -- and reported that it had skipped an advert. It had jumped the
         * user's focus past the header instead, and claimed success for it.
         *
         * Matching on the word "skip" alone cannot work, because the word
         * belongs to accessibility long before it belongs to advertising. What
         * separates them is the OBJECT: an ad button skips an *ad*, or says
         * nothing else at all ("Skip", "Skip >"). A navigation link always
         * names where it is going -- navigation, content, main, to the player.
         */
        const wanted =
          /^\s*skip(?:\s+(?:this\s+)?(?:ad|ads|advert|advertisement|intro))?\s*[>»]?\s*$/i;
        const clickable = [
          ...document.querySelectorAll("button, a, [role=button], div[class*=skip]"),
        ];
        const target = clickable.find((element) => {
          if (!(element instanceof HTMLElement)) return false;
          const rect = element.getBoundingClientRect();
          if (rect.width < 4 || rect.height < 4) return false;
          /*
           * `textContent` as well as `innerText`, and that is not belt and
           * braces. `innerText` is LAYOUT-DEPENDENT: it is empty for an element
           * the browser has not laid out yet, which is exactly the state a skip
           * button is in for the first moments after an ad starts -- the moment
           * we are most likely to be looking. `textContent` reads the markup
           * and is always there.
           */
          /*
           * EACH SOURCE IS TESTED SEPARATELY, NOT JOINED, and that matters
           * because the pattern is anchored at the start.
           *
           * `<a role="button" aria-label="Skip intro">»</a>` is a real shape.
           * Joining gives "» Skip intro", which does not START with "skip", so
           * the button was missed. The anchor earns its place -- it is what
           * stops "don't skip this" matching -- so the fix is to ask each label
           * on its own rather than to loosen it.
           *
           * `textContent` is included as well as `innerText` because
           * `innerText` is LAYOUT-DEPENDENT and empty for an element the
           * browser has not laid out yet, which is exactly the state a skip
           * button is in in the first moments of an ad.
           */
          return [element.innerText, element.textContent, element.getAttribute("aria-label")].some(
            (label) => label && wanted.test(String(label).trim()),
          );
        });
        if (!target) return { found: false, clicked: false };
        target.click();
        return {
          found: true,
          clicked: true,
          label: (target.innerText || target.textContent || "").trim().slice(0, 60),
        };
      });
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
      // A hand-over is reported as `blocked` so the loop stops asking. Every
      // other failure keeps its existing shape.
      const handover = error instanceof Error ? error.handover : undefined;
      process.stdout.write(
        `${JSON.stringify({
          id,
          ok: false,
          ...(handover ? { code: "blocked", handover } : {}),
          error: error instanceof Error ? error.message : "Browser host failed.",
        })}\n`,
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
