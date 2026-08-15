/**
 * Overlay logic for the CAERA Native Companion.
 *
 * Talks to the Rust host over Tauri IPC only. Everything shown here is REAL
 * host state — if the host cannot be reached the overlay says so rather than
 * rendering a hopeful placeholder.
 *
 * Emergency stop is deliberately the one control that never depends on having a
 * healthy session: it is always enabled and always reachable.
 */

/*
 * NO CONTEXT MENU, AND NO RELOAD SHORTCUTS, IN THE SHIPPED SHELL.
 *
 * A right click in a webview offers Inspect Element, View Source and Reload.
 * None of those belong in a product surface: the first two hand a reader the
 * running code, and the third can drop the overlay into a state the host is not
 * expecting mid-run.
 *
 * This is a POLISH control rather than a security boundary, and it is worth
 * being clear about which. Anyone determined can still attach a debugger to a
 * local process; what stops that is the CSP, the IPC allow-list and code
 * signing. What this stops is the accidental and the casual, which is most of
 * it.
 */
if (typeof window !== "undefined") {
  window.addEventListener("contextmenu", (event) => event.preventDefault());
  window.addEventListener("keydown", (event) => {
    const key = (event.key || "").toLowerCase();
    const devtools =
      key === "f12" ||
      ((event.ctrlKey || event.metaKey) && event.shiftKey && ["i", "j", "c"].includes(key));
    const reload = (event.ctrlKey || event.metaKey) && ["r", "u"].includes(key);
    if (devtools || reload) event.preventDefault();
  });
}

const el = (id) => document.getElementById(id);

const tauri = () => (typeof window !== "undefined" ? window.__TAURI__ : null);
const invoke = (cmd, args) => {
  const t = tauri();
  const fn = t?.core?.invoke ?? t?.invoke;
  if (!fn) return Promise.reject(new Error("The companion bridge is not available."));
  return fn(cmd, args);
};

/** The overlay never signs its own envelopes; the host owns the session. */
let session = null;
let currentRun = null;

async function ensureSession() {
  if (session) return session;
  const opened = await invoke("open_session");
  if (
    !opened ||
    typeof opened.sessionId !== "string" ||
    !Array.isArray(opened.key) ||
    opened.key.length < 16
  ) {
    throw new Error("The companion did not open a secure overlay session.");
  }
  session = {
    id: opened.sessionId,
    key: Uint8Array.from(opened.key),
    counter: 0,
  };
  return session;
}

