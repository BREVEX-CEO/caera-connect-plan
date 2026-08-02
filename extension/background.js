/**
 * OCADE Browser Companion — service worker.
 *
 * Brokers between the OCADE page and content scripts. It is deliberately dumb:
 * it validates, it asks permission, it forwards. All policy decisions live in
 * the app (`src/lib/native/browser-bridge.ts`) and all message shapes in
 * `src/lib/native/extension-protocol.ts` — that logic is unit-tested, this file
 * is the thin browser-side adapter.
 *
 * Security invariants enforced here:
 *  - only the paired OCADE origin may connect (also pinned in the manifest);
 *  - every message must carry the single pairing token issued at connect;
 *  - site access is requested PER ORIGIN at the moment it is approved — the
 *    extension ships with no host permissions at all;
 *  - private/incognito is refused by the manifest and re-checked here.
 */

const PROTOCOL_VERSION = 1;

const KINDS = new Set([
  "connect",
  "tabs.list",
  "tab.activate",
  "tab.create",
  "page.summary",
  "page.a11y",
  "page.screenshot",
  "page.navigate",
  "page.wait",
  "page.verify",
  "form.fill",
  "form.submit",
  "file.download",
  "file.upload",
  "file.drop",
  "run.progress",
  "run.cancel",
  "emergency.stop",
]);

/** Single-use pairing token, held only in memory for this browser session. */
let pairingToken = null;
let pairingCode = null;
let pairingExpiresAt = 0;
let emergencyStopped = false;
const cancelledRuns = new Set();
const runStates = new Map();

function refuse(reason) {
  return { ok: false, error: reason };
}

function reply(kind, data) {
  return { ok: true, kind, data };
}

function newToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Mirrors validateRequest() in extension-protocol.ts. */
function validate(msg) {
  if (typeof msg !== "object" || msg === null) return refuse("Malformed message.");
  if (msg.v !== PROTOCOL_VERSION) return refuse("Unsupported protocol version.");
  if (typeof msg.kind !== "string" || !KINDS.has(msg.kind)) return refuse("Unsupported request.");
  if (msg.kind === "connect") {
    if (
      !pairingCode ||
      Date.now() > pairingExpiresAt ||
      typeof msg.pairingCode !== "string" ||
      msg.pairingCode !== pairingCode
    ) {
      return refuse("The pairing code is invalid or expired.");
    }
    return { ok: true };
  }
  if (!pairingToken) return refuse("This page is not paired with the OCADE extension.");
  if (typeof msg.token !== "string" || msg.token !== pairingToken) {
    return refuse("This page is not paired with the OCADE extension.");
  }
  if (
    emergencyStopped &&
    msg.kind !== "emergency.stop" &&
    msg.kind !== "run.cancel" &&
    msg.kind !== "run.progress"
  ) {
    return refuse("Browser control is stopped. Re-open the extension to begin a new pairing.");
  }
  if (
    typeof msg.runId === "string" &&
    cancelledRuns.has(msg.runId) &&
    msg.kind !== "run.cancel" &&
    msg.kind !== "run.progress"
  ) {
    return refuse("This browser run was cancelled.");
  }
  return { ok: true };
}

