/**
 * The extension's own UI, and the ONLY place scope and control change.
 *
 * Approval cannot come from a page: the background worker checks that a
 * scope message originated from an extension page before honouring it. That
 * check is what stops a site talking its own origin onto the approved list.
 */

const send = (message) => chrome.runtime.sendMessage(message);

const LABELS = {
  running: "Running",
  paused: "Paused",
  stopped: "Stopped",
  handed_over: "You have control",
};

async function render() {
  const { status } = await send({ command: "control.status" });

  const state = document.getElementById("state");
  state.className = `state ${status.control}`;
  document.getElementById("stateText").textContent = LABELS[status.control] ?? status.control;

  const handover = document.getElementById("handover");
  if (status.handover) {
    handover.style.display = "block";
    handover.textContent = status.handover.message;
  } else {
    handover.style.display = "none";
  }

  const list = document.getElementById("origins");
  list.textContent = "";
  if (status.approvedOrigins.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "None yet — OCADE cannot act anywhere.";
    list.append(empty);
  }
  for (const origin of status.approvedOrigins) {
    const row = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = origin;
    const remove = document.createElement("button");
    remove.textContent = "Remove";
    remove.addEventListener("click", async () => {
      await send({ command: "scope.revoke", origin });
      void render();
    });
    row.append(label, remove);
    list.append(row);
  }
}

function on(id, message) {
  document.getElementById(id).addEventListener("click", async () => {
    await send(message);
    void render();
  });
}

on("pause", { command: "control.pause" });
on("resume", { command: "control.resume" });
on("stop", { command: "control.stop", argument: { reason: "Stopped from the popup." } });
on("takeover", { command: "control.takeover", argument: { what: "this tab" } });

/**
 * The tab the person means.
 *
 * Normally that is the active tab, because a popup does not take the tab's
 * place. Opened as a TAB instead — which is how it is debugged, and how the
 * end-to-end test drives it — the active tab is this page, whose
 * chrome-extension:// URL can never be approved. Falling back to the most
 * recently used http(s) tab makes both cases work.
 */
async function targetTab() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.url && /^https?:/.test(active.url)) return active;
  const tabs = await chrome.tabs.query({});
  return tabs
    .filter((t) => /^https?:/.test(t.url ?? ""))
    .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];
}

document.getElementById("approve").addEventListener("click", async () => {
  const tab = await targetTab();
  if (!tab?.url) return;
  const origin = new URL(tab.url).origin;

  /*
   * Ask Chrome for host access FIRST, from this click.
   * `chrome.permissions.request` needs a user gesture, and it is the only thing
   * that actually lets OCADE read or act on the site. Recording the origin
   * without it produced a scope list that promised access the browser had never
   * granted, and a run that failed the moment it tried to touch the page.
   */
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
  if (!granted) {
    void render();
    return;
  }
  await send({ command: "scope.approve", origin });
  void render();
});

void render();
