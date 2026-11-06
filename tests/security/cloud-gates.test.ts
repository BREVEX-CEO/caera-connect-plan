import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { isSameOriginWrite } from "../../src/lib/security/isolation.ts";
import { streamAccountExport } from "../../src/lib/account/data-rights.ts";

test("Linux cloud gate entry points parse before any evaluation credentials are released", () => {
  for (const script of ["scripts/ci-local.sh", "scripts/jarvis-e1.sh"]) {
    const result = spawnSync("bash", ["-n", script], { encoding: "utf8" });
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${script}: ${result.stderr}`);
  }
});

test("Linux gate refuses an unsupported mode before running any tests", () => {
  const result = spawnSync("bash", ["scripts/ci-local.sh", "--unknown"], { encoding: "utf8" });
  assert.ifError(result.error);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/);
});

test("evaluation preserves actual target choices and partial checkpoints", () => {
  const result = spawnSync(
    "python3",
    ["-m", "unittest", "discover", "-s", "tests/jarvis", "-p", "test_eval_audit.py", "-v"],
    { encoding: "utf8" },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test("oracle privilege drops exclude the server environment with an actual synthetic canary", () => {
  const result = spawnSync(
    "python3",
    [
      "-c",
      'import sys; sys.path[:0]=["device-agent/windows","tests/jarvis"]; from tests.run_required import main; sys.exit(main(["--tests", "test_eval_isolation.OracleIsolation"]))',
    ],
    { encoding: "utf8" },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test("staging isolation smoke refuses an uncredentialed process", () => {
  const environment = { ...process.env };
  delete environment.SUPABASE_URL;
  delete environment.SUPABASE_SERVICE_ROLE_KEY;
  const result = spawnSync("python3", ["scripts/jarvis-staging-isolation.py"], {
    encoding: "utf8",
    env: environment,
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /REFUSED: an isolated root staging step is required/);
});

test("coding gate detects SQL and authority changes and fails on an invalid comparison", () => {
  const workflow = readFileSync(".github/workflows/jarvis-cloud-validation.yml", "utf8");
  const block = workflow.match(
    /name: Migrations and authority contracts when changed\n[\s\S]*?run: \|\n((?: {10}[^\n]*\n)+)/,
  )?.[1];
  assert.ok(block, "the real coding-gate migration step must exist");
  const script = block.replace(/^ {10}/gm, "");
  const folder = mkdtempSync(join(tmpdir(), "ocade-coding-diff-"));
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, { cwd: folder, encoding: "utf8" });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
  };
  const commit = () => {
    git("add", ".");
    git(
      "-c",
      "user.name=Coding gate fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-qm",
      "fixture",
    );
  };
  const run = (base = "HEAD^") =>
    spawnSync("bash", ["-e", "-c", "npm() { printf 'DB_GATE_REQUESTED\\n'; }\n" + script], {
      cwd: folder,
      encoding: "utf8",
      env: { ...process.env, CODING_BASE_SHA: base },
    });
  try {
    git("init", "-q");
    writeFileSync(join(folder, "baseline"), "baseline");
    commit();
    assert.notEqual(run().status, 0, "a missing parent must fail, not skip the gate");
    for (const path of [
      "docs/fixture.md",
      "supabase/migrations/fixture.sql",
      "src/lib/jarvis/authority.server.ts",
      "tests/jarvis/db/fixture.sql",
    ]) {
      mkdirSync(dirname(join(folder, path)), { recursive: true });
      writeFileSync(join(folder, path), "fixture");
      commit();
      const result = run();
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.includes("DB_GATE_REQUESTED"), !path.startsWith("docs/"), path);
    }
    const originalBase = spawnSync("git", ["rev-parse", "HEAD^"], {
      cwd: folder,
      encoding: "utf8",
    }).stdout.trim();
    writeFileSync(join(folder, "docs/fixture.md"), "follow-up fix");
    commit();
    const followup = run(originalBase);
    assert.equal(followup.status, 0, followup.stderr);
    assert.match(
      followup.stdout,
      /DB_GATE_REQUESTED/,
      "a fix-only commit must still check SQL changed earlier in its coding batch",
    );
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("coding CI excludes the qualification timing callback while retaining coding cases", () => {
  const workflow = readFileSync(".github/workflows/jarvis-cloud-validation.yml", "utf8");
  const gate = workflow.split("\n  planner-safety:")[0];
  assert.match(gate, /OCADE_CODING_GATE: "1"\s+run: .*tests\/jarvis\/e2e\.test\.ts/);
  const e2e = readFileSync("tests/jarvis/e2e.test.ts", "utf8");
  const flag = e2e.match(/^const codingGate = process\.env\.OCADE_CODING_GATE === "1";$/m)?.[0];
  const skip = e2e.match(/"timing suite: [^"]+",\s+(\{ skip: !ready \|\| codingGate \})/)?.[1];
  assert.ok(flag && skip, "the existing timing test must use the coding gate exclusion");
  const folder = mkdtempSync(join(tmpdir(), "ocade-test-selection-"));
  try {
    const allowed = join(folder, "coding-ran");
    const forbidden = join(folder, "qualification-ran");
    const path = join(folder, "selection.test.mjs");
    writeFileSync(
      path,
      `
import { test } from "node:test";
import { writeFileSync } from "node:fs";
const ready = true;
${flag}
test("coding case", () => writeFileSync(${JSON.stringify(allowed)}, "ran"));
test("timing suite: qualification case", ${skip}, () =>
  writeFileSync(${JSON.stringify(forbidden)}, "ran"));
`,
    );
    const env: NodeJS.ProcessEnv = { ...process.env, OCADE_CODING_GATE: "1" };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ["--test", path], { encoding: "utf8", env });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(allowed), true, "ordinary coding tests must execute");
    assert.equal(existsSync(forbidden), false, "qualification callbacks must not execute");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("offline navigation never saves a personalised page", async () => {
  const origin = "https://ocade.test";
  const precached: Request[] = [];
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const cacheWrites: unknown[] = [];
  const cache = {
    addAll: async (paths: unknown[]) => {
      precached.push(...paths.filter((path): path is Request => path instanceof Request));
    },
    match: async (path: string) =>
      new Response(path === "/offline.html" ? "offline" : "public shell"),
    put: async (...args: unknown[]) => {
      cacheWrites.push(args);
    },
  };
  let online = true;
  const network = new Response("private page", { headers: { "content-type": "text/html" } });
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: {
      location: { origin },
      addEventListener: (name: string, handler: (event: Record<string, unknown>) => void) =>
        listeners.set(name, handler),
      skipWaiting: async () => undefined,
    },
    caches: { open: async () => cache, delete: async () => undefined },
    URL,
    Request,
    Response,
    fetch: async () => {
      if (online) return network;
      throw new Error("disconnected");
    },
  });
  let wait: Promise<unknown> | undefined;
  listeners.get("install")!({
    waitUntil: (job: Promise<unknown>) => {
      wait = job;
    },
  });
  assert.ok(wait);
  await wait;
  assert.ok(precached.some((request) => request.url === origin + "/ocade-jarvis"));
  assert.ok(precached.every((request) => request.credentials === "omit"));
  const navigate = async (path: string) => {
    let response: Promise<Response> | undefined;
    listeners.get("fetch")!({
      request: { url: origin + path, method: "GET", mode: "navigate" },
      respondWith: (job: Promise<Response>) => {
        response = job;
      },
      waitUntil: () => {},
    });
    assert.ok(response);
    return response;
  };
  assert.equal(await (await navigate("/library?private=1")).text(), "private page");
  assert.deepEqual(cacheWrites, []);
  online = false;
  assert.equal(await (await navigate("/library?private=1")).text(), "offline");
  assert.equal(await (await navigate("/ocade-jarvis?c=secret")).text(), "public shell");
});

test("session-backed writes refuse foreign browser origins", () => {
  const request = (headers: HeadersInit) =>
    new Request("https://ocade.example/_server/action", { method: "POST", headers });
  assert.equal(isSameOriginWrite(request({ origin: "https://ocade.example" })), true);
  assert.equal(isSameOriginWrite(request({ origin: "https://other.ocade.example" })), false);
  assert.equal(isSameOriginWrite(request({ "sec-fetch-site": "cross-site" })), false);
  assert.equal(isSameOriginWrite(request({ origin: "null" })), false);
  assert.equal(isSameOriginWrite(request({})), true);
});

test("the streamed account export preserves device records without credentials or raw errors", async () => {
  const account = "aaaaaaaa-0000-0000-0000-000000000001";
  const admin = {
    from(table: string) {
      return {
        select: () => ({
          eq(owner: string, userId: string) {
            assert.ok(owner === "id" || owner === "user_id");
            assert.equal(userId, account);
            const page = {
              order: () => page,
              or: () => page,
              async limit() {
                if (table === "jarvis_devices") {
                  return { data: [{ id: "device", name: "My computer", public_key: "secret-key" }], error: null };
                }
                if (table === "ocade_push_subscriptions") {
                  return { data: [{ endpoint: "secret-endpoint", auth: "secret-auth", session_id: "secret-session", p256dh: "secret-p256dh", failures: 0 }], error: null };
                }
                if (table === "activity_log") {
                  return { data: null, error: { message: "secret-error" } };
                }
                return { data: [], error: null };
              },
            };
            return page;
          },
          in() { throw new Error("No parent IDs should be selected in this fixture"); },
        }),
        delete() { throw new Error("An export must not delete data"); },
      };
    },
  };
  const payload = await new Response(streamAccountExport(admin, account)).text();
  assert.doesNotMatch(payload, /secret-/);
  const document = JSON.parse(payload);
  const tables = document.classes.flatMap((entry: { tables: unknown[] }) => entry.tables);
  assert.deepEqual(tables.find((table: { table: string }) => table.table === "jarvis_devices").rows,
    [{ id: "device", name: "My computer" }]);
  assert.equal(document.partial, true);
});
