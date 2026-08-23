/**
 * OCADE Cowork executor.
 *
 * The website is the interface; this is the part that can actually touch the
 * browser. It owns three things the page cannot reach:
 *
 *   1. THE SCOPE. A command runs only against a tab whose ORIGIN the user has
 *      approved. Nothing in a page can add an origin — approval arrives from
 *      the extension's own popup, and is compared by origin rather than by
 *      substring, so "https://evil.example/#bank.example" is not the bank.
 *
 *   2. THE CONTROL LATCH. Pause, stop and take-over. Stop and take-over are
 *      LATCHES: once set, every subsequent command is refused until the person
 *      clears them. A latch that anything else can clear is not a stop button.
 *
 *   3. VERIFICATION. Every mutating command observes the page, acts, observes
 *      again, and reports what actually changed. A click that returned without
 *      throwing is not evidence that anything happened, and this never reports
 *      it as though it were.
 */

import {
  RUNNING,
  PAUSED,
  STOPPED,
  HANDED_OVER,
  COMMANDS,
  MUTATING,
  isAuthorized,
  isProtectedField,
  sanitisePageText,
} from "./protocol.js";

/**
 * Control state OUTLIVES THE SERVICE WORKER.
 *
 * MV3 terminates an idle worker after about thirty seconds and starts a fresh
 * one on the next event. Holding the latch only in memory meant a run the
 * person had STOPPED came back RUNNING the moment the worker recycled — the
 * stop button would work for half a minute and then quietly stop working.
 * There is no worse failure mode in this file.
 *
 * So the latch is written to `chrome.storage.session` on every change and read
 * back before every command. Session storage is cleared when the browser
 * closes, which is the right lifetime: a new browser session starts clean, and
 * nothing within a session can lose a stop.
 */
const state = {
  control: RUNNING,
  /** Origins the USER approved, in this browser. */
  approvedOrigins: [],
  /** Why the run stopped or handed over, shown to the person in the popup. */
  reason: null,
  /** Set when a run is waiting for the person to do something themselves. */
  handover: null,
};

const STORAGE_KEY = "ocade.cowork.scope";
const CONTROL_KEY = "ocade.cowork.control";

async function loadScope() {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const origins = stored?.[STORAGE_KEY];
    if (Array.isArray(origins)) state.approvedOrigins = origins;
  } catch {
    // No stored scope is the correct default: nothing is approved.
  }
}
const scopeReady = loadScope();

async function saveScope() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state.approvedOrigins });
}

async function loadControl() {
  try {
    const stored = await chrome.storage.session.get(CONTROL_KEY);
    const saved = stored?.[CONTROL_KEY];
    if (saved && typeof saved.control === "string") {
      state.control = saved.control;
      state.reason = saved.reason ?? null;
      state.handover = saved.handover ?? null;
    }
  } catch {
    // Nothing persisted yet: RUNNING is the correct default for a new session.
  }
}

async function saveControl() {
  try {
    await chrome.storage.session.set({
      [CONTROL_KEY]: { control: state.control, reason: state.reason, handover: state.handover },
    });
  } catch {
    // If this fails the latch is still correct for THIS worker; the next one
    // re-reads and finds nothing, which is why the write is the first thing
    // every control command does.
  }
}

function status() {
  return {
    control: state.control,
    approvedOrigins: [...state.approvedOrigins],
    reason: state.reason,
    handover: state.handover,
  };
}

/**
 * A refusal, phrased for the person rather than for the log.
 * `blocked: true` marks the cases where OCADE should stop asking and wait.
 */
function refuse(reason, extra = {}) {
  return { ok: false, reason, ...extra, status: status() };
}

/** The gate every command passes through. */
function checkControl() {
  if (state.control === STOPPED)
    return refuse("OCADE was stopped. Start a new run when you are ready.", { blocked: true });
  if (state.control === HANDED_OVER)
    return refuse(
      state.handover?.message ??
        "OCADE handed control back to you. Finish in the tab, then press Resume.",
      { blocked: true, handover: state.handover },
    );
  if (state.control === PAUSED) return refuse("OCADE is paused.", { blocked: true });
  return null;
}

