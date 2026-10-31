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
 *     --report <file.json> "<the person's request>"
 *
 * The account is a synthetic staging test account; its online-AI consent is set
 * by the operator running this test. Never point this at production.
 */
import { spawn } from "node:child_process";
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
    rounds: { type: "string", default: "60" },
    // The test operator confirms each external-effect step, as the person would in the app.
    "confirm-effects": { type: "boolean", default: false },
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
const agent = (...args) =>
  new Promise((ok) => {
    const child = spawn("python3", ["-m", "ocade_agent", ...args, "--server", url], {
      cwd: join(root, "device-agent/windows"),
      env: {
        ...process.env,
        OCADE_AGENT_HOME: home,
        PYTHONPATH: join(root, "device-agent/windows"),
      },
    });
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
      confirmations.push({ step: step.id, summary: step.summary, at: new Date().toISOString() });
      console.log(`  operator confirmed: ${step.summary}`);
    }
    await new Promise((ok) => setTimeout(ok, 1500));
  }
})();
for (let round = 0; round < Number(values.rounds); round += 1) {
  const view = await authority.taskView(admin, user.id, taskId);
  console.log(
    `[${view.status}] ${view.steps.at(-1)?.summary ?? "planning"} (${view.steps.length} steps)`,
  );
  if (!["running"].includes(view.status)) break;
  const run = await agent("run", "--workspace", resolve(values.workspace), "--until-idle");
  if (run.code !== 0) console.error(run.out.slice(-600));
}
running = false;
await confirming;
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
