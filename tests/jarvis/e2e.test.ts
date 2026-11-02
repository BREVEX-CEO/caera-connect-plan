/**
 * END TO END, WITHOUT SUBSTITUTES FOR THE PARTS UNDER TEST (plan.md P19 first slice, §28.2).
 *
 * The real server authority module runs behind a local HTTP server; every RPC
 * it makes runs the real migrations' functions in a fresh disposable PostgreSQL
 * database as `service_role`; the real Python companion enrolls, signs its
 * requests, claims actions and drives the real MCP workers, which write real
 * files with a real office engine; the independent verifier re-reads them; the
 * database settles the task. The test itself never writes a deliverable.
 *
 * Evidence class: Linux cloud container, LibreOffice. It does NOT qualify the
 * Windows companion, Excel/Word COM, the OCADE web UI or a hosted Supabase.
 * Needs PG* variables for a local PostgreSQL 16+, python3 with the companion's
 * requirements, and LibreOffice. Skips (does not pass) when they are missing.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { plannerAccess } from "../../src/lib/jarvis/planner.server.ts";
import {
  advance,
  approveDevice,
  handleDeviceRequest,
  resumeTask,
  startTask,
  stopTask,
  taskView,
  type Admin,
} from "../../src/lib/jarvis/authority.server.ts";

const root = new URL("../..", import.meta.url).pathname;
const agentDir = join(root, "device-agent/windows");
const db = `ocade_jarvis_e2e_${process.pid}`;
const ready =
  spawnSync("psql", ["-Atqc", "select 1", "-d", "postgres"]).status === 0 &&
  spawnSync("python3", ["-c", "import mcp, openpyxl, docx, pypdfium2"]).status === 0 &&
  (spawnSync("which", ["soffice"]).status === 0 ||
    spawnSync("which", ["libreoffice"]).status === 0);

// CI must run the end-to-end tests, not skip them for a missing prerequisite.
test("end-to-end prerequisites are installed in CI", { skip: !process.env.CI }, () => {
  assert.ok(ready, "psql, the companion's Python packages and LibreOffice are required in CI");
});

function sql(text: string, role = "service_role"): string {
  const run = spawnSync("psql", ["-X", "-Atq", "-v", "ON_ERROR_STOP=1", "-d", db], {
    input: `SET ROLE ${role};\n${text}`,
    encoding: "utf8",
  });
  if (run.status !== 0) throw new Error(run.stderr.trim());
  return run.stdout.trim();
}

const literal = (value: unknown) =>
  value === null
    ? "NULL"
    : `'${(typeof value === "string" ? value : JSON.stringify(value)).replace(/'/g, "''")}'`;

/** The service-role client, narrowed to RPC and backed by the real database functions. */
const SET_RETURNING = new Set([
  "jarvis_enroll_device",
  "jarvis_open_task",
  "jarvis_stop_task",
  "jarvis_submit_receipt",
]);
const admin = {
  rpc: async (fn: string, args: Record<string, unknown>) => {
    const call = `public.${fn}(${Object.entries(args)
      .map(([k, v]) => `${k} => ${literal(v)}`)
      .join(", ")})`;
    try {
      const text = SET_RETURNING.has(fn)
        ? sql(`SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]') FROM ${call} AS r;`)
        : sql(`SELECT to_jsonb(${call});`);
      return { data: text === "" ? null : JSON.parse(text), error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },
} as unknown as Admin;

let server: Server;
let url = "";
const userA = "aaaaaaaa-0000-0000-0000-00000000000a";
const userB = "bbbbbbbb-0000-0000-0000-00000000000b";
const conversation = "aaaaaaaa-1111-0000-0000-00000000000a";
const conversation2 = "aaaaaaaa-1111-0000-0000-00000000000b";
const home = mkdtempSync(join(tmpdir(), "ocade-agent-"));
const workspace = mkdtempSync(join(tmpdir(), "ocade-ws-"));
let lastSigned: { headers: Record<string, string>; body: string } | null = null;
let scriptedService: Server;
const originalPlannerAccess = { ...plannerAccess };
const fixtureOutputs = (prompt: string) => {
  const label = /a third time/.test(prompt) ? "third" : /again/.test(prompt) ? "again" : "first";
  const root = `OCADE output/finance-${label}`;
  return {
    workbook: `${root}/reconciled.xlsx`,
    docx: `${root}/summary.docx`,
    pdf: `${root}/summary.pdf`,
  };
};

function agent(...args: string[]) {
  return new Promise<{ code: number; out: string }>((resolve) => {
    const child = spawn("python3", ["-m", "ocade_agent", ...args, "--server", url], {
      cwd: agentDir,
      env: { ...process.env, OCADE_AGENT_HOME: home, PYTHONPATH: agentDir },
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code: code ?? -1, out }));
  });
}

before(async () => {
  if (!ready) return;
  spawnSync("psql", ["-qc", `CREATE DATABASE ${db}`, "-d", "postgres"]);
  const setup = [join(root, "tests/jarvis/db/supabase-stub.sql")].concat(
    readdirSync(join(root, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => join(root, "supabase/migrations", f)),
  );
  for (const file of setup) {
    const run = spawnSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", db, "-f", file], {
      encoding: "utf8",
    });
    if (run.status !== 0) throw new Error(`${file}: ${run.stderr}`);
  }
  sql(
    `INSERT INTO auth.users (id, email) VALUES ('${userA}', 'a@example.test'), ('${userB}', 'b@example.test');
     INSERT INTO public.ocade_conversations (id, user_id, title, surface) VALUES
       ('${conversation}', '${userA}', 'J', 'jarvis'), ('${conversation2}', '${userA}', 'J2', 'jarvis');
     -- Synthetic accounts that agreed to online AI; the consent test below withdraws it first.
     UPDATE public.profiles SET online_ai_consent_at = now(),
       online_ai_consent_version = '${(await import("../../src/lib/intelligence/online-consent-version.ts")).ONLINE_CONSENT_VERSION}'
      WHERE id IN ('${userA}', '${userB}');`,
    "postgres",
  );
  spawnSync(
    "python3",
    [
      "-c",
      `from tests.fixtures import ledger_workbook; from pathlib import Path; ledger_workbook(Path(${JSON.stringify(join(workspace, "Q3 ledger.xlsx"))}))`,
    ],
    { cwd: agentDir },
  );

  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks).toString();
    const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)]));
    if (JSON.parse(body || "{}").op === "claim") lastSigned = { headers, body };
    const request = new Request(`${url}${req.url}`, {
      method: req.method,
      headers,
      body: req.method === "POST" ? body : undefined,
    });
    const reply = await handleDeviceRequest(admin, request, "127.0.0.1").catch((error: Error) => ({
      status: 500,
      body: { error: error.message },
    }));
    res
      .writeHead(reply.status, { "content-type": "application/json" })
      .end(JSON.stringify(reply.body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

  // Scripted PROVIDER TEST DOUBLE, never production routing and never evidence of
  // genuine model autonomy. This retains real PostgreSQL/device/MCP/Office coverage.
  scriptedService = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const part of req) chunks.push(part as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const prompt: string =
      body.messages.find((part: { role: string }) => part.role === "user")?.content ?? "";
    const offered = new Set((body.tools as { name: string }[]).map((t) => t.name));
    const outputs = fixtureOutputs(prompt);
    let call: { name: string; args: Record<string, unknown> };
    if (offered.has("set_goal")) {
      call = {
        name: "set_goal",
        args: {
          checks: [
            {
              id: "reconciled",
              description: "Result workbook exists",
              kind: "file_exists",
              params: { path: outputs.workbook },
            },
            {
              id: "report_docx",
              description: "Editable report exists",
              kind: "file_exists",
              params: { path: outputs.docx },
            },
            {
              id: "report_pdf",
              description: "Rendered report exists",
              kind: "file_exists",
              params: { path: outputs.pdf },
            },
          ],
        },
      };
    } else if (!prompt.includes('"operation":"fs.list"')) {
      call = { name: "fs_list", args: { path: "." } };
    } else if (!prompt.includes('"operation":"fs.read_text"')) {
      call = { name: "fs_read_text", args: { path: "Q3 ledger.xlsx" } };
    } else if (!prompt.includes('"operation":"office.write_workbook"')) {
      call = {
        name: "office_write_workbook",
        args: {
          path: outputs.workbook,
          sheets: [
            {
              name: "Reconciliation",
              rows: [
                ["Ledger total", 435.75],
                ["Bank total", 467.25],
                ["Net difference", "=B2-B1"],
              ],
            },
          ],
        },
      };
    } else if (!prompt.includes('"operation":"office.write_document"')) {
      call = {
        name: "office_write_document",
        args: {
          docx: outputs.docx,
          pdf: outputs.pdf,
          title: "Financial reconciliation",
          sections: [{ heading: "Summary", paragraphs: ["Net difference 31.50"] }],
        },
      };
    } else {
      call = { name: "finish", args: {} };
    }
    res.writeHead(200, { "content-type": "text/event-stream" });
    const proposal = { id: "scripted-call", name: call.name, arguments: call.args };
    res.end(
      [
        { type: "tool_call", call: proposal },
        {
          type: "final",
          response: { backend: "online", stopReason: "tool_use", toolCalls: [proposal] },
        },
      ]
        .map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`)
        .join(""),
    );
  });
  await new Promise<void>((resolve) => scriptedService.listen(0, "127.0.0.1", resolve));
  const location = scriptedService.address();
  plannerAccess.serviceUrl = () =>
    `http://127.0.0.1:${typeof location === "object" && location ? location.port : 0}`;
  plannerAccess.serviceKey = () => "scripted-test-only";
  plannerAccess.acquirePermit = async (_userId, key) => ({
    permit: {
      id: "test-only",
      generationId: key,
      idempotencyKey: key,
      surface: "jarvis",
      source: "server",
    },
    release: async () => {},
  });
});

after(() => {
  Object.assign(plannerAccess, originalPlannerAccess);
  scriptedService?.close();
  server?.close();
  if (ready)
    spawnSync("psql", ["-qc", `DROP DATABASE IF EXISTS ${db} WITH (FORCE)`, "-d", "postgres"]);
});

const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

test(
  "scripted AI fixture: workbook to verified Word and PDF via real device, database and workers",
  { skip: !ready },
  async () => {
    const enrolled = await agent("enroll", "--name", "E2E PC", "--workspace", workspace);
    const code = /Pairing code: ([0-9A-F]{16})/.exec(enrolled.out)?.[1];
    assert.ok(code, enrolled.out);

    // A pending device can do nothing until its owner approves the code.
    assert.equal((await agent("run", "--workspace", workspace, "--until-idle")).code !== 0, true);

    const deviceId = await approveDevice(admin, userA, code);
    await assert.rejects(
      startTask(admin, userA, {
        conversationId: conversation,
        deviceId,
        objective: "Reconcile Q3 ledger.xlsx into a report",
      }),
      /file access/,
    );
    sql(
      `INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed) VALUES
       ('${userA}', NULL, 'master', true), ('${userA}', '${deviceId}', 'files', true);`,
      "postgres",
    );

    // Account B can neither start work on A's computer nor read or stop A's task.
    await assert.rejects(
      startTask(admin, userB, {
        conversationId: conversation,
        deviceId,
        objective: "Reconcile Q3 ledger.xlsx",
      }),
      // B holds no grant on A's computer, so it is refused before any model turn.
      /file access/,
    );
    // Any unfamiliar objective uses the planner; the server still controls
    // permissions. This fixture deliberately tests only its finance task.

    const original = sha(join(workspace, "Q3 ledger.xlsx"));
    const { taskId } = await startTask(admin, userA, {
      conversationId: conversation,
      deviceId,
      objective: "Reconcile Q3 ledger.xlsx and give me a Word and PDF report",
    });
    await assert.rejects(taskView(admin, userB, taskId), /does not exist/);
    assert.equal(
      await stopTask(admin, userB, taskId).catch((e: Error) => e.message),
      "That task does not exist.",
    );

    const run = await agent("run", "--workspace", workspace, "--until-idle");
    assert.equal(run.code, 0, run.out);

    const view = await taskView(admin, userA, taskId);
    assert.equal(view.status, "completed", JSON.stringify(view, null, 2));
    assert.ok(
      view.checks.every((c) => c.state === "passed"),
      JSON.stringify(view.checks),
    );
    assert.deepEqual(
      view.steps.map((s) => s.status),
      ["done", "done", "done", "done", "done"],
    );
    // The checks were fixed after a first read-only look, which the planner then reused.
    assert.equal(view.steps[0].summary, "Looking at your JARVIS folder");

    // Independent of JARVIS: the files exist where it said, and the original is untouched.
    const folder = join(workspace, "OCADE output", "finance-first");
    for (const name of ["reconciled.xlsx", "summary.docx", "summary.pdf"]) {
      assert.ok(existsSync(join(folder, name)), name);
    }
    assert.equal(sha(join(workspace, "Q3 ledger.xlsx")), original);
    assert.match(view.result ?? "", /Done, and checked independently/);

    // A captured request cannot be replayed; an altered one fails its signature.
    assert.ok(lastSigned);
    const replay = await fetch(`${url}/api/jarvis/device`, {
      method: "POST",
      headers: lastSigned.headers,
      body: lastSigned.body,
    });
    assert.equal(replay.status, 409);
    const forged = await fetch(`${url}/api/jarvis/device`, {
      method: "POST",
      headers: { ...lastSigned.headers, "x-ocade-timestamp": String(Date.now() + 1000) },
      body: lastSigned.body,
    });
    assert.equal(forged.status, 401);
  },
);

test("STOP before dispatch: nothing runs and nothing is written", { skip: !ready }, async () => {
  const deviceId = sql(`SELECT id FROM public.jarvis_devices WHERE user_id = '${userA}'`);
  const { taskId } = await startTask(admin, userA, {
    conversationId: conversation2,
    deviceId,
    objective: "Reconcile Q3 ledger.xlsx again",
  });
  const stopped = await stopTask(admin, userA, taskId);
  assert.deepEqual(stopped, { status: "stopped", cancelled: 1, inFlight: 0 });
  await advance(admin, taskId); // a late planner turn changes nothing
  const run = await agent("run", "--workspace", workspace, "--until-idle");
  assert.equal(run.code, 0, run.out);
  const view = await taskView(admin, userA, taskId);
  assert.equal(view.status, "stopped");
  assert.deepEqual(
    view.steps.map((s) => s.status),
    ["cancelled"],
  );
  assert.equal(existsSync(join(workspace, "OCADE output", "finance-again")), false);
});

test(
  "STOP while a step runs: in-flight work is cancelled and its effect accounted for",
  { skip: !ready },
  async () => {
    const deviceId = sql(`SELECT id FROM public.jarvis_devices WHERE user_id = '${userA}'`);
    const { taskId } = await startTask(admin, userA, {
      conversationId: conversation2,
      deviceId,
      objective: "Reconcile Q3 ledger.xlsx a third time",
    });
    const running = agent("run", "--workspace", workspace, "--until-idle");
    const claimedReport = () =>
      sql(`SELECT count(*) FROM public.jarvis_activity WHERE task_id = '${taskId}'
          AND status = 'claimed' AND action ->> 'operation' = 'office.write_document'`) === "1";
    const deadline = Date.now() + 60_000;
    while (!claimedReport()) {
      assert.ok(Date.now() < deadline, "the report step never started");
      await new Promise((r) => setTimeout(r, 50));
    }
    const stopped = await stopTask(admin, userA, taskId);
    assert.deepEqual(stopped, { status: "stopped", cancelled: 0, inFlight: 1 });
    const run = await running;
    assert.equal(run.code, 0, run.out);

    const view = await taskView(admin, userA, taskId);
    assert.equal(view.status, "stopped");
    assert.deepEqual(
      view.steps.map((s) => s.status),
      ["done", "done", "done", "cancelled"],
    );
    const receipt = JSON.parse(
      sql(
        `SELECT result FROM public.jarvis_activity WHERE task_id = '${taskId}' AND status = 'cancelled'`,
      ),
    );
    // Either the device stopped it (unknown, maybe changed) or it had already finished (observed).
    assert.ok(
      (receipt.status === "unknown" &&
        receipt.maybeChanged === true &&
        receipt.errorCode === "stopped") ||
        receipt.status === "observed",
      JSON.stringify(receipt),
    );
    assert.equal(
      view.checks.some((c) => c.state === "passed"),
      false,
    );
  },
);

/**
 * A model-planned task (P13) through the REAL Online Intelligence service door:
 * `handleOnlineIntelligence` from the repository (the code behind the deployed
 * `ocade-intelligence-service`) runs here with its server-key check, consent
 * check, permit claim and settlement against the real local ledger. Only the
 * provider (Gemini) is scripted, so this is evidence class L2: it proves the
 * adapter, permits, routing, validation, execution and settlement — not the
 * model's judgement.
 */
test(
  "model-planned task through the intelligence service: consent, permits, outage, settlement",
  { skip: !ready },
  async () => {
    const { handleOnlineIntelligence, isServiceKey } =
      await import("../../src/lib/intelligence/edge-handler.ts");
    const { ALLOWANCES } = await import("../../src/lib/commercial/usage-policy.ts");
    const { ONLINE_CONSENT_VERSION } =
      await import("../../src/lib/intelligence/online-consent-version.ts");
    const { plannerAccess } = await import("../../src/lib/jarvis/planner.server.ts");
    const deviceId = sql(`SELECT id FROM public.jarvis_devices WHERE user_id = '${userA}'`);
    writeFileSync(join(workspace, "status.txt"), "Status: GREEN\nOwner: Finance\n");
    spawnSync("python3", [
      "-c",
      "from PIL import Image; import sys; Image.new('RGB', (640, 360), (200, 20, 20)).save(sys.argv[1])",
      join(workspace, "chart.png"),
    ]);
    // Looking at an image and sharing it with the online planner is the person's `screen` choice.
    sql(
      `INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed) VALUES ('${userA}', '${deviceId}', 'screen', true)`,
      "postgres",
    );
    const serviceKey = "test-service-role-key";
    const sent: { tools: { name: string; parameters: unknown }[]; prompt: string }[] = [];
    let providerUp = true;
    const script: ((prompt: string) => { name: string; args: unknown })[] = [
      () => ({ name: "fs_read_text", args: { path: "status.txt" } }),
      () => ({ name: "media_preview", args: { path: "chart.png" } }),
      (prompt) => ({
        name: "office_write_document",
        args: {
          docx: "OCADE output/status.docx",
          title: "Status",
          sections: [
            {
              heading: "Summary",
              paragraphs: [/GREEN/.test(prompt) ? "Status is GREEN" : "unknown"],
            },
          ],
        },
      }),
      () => ({ name: "finish", args: {} }),
    ];
    const rpc = (fn: string, args: Record<string, unknown>) =>
      sql(
        `SELECT to_jsonb(public.${fn}(${Object.entries(args)
          .map(([k, v]) => `${k} => ${literal(v)}`)
          .join(", ")}))`,
      );
    const service = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const request = new Request(`http://service${req.url}`, {
        method: req.method,
        headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])),
        body: Buffer.concat(chunks),
      });
      const response = await handleOnlineIntelligence(request, {
        allowedOrigins: new Set(),
        providerReady: true,
        providerSlots: ["primary"],
        verifyJwt: () => Promise.resolve(null),
        async verifyService(r: Request) {
          const user = r.headers.get("x-ocade-user") ?? "";
          return /^[0-9a-f-]{36}$/.test(user) &&
            (await isServiceKey(r.headers.get("apikey"), [serviceKey]))
            ? { userId: user }
            : null;
        },
        consented: async (userId: string) =>
          sql(
            `SELECT online_ai_consent_version FROM public.profiles WHERE id = '${userId}' AND online_ai_consent_at IS NOT NULL`,
            "postgres",
          ) === ONLINE_CONSENT_VERSION,
        async claimPermit({ userId, permit }) {
          const ok = rpc("ocade_claim_generation_transport", {
            p_user_id: userId,
            p_permit_id: permit.id,
            p_generation_id: permit.generationId,
            p_idempotency_key: permit.idempotencyKey,
            p_surface: permit.surface,
          });
          return ok === "true" ? { ok: true as const } : { ok: false as const, reason: "refused" };
        },
        async finalizePermit({ userId, permit }) {
          sql(
            `SELECT * FROM public.ocade_finalize_generation_permit(${literal(userId)}, ${literal(permit.idempotencyKey)}, 100)`,
          );
        },
        async releasePermit({ userId, permit }) {
          sql(
            `SELECT public.ocade_release_generation_permit(${literal(userId)}, ${literal(permit.idempotencyKey)}, 'transport_ended_without_output')`,
          );
        },
        async callProvider({ body }) {
          if (!providerUp) return new Response(null, { status: 503 });
          const declarations = (
            body.tools as { function_declarations: { name: string; parameters: unknown }[] }[]
          )[0].function_declarations;
          const prompt = JSON.stringify(body.contents);
          sent.push({ tools: declarations, prompt });
          const call =
            declarations[0].name === "set_goal"
              ? {
                  name: "set_goal",
                  args: {
                    checks: [
                      {
                        id: "report_says_green",
                        description: "Report says GREEN",
                        kind: "file_contains",
                        params: { path: "OCADE output/status.docx", text: "Status is GREEN" },
                      },
                    ],
                  },
                }
              : script.shift()!(prompt);
          const chunk = {
            candidates: [
              { content: { role: "model", parts: [{ functionCall: call }] }, finishReason: "STOP" },
            ],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
          };
          return new Response(`data: ${JSON.stringify(chunk)}\r\n\r\n`, {
            headers: { "content-type": "text/event-stream" },
          });
        },
      });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) for await (const piece of response.body) res.write(piece);
      res.end();
    });
    await new Promise<void>((resolve) => service.listen(0, "127.0.0.1", resolve));
    const address = service.address();
    const saved = { ...plannerAccess };
    plannerAccess.serviceUrl = () =>
      `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    plannerAccess.serviceKey = () => serviceKey;
    plannerAccess.acquirePermit = async (userId: string, key: string) => {
      const [row] = JSON.parse(
        sql(
          `SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]') FROM public.ocade_acquire_generation_permit(${literal(userId)}, ${literal(key)}, ${literal(key)}, 'jarvis', 'free', ${ALLOWANCES.free.session * 100}, NULL, 100) AS r`,
        ),
      );
      if (row.outcome !== "granted")
        throw new (await import("../../src/lib/jarvis/planner.server.ts")).PlannerUnavailable(
          row.outcome,
        );
      return {
        permit: {
          id: row.permit_id,
          generationId: key,
          idempotencyKey: key,
          surface: "jarvis" as const,
          source: "server" as const,
        },
        release: async () =>
          void sql(
            `SELECT public.ocade_release_generation_permit(${literal(userId)}, ${literal(key)}, 'cancelled_before_output')`,
          ),
      };
    };
    const objective = "Summarise status.txt into a Word note";
    try {
      // No consent: the service refuses with the exact message the page answers by asking;
      // nothing starts, nothing is charged.
      const { JARVIS_CONSENT_NEEDED } = await import("../../src/lib/jarvis/consent-needed.ts");
      sql(
        `UPDATE public.profiles SET online_ai_consent_at = NULL WHERE id = '${userA}'`,
        "postgres",
      );
      await assert.rejects(
        startTask(admin, userA, { conversationId: conversation2, deviceId, objective }),
        (error: Error) => error.message === JARVIS_CONSENT_NEEDED,
      );
      sql(
        `UPDATE public.profiles SET online_ai_consent_at = now(), online_ai_consent_version = '${ONLINE_CONSENT_VERSION}' WHERE id = '${userA}'`,
        "postgres",
      );
      // The task opens with only a read-only look; no model is asked before it is seen.
      // A wrong server key is then refused by the service door: the task waits, nothing changed.
      plannerAccess.serviceKey = () => "wrong-key";
      const { taskId } = await startTask(admin, userA, {
        conversationId: conversation2,
        deviceId,
        objective,
      });
      assert.equal(sent.length, 0, "the checks are not guessed before the folder is seen");
      const discovered = await agent("run", "--workspace", workspace, "--until-idle");
      assert.equal(discovered.code, 0, discovered.out);
      const refused = await taskView(admin, userA, taskId);
      assert.equal(refused.status, "waiting");
      assert.match(refused.blocker ?? "", /unavailable/);
      assert.deepEqual(
        refused.steps.map((s) => s.status),
        ["done"],
      );
      plannerAccess.serviceKey = () => serviceKey;

      // Provider outage: the task waits with its checkpoint, the permit is released, then it resumes.
      providerUp = false;
      await resumeTask(admin, userA, taskId);
      const waiting = await taskView(admin, userA, taskId);
      assert.equal(waiting.status, "waiting");
      assert.match(waiting.blocker ?? "", /busy|unavailable/);
      providerUp = true;
      await resumeTask(admin, userA, taskId);
      assert.match(
        sent[0].prompt,
        /status\.txt/,
        "the checks were compiled from the observed folder",
      );
      const offered = sent.at(-1)!.tools.map((t) => t.name);
      assert.ok(
        offered.includes("fs_read_text") && offered.includes("office_write_document"),
        offered.join(","),
      );
      assert.ok(!offered.some((t) => /^(web_|ui_|apps_|mcp)/.test(t)), offered.join(","));
      assert.ok(
        !JSON.stringify(sent.map((s) => s.tools)).includes("additionalProperties"),
        "schemas normalized for the provider",
      );
      assert.match(sent.at(-1)!.prompt, /untrusted data/);
      const run = await agent("run", "--workspace", workspace, "--until-idle");
      assert.equal(run.code, 0, run.out);
      const view = await taskView(admin, userA, taskId);
      assert.equal(view.status, "completed", JSON.stringify(view, null, 2));
      assert.deepEqual(
        view.checks.map((c) => c.state),
        ["passed"],
      );
      assert.ok(existsSync(join(workspace, "OCADE output", "status.docx")));
      assert.ok(
        sent.some((s) => /Status: GREEN/.test(s.prompt)),
        "the model saw the observed file text",
      );
      // The model SAW the image it asked for: the turn after media.preview carries it as image data.
      const looked = sent.findIndex((s) => s.prompt.includes('"inline_data"'));
      assert.ok(looked > 0, "a preview reached the provider as an image");
      assert.match(sent[looked].prompt, /"mime_type":"image\/jpeg"/);
      assert.ok(
        sent.some((s) => /Status: GREEN/.test(s.prompt)),
        "the model saw the observed file text",
      );
      // Every planner turn spent exactly one JARVIS permit; the outage turn was released, not charged.
      const permits = JSON.parse(
        sql(
          `SELECT jsonb_object_agg(status, n) FROM (SELECT status, count(*) AS n FROM public.ocade_generation_permits WHERE user_id = '${userA}' AND surface = 'jarvis' GROUP BY status) s`,
          "postgres",
        ),
      );
      assert.equal(permits.succeeded, 5, JSON.stringify(permits)); // goal + 4 steps
      assert.ok(!permits.reserved, JSON.stringify(permits));

      // Elapsed time (M3): server timestamps, device-measured steps; the outage is a pause, not the person's wait.
      const timing = view.timing;
      // 5 charged turns + the refused wrong-key and outage turns (both inside the task now).
      assert.equal(timing.modelCalls, 7, JSON.stringify(timing));
      assert.ok(timing.modelMs > 0, JSON.stringify(timing));
      assert.ok(timing.pausedMs > 0, JSON.stringify(timing));
      assert.equal(timing.userWaitMs, 0, JSON.stringify(timing)); // nothing was asked of the person
      assert.ok(
        view.steps.every((s) => typeof s.durationMs === "number"),
        JSON.stringify(view.steps),
      );
      assert.ok(timing.activeExecutionMs !== null && timing.activeExecutionMs > 0);
      assert.ok(
        timing.totalElapsedMs! >=
          timing.activeExecutionMs + timing.pausedMs + timing.userWaitMs - 50,
      );
      assert.equal(timing.verifiedAt, timing.finishedAt);
      assert.ok(Date.parse(timing.finishedAt!) > Date.parse(timing.acceptedAt));
    } finally {
      Object.assign(plannerAccess, saved);
      service.close();
    }
  },
);

test("a revoked computer is refused at the door", { skip: !ready }, async () => {
  const deviceId = sql(`SELECT id FROM public.jarvis_devices WHERE user_id = '${userA}'`);
  sql(`SELECT public.jarvis_revoke_device('${userA}', '${deviceId}')`);
  const run = await agent("run", "--workspace", workspace, "--until-idle");
  assert.notEqual(run.code, 0);
  assert.match(run.out, /not paired/);
});