async function tabFor(tabId) {
  const tab = tabId
    ? await chrome.tabs.get(tabId)
    : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!tab) throw new Error("There is no tab to act in.");
  return tab;
}

/** Scope is checked against the tab's CURRENT url, immediately before acting. */
function requireScope(tab) {
  if (!isAuthorized(tab.url ?? "", state.approvedOrigins)) {
    return refuse(
      `That tab is outside the sites you approved for OCADE (${tab.url ? new URL(tab.url).origin : "unknown"}). Approve it in the OCADE Cowork popup first.`,
      { blocked: true },
    );
  }
  return null;
}

async function inPage(tabId, command, argument) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ["src/content.js"] });
  return chrome.tabs.sendMessage(tabId, { command, argument });
}

async function observeTab(tabId) {
  const result = await inPage(tabId, "observe", {});
  if (!result?.ok) return null;
  const observation = result.observation;
  const { text, injectionAttempts } = sanitisePageText(observation.text);
  return { ...observation, text, injectionAttempts };
}

/** Wait for a navigation or an SPA update to settle, without a blind sleep. */
async function settle(tabId, previousSignature, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 150));
    let observation;
    try {
      observation = await observeTab(tabId);
    } catch {
      continue; // mid-navigation: the page is being replaced
    }
    if (!observation) continue;
    last = observation;
    if (observation.readyState === "complete" && observation.signature !== previousSignature) {
      return observation;
    }
  }
  return last;
}

/**
 * OBSERVE -> ACT -> OBSERVE AGAIN -> VERIFY.
 *
 * The result carries both observations and an explicit `verified`. When nothing
 * measurably changed, that is reported as `verified: false` WITH the evidence,
 * rather than as a success — a click that hit nothing looks exactly like a
 * click that worked, right up until the run continues on a false premise.
 */
async function runMutating(tab, command, argument) {
  const before = await observeTab(tab.id);
  if (!before) return refuse("The page could not be read, so nothing was attempted.");

  const acted = await inPage(tab.id, command === "form.fill" ? "type" : command, argument);
  if (!acted?.ok) return refuse(acted?.reason ?? "The action could not be performed.");

  const after = (await settle(tab.id, before.signature)) ?? (await observeTab(tab.id));
  const changed = Boolean(after) && after.signature !== before.signature;

  return {
    ok: true,
    verified: changed,
    evidence: changed
      ? `The page changed after ${command}: ${before.signature} -> ${after.signature}`
      : `No measurable change after ${command}. The action was performed but nothing on the page moved, so this is NOT reported as done.`,
    before: { url: before.url, title: before.title, signature: before.signature },
    after: after ? { url: after.url, title: after.title, signature: after.signature } : null,
    observation: after,
    status: status(),
  };
}

/**
 * A field the person must fill themselves. The run does not fail and does not
 * guess: it latches to HANDED_OVER, says what is needed and where, and waits.
 */
async function handOver(field, tab) {
  /*
   * THE CHECKPOINT IS TAKEN HERE, BEFORE THE PERSON TOUCHES ANYTHING.
   *
   * A hand-over exists because someone is about to sign in, and signing in is
   * the single most disruptive thing that can happen to a page: the DOM the
   * plan was built against is gone by the time control comes back. Resuming
   * without re-reading the page means acting on element references that
   * described a login form. Recording what the page looked like at the moment
   * OCADE stepped back is what makes the comparison on resume possible.
   */
  const checkpoint = await observeTab(tab.id).catch(() => null);
  state.control = HANDED_OVER;
  state.handover = {
    what: field,
    tabId: tab.id,
    url: tab.url,
    checkpoint: checkpoint
      ? { url: checkpoint.url, title: checkpoint.title, signature: checkpoint.signature }
      : null,
    message: `OCADE will not type a ${field}. Please enter it yourself in this tab, then press Resume in the OCADE Cowork popup.`,
  };
  void saveControl();
  return refuse(state.handover.message, { blocked: true, handover: state.handover });
}

