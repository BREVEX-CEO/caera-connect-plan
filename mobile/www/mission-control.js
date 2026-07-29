const $ = (id) => document.getElementById(id);
const native = window.Capacitor?.Plugins?.OcadeMobile;
let snapshot = null;

const setText = (id, value) => {
  const node = $(id);
  if (node) node.textContent = value ?? "—";
};

function report(detail, ok = false) {
  setText("command-note", detail);
  $("command-note").style.color = ok ? "var(--ok)" : "var(--warn)";
}

function requireTask() {
  const taskId = snapshot?.task?.id;
  if (!taskId) {
    report("No verified current task is available.");
    return null;
  }
  return taskId;
}

async function issue(kind, payload = {}) {
  if (!native?.issueScopedCommand) {
    report("The native signed-command bridge is unavailable. Nothing was sent.");
    return null;
  }
  report("Waiting for the computer to acknowledge the signed command…");
  try {
    const receipt = await native.issueScopedCommand({ kind, payload });
    const completed =
      receipt?.acknowledged === true &&
      receipt?.outcome === "completed" &&
      typeof receipt?.commandId === "string";
    report(
      completed
        ? receipt.detail || "The computer acknowledged completion."
        : receipt?.detail || "The computer did not acknowledge completion.",
      completed,
    );
    if (completed) await refresh();
    return completed ? receipt : null;
  } catch {
    report("The signed command failed. Nothing was reported as completed.");
    return null;
  }
}

function renderApprovals(approvals, taskId) {
  const list = $("approvals");
  list.replaceChildren();
  const pending = approvals.filter((approval) => approval.status === "pending");
  if (pending.length === 0) {
    list.append(
      Object.assign(document.createElement("li"), {
        textContent: "No verified approvals waiting.",
      }),
    );
    return;
  }
  for (const approval of pending) {
    const item = document.createElement("li");
    const summary = document.createElement("p");
    summary.textContent = `${approval.summary} · ${approval.risk}`;
    const actions = document.createElement("div");
    actions.className = "actions";
    for (const decision of ["approved", "denied"]) {
      const button = document.createElement("button");
      button.textContent = decision === "approved" ? "Approve" : "Deny";
      button.addEventListener(
        "click",
        () =>
          void issue("approval.decide", {
            taskId: approval.taskId || taskId,
            approvalId: approval.id,
            decision,
          }),
      );
      actions.append(button);
    }
    item.append(summary, actions);
    list.append(item);
  }
}

function renderOutputs(outputs, taskId) {
  const list = $("outputs");
  list.replaceChildren();
  if (outputs.length === 0) {
    list.append(
      Object.assign(document.createElement("li"), { textContent: "No verified outputs." }),
    );
    return;
  }
  for (const output of outputs) {
    const item = document.createElement("li");
    item.textContent = `${output.name} · ${output.status} · ${output.sizeBytes} bytes · ${output.sha256.slice(0, 12)}…`;
    if (output.downloadable && output.status === "ready") {
      const button = document.createElement("button");
      button.textContent = "Download verified output";
      button.addEventListener(
        "click",
        () =>
          void issue("output.download", { taskId: output.taskId || taskId, outputId: output.id }),
      );
      item.append(button);
    }
    list.append(item);
  }
}

function renderReceipts(receipts) {
  const list = $("receipts");
  list.replaceChildren();
  if (receipts.length === 0) {
    list.append(
      Object.assign(document.createElement("li"), { textContent: "No verified receipts." }),
    );
    return;
  }
  for (const receipt of receipts) {
    const item = document.createElement("li");
    item.textContent = `${receipt.headline} · ${receipt.outcome} · ${receipt.observedAt}`;
    list.append(item);
  }
}

function render(next) {
  snapshot = next;
  const task = next?.task ?? null;
  setText(
    "pc-online",
    task?.pcOnline === true ? "Online" : task?.pcOnline === false ? "Offline" : "Unknown",
  );
  setText("health", task?.companionHealth ?? "Unknown");
  setText("task", task ? `${task.title} · ${task.state}` : "No verified task");
  setText("application", task?.activeApplication);
  setText("step", task?.currentStep);
  setText("checkpoint", task?.lastVerifiedCheckpoint);
  $("progress").value = Number.isFinite(task?.progressPercent) ? task.progressPercent : 0;
  setText("problem", task?.error || task?.blocker || "No verified blocker or error.");

  const preview = $("preview");
  if (task?.preview?.enabled === true && task?.preview?.redacted === true && task.preview.dataUrl) {
    preview.src = task.preview.dataUrl;
    preview.hidden = false;
  } else {
    preview.removeAttribute("src");
    preview.hidden = true;
  }

  $("pause").disabled = task?.state !== "running";
  $("resume").disabled = task?.state !== "paused";
  $("cancel").disabled = !["queued", "running", "paused", "blocked"].includes(task?.state);
  renderApprovals(Array.isArray(next?.approvals) ? next.approvals : [], task?.id);
  renderOutputs(Array.isArray(next?.outputs) ? next.outputs : [], task?.id);
  renderReceipts(Array.isArray(next?.receipts) ? next.receipts : []);
}

async function refresh() {
  if (!native?.missionSnapshot) {
    report("The native mission snapshot bridge is unavailable. No task state was invented.");
    return;
  }
  try {
    const result = await native.missionSnapshot();
    if (result?.verified !== true || !result?.snapshot) {
      report(result?.detail || "The PC task snapshot was not independently verified.");
      return;
    }
    render(result.snapshot);
    report(`Snapshot verified at ${result.snapshot.observedAt}.`, true);
  } catch {
    report("The PC task snapshot could not be verified.");
  }
}

$("refresh").addEventListener("click", () => void refresh());
$("pause").addEventListener("click", () => {
  const taskId = requireTask();
  if (taskId) void issue("run.pause", { taskId });
});
$("resume").addEventListener("click", () => {
  const taskId = requireTask();
  if (taskId) void issue("run.resume", { taskId });
});
$("cancel").addEventListener("click", () => {
  const taskId = requireTask();
  if (taskId) void issue("run.cancel", { taskId });
});
$("mission-stop").addEventListener("click", () => void issue("emergency.stop"));
$("send-task").addEventListener("click", () => {
  const text = $("new-task").value.trim();
  if (!text) return report("Enter a bounded task instruction first.");
  void issue("task.create", { text });
});
$("add-instruction").addEventListener("click", () => {
  const taskId = requireTask();
  const text = $("instruction").value.trim();
  if (taskId && text) void issue("instruction.add", { taskId, text });
});
$("correct-instruction").addEventListener("click", () => {
  const taskId = requireTask();
  const instructionId = $("instruction-id").value.trim();
  const text = $("instruction").value.trim();
  if (!instructionId) return report("Enter the exact instruction ID to correct.");
  if (taskId && text) void issue("instruction.correct", { taskId, instructionId, text });
});
$("revoke").addEventListener("click", () => void issue("session.revoke"));
$("pair").addEventListener("click", async () => {
  if (!native?.pair) {
    return setText(
      "pair-note",
      "The native pairing transport is unavailable. This device is not paired.",
    );
  }
  const code = $("pair-code").value.trim();
  const nonce = $("pair-nonce").value.trim();
  try {
    const result = await native.pair({ code, nonce });
    setText(
      "pair-note",
      result?.acknowledged === true
        ? "The computer acknowledged pairing."
        : result?.detail || "The computer did not acknowledge pairing.",
    );
    if (result?.acknowledged === true) await refresh();
  } catch {
    setText("pair-note", "Pairing failed. This device was not marked trusted.");
  }
});

void refresh();
