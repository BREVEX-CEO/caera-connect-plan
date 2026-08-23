/**
 * In-page half of the executor: it OBSERVES and it ACTS, and it does neither
 * without being asked by the background service worker.
 *
 * Injected on demand by `chrome.scripting`, only into a tab whose origin the
 * user has approved. It holds no state between calls and makes no decisions
 * about what is allowed — the background worker owns the control latch and the
 * scope, so a page cannot reach a decision point by talking to this file.
 */

/** Everything the model needs to choose a next step, and nothing it does not. */
function describe(element, index) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  const visible =
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    Number(style.opacity) > 0.01;
  return {
    ref: index,
    tag: element.tagName.toLowerCase(),
    type: element.getAttribute("type") || undefined,
    name: element.getAttribute("name") || undefined,
    id: element.id || undefined,
    autocomplete: element.getAttribute("autocomplete") || undefined,
    placeholder: element.getAttribute("placeholder") || undefined,
    ariaLabel: element.getAttribute("aria-label") || undefined,
    label: labelFor(element),
    role: element.getAttribute("role") || undefined,
    text: (element.innerText || element.value || "").trim().slice(0, 200) || undefined,
    disabled: Boolean(element.disabled),
    checked: element.type === "checkbox" || element.type === "radio" ? element.checked : undefined,
    value: element.value === undefined ? undefined : String(element.value).slice(0, 200),
    visible,
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    },
  };
}

function labelFor(element) {
  if (element.id) {
    const explicit = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (explicit) return explicit.innerText.trim().slice(0, 120);
  }
  const wrapping = element.closest("label");
  return wrapping ? wrapping.innerText.trim().slice(0, 120) : undefined;
}

const INTERACTIVE =
  'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="switch"], [role="checkbox"], [contenteditable="true"]';

/** A stable-enough handle for one element within a single observation. */
let lastObserved = [];

function observe() {
  lastObserved = [...document.querySelectorAll(INTERACTIVE)];
  const controls = lastObserved.map(describe);
  return {
    url: location.href,
    title: document.title,
    readyState: document.readyState,
    // Trimmed hard: this is for deciding a next step, not for reading the page
    // into the model's context.
    text: (document.body?.innerText || "").trim().slice(0, 5000),
    controls,
    // A single-page app changes this without a navigation event, so it is part
    // of every observation and the caller can tell a real change from a reload.
    signature: `${location.href}|${document.title}|${controls.length}`,
  };
}

function resolve(target) {
  if (typeof target === "number") return lastObserved[target] ?? null;
  if (target && typeof target.selector === "string") return document.querySelector(target.selector);
  if (target && typeof target.text === "string") {
    const wanted = target.text.trim().toLowerCase();
    return (
      [...document.querySelectorAll(INTERACTIVE)].find(
        (el) => (el.innerText || el.value || "").trim().toLowerCase() === wanted,
      ) ??
      [...document.querySelectorAll(INTERACTIVE)].find((el) =>
        (el.innerText || el.value || "").trim().toLowerCase().includes(wanted),
      ) ??
      null
    );
  }
  return null;
}

/** React and other frameworks track the previous value on the node itself. */
function setNativeValue(element, value) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function act(command, argument) {
  switch (command) {
    case "observe":
      return { ok: true, observation: observe() };

    case "click": {
      const element = resolve(argument.target);
      if (!element) return { ok: false, reason: "No element matched that target." };
      if (element.disabled) return { ok: false, reason: "That control is disabled." };
      element.scrollIntoView({ block: "center" });
      element.click();
      return { ok: true };
    }

    case "type": {
      const element = resolve(argument.target);
      if (!element) return { ok: false, reason: "No element matched that target." };
      if (element.disabled || element.readOnly)
        return { ok: false, reason: "That field cannot be typed into." };
      element.focus();
      if (element.isContentEditable) {
        element.textContent = argument.text;
        element.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        setNativeValue(element, argument.text);
      }
      return { ok: true };
    }

    case "scroll": {
      const by = Number(argument.by ?? 0);
      const before = window.scrollY;
      window.scrollBy({ top: by, behavior: "instant" });
      return { ok: true, from: before, to: window.scrollY };
    }

    case "media": {
      /*
       * The biggest playing media element on the page.
       *
       * Pages carry hidden <audio> elements for notification sounds and
       * off-screen <video> for autoplaying backgrounds, so "the first one" is
       * frequently the wrong one. The largest VISIBLE element is the one the
       * person is actually looking at.
       */
      const candidates = [...document.querySelectorAll("video, audio")].filter((el) => {
        const rect = el.getBoundingClientRect();
        return el.tagName === "AUDIO" || (rect.width > 0 && rect.height > 0);
      });
      if (!candidates.length)
        return { ok: false, reason: "There is no video or audio on this page." };
      const media = candidates.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return rb.width * rb.height - ra.width * ra.height;
      })[0];

      const before = { paused: media.paused, muted: media.muted, time: media.currentTime };
      const seconds = Number(argument.seconds ?? 10);
      switch (argument.action) {
        case "play":
          media.play?.();
          break;
        case "pause":
          media.pause?.();
          break;
        case "mute":
          media.muted = true;
          break;
        case "unmute":
          media.muted = false;
          break;
        case "seek":
          media.currentTime = Math.max(0, seconds);
          break;
        case "forward":
          media.currentTime = Math.max(0, media.currentTime + Math.abs(seconds));
          break;
        case "back":
          media.currentTime = Math.max(0, media.currentTime - Math.abs(seconds));
          break;
        default:
          return { ok: false, reason: `Unknown media action: ${argument.action}` };
      }
      // Read it back: play() can be refused by autoplay policy and a seek past
      // the end simply does not move, and both look like success from here.
      return {
        ok: true,
        before,
        after: { paused: media.paused, muted: media.muted, time: media.currentTime },
        duration: Number.isFinite(media.duration) ? media.duration : null,
      };
    }

    default:
      return { ok: false, reason: `Unknown in-page command: ${command}` };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  try {
    respond(act(message.command, message.argument ?? {}));
  } catch (error) {
    respond({
      ok: false,
      reason: error instanceof Error ? error.message : "In-page action failed.",
    });
  }
  return true;
});