/**
 * Coming back after a hand-over: RE-OBSERVE, then say whether what OCADE
 * believed is still true.
 *
 * The page has almost certainly changed — that is what signing in does — so a
 * change is not an error here. It is the signal that every element reference
 * from before the hand-over is stale and the next step has to be re-planned
 * against the observation returned with this reply, rather than resumed from
 * memory. When the tab cannot be read at all, the honest answer is to ask for
 * a refresh rather than to guess.
 */
async function resumeFromCheckpoint(handover) {
  if (!handover?.tabId) return { resumed: true, stale: false, detail: "Resumed." };

  let tab = null;
  try {
    tab = await chrome.tabs.get(handover.tabId);
  } catch {
    return {
      resumed: true,
      stale: true,
      needsRefresh: true,
      detail:
        "The tab OCADE handed over is no longer open. Open the page again so OCADE can read it before continuing.",
    };
  }

  // Scope is re-checked on the CURRENT url: a sign-in can land somewhere else
  // entirely, and approval given for one origin is not approval for another.
  if (!isAuthorized(tab.url ?? "", state.approvedOrigins)) {
    return {
      resumed: true,
      stale: true,
      needsRefresh: true,
      detail: `That tab is now on ${tab.url ? new URL(tab.url).origin : "an unknown page"}, which is outside the sites you approved for OCADE. Approve it in the popup, or return the tab to the approved site.`,
    };
  }

  const now = await observeTab(handover.tabId).catch(() => null);
  if (!now) {
    return {
      resumed: true,
      stale: true,
      needsRefresh: true,
      detail:
        "The page could not be read after the hand-over. Refresh the tab so OCADE can observe it before continuing.",
    };
  }

  const before = handover.checkpoint;
  const stale = !before || now.signature !== before.signature;
  /*
   * Say what actually happened. "while you were signing in" is true when OCADE
   * stepped back from a password or a one-time code; it is simply false when
   * the person pressed TAKE OVER, and a message that tells someone they were
   * doing something they were not is the kind of small untruth that makes the
   * rest of the reporting harder to believe.
   */
  const whileYou =
    handover.what === "password" || handover.what === "one-time code"
      ? "you were signing in"
      : "you had control";
  return {
    resumed: true,
    stale,
    needsRefresh: false,
    observation: now,
    checkpoint: before,
    detail: stale
      ? `The page changed while ${whileYou}${before ? `: ${before.signature} -> ${now.signature}` : ""}. OCADE re-read it; anything planned against the old page is stale and must be decided again from this observation.`
      : "The page is unchanged since the hand-over; OCADE re-read it and is continuing from the same verified state.",
  };
}