/** Ask for access to exactly one origin, only when the user approves it. */
async function ensureOriginPermission(url) {
  let origin;
  try {
    origin = new URL(url).origin + "/*";
  } catch {
    return false;
  }
  const already = await chrome.permissions.contains({ origins: [origin] });
  if (already) return true;
  /*
   * Triggers the browser's own consent prompt — but only when there is a user
   * activation to trigger it with.
   *
   * A service worker handling an external message has no activation, so this
   * call THROWS rather than returning false. Unhandled, that threw straight
   * past the caller's "You didn't grant OCADE access to this site." refusal and
   * surfaced as the generic catch-all, leaving a user with a message that says
   * nothing about what to do. Returning false keeps the actionable refusal
   * reachable; the grant is then made from the popup, where the activation
   * actually exists.
   */
  try {
    return await chrome.permissions.request({ origins: [origin] });
  } catch {
    return false;
  }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function targetTab(msg) {
  if (typeof msg.tabId === "string") {
    const numeric = Number(msg.tabId);
    if (!Number.isSafeInteger(numeric)) return null;
    try {
      return await chrome.tabs.get(numeric);
    } catch {
      return null;
    }
  }
  return activeTab();
}

function sameOrigin(left, right) {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

async function ensureDownloadsPermission() {
  const already = await chrome.permissions.contains({ permissions: ["downloads"] });
  if (already) return true;
  return chrome.permissions.request({ permissions: ["downloads"] });
}

async function runInTab(tabId, func, args = []) {
  const [result] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return result?.result;
}

/** Injected: build the DomLike summary the app's summarisePage() expects. */
function collectDom() {
  const roots = [document];
  const frames = [];
  let openShadowRoots = 0;
  for (let index = 0; index < roots.length; index++) {
    for (const element of roots[index].querySelectorAll("*")) {
      if (element.shadowRoot) {
        roots.push(element.shadowRoot);
        openShadowRoots++;
      }
      if (element.tagName === "IFRAME") {
        let sameOrigin = false;
        try {
          sameOrigin = new URL(element.src, location.href).origin === location.origin;
          if (sameOrigin && element.contentDocument) roots.push(element.contentDocument);
        } catch {
          sameOrigin = false;
        }
        frames.push({
          src: element.src || "",
          title: element.getAttribute("title") || "",
          sameOrigin,
        });
      }
    }
  }
  const all = (selector) => roots.flatMap((root) => Array.from(root.querySelectorAll(selector)));
  const headings = all("h1,h2,h3").map((heading) => heading.textContent || "");
  const fields = all("input,select,textarea").map((el) => ({
    name: el.getAttribute("name") || el.getAttribute("id") || el.getAttribute("aria-label") || "",
    type: el.getAttribute("type") || el.tagName.toLowerCase(),
  }));
  const links = all("a[href]").map((a) => ({
    text: a.textContent || "",
    href: a.href,
  }));
  return {
    url: location.href,
    title: document.title,
    headings,
    bodyText: document.body ? document.body.innerText : "",
    fields,
    links,
    frames,
    openShadowRoots,
  };
}

/** Injected: accessibility-oriented view — roles and names, never values. */
function collectA11y() {
  const protectedPattern =
    /(password|passwd|pwd|otp|one-?time|verification|2fa|mfa|captcha|cvv|cvc|card|iban|ssn|secret|token|pin|recovery)/i;
  const roots = [document];
  const frames = [];
  let openShadowRoots = 0;
  for (let index = 0; index < roots.length; index++) {
    for (const element of roots[index].querySelectorAll("*")) {
      if (element.shadowRoot) {
        roots.push(element.shadowRoot);
        openShadowRoots++;
      }
      if (element.tagName === "IFRAME") {
        let sameOrigin = false;
        try {
          sameOrigin = new URL(element.src, location.href).origin === location.origin;
          if (sameOrigin && element.contentDocument) roots.push(element.contentDocument);
        } catch {
          sameOrigin = false;
        }
        frames.push({
          src: element.src || "",
          title: element.getAttribute("title") || "",
          sameOrigin,
        });
      }
    }
  }
  const nodes = roots
    .flatMap((root) =>
      Array.from(
        root.querySelectorAll("[role],button,a[href],input,select,textarea,h1,h2,h3,[aria-label]"),
      ),
    )
    .slice(0, 500);
  return {
    url: location.href,
    title: document.title,
    nodes: nodes.map((el) => {
      const role = el.getAttribute("role") || el.tagName.toLowerCase();
      const name =
        el.getAttribute("aria-label") ||
        el.getAttribute("name") ||
        el.getAttribute("alt") ||
        (el.textContent || "").trim().slice(0, 120);
      const type = el.getAttribute("type") || "";
      return {
        role,
        name,
        disabled: el.hasAttribute("disabled"),
        protected: protectedPattern.test(`${name} ${type}`),
      };
    }),
    frames,
    openShadowRoots,
  };
}

/** Injected: fill approved non-sensitive fields with semantic selector healing. */
function fillApprovedFields(fields) {
  const protectedPattern =
    /(password|passwd|pwd|otp|one-?time|verification|2fa|mfa|captcha|cvv|cvc|card|iban|ssn|secret|token|pin|recovery)/i;
  const usable = (element) => {
    if (
      element.hidden ||
      element.hasAttribute("disabled") ||
      element.getAttribute("aria-hidden") === "true"
    ) {
      return false;
    }
    try {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    } catch {
      return true;
    }
  };
  const resolve = (field) => {
    const target = field.target || {};
    if (target.selector) {
      try {
        const exact = document.querySelector(target.selector);
        if (exact && usable(exact)) return { element: exact, healed: false, ambiguous: false };
      } catch {
        // A stale or malformed selector falls through to semantic healing.
      }
    }
    const candidates = Array.from(
      document.querySelectorAll("input,select,textarea,[contenteditable]"),
    );
    const wanted = String(target.name || field.name || "")
      .trim()
      .toLowerCase();
    const semantic = candidates.filter((el) => {
      if (!usable(el)) return false;
      const values = [
        el.getAttribute("name"),
        el.getAttribute("id"),
        el.getAttribute("aria-label"),
        el.getAttribute("placeholder"),
      ]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase());
      return values.includes(wanted);
    });
    if (semantic.length > 1) return { element: null, healed: true, ambiguous: true };
    return semantic[0]
      ? { element: semantic[0], healed: Boolean(target.selector), ambiguous: false }
      : null;
  };

  let filled = 0;
  let healed = 0;
  for (const field of fields) {
    if (
      !field ||
      typeof field.name !== "string" ||
      typeof field.value !== "string" ||
      protectedPattern.test(field.name) ||
      protectedPattern.test(field.value)
    ) {
      return { ok: false, error: "A protected or malformed form field was refused." };
    }
    const found = resolve(field);
    if (!found) return { ok: false, error: `Could not find the field named ${field.name}.` };
    if (found.ambiguous || !found.element) {
      return { ok: false, error: `The field named ${field.name} is ambiguous.` };
    }
    const type = found.element.getAttribute("type") || "";
    if (protectedPattern.test(type)) {
      return { ok: false, error: "A protected form field was refused." };
    }
    found.element.focus();
    if ("value" in found.element) found.element.value = field.value;
    else found.element.textContent = field.value;
    found.element.dispatchEvent(new Event("input", { bubbles: true }));
    found.element.dispatchEvent(new Event("change", { bubbles: true }));
    filled++;
    if (found.healed) healed++;
  }
  return { ok: true, filled, healed };
}

/** Injected: submit only the confirmed semantic target. */
function submitApprovedForm(target) {
  const usable = (element) => {
    if (
      element.hidden ||
      element.hasAttribute("disabled") ||
      element.getAttribute("aria-hidden") === "true"
    ) {
      return false;
    }
    try {
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    } catch {
      return true;
    }
  };
  const resolve = () => {
    if (target?.selector) {
      try {
        const exact = document.querySelector(target.selector);
        if (exact && usable(exact)) return { element: exact, healed: false, ambiguous: false };
      } catch {
        // Fall through to role/name/text matching.
      }
    }
    const wanted = String(target?.name || target?.text || "")
      .trim()
      .toLowerCase();
    const candidates = Array.from(
      document.querySelectorAll("button,input[type=submit],[role=button]"),
    );
    const semantic = candidates.filter((el) => {
      if (!usable(el)) return false;
      const name = (
        el.getAttribute("aria-label") ||
        el.getAttribute("value") ||
        el.textContent ||
        ""
      )
        .trim()
        .toLowerCase();
      return wanted ? name === wanted : el.matches("button[type=submit],input[type=submit]");
    });
    if (semantic.length > 1) return { element: null, healed: true, ambiguous: true };
    return semantic[0]
      ? { element: semantic[0], healed: Boolean(target?.selector), ambiguous: false }
      : null;
  };
  const found = resolve();
  if (!found) return { ok: false, error: "Could not find the confirmed submit control." };
  if (found.ambiguous || !found.element) {
    return { ok: false, error: "The confirmed submit control is ambiguous." };
  }
  found.element.click();
  return { ok: true, healed: found.healed };
}

/** Injected: hand approved bytes to an explicit file input. */
function uploadApprovedFile(target, file) {
  const usable = (element) =>
    !element.hidden &&
    !element.hasAttribute("disabled") &&
    element.getAttribute("aria-hidden") !== "true";
  let input = null;
  if (target?.selector) {
    try {
      input = document.querySelector(target.selector);
      if (input && !usable(input)) input = null;
    } catch {
      input = null;
    }
  }
  if (!input) {
    const wanted = String(target?.name || "")
      .trim()
      .toLowerCase();
    const matches = Array.from(document.querySelectorAll('input[type="file"]')).filter((el) => {
      if (!usable(el)) return false;
      const names = [el.getAttribute("name"), el.getAttribute("id"), el.getAttribute("aria-label")]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase());
      return !wanted || names.includes(wanted);
    });
    if (matches.length > 1) {
      return { ok: false, error: "The approved file input is ambiguous." };
    }
    input = matches[0] || null;
  }
  if (!input || input.getAttribute("type") !== "file") {
    return { ok: false, error: "Could not find the approved file input." };
  }
  try {
    const binary = atob(file.dataBase64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const approved = new File([bytes], file.name, { type: file.mimeType });
    const transfer = new DataTransfer();
    transfer.items.add(approved);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, name: file.name, bytes: bytes.length };
  } catch {
    return { ok: false, error: "The approved file handoff could not be decoded." };
  }
}