async function signed(command, args = {}) {
  const active = await ensureSession();
  active.counter += 1;
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = [...nonceBytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const issued_at = Math.floor(Date.now() / 1000);
  const body = `${command}|${JSON.stringify(args)}`;
  const canonical = `v1\n${active.id}\n${active.counter}\n${nonce}\n${issued_at}\n${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    active.key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical));
  const mac = [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return {
    session_id: active.id,
    counter: active.counter,
    nonce,
    issued_at,
    body,
    mac,
  };
}

function setHeader(state, text) {
  const dot = el("dot");
  dot.className = `dot ${state}`;
  el("title").textContent = text;
}

function show(node, visible) {
  node.classList.toggle("hidden", !visible);
}

function fmtTime(unixSeconds) {
  if (!unixSeconds) return "";
  return new Date(unixSeconds * 1000).toLocaleTimeString();
}

async function refresh() {
  try {
    await ensureSession();
    const status = await invoke("status");
    const halted = Boolean(status?.halted);
    show(el("haltedBox"), halted);

    if (halted) {
      setHeader("bad", "Emergency stop active");
    } else if (status?.available) {
      setHeader("ok", `OCADE ready${status.version ? ` · v${status.version}` : ""}`);
    } else {
      setHeader("warn", "Companion unavailable");
    }

    const caps = Array.isArray(status?.capabilities) ? status.capabilities : [];
    el("caps").textContent = caps.length ? caps.join(" · ") : "This build reports no capabilities.";

    await Promise.all([refreshAudit(), refreshGesture()]);
  } catch (e) {
    // Honest failure — never claim readiness we cannot verify.
    setHeader("bad", "Companion not responding");
    el("caps").textContent = e && e.message ? e.message : "The companion did not respond.";
  }
}

async function refreshGesture() {
  try {
    const status = await invoke("gesture_status");
    const available = Boolean(status?.available);
    const running = Boolean(status?.running);
    const armed = Boolean(status?.controlEnabled);
    el("gesturePreview").disabled = !available || running;
    el("gestureArm").disabled = !available || running;
    el("gestureStop").disabled = !running;
    el("gestureCamera").disabled = running;
    el("gestureStatus").textContent = !available
      ? status?.reason || "This installation does not contain hand control."
      : running
        ? armed
          ? "Hand control is active. Ctrl + Shift + F12 stops it immediately."
          : "Camera preview is running; cursor control is off."
        : "Ready. Preview the camera before activating cursor control.";
  } catch (error) {
    el("gestureStatus").textContent =
      error?.message || "The hand-control status could not be read.";
  }
}

async function startGesture(enableControl) {
  const args = {
    cameraIndex: Number(el("gestureCamera").value || 0),
    enableControl,
  };
  const request = await signed("gesture_start", args);
  await invoke("gesture_start", { request, ...args });
  show(el("gestureConfirm"), false);
  await Promise.all([refreshGesture(), refreshAudit()]);
}

async function refreshAudit() {
  let entries = [];
  try {
    const raw = await invoke("audit_log");
    entries = Array.isArray(raw) ? raw : [];
  } catch {
    entries = [];
  }

  const list = el("audit");
  list.replaceChildren();
  show(el("auditEmpty"), entries.length === 0);

  for (const entry of entries.slice(-20).reverse()) {
    const li = document.createElement("li");

    const mark = document.createElement("span");
    mark.className = "mark";
    mark.textContent = entry.ok ? "✓" : "✕";
    mark.style.color = entry.ok ? "var(--ok)" : "var(--bad)";

    const when = document.createElement("span");
    when.textContent = fmtTime(entry.at);

    const detail = document.createElement("span");
    detail.style.flex = "1";
    // textContent, never innerHTML — audit text is data, never markup.
    detail.textContent = String(entry.detail ?? "");

    li.append(mark, when, detail);
    list.append(li);
  }
}

/* --------------------------------------------------------------- events -- */

async function bindHostEvents() {
  const listen = tauri()?.event?.listen;
  if (!listen) return;

  await listen("ocade://action-started", (e) => {
    currentRun = String(e?.payload ?? "");
    el("runningLabel").textContent = currentRun || "an action";
    show(el("runningBox"), true);
  });

  await listen("ocade://action-finished", () => {
    currentRun = null;
    show(el("runningBox"), false);
    void refreshAudit();
  });

  await listen("ocade://action-progress", (e) => {
    const payload = e?.payload;
    if (!payload || String(payload.runId ?? "") !== currentRun) return;
    const percent = Number(payload.percent);
    const stage = String(payload.stage ?? "running");
    el("runningLabel").textContent = Number.isFinite(percent)
      ? `${stage} · ${Math.max(0, Math.min(100, percent))}%`
      : stage;
  });

  await listen("ocade://emergency-stop", () => {
    currentRun = null;
    show(el("runningBox"), false);
    show(el("haltedBox"), true);
    setHeader("bad", "Emergency stop active");
    void Promise.all([refreshAudit(), refreshGesture()]);
  });
}

el("refresh").addEventListener("click", () => void refresh());

el("gesturePreview").addEventListener("click", async () => {
  try {
    await startGesture(false);
  } catch (error) {
    el("gestureStatus").textContent = error?.message || "Camera preview could not start.";
  }
});

el("gestureArm").addEventListener("click", () => {
  show(el("gestureConfirm"), true);
  el("gestureStatus").textContent =
    "Allow OCADE to move, click, drag and open items until you stop it?";
});

el("gestureConfirm").addEventListener("click", async () => {
  try {
    await startGesture(true);
  } catch (error) {
    el("gestureStatus").textContent = error?.message || "Hand control could not start.";
  }
});

el("gestureStop").addEventListener("click", async () => {
  try {
    const request = await signed("gesture_stop", {});
    await invoke("gesture_stop", { request });
  } finally {
    show(el("gestureConfirm"), false);
    await Promise.all([refreshGesture(), refreshAudit()]);
  }
});

el("hide").addEventListener("click", () => {
  const win = tauri()?.window?.getCurrentWindow?.();
  if (win?.hide) void win.hide();
});

el("stop").addEventListener("click", async () => {
  try {
    await invoke("emergency_stop");
  } catch {
    // The host may also be halted from the tray or the global hotkey; reflect
    // the attempt either way rather than silently doing nothing.
  } finally {
    show(el("haltedBox"), true);
    show(el("runningBox"), false);
    setHeader("bad", "Emergency stop active");
    void Promise.all([refreshAudit(), refreshGesture()]);
  }
});

el("reset").addEventListener("click", async () => {
  try {
    const request = await signed("reset_emergency_stop", {});
    await invoke("reset_emergency_stop", { request });
    show(el("haltedBox"), false);
    await refresh();
  } catch {
    setHeader("bad", "Could not clear the emergency stop");
  }
});

el("cancel").addEventListener("click", async () => {
  if (!currentRun) return;
  try {
    const args = { runId: currentRun };
    const request = await signed("cancel", args);
    await invoke("cancel", { request, ...args });
  } catch {
    /* the run may have already finished */
  }
});

void bindHostEvents();
void refresh();