async function handle(request) {
  await scopeReady;
  // Re-read the latch first: this worker may be a fresh one that replaced the
  // worker the person pressed Stop in.
  await loadControl();
  const command = request?.command;
  if (!COMMANDS.has(command)) return refuse(`Unknown command: ${String(command)}`);
  const argument = request.argument ?? {};

  // Control commands are always available — a stop button that can be gated is
  // not a stop button.
  switch (command) {
    case "control.status":
      return { ok: true, status: status() };
    case "control.pause":
      if (state.control === RUNNING) state.control = PAUSED;
      await saveControl();
      return { ok: true, status: status() };
    case "control.resume": {
      // STOPPED is deliberately absent: resume must not clear a stop.
      if (state.control !== PAUSED && state.control !== HANDED_OVER) {
        await saveControl();
        return { ok: true, status: status() };
      }
      const wasHandedOver = state.control === HANDED_OVER;
      const handover = state.handover;
      state.control = RUNNING;
      state.handover = null;
      state.reason = null;
      await saveControl();
      if (!wasHandedOver) return { ok: true, status: status() };
      // Re-observation happens AFTER the latch clears, because observing is
      // itself gated by the latch.
      const resumption = await resumeFromCheckpoint(handover);
      return { ok: true, status: status(), resumption };
    }
    case "control.stop":
      state.control = STOPPED;
      state.reason = argument.reason ?? "Stopped by the user.";
      await saveControl();
      return { ok: true, status: status() };
    case "control.takeover": {
      /*
       * TAKING OVER IS A HAND-OVER, AND MUST CHECKPOINT LIKE ONE.
       *
       * This used to record only a message — no tab and no observation — so
       * `resumeFromCheckpoint` had nothing to compare against and returned a
       * bare "Resumed." OCADE then carried on against whatever it last
       * believed.
       *
       * That is the wrong way round. A person who pressed TAKE OVER is
       * precisely someone who has been changing the page by hand, so the odds
       * that the old plan is stale are HIGHER here than after a login, not
       * lower. Recording the tab and what it looked like is what makes the
       * re-observation on resume possible at all.
       */
      const tab = await tabFor(argument.tabId).catch(() => null);
      const checkpoint = tab ? await observeTab(tab.id).catch(() => null) : null;
      state.control = HANDED_OVER;
      state.handover = {
        what: argument.what ?? "this step",
        tabId: tab?.id ?? null,
        url: tab?.url ?? null,
        checkpoint: checkpoint
          ? { url: checkpoint.url, title: checkpoint.title, signature: checkpoint.signature }
          : null,
        message: "You have control of the tab.",
      };
      await saveControl();
      return { ok: true, status: status() };
    }
    case "scope.list":
      return { ok: true, status: status() };
    default:
      break;
  }

  const blocked = checkControl();
  if (blocked) return blocked;

  switch (command) {
    case "tabs.list": {
      const tabs = await chrome.tabs.query({});
      return {
        ok: true,
        // Tabs outside the approved scope are COUNTED but not described: the
        // model learns the browser has other tabs without learning where the
        // person banks.
        tabs: tabs.map((t) => {
          const inScope = isAuthorized(t.url ?? "", state.approvedOrigins);
          return inScope
            ? { id: t.id, url: t.url, title: t.title, active: t.active, inScope: true }
            : { id: t.id, inScope: false };
        }),
        status: status(),
      };
    }

    case "tabs.open": {
      if (!isAuthorized(argument.url ?? "", state.approvedOrigins))
        return refuse("That address is outside the sites you approved for OCADE.", {
          blocked: true,
        });
      const tab = await chrome.tabs.create({
        url: argument.url,
        active: argument.active !== false,
      });
      const observation = await settle(tab.id, null);
      return {
        ok: true,
        verified: Boolean(observation),
        tabId: tab.id,
        observation,
        status: status(),
      };
    }

    case "tabs.switch": {
      const tab = await tabFor(argument.tabId);
      const outOfScope = requireScope(tab);
      if (outOfScope) return outOfScope;
      await chrome.tabs.update(tab.id, { active: true });
      const confirmed = await chrome.tabs.get(tab.id);
      return { ok: true, verified: confirmed.active === true, tabId: tab.id, status: status() };
    }

    case "tabs.close": {
      const tab = await tabFor(argument.tabId);
      const outOfScope = requireScope(tab);
      if (outOfScope) return outOfScope;
      await chrome.tabs.remove(tab.id);
      // Verify by asking for it back rather than trusting the call.
      let stillThere = true;
      try {
        await chrome.tabs.get(tab.id);
      } catch {
        stillThere = false;
      }
      return { ok: true, verified: !stillThere, status: status() };
    }

    case "navigate": {
      if (!isAuthorized(argument.url ?? "", state.approvedOrigins))
        return refuse("That address is outside the sites you approved for OCADE.", {
          blocked: true,
        });
      const tab = await tabFor(argument.tabId);
      const before = tab.url;
      await chrome.tabs.update(tab.id, { url: argument.url });
      const observation = await settle(tab.id, `${before}|${tab.title}|0`);
      const arrived =
        Boolean(observation) && observation.url.startsWith(new URL(argument.url).origin);
      return {
        ok: true,
        verified: arrived,
        evidence: arrived
          ? `Arrived at ${observation.url}`
          : `Navigation did not land on ${argument.url}`,
        observation,
        status: status(),
      };
    }

    case "reload": {
      const tab = await tabFor(argument.tabId);
      const outOfScope = requireScope(tab);
      if (outOfScope) return outOfScope;
      await chrome.tabs.reload(tab.id);
      const observation = await settle(tab.id, null);
      return { ok: true, verified: Boolean(observation), observation, status: status() };
    }

    case "observe": {
      const tab = await tabFor(argument.tabId);
      const outOfScope = requireScope(tab);
      if (outOfScope) return outOfScope;
      const observation = await observeTab(tab.id);
      if (!observation) return refuse("The page could not be read.");
      return { ok: true, observation, status: status() };
    }

    case "screenshot": {
      const tab = await tabFor(argument.tabId);
      const outOfScope = requireScope(tab);
      if (outOfScope) return outOfScope;
      /*
       * `captureVisibleTab` is gated on `<all_urls>` or an ACTIVE `activeTab`
       * grant — a per-origin host permission is not enough, which is Chrome's
       * rule and not something this extension can talk it out of. `activeTab`
       * is declared, and it becomes active when the person uses the extension
       * on that tab.
       *
       * When it is not available the answer is that it is not available. The
       * alternative — reporting success with no image, or crashing the run —
       * would both be worse than saying so: the caller can still observe the
       * page, which is the better signal anyway.
       */
      let dataUrl;
      try {
        dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
      } catch (error) {
        return refuse(
          "Chrome would not capture this tab. A screenshot needs the extension to be active on the tab — open the OCADE Cowork popup on it first. Reading the page works regardless.",
          { unavailable: true, detail: error instanceof Error ? error.message : String(error) },
        );
      }
      const captured = typeof dataUrl === "string" && dataUrl.startsWith("data:image/png");
      if (!captured) return refuse("Chrome returned no image for this tab.", { unavailable: true });
      return { ok: true, verified: true, bytes: dataUrl.length, dataUrl, status: status() };
    }

    case "type":
    case "form.fill": {
      const tab = await tabFor(argument.tabId);
      const outOfScope = requireScope(tab);
      if (outOfScope) return outOfScope;

      // Look at the field BEFORE typing into it. This is the whole point.
      const observation = await observeTab(tab.id);
      if (!observation) return refuse("The page could not be read, so nothing was typed.");
      const field =
        typeof argument.target === "number"
          ? observation.controls[argument.target]
          : observation.controls.find(
              (c) => argument.target?.selector && `#${c.id}` === argument.target.selector,
            );
      if (field && isProtectedField(field)) {
        return await handOver(describeSecret(field), tab);
      }
      return runMutating(tab, "type", argument);
    }

    case "media":
    case "click":
    case "scroll": {
      const tab = await tabFor(argument.tabId);
      const outOfScope = requireScope(tab);
      if (outOfScope) return outOfScope;
      return runMutating(tab, command, argument);
    }

    default:
      return refuse(`Unhandled command: ${command}`);
  }
}

