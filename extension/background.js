/*
 * OCADE JARVIS browser extension — the narrow bridge to the person's own browser.
 *
 * WHAT IT DOES. Enrolls this browser as an OCADE device with its own key (the
 * shared device protocol, ocade_protocol.json), then runs the browser actions a
 * JARVIS task sends — only in tabs this extension opened itself. It never
 * reads, injects into or closes any other tab. Reading a page uses the same
 * page semantics as the Device Agent (ocade_page.js); the purchase and
 * sensitive-submission gates come from the same contract.
 *
 * WHAT IT NEVER DOES. It holds no provider key and calls no model; it never
 * extracts stored passwords; it stops at CAPTCHA, one-time codes, passkeys
 * and password fields and hands the tab to the person.
 */
import CONTRACT from "./ocade_protocol.js";
import { SERVER } from "./config.js";

// Service workers cannot await at the top level; the page semantics load on first use.
let PAGE = null;
const page = async () =>
  (PAGE ??= await (await fetch(chrome.runtime.getURL("ocade_page.js"))).text());
const PURCHASE = new RegExp(CONTRACT.gates.purchase, "i");
const SENSITIVE = new RegExp(CONTRACT.gates.sensitive, "i");
const KEYS = {
  Enter: 13,
  Tab: 9,
  Escape: 27,
  ArrowUp: 38,
  ArrowDown: 40,
  ArrowLeft: 37,
  ArrowRight: 39,
  PageUp: 33,
  PageDown: 34,
  Home: 36,
  End: 35,
  Backspace: 8,
  Space: 32,
};

/* --- identity: a non-extractable P-256 key kept in IndexedDB ----------------- */

