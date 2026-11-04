#!/usr/bin/env node
/**
 * One REAL JARVIS task against a hosted Supabase project (staging), end to end:
 * the person's prompt -> goal checks from Gemini -> Gemini chooses every step ->
 * this computer's companion executes -> the separate verifier settles -> report.
 *
 * It runs the production server modules unchanged (task authority, commercial
 * permit gate, the deployed ocade-intelligence-service service door) in place of
 * the web server, and pairs a companion on this computer. It holds no plan, no
 * step and no file name: only the prompt it is given.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OCADE_LIVE_EMAIL=qa+jarvis@... \
 *   node scripts/jarvis-live.mjs --workspace <dir> [--grant screen --grant site:example.com] \
 *     [--agent-user <unprivileged OS user>] [--minutes 15] --report <file.json> "<the person's request>"
 *
 * The companion is started as a customer's would be: without this harness's server keys
 * in its environment, and (with --agent-user) as an ordinary OS user who owns the workspace,
 * so a model-chosen command cannot read the harness's secrets.
 *
 * The account is a synthetic staging test account; its online-AI consent is set
 * by the operator running this test. Never point this at production.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createJiti } from "jiti";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    workspace: { type: "string" },
    report: { type: "string", default: "jarvis-live-report.json" },
    grant: { type: "string", multiple: true, default: [] },
    // How long the task may take before the harness stops waiting for it.
    minutes: { type: "string", default: "15" },
    // The test operator confirms each external-effect step, as the person would in the app.
    "confirm-effects": { type: "boolean", default: false },
    "agent-user": { type: "string" },
  },
});
const objective = positionals.join(" ").trim();
const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OCADE_LIVE_EMAIL"].filter(
  (n) => !process.env[n],
);
if (!objective || !values.workspace || missing.length) {
  console.error(`Needs a prompt, --workspace and ${missing.join(", ") || "nothing else"}.`);
  process.exit(2);
}

const root = resolve(import.meta.dirname, "..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });
const { supabaseAdmin: admin } = await jiti.import("@/integrations/supabase/client.server");
const authority = await jiti.import("@/lib/jarvis/authority.server");
const { ONLINE_CONSENT_VERSION } = await jiti.import("@/lib/intelligence/online-consent-version");
const must = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

// The synthetic account, its consent, a JARVIS conversation.
const email = process.env.OCADE_LIVE_EMAIL;
const listed = must(await admin.auth.admin.listUsers({ perPage: 1000 }));
const user =
  listed.users.find((u) => u.email === email) ??
  must(await admin.auth.admin.createUser({ email, email_confirm: true })).user;
must(
  await admin
    .from("profiles")
    .update({
      online_ai_consent_at: new Date().toISOString(),
      online_ai_consent_version: ONLINE_CONSENT_VERSION,
    })
    .eq("id", user.id),
);
const conversation = must(
  await admin
    .from("ocade_conversations")
    .insert({ user_id: user.id, title: objective.slice(0, 60), surface: "jarvis" })
    .select("id")
    .single(),
).id;

// The device endpoint, served here exactly as the web server serves it.
const server = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)]));
  const request = new Request(`http://127.0.0.1${req.url}`, {
    method: req.method,
    headers,
    body: Buffer.concat(chunks),
  });
  const reply = await authority
    .handleDeviceRequest(admin, request, "127.0.0.1")
    .catch((error) => ({ status: 500, body: { error: error.message } }));
  res
    .writeHead(reply.status, { "content-type": "application/json" })
    .end(JSON.stringify(reply.body));
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const url = `http://127.0.0.1:${server.address().port}`;
const home = mkdtempSync(join(tmpdir(), "ocade-live-agent-"));
const agentUser = values["agent-user"];
if (agentUser) spawnSync("chown", ["-R", agentUser, home, resolve(values.workspace)]);
// Only what a customer's computer would have: no Supabase or provider keys.
const SAFE_ENV =
  /^(PATH|LANG|LC_\w+|TZ|DISPLAY|XAUTHORITY|HTTPS?_PROXY|https?_proxy|NO_PROXY|no_proxy|PLAYWRIGHT_BROWSERS_PATH|OCADE_BROWSER_EXECUTABLE|OCADE_ALLOW_PRIVATE_WEB)$/;
const agent = (...args) =>
  new Promise((ok) => {
    const command = ["python3", "-m", "ocade_agent", ...args, "--server", url];
    const child = spawn(
      agentUser ? "runuser" : command[0],
      agentUser ? ["-u", agentUser, "--", ...command] : command.slice(1),
      {
        cwd: join(root, "device-agent/windows"),
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(([name]) => SAFE_ENV.test(name)),
          ),
          HOME: home,
          OCADE_AGENT_HOME: home,
          PYTHONPATH: join(root, "device-agent/windows"),
        },
      },
    );
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => ok({ code, out }));
  });

// Pair this computer and grant what the person chose.
const enrolled = await agent(
  "enroll",
  "--name",
  "JARVIS live test",
  "--workspace",
  resolve(values.workspace),
);
const code = /Pairing code: ([0-9A-F]{16})/.exec(enrolled.out)?.[1];
if (!code) throw new Error(`enrolment failed: ${enrolled.out.slice(-400)}`);
const deviceId = await authority.approveDevice(admin, user.id, code);
// The account-wide switch stays as the person left it after the first run.
const master = must(
  await admin
    .from("jarvis_permissions")
    .select("id")
    .eq("user_id", user.id)
    .is("device_id", null)
    .eq("capability", "master"),
);
const grants = [
  ...(master.length
    ? []
    : [{ user_id: user.id, device_id: null, capability: "master", allowed: true }]),
  ...["files", ...values.grant].map((capability) => ({
    user_id: user.id,
    device_id: deviceId,
    capability,
    allowed: true,
  })),
];
must(await admin.from("jarvis_permissions").insert(grants));

// The companion runs as a customer's does: already started and idle when the task arrives, so
// the first step's pickup is the real idle pickup (the nudge, or polling without Realtime).
const companion = agent("run", "--workspace", resolve(values.workspace));
await new Promise((ok) => setTimeout(ok, 5000));
const { taskId } = await authority.startTask(admin, user.id, {
  conversationId: conversation,
  deviceId,
  objective,
});
console.log(`task ${taskId}: ${objective}`);
const confirmations = [];
// The companion runs while the task does; the operator confirms external effects as they appear.
let running = true;
const confirming = (async () => {
  while (running && values["confirm-effects"]) {
    const view = await authority.taskView(admin, user.id, taskId);
    for (const step of view.steps.filter((s) => s.needsConfirmation)) {
      await authority.confirmAction(admin, user.id, step.id);
      confirmations.push({ step: step.id, effect: step.effect, at: new Date().toISOString() });
      console.log(`  operator confirmed: ${step.effect}`);
    }
    await new Promise((ok) => setTimeout(ok, 1500));
  }
})();
const deadline = Date.now() + Number(values.minutes) * 60_000;
let shown = "";
while (Date.now() < deadline) {
  const view = await authority.taskView(admin, user.id, taskId);
  const line = `[${view.status}] ${view.steps.at(-1)?.summary ?? "planning"} (${view.steps.length} steps)`;
  if (line !== shown) console.log((shown = line));
  if (view.status !== "running") break;
  await new Promise((ok) => setTimeout(ok, 1000));
}
running = false;
await confirming;
await agent("stop");
const ended = await companion;
if (ended.code !== 0) console.error(ended.out.slice(-600));
const view = await authority.taskView(admin, user.id, taskId);
const state = must(await admin.rpc("jarvis_task_state", { p_task: taskId }));
const outputs = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? outputs(join(dir, e.name))
      : [{ path: join(dir, e.name), bytes: statSync(join(dir, e.name)).size }],
  );
writeFileSync(
  values.report,
  JSON.stringify(
    {
      objective,
      taskId,
      status: view.status,
      result: view.result,
      blocker: view.blocker,
      checks: view.checks,
      timing: view.timing,
      // Person interventions: each external effect the test operator confirmed.
      confirmations,
      // Every decision the model made, as queued: operation, arguments, what was observed.
      decisions: state.steps.map((s) => ({
        summary: s.summary,
        intent: s.intent,
        status: s.status,
        receipt: s.receipt && {
          ...s.receipt,
          preview: s.receipt.preview ? `${s.receipt.preview.length} base64 chars` : undefined,
        },
      })),
      outputs: existsSync(join(resolve(values.workspace), "OCADE output"))
        ? outputs(join(resolve(values.workspace), "OCADE output"))
        : [],
    },
    null,
    2,
  ),
);
console.log(`${view.status}: report in ${values.report}`);
server.close();