function describeSecret(field) {
  const haystack =
    `${field.name ?? ""} ${field.id ?? ""} ${field.autocomplete ?? ""} ${field.label ?? ""} ${field.placeholder ?? ""}`.toLowerCase();
  if (field.type === "password" || /pass/.test(haystack)) return "password";
  if (/otp|one.?time|2fa|mfa|verification code|auth.*code/.test(haystack)) return "one-time code";
  if (/cvv|cvc|csc/.test(haystack)) return "card security code";
  if (/captcha/.test(haystack)) return "CAPTCHA";
  if (/recovery|backup code/.test(haystack)) return "recovery code";
  if (/pin/.test(haystack)) return "PIN";
  return "confidential value";
}

/**
 * Approval arrives HERE, from the extension's own UI — never from a page.
 *
 * An origin is recorded only once Chrome has ACTUALLY granted host access for
 * it. Recording it first and discovering the permission was missing at act time
 * produces the worst of both: a scope list that says OCADE may act on a site,
 * and a run that dies on "Extension manifest must request permission" the
 * moment it tries. The popup requests the permission under a user gesture; this
 * confirms the grant before believing it.
 */
async function approveOrigin(origin) {
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const granted = await chrome.permissions.contains({ origins: [`${parsed.origin}/*`] });
  if (!granted) return false;

  if (!state.approvedOrigins.includes(parsed.origin)) {
    state.approvedOrigins.push(parsed.origin);
    await saveScope();
  }
  return true;
}