/** Injected: dispatch an approved file through an explicit drop target. */
function dropApprovedFile(target, file) {
  const usable = (element) =>
    !element.hidden &&
    !element.hasAttribute("disabled") &&
    element.getAttribute("aria-hidden") !== "true";
  let dropTarget = null;
  if (target?.selector) {
    try {
      dropTarget = document.querySelector(target.selector);
      if (dropTarget && !usable(dropTarget)) dropTarget = null;
    } catch {
      dropTarget = null;
    }
  }
  if (!dropTarget) {
    const wanted = String(target?.name || target?.text || "")
      .trim()
      .toLowerCase();
    const matches = Array.from(
      document.querySelectorAll("[data-ocade-dropzone],[aria-label],[role=button],label"),
    ).filter((element) => {
      if (!usable(element)) return false;
      const name = (
        element.getAttribute("aria-label") ||
        element.getAttribute("data-ocade-dropzone") ||
        element.textContent ||
        ""
      )
        .trim()
        .toLowerCase();
      return wanted && name === wanted;
    });
    if (matches.length > 1) {
      return { ok: false, error: "The approved drop target is ambiguous." };
    }
    dropTarget = matches[0] || null;
  }
  if (!dropTarget) return { ok: false, error: "Could not find the approved drop target." };

  try {
    const binary = atob(file.dataBase64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const approved = new File([bytes], file.name, { type: file.mimeType });
    const transfer = new DataTransfer();
    transfer.items.add(approved);
    for (const type of ["dragenter", "dragover", "drop"]) {
      dropTarget.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }),
      );
    }
    return { ok: true, name: file.name, bytes: bytes.length };
  } catch {
    return { ok: false, error: "The approved drop handoff could not be decoded." };
  }
}