const db = () =>
  new Promise((resolve, reject) => {
    const open = indexedDB.open("ocade", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("keys");
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
async function stored(name, value) {
  const store = (await db())
    .transaction("keys", value === undefined ? "readonly" : "readwrite")
    .objectStore("keys");
  return new Promise((resolve, reject) => {
    const request =
      value === undefined
        ? store.get(name)
        : value === null
          ? store.delete(name)
          : store.put(value, name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const hex = async (text) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

let lastStamp = 0;
async function post(path, body, keyPair, deviceId) {
  const raw = JSON.stringify(body);
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  const device = deviceId ?? "-";
  const text = [
    CONTRACT.signing.prefix,
    String(CONTRACT.version),
    "POST",
    path,
    device,
    String(lastStamp),
    await hex(raw),
  ].join("\n");
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.privateKey,
    new TextEncoder().encode(text),
  );
  const h = CONTRACT.headers;
  const response = await fetch(SERVER + path, {
    method: "POST",
    body: raw,
    headers: {
      "content-type": "application/json",
      [h.device]: device,
      [h.protocol]: String(CONTRACT.version),
      [h.timestamp]: String(lastStamp),
      [h.signature]: b64url(signature),
    },
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function state() {
  return (await chrome.storage.local.get("ocade")).ocade ?? {};
}
async function setState(patch) {
  await chrome.storage.local.set({ ocade: { ...(await state()), ...patch } });
}

async function connect() {
  const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
    "verify",
  ]);
  const publicKey = b64url(await crypto.subtle.exportKey("spki", keyPair.publicKey));
  const reply = await post(
    CONTRACT.paths.enroll,
    {
      publicKey,
      name: "Chrome on this computer",
      kind: "extension",
      softwareVersion: chrome.runtime.getManifest().version,
    },
    keyPair,
  );
  if (reply.status !== 200) throw new Error(reply.body.error ?? `status ${reply.status}`);
  await stored("key", keyPair);
  await setState({
    deviceId: reply.body.deviceId,
    approved: false,
    fingerprint: reply.body.fingerprint,
    status: "waiting",
  });
  await chrome.tabs.create({ url: SERVER + reply.body.approve });
  poll();
}

async function forget(tellOcade = true) {
  const { deviceId } = await state();
  const keyPair = await stored("key");
  if (tellOcade && deviceId && keyPair) {
    // Disconnecting ends this browser's key in OCADE too, not only here.
    await post(CONTRACT.paths.exchange, { results: [], forget: true }, keyPair, deviceId).catch(
      () => null,
    );
  }
  await stored("key", null);
  await chrome.storage.local.remove("ocade");
}

/* --- the tabs JARVIS owns, and nothing else --------------------------------------- */

async function ownTabs() {
  const { tabs = [] } = await chrome.storage.session.get("tabs");
  const live = [];
  for (const id of tabs) {
    try {
      await chrome.tabs.get(id);
      live.push(id);
    } catch {
      /* closed by the person */
    }
  }
  return live;
}
const saveTabs = (tabs) => chrome.storage.session.set({ tabs });

const attached = new Set();
// Set by detachAll: the running action may not re-attach and carry on.
let halted = false;
chrome.debugger.onDetach.addListener(({ tabId }) => attached.delete(tabId));
async function cdp(tabId, method, params = {}) {
  if (!(await ownTabs()).includes(tabId)) throw new Error("not an OCADE tab");
  if (halted) throw new Error("Stopped before it finished");
  if (!attached.has(tabId)) {
    await chrome.debugger.attach({ tabId }, "1.3");
    attached.add(tabId);
    // Every request of an OCADE tab passes the network guard from here on.
    await chrome.debugger.sendCommand({ tabId }, "Fetch.enable", {
      patterns: [{ urlPattern: "*" }],
    });
    await chrome.debugger.sendCommand({ tabId }, "Network.enable", {});
  }
  return chrome.debugger.sendCommand({ tabId }, method, params);
}

/** Let go of every OCADE tab: Stop, disconnect, revoke and task end all end control. */
async function detachAll() {
  halted = true;
  for (const tabId of [...attached]) {
    await chrome.debugger.detach({ tabId }).catch(() => null);
    attached.delete(tabId);
  }
}

/* --- the network guard: OCADE tabs never reach the device's own network ------------ */

// Sites the person allowed in OCADE (sent with each command): only these may be private.
let allowedSites = [];
let privateHit = null;
const allowed = (host) => {
  const labels = host.split(".");
  return labels.some((_, at) => allowedSites.includes(labels.slice(at).join(".")));
};
function privateAddress(raw) {
  let host = raw.replace(/^\[|\]$/g, "").toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(host);
  if (mapped) host = mapped[1];
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.lan|.*\.home)$/.test(host)) return true;
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (host.includes(":")) return /^(::1?$|f[cd]|fe[89ab]|ff)/.test(host);
  return false;
}
chrome.debugger.onEvent.addListener(({ tabId }, method, params) => {
  if (!attached.has(tabId)) return;
  if (method === "Fetch.requestPaused") {
    let host = "";
    try {
      host = new URL(params.request.url).hostname;
    } catch {
      /* data:, blob: and similar stay in the page */
    }
    if (host && privateAddress(host) && !allowed(host)) {
      privateHit = `${host} is on a private network`;
      chrome.debugger
        .sendCommand({ tabId }, "Fetch.failRequest", {
          requestId: params.requestId,
          errorReason: "BlockedByClient",
        })
        .catch(() => null);
    } else {
      chrome.debugger
        .sendCommand({ tabId }, "Fetch.continueRequest", { requestId: params.requestId })
        .catch(() => null);
    }
  } else if (method === "Network.responseReceived") {
    // A public-looking name that resolved privately (the browser resolves it
    // itself): nothing seen there is used, and the tab leaves the page.
    const address = params.response?.remoteIPAddress;
    let host = "";
    try {
      host = new URL(params.response.url).hostname;
    } catch {
      /* not a network response */
    }
    if (address && privateAddress(address) && !allowed(host)) {
      privateHit = `${host} reached a private network address`;
    }
  }
});
async function run(tabId, body, arg) {
  const expression = `(() => { ${await page()}\n return (${body})(${JSON.stringify(arg ?? null)}); })()`;
  const out = await cdp(tabId, "Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (out.exceptionDetails) throw new Error(out.exceptionDetails.text ?? "page script failed");
  return out.result.value;
}
async function settle(tabId) {
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await run(tabId, "() => document.readyState")) !== "loading") return;
    } catch {
      /* navigating */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

let active = null;
let seq = 0;
let held = {};
let boundary = null;

async function geometry(tabId) {
  const geo = await run(tabId, "() => ({ ...window.__ocade.geometry(), url: location.href })");
  return { ...geo, tab: (await ownTabs()).indexOf(tabId) };
}

async function observe(tabId, withFrame = false) {
  await settle(tabId);
  const snap = await run(tabId, "() => window.__ocade.snapshot()");
  const geo = await geometry(tabId);
  boundary = snap.boundary;
  seq += 1;
  const id = `o${seq}`;
  held = {
    [id]: {
      tabId,
      geometry: geo,
      refs: Object.fromEntries(snap.elements.map((e) => [e.ref, [e.role, e.name]])),
    },
  };
  const tabs = [];
  for (const [index, own] of (await ownTabs()).entries()) {
    const tab = await chrome.tabs.get(own);
    tabs.push({
      index,
      title: (tab.title ?? "").slice(0, 80),
      url: (tab.url ?? "").slice(0, 300),
      active: own === tabId,
    });
  }
  const out = {
    observationId: id,
    url: geo.url,
    title: (await run(tabId, "() => document.title")).slice(0, 120),
    tabs,
    viewport: { w: geo.w, h: geo.h, dpr: geo.dpr, zoom: geo.zoom, sx: geo.sx, sy: geo.sy },
    elements: snap.elements,
    text: snap.text,
    humanBoundary: snap.boundary,
  };
  if (withFrame) out.frame = await frame(tabId);
  return out;
}

async function frame(tabId) {
  try {
    return (await cdp(tabId, "Page.captureScreenshot", { format: "jpeg", quality: 45 })).data;
  } catch {
    return null;
  }
}

function gate(kind, info, confirmed) {
  const name = String(info?.name ?? "");
  if (kind === "type") {
    if (info.card)
      return { status: "blocked", summary: "JARVIS never enters payment card details" };
    if (info.password)
      return {
        status: "human_required",
        summary: "A password is needed. Take over and type it yourself.",
      };
    return null;
  }
  if (PURCHASE.test(name))
    return { status: "blocked", summary: "JARVIS never completes a purchase or payment" };
  if (SENSITIVE.test(name) && !confirmed)
    return {
      status: "needs_confirmation",
      summary: `Confirm before JARVIS presses “${name.slice(0, 60)}”`,
    };
  return null;
}

async function stale(tabId, observationId) {
  const was = held[observationId];
  if (!was || was.tabId !== tabId) return "That observation is no longer current.";
  const now = await geometry(tabId);
  const labels = {
    url: "the page navigated",
    tab: "the tab changed",
    w: "the viewport resized",
    h: "the viewport resized",
    dpr: "the display scale changed",
    zoom: "the zoom changed",
    sx: "the page scrolled",
    sy: "the page scrolled",
    m: "the page content changed",
  };
  for (const [key, label] of Object.entries(labels)) {
    if (now[key] !== was.geometry[key]) return `Geometry is stale: ${label}.`;
  }
  return null;
}

async function target(tabId, ref, observationId) {
  const was = held[observationId];
  if (!was || was.tabId !== tabId || !was.refs[ref])
    return [null, "That element is not in the current observation."];
  const live = await run(
    tabId,
    "(ref) => { const el = window.__ocade.byRef(ref); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { ...window.__ocade.identityOf(el), x: r.left + r.width / 2, y: r.top + r.height / 2 }; }",
    ref,
  );
  if (!live) return [null, "That element is gone from the page."];
  const [role, name] = was.refs[ref];
  if (live.role !== role || live.name !== name)
    return [null, "That element changed since it was observed."];
  return [live, null];
}

async function click(tabId, x, y) {
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await cdp(tabId, "Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  }
}
async function key(tabId, name) {
  const code = KEYS[name];
  const base = {
    key: name === "Space" ? " " : name,
    code: name,
    windowsVirtualKeyCode: code,
    nativeVirtualKeyCode: code,
  };
  await cdp(tabId, "Input.dispatchKeyEvent", {
    type: "keyDown",
    ...base,
    ...(name === "Enter" ? { text: "\r" } : {}),
  });
  await cdp(tabId, "Input.dispatchKeyEvent", { type: "keyUp", ...base });
}

async function open(url, newTab) {
  const tabs = await ownTabs();
  if (newTab || active === null || !tabs.includes(active)) {
    // A blank tab first, so the network guard is in place before the first request.
    const tab = await chrome.tabs.create({ url: "about:blank", active: false });
    await saveTabs([...tabs, tab.id]);
    active = tab.id;
  }
  await cdp(active, "Page.navigate", { url });
  await new Promise((r) => setTimeout(r, 300));
  await settle(active);
}

/** One action inside the network guard: a private address ends it with nothing read. */
async function act(action, confirmed) {
  privateHit = null;
  halted = false;
  const outcome = await actOnce(action, confirmed);
  if (!privateHit) return outcome;
  if (active !== null) await cdp(active, "Page.navigate", { url: "about:blank" }).catch(() => null);
  return { status: "blocked", summary: `Stopped: ${privateHit.slice(0, 200)}` };
}

/** One action, verified by observing the page it leaves. */
async function actOnce(action, confirmed) {
  const kind = action.action;
  const tabs = await ownTabs();
  if (!tabs.includes(active)) active = tabs.at(-1) ?? null;
  if (["open", "new_tab"].includes(kind)) {
    const url = /^https?:\/\//i.test(action.url) ? action.url : `https://${action.url}`;
    if (!/^https?:\/\//i.test(url))
      return { status: "blocked", summary: "Only web addresses can be opened" };
    await open(url, kind === "new_tab" || action.newTab);
    return {
      status: "done",
      summary: `Opened ${url.slice(0, 120)}`,
      observation: await observe(active),
    };
  }
  if (active === null) return { status: "failed", summary: "Open a page first" };
  if (kind === "observe")
    return { status: "done", summary: "Looked at the page", observation: await observe(active) };
  if (kind === "look")
    return {
      status: "done",
      summary: "Looked at the screen",
      observation: await observe(active, true),
    };
  if (
    ["click", "type", "select", "press", "click_at"].includes(kind) &&
    ["captcha", "otp", "passkey"].includes(boundary)
  ) {
    return {
      status: "human_required",
      summary: "This page needs a person to verify. Take over to continue.",
    };
  }
  const before = await geometry(active);
  let detail = "";
  if (kind === "switch_tab") {
    if (!(action.index >= 0 && action.index < tabs.length))
      return { status: "failed", summary: "That tab does not exist" };
    active = tabs[action.index];
    detail = `Switched to tab ${action.index + 1}`;
  } else if (kind === "close_tab") {
    if (tabs.length <= 1) return { status: "failed", summary: "The last tab stays open" };
    await chrome.tabs.remove(active);
    await saveTabs(tabs.filter((id) => id !== active));
    active = tabs.filter((id) => id !== active).at(-1);
    detail = "Closed the tab";
  } else if (kind === "back" || kind === "forward") {
    await run(active, `() => history.${kind}()`);
    await new Promise((r) => setTimeout(r, 400));
    detail = `Went ${kind}`;
  } else if (kind === "scroll") {
    await cdp(active, "Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: before.w / 2,
      y: before.h / 2,
      deltaX: 0,
      deltaY: action.direction === "up" ? -600 : 600,
    });
    await new Promise((r) => setTimeout(r, 300));
    detail = `Scrolled ${action.direction}`;
  } else if (kind === "wait") {
    await new Promise((r) => setTimeout(r, Math.min(5, Math.max(0.2, action.seconds)) * 1000));
    detail = "Waited";
  } else if (["click", "type", "select"].includes(kind)) {
    const [info, why] = await target(active, action.ref, action.observationId);
    if (!info) return { status: "stale", summary: why, observation: await observe(active) };
    const blocked = gate(kind, info, confirmed);
    if (blocked) return blocked;
    if (kind === "click") {
      await click(active, info.x, info.y);
      detail = `Clicked “${info.name || info.role}”`;
    } else if (kind === "type") {
      const text = String(action.text ?? "").slice(0, 2000);
      await run(
        active,
        "(ref) => { const el = window.__ocade.byRef(ref); el.focus(); if ('value' in el) el.value = ''; }",
        action.ref,
      );
      await cdp(active, "Input.insertText", { text });
      const value = await run(active, "(ref) => window.__ocade.byRef(ref).value", action.ref);
      if (info.editable && value !== text)
        return {
          status: "failed",
          summary: "The field did not take the text",
          observation: await observe(active),
        };
      if (action.submit) {
        const submit = gate(
          "submit",
          await run(
            active,
            "(ref) => window.__ocade.submitOf(window.__ocade.byRef(ref))",
            action.ref,
          ),
          confirmed,
        );
        if (submit) return submit;
        await key(active, "Enter");
      }
      detail = `Typed into “${info.name || "a field"}”`;
    } else {
      const chosen = await run(
        active,
        "([ref, label]) => { const el = window.__ocade.byRef(ref); const o = [...el.options].find((x) => x.label === label || x.text === label); if (!o) return false; el.value = o.value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; }",
        [action.ref, action.option],
      );
      if (!chosen) return { status: "failed", summary: "That option does not exist" };
      detail = `Chose “${action.option}”`;
    }
  } else if (kind === "press") {
    if (!(action.key in KEYS)) return { status: "blocked", summary: "That key is not allowed" };
    if (action.key === "Enter") {
      const submit = gate(
        "submit",
        await run(active, "() => window.__ocade.submitOf(document.activeElement)"),
        confirmed,
      );
      if (submit) return submit;
    }
    await key(active, action.key);
    detail = `Pressed ${action.key}`;
  } else if (kind === "click_at") {
    const why = await stale(active, action.observationId);
    if (why) return { status: "stale", summary: why, observation: await observe(active) };
    if (!(action.x >= 0 && action.x <= before.w && action.y >= 0 && action.y <= before.h))
      return { status: "failed", summary: "That point is outside the page" };
    const blocked = gate(
      "click",
      await run(active, "([x, y]) => window.__ocade.atPoint(x, y)", [action.x, action.y]),
      confirmed,
    );
    if (blocked) return blocked;
    await click(active, action.x, action.y);
    detail = "Clicked a point on the page";
  } else {
    return { status: "failed", summary: "This browser only runs browser actions" };
  }
  await new Promise((r) => setTimeout(r, 300));
  await settle(active);
  const observation = await observe(active);
  const after = await geometry(active);
  const changed = ["url", "tab", "m", "sy"].filter((k) => after[k] !== before[k]);
  return { status: "done", summary: detail.slice(0, 280), changed, observation };
}

/* --- the exchange ------------------------------------------------------------------ */

let polling = false;
let stopRequested = false;

async function poll() {
  if (polling) return;
  polling = true;
  try {
    let results = [];
    let shot = null;
    for (;;) {
      const { deviceId } = await state();
      const keyPair = await stored("key");
      if (!deviceId || !keyPair) return;
      const body = {
        results,
        capabilities: { browser_real: true, browser_isolated: false },
        softwareVersion: chrome.runtime.getManifest().version,
      };
      if (stopRequested) body.stop = true;
      if (shot) body.frame = shot;
      let reply;
      try {
        reply = await post(CONTRACT.paths.exchange, body, keyPair, deviceId);
      } catch {
        await setState({ status: "offline" });
        return;
      }
      if (reply.status === 202) {
        // Waiting for the person to approve this browser in OCADE.
        await setState({ status: "waiting" });
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      if ([401, 403, 410].includes(reply.status)) {
        await detachAll();
        await forget(false);
        return;
      }
      if (reply.status === 426) {
        await setState({ status: "update" });
        return;
      }
      if (reply.status !== 200 || reply.body.deviceId !== deviceId) return;
      stopRequested = false;
      await setState({
        approved: true,
        status: reply.body.busy ? "working" : "connected",
        task: reply.body.task ?? null,
      });
      results = [];
      shot = null;
      if (!reply.body.busy && !(reply.body.commands ?? []).length) await detachAll();
      for (const command of (reply.body.commands ?? []).slice(0, 1)) {
        allowedSites = command.sites ?? [];
        let outcome;
        let settled = false;
        const running = act(command.action, Boolean(command.confirmed))
          .catch((error) => ({
            status: "failed",
            summary: `The action failed: ${String(error.message ?? error).slice(0, 160)}`,
          }))
          .finally(() => (settled = true));
        // While it runs, keep asking OCADE whether to stop (web STOP, Take Over),
        // and let the popup's STOP through at once. Detaching ends the action.
        while (!settled) {
          await Promise.race([running, new Promise((r) => setTimeout(r, 1000))]);
          if (settled) break;
          const check = {
            results: [],
            running: [command.id],
            ...(stopRequested && { stop: true }),
          };
          const live = await post(CONTRACT.paths.exchange, check, keyPair, deviceId).catch(
            () => null,
          );
          if (live?.status === 200) stopRequested = false;
          if (stopRequested || live?.body?.cancel?.includes(command.id)) await detachAll();
        }
        outcome = await running;
        const picture =
          outcome.observation?.frame ?? (active !== null ? await frame(active) : null);
        if (outcome.observation) delete outcome.observation.frame;
        if (picture && picture.length <= 400_000) shot = { taskId: command.taskId, jpeg: picture };
        results.push({ id: command.id, ...outcome });
      }
      if (!reply.body.busy && results.length === 0) return;
      if (results.length === 0) await new Promise((r) => setTimeout(r, 1000));
    }
  } finally {
    polling = false;
  }
}

chrome.alarms.create("ocade-poll", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => poll());
chrome.runtime.onStartup.addListener(() => poll());
chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  (async () => {
    if (message === "connect") await connect();
    if (message === "stop") {
      stopRequested = true;
      await detachAll(); // ends whatever JARVIS is doing in its tabs now
      await poll();
    }
    if (message === "forget") {
      await detachAll();
      await forget();
    }
    if (message === "poll") await poll();
    reply({ ...(await state()), server: SERVER });
  })().catch((error) => reply({ error: String(error.message ?? error), server: SERVER }));
  return true;
});
poll();