async function revokeOrigin(origin) {
  state.approvedOrigins = state.approvedOrigins.filter((o) => o !== origin);
  await saveScope();
  // Hand the host access back as well. Leaving it granted would mean "removed"
  // in the UI and still-reachable in the browser.
  try {
    await chrome.permissions.remove({ origins: [`${new URL(origin).origin}/*`] });
  } catch {
    // Already gone, or never granted.
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  // Only the extension's own pages may change scope or control. A content
  // script — and therefore any page — cannot, whatever it sends.
  const fromExtensionPage = sender.url?.startsWith(chrome.runtime.getURL("")) === true;

  (async () => {
    if (message?.command === "scope.approve" || message?.command === "scope.revoke") {
      if (!fromExtensionPage) {
        respond(refuse("Scope can only be changed from the OCADE Cowork popup."));
        return;
      }
      if (message.command === "scope.approve") {
        const approved = await approveOrigin(message.origin);
        respond(
          approved
            ? { ok: true, status: status() }
            : refuse("Chrome did not grant access to that site, so it was not approved."),
        );
        return;
      }
      await revokeOrigin(message.origin);
      respond({ ok: true, status: status() });
      return;
    }
    try {
      respond(await handle(message));
    } catch (error) {
      respond(refuse(error instanceof Error ? error.message : "The browser action failed."));
    }
  })();
  return true;
});

/**
 * THE WEBSITE'S CHANNEL.
 *
 * OCADE runs as an ordinary web page, so it cannot touch the browser itself.
 * `onMessageExternal` is how the page asks this extension to act — and Chrome
 * only delivers a message here if the sender's origin is listed in the
 * manifest's `externally_connectable.matches`, so the origin check is the
 * browser's, not a string comparison of ours that could be got wrong.
 *
 * A page reaching this listener gets exactly the same executor as anything
 * else: the same scope gate, the same control latch, the same refusals. What it
 * specifically does NOT get is the ability to change either. `scope.approve`
 * and `scope.revoke` are handled in the internal listener and require an
 * extension page; arriving here they fall through to `handle`, which does not
 * implement them and answers "unknown command". So the site can ask OCADE to
 * work, and cannot grant OCADE permission to work somewhere new.
 */
chrome.runtime.onMessageExternal.addListener((message, sender, respond) => {
  (async () => {
    try {
      if (message?.command === "scope.approve" || message?.command === "scope.revoke") {
        respond(
          refuse(
            "A website cannot change what OCADE is allowed to act on. Approve the site in the OCADE Cowork popup.",
          ),
        );
        return;
      }
      if (message?.command === "handshake") {
        respond({
          ok: true,
          extension: chrome.runtime.getManifest().version,
          protocolVersion: 1,
          origin: sender.origin ?? null,
          status: status(),
        });
        return;
      }
      respond(await handle(message));
    } catch (error) {
      respond(refuse(error instanceof Error ? error.message : "The browser action failed."));
    }
  })();
  return true;
});

/** Exposed for the test harness, which drives the worker directly. */
globalThis.__ocadeHandle = handle;
globalThis.__ocadeApprove = approveOrigin;
globalThis.__ocadeState = state;
globalThis.__ocadeResetControl = async () => {
  state.control = RUNNING;
  state.reason = null;
  state.handover = null;
  await saveControl();
};