/** Injected: compare post-action state without returning field values. */
function verifyPage(expectation) {
  const failures = [];
  if (expectation?.url && location.href !== expectation.url) failures.push("URL did not match");
  if (
    expectation?.text &&
    !(document.body?.innerText || "").toLowerCase().includes(String(expectation.text).toLowerCase())
  ) {
    failures.push("expected text was not visible");
  }
  for (const field of Array.isArray(expectation?.fields) ? expectation.fields : []) {
    const wanted = String(field.name || "").toLowerCase();
    const element = Array.from(document.querySelectorAll("input,select,textarea")).find((el) =>
      [el.getAttribute("name"), el.getAttribute("id"), el.getAttribute("aria-label")]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase() === wanted),
    );
    if (!element || !("value" in element) || element.value !== field.value) {
      failures.push(`field ${field.name} did not match`);
    }
  }
  return {
    verified: failures.length === 0,
    evidence:
      failures.length === 0
        ? "A separate post-action browser observation matched every expectation."
        : `Post-action observation failed: ${failures.join("; ")}.`,
  };
}

/** Injected: bounded polling for dynamic pages; never waits indefinitely. */
async function waitForPage(expectation, requestedTimeoutMs) {
  const timeoutMs = Math.min(10_000, Math.max(100, Number(requestedTimeoutMs) || 3_000));
  const deadline = Date.now() + timeoutMs;
  const target = expectation?.target || null;

  const findTarget = () => {
    if (!target) return { found: true, ambiguous: false };
    if (target.selector) {
      try {
        const exact = document.querySelector(target.selector);
        if (
          exact &&
          !exact.hidden &&
          !exact.hasAttribute("disabled") &&
          exact.getAttribute("aria-hidden") !== "true"
        ) {
          return { found: true, ambiguous: false };
        }
      } catch {
        // A stale selector falls through to semantic matching.
      }
    }
    const wanted = String(target.name || target.text || "")
      .trim()
      .toLowerCase();
    const role = String(target.role || "")
      .trim()
      .toLowerCase();
    const candidates = Array.from(
      document.querySelectorAll(
        "[role],button,a[href],input,select,textarea,[aria-label],[contenteditable]",
      ),
    ).filter((element) => {
      if (
        element.hidden ||
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-hidden") === "true"
      ) {
        return false;
      }
      const elementRole = (
        element.getAttribute("role") || element.tagName.toLowerCase()
      ).toLowerCase();
      const elementName = (
        element.getAttribute("aria-label") ||
        element.getAttribute("name") ||
        element.textContent ||
        ""
      )
        .trim()
        .toLowerCase();
      return (!role || elementRole === role) && (!wanted || elementName === wanted);
    });
    return { found: candidates.length === 1, ambiguous: candidates.length > 1 };
  };

  do {
    const targetState = findTarget();
    if (targetState.ambiguous) {
      return { ok: false, error: "The dynamic-page target is ambiguous." };
    }
    const textReady =
      !expectation?.text ||
      (document.body?.innerText || "")
        .toLowerCase()
        .includes(String(expectation.text).toLowerCase());
    if (targetState.found && textReady) {
      return {
        ok: true,
        waitedMs: timeoutMs - Math.max(0, deadline - Date.now()),
        evidence: "The bounded dynamic-page condition was observed.",
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  } while (Date.now() < deadline);

  return { ok: false, error: "The dynamic-page condition was not observed before timeout." };
}

/**
 * Injected: hide protected fields BEFORE any capture.
 *
 * The original inline filter is stashed on the element so `unmaskProtected` can
 * put the page back exactly as it was — leaving a page permanently blurred
 * because a capture failed would be a visible bug for the user.
 */
function maskProtected(selectors) {
  let count = 0;
  for (const sel of selectors) {
    let found;
    try {
      found = document.querySelectorAll(sel);
    } catch {
      continue; // ignore a malformed selector rather than abort the masking
    }
    for (const el of found) {
      if (el.dataset.ocadeMasked === undefined) {
        el.dataset.ocadePrevFilter = el.style.filter || "";
        el.dataset.ocadeMasked = "1";
      }
      el.style.filter = "blur(12px)";
      count++;
    }
  }
  return count;
}

/** Injected: restore every element masked for the capture. */
function unmaskProtected() {
  let restored = 0;
  for (const el of document.querySelectorAll("[data-ocade-masked]")) {
    el.style.filter = el.dataset.ocadePrevFilter || "";
    delete el.dataset.ocadePrevFilter;
    delete el.dataset.ocadeMasked;
    restored++;
  }
  return restored;
}

async function execute(msg) {
  switch (msg.kind) {
    case "connect": {
      pairingToken = newToken();
      pairingCode = null;
      pairingExpiresAt = 0;
      const manifest = chrome.runtime.getManifest();
      return reply("connect", {
        v: PROTOCOL_VERSION,
        token: pairingToken,
        identity: {
          runtimeId: chrome.runtime.id,
          name: manifest.name,
          version: manifest.version,
          manifestVersion: manifest.manifest_version,
        },
      });
    }

    case "tabs.list": {
      // Tab metadata only — no page content, so no host permission required.
      const tabs = await chrome.tabs.query({});
      return reply(
        "tabs.list",
        tabs
          .filter((t) => !t.incognito)
          .map((t) => ({
            id: String(t.id),
            windowId: t.windowId,
            title: t.title ?? "",
            url: t.url ?? "",
            active: !!t.active,
          })),
      );
    }

    case "tab.activate": {
      const tab = await targetTab(msg);
      if (!tab?.id || tab.incognito) return refuse("That tab is unavailable.");
      await chrome.tabs.update(tab.id, { active: true });
      if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
      return reply("tab.activate", { tabId: String(tab.id), active: true });
    }

    case "tab.create": {
      if (typeof msg.url !== "string" || !/^https?:\/\//i.test(msg.url)) {
        return refuse("Only HTTP and HTTPS tabs can be created.");
      }
      if (!(await ensureOriginPermission(msg.url))) {
        return refuse("You didn't grant OCADE access to this site.");
      }
      const tab = await chrome.tabs.create({ url: msg.url, active: false });
      return reply("tab.create", {
        tabId: String(tab.id),
        windowId: tab.windowId,
        requestedUrl: msg.url,
        active: !!tab.active,
      });
    }

    case "page.navigate": {
      const tab = await activeTab();
      if (!tab?.id || tab.incognito) return refuse("No approved active tab.");
      if (typeof msg.url !== "string" || !/^https?:\/\//i.test(msg.url)) {
        return refuse("Only HTTP and HTTPS navigation is supported.");
      }
      if (!(await ensureOriginPermission(msg.url))) {
        return refuse("You didn't grant OCADE access to this site.");
      }
      await chrome.tabs.update(tab.id, { url: msg.url });
      return reply("page.navigate", { tabId: String(tab.id), requestedUrl: msg.url });
    }

    case "page.summary":
    case "page.a11y": {
      const tab = await targetTab(msg);
      if (!tab?.id || !tab.url) return refuse("No active tab.");
      if (msg.url && !sameOrigin(tab.url, msg.url)) {
        return refuse("The active tab changed before OCADE could inspect it.");
      }
      if (!(await ensureOriginPermission(tab.url))) {
        return refuse("You didn't grant OCADE access to this site.");
      }
      const data = await runInTab(tab.id, msg.kind === "page.summary" ? collectDom : collectA11y);
      return reply(msg.kind, data);
    }

    case "page.wait": {
      const tab = await targetTab(msg);
      if (!tab?.id || !tab.url) return refuse("No active tab.");
      if (!msg.url || !sameOrigin(tab.url, msg.url)) {
        return refuse("The active tab changed before OCADE could wait for it.");
      }
      if (!(await ensureOriginPermission(tab.url))) {
        return refuse("You didn't grant OCADE access to this site.");
      }
      const result = await runInTab(tab.id, waitForPage, [msg.expectation || {}, msg.timeoutMs]);
      if (typeof msg.runId === "string" && cancelledRuns.has(msg.runId)) {
        return refuse("This browser run was cancelled.");
      }
      return result?.ok
        ? reply("page.wait", result)
        : refuse(result?.error || "The dynamic-page wait failed.");
    }

    case "page.screenshot": {
      const tab = await targetTab(msg);
      if (!tab?.id || !tab.url) return refuse("No active tab.");
      if (msg.url && !sameOrigin(tab.url, msg.url)) {
        return refuse("The active tab changed before OCADE could capture it.");
      }
      if (!(await ensureOriginPermission(tab.url))) {
        return refuse("You didn't grant OCADE access to this site.");
      }
      // Mask credential fields first — a screenshot must never capture them.
      // The baseline list is enforced HERE and cannot be reduced by the caller;
      // selectors sent by the app (from `screenshotRedaction`) only ADD to it.
      const baseline = [
        'input[type="password"]',
        'input[autocomplete*="one-time"]',
        'input[autocomplete*="cc-"]',
      ];
      const extra = Array.isArray(msg.maskSelectors)
        ? msg.maskSelectors.filter((s) => typeof s === "string" && s.length > 0 && s.length < 200)
        : [];
      const selectors = [...new Set([...baseline, ...extra])];

      const masked = await runInTab(tab.id, maskProtected, [selectors]);
      let dataUrl;
      try {
        dataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
      } finally {
        // Always restore, even if the capture threw — never leave the page blurred.
        await runInTab(tab.id, unmaskProtected, []);
      }
      return reply("page.screenshot", { dataUrl, maskedFields: masked });
    }

    case "form.fill": {
      const tab = await targetTab(msg);
      if (!tab?.id || !tab.url) return refuse("No active tab.");
      if (!msg.confirmed) return refuse("Form filling requires confirmation.");
      if (!msg.url || !sameOrigin(tab.url, msg.url)) {
        return refuse("The active tab changed before OCADE could fill it.");
      }
      if (!(await ensureOriginPermission(tab.url))) {
        return refuse("You didn't grant OCADE access to this site.");
      }
      if (!Array.isArray(msg.fields) || msg.fields.length < 1 || msg.fields.length > 100) {
        return refuse("The form field list is invalid.");
      }
      const result = await runInTab(tab.id, fillApprovedFields, [msg.fields]);
      return result?.ok
        ? reply("form.fill", result)
        : refuse(result?.error || "The approved fields could not be filled.");
    }

    case "form.submit": {
      const tab = await targetTab(msg);
      if (!tab?.id || !tab.url) return refuse("No active tab.");
      if (!msg.confirmed) return refuse("Form submission requires confirmation.");
      if (!msg.url || !sameOrigin(tab.url, msg.url)) {
        return refuse("The active tab changed before OCADE could submit.");
      }
      if (!(await ensureOriginPermission(tab.url))) {
        return refuse("You didn't grant OCADE access to this site.");
      }
      const result = await runInTab(tab.id, submitApprovedForm, [msg.target || null]);
      return result?.ok
        ? reply("form.submit", result)
        : refuse(result?.error || "The confirmed form could not be submitted.");
    }

    case "file.upload": {
      const tab = await targetTab(msg);
      if (!tab?.id || !tab.url) return refuse("No active tab.");
      if (!msg.confirmed) return refuse("File upload requires confirmation.");
      if (!msg.url || !sameOrigin(tab.url, msg.url)) {
        return refuse("The active tab changed before OCADE could upload.");
      }
      const file = msg.file;
      if (
        !file ||
        typeof file.name !== "string" ||
        typeof file.mimeType !== "string" ||
        typeof file.dataBase64 !== "string" ||
        file.dataBase64.length > 14_000_000
      ) {
        return refuse("The approved file handoff is invalid or too large.");
      }
      if (!(await ensureOriginPermission(tab.url))) {
        return refuse("You didn't grant OCADE access to this site.");
      }
      const result = await runInTab(tab.id, uploadApprovedFile, [msg.target || null, file]);
      return result?.ok
        ? reply("file.upload", result)
        : refuse(result?.error || "The approved file could not be handed off.");
    }

    case "file.drop": {
      const tab = await targetTab(msg);
      if (!tab?.id || !tab.url) return refuse("No active tab.");
      if (!msg.confirmed) return refuse("File drop requires confirmation.");
      if (!msg.url || !sameOrigin(tab.url, msg.url)) {
        return refuse("The active tab changed before OCADE could drop the file.");
      }
      const file = msg.file;
      if (
        !file ||
        typeof file.name !== "string" ||
        typeof file.mimeType !== "string" ||
        typeof file.dataBase64 !== "string" ||
        file.dataBase64.length > 14_000_000
      ) {
        return refuse("The approved file handoff is invalid or too large.");
      }
      if (!(await ensureOriginPermission(tab.url))) {
        return refuse("You didn't grant OCADE access to this site.");
      }
      const result = await runInTab(tab.id, dropApprovedFile, [msg.target || null, file]);
      return result?.ok
        ? reply("file.drop", result)
        : refuse(result?.error || "The approved file could not be dropped.");
    }

    case "file.download": {
      if (!msg.confirmed) return refuse("Download requires confirmation.");
      if (
        typeof msg.url !== "string" ||
        !/^https?:\/\//i.test(msg.url) ||
        typeof msg.filename !== "string" ||
        !msg.filename ||
        /[\\/:*?"<>|]/.test(msg.filename)
      ) {
        return refuse("The download request is invalid.");
      }
      if (!(await ensureOriginPermission(msg.url))) {
        return refuse("You didn't grant OCADE access to this site.");
      }
      if (!(await ensureDownloadsPermission())) {
        return refuse("You didn't grant OCADE download access.");
      }
      const downloadId = await chrome.downloads.download({
        url: msg.url,
        filename: msg.filename,
        saveAs: true,
      });
      return reply("file.download", { downloadId, filename: msg.filename });
    }

    case "page.verify": {
      const tab = await targetTab(msg);
      if (!tab?.id || !tab.url) return refuse("No active tab.");
      if (msg.url && !sameOrigin(tab.url, msg.url)) {
        return refuse("The active tab changed before OCADE could verify the action.");
      }
      if (!(await ensureOriginPermission(tab.url))) {
        return refuse("You didn't grant OCADE access to this site.");
      }
      const result = await runInTab(tab.id, verifyPage, [msg.expectation || {}]);
      return reply("page.verify", result);
    }

    case "run.cancel": {
      if (typeof msg.runId !== "string" || !msg.runId) return refuse("A run id is required.");
      cancelledRuns.add(msg.runId);
      runStates.set(msg.runId, {
        status: "cancelled",
        kind: "run.cancel",
        operationId: msg.operationId || null,
        updatedAt: new Date().toISOString(),
      });
      return reply("run.cancel", {
        acknowledged: true,
        detail: `Browser run ${msg.runId} is cancelled.`,
      });
    }

    case "emergency.stop": {
      emergencyStopped = true;
      cancelledRuns.clear();
      for (const [runId, state] of runStates) {
        if (state.status === "running") {
          runStates.set(runId, {
            ...state,
            status: "stopped",
            updatedAt: new Date().toISOString(),
          });
        }
      }
      return reply("emergency.stop", {
        acknowledged: true,
        detail: "Browser emergency stop is latched.",
      });
    }

    default:
      return refuse("Unsupported request.");
  }
}

async function handle(msg, sender) {
  const check = validate(msg);
  if (!check.ok) return check;

  // Incognito is refused at the manifest level; re-check defensively.
  if (sender?.tab?.incognito) return refuse("OCADE does not act inside private windows.");

  if (msg.kind === "run.progress") {
    if (typeof msg.runId !== "string" || !msg.runId) return refuse("A run id is required.");
    return reply(
      "run.progress",
      runStates.get(msg.runId) || {
        status: "unknown",
        kind: null,
        operationId: null,
        updatedAt: null,
      },
    );
  }

  const tracked =
    typeof msg.runId === "string" &&
    msg.runId.length > 0 &&
    msg.kind !== "run.cancel" &&
    msg.kind !== "emergency.stop" &&
    msg.kind !== "connect";
  if (tracked) {
    runStates.set(msg.runId, {
      status: "running",
      kind: msg.kind,
      operationId: msg.operationId || null,
      updatedAt: new Date().toISOString(),
    });
    while (runStates.size > 200) runStates.delete(runStates.keys().next().value);
  }

  try {
    const response = await execute(msg);
    if (tracked) {
      runStates.set(msg.runId, {
        status: response.ok ? "completed" : "failed",
        kind: msg.kind,
        operationId: msg.operationId || null,
        detail: response.ok ? "The extension completed the operation." : response.error,
        updatedAt: new Date().toISOString(),
      });
    }
    return response;
  } catch (error) {
    if (tracked) {
      runStates.set(msg.runId, {
        status: "failed",
        kind: msg.kind,
        operationId: msg.operationId || null,
        detail: error instanceof Error ? error.message : "The extension operation failed.",
        updatedAt: new Date().toISOString(),
      });
    }
    throw error;
  }
}

// The extension popup is the user-presence factor for pairing. An external
// page cannot call this internal listener.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.kind !== "pairing.begin") return false;
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  pairingCode = String(bytes[0] % 1_000_000).padStart(6, "0");
  pairingExpiresAt = Date.now() + 5 * 60_000;
  pairingToken = null;
  emergencyStopped = false;
  cancelledRuns.clear();
  sendResponse({ ok: true, pairingCode, expiresAt: pairingExpiresAt });
  return false;
});

// Only the origins pinned in `externally_connectable` can reach this.
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  handle(msg, sender)
    .then(sendResponse)
    .catch(() => sendResponse(refuse("The OCADE extension could not complete that request.")));
  return true; // keep the channel open for the async reply
});

// Dropping the token on suspend means a new session must pair again.
chrome.runtime.onSuspend?.addListener(() => {
  pairingToken = null;
});
