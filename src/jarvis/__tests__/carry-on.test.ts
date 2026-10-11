import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseTwin } from "../../../scripts/db-twin.mts";
import type { ModelStep } from "../agent";
import {
  BACKGROUND_MAX_ACTIONS,
  carryOn,
  taskToCarryOn,
  type BackgroundDeps,
} from "../background.server";
import { exchange } from "../device.server";
import { lit, restOver } from "./rest-adapter";

/**
 * THE COMPUTER CARRIES ON, against real PostgreSQL with the real migrations:
 * what it may continue, whose loop wins, what waits for the person, and that
 * every step goes through the same queue and the same checks as a tab's.
 */
const notified = vi.hoisted(() => [] as { title: string; idempotencyKey: string }[]);
vi.mock("@/lib/notifications/send.server", () => ({
  sendNotification: async (input: { title: string; idempotencyKey: string }) => {
    notified.push({ title: input.title, idempotencyKey: input.idempotencyKey });
  },
}));

let twin: DatabaseTwin;
const A = "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb";
const TAB = "cccccccc-3333-4ccc-8ccc-cccccccccccc";
let device: string;
let otherDevice: string;
let strangerDevice: string;
let conversation: string;
const admin = () => restOver(twin) as never;
const me = () => ({ id: device, userId: A, kind: "agent" });
const sql = <T = Record<string, unknown>>(text: string) => twin.asServiceRole<T>(text);

/** A running task the tab that started it has not touched for `silentMinutes`. */
async function task(silentMinutes = 5, controller: string | null = TAB): Promise<string> {
  const [row] = await sql<{ id: string }>(
    `insert into public.jarvis_tasks (user_id, conversation_id, device_id, title, plan, controller)
     values ('${A}', '${conversation}', '${device}', 'Tidy the reports', '["List","Finish"]'::jsonb, ${lit(controller)})
     returning id`,
  );
  await age(row!.id, silentMinutes);
  return row!.id;
}

/** `updated_at` is set by a trigger on every write, so the past is written with it off. */
const age = (id: string, minutes: number) =>
  twin.execSuperuser(
    `alter table public.jarvis_tasks disable trigger jarvis_tasks_frame_is_temporary;
     update public.jarvis_tasks set updated_at = now() - interval '${minutes} minutes' where id = '${id}';
     alter table public.jarvis_tasks enable trigger jarvis_tasks_frame_is_temporary;`,
  );

const taskRow = async (id: string) =>
  (
    await sql<{
      status: string;
      blocker: string | null;
      controller: string | null;
      result: string | null;
      current_step: number;
    }>(
      `select status, blocker, controller, result, current_step from public.jarvis_tasks where id = '${id}'`,
    )
  )[0]!;

const actionsOf = (id: string) =>
  sql<{ id: string; status: string; summary: string; action: { action: string } }>(
    `select id, status, summary, action from public.jarvis_activity
     where task_id = '${id}' and action is not null order by created_at`,
  );

const permit = (capability: string, allowed: boolean) =>
  sql(
    `insert into public.jarvis_permissions (user_id, capability, allowed)
     values ('${A}', '${capability}', ${allowed})`,
  );

const background = (on: boolean) =>
  sql(`update public.jarvis_devices set background_enabled = ${on} where id = '${device}'`);

/** A model that answers with these steps in order, and keeps what it was shown. */
function scripted(...steps: (ModelStep | null | "unavailable" | (() => Promise<ModelStep>))[]) {
  const seen: string[][] = [];
  const model: BackgroundDeps["model"] = async ({ userId, messages }) => {
    expect(userId).toBe(A);
    seen.push(messages.map((m) => `${m.role}: ${m.content}`));
    const step = steps.shift();
    if (step === undefined) throw new Error("the model was asked for a step nobody expected");
    return typeof step === "function" ? step() : step;
  };
  return { model, seen };
}
const call = (name: string, args: Record<string, unknown>): ModelStep => ({
  text: "",
  toolCalls: [{ id: "c", name, arguments: args }],
});

/** The computer does the queued step and reports it, as the Device Agent would. */
async function computerRuns(result: Record<string, unknown> = {}) {
  const reply = await exchange(admin(), me(), { results: [] });
  const command = reply.commands[0]!;
  await exchange(admin(), me(), {
    results: [{ id: command.id, status: "done", summary: "Listed .", ...result }],
  });
  return command;
}

beforeAll(async () => {
  twin = await DatabaseTwin.create();
  const applied = await twin.applyMigrations();
  expect(applied.filter((m) => !m.ok)).toEqual([]);
  await twin.execSuperuser(
    `insert into auth.users (id, email) values ('${A}', 'a@jarvis.invalid'), ('${B}', 'b@jarvis.invalid')
     on conflict do nothing;`,
  );
  [{ id: conversation }] = await sql<{ id: string }>(
    `insert into public.ocade_conversations (user_id, title, surface)
     values ('${A}', 'j', 'jarvis') returning id`,
  );
  const enroll = async (user: string, name: string) =>
    (
      await sql<{ id: string }>(
        `insert into public.jarvis_devices (user_id, name, public_key, capabilities)
         values ('${user}', '${name}', repeat('${name[0]}', 122), '{"files":true,"terminal":true,"apps":true}'::jsonb)
         returning id`,
      )
    )[0]!.id;
  device = await enroll(A, "Desk");
  otherDevice = await enroll(A, "Laptop");
  strangerDevice = await enroll(B, "Theirs");
}, 120_000);

afterAll(async () => {
  await twin?.close();
});

beforeEach(async () => {
  notified.length = 0;
  delete process.env.JARVIS_EXECUTION_DISABLED;
  await sql(`delete from public.jarvis_tasks where user_id = '${A}'`);
  await sql(`delete from public.jarvis_permissions where user_id = '${A}'`);
  await sql(`delete from public.ocade_messages where user_id = '${A}'`);
  await sql(
    `insert into public.ocade_messages (conversation_id, user_id, role, content)
     values ('${conversation}', '${A}', 'user', 'Tidy the reports folder')`,
  );
  await permit("files", true);
  await background(true);
});

describe("which task a computer may carry on with", () => {
  it("without Background Mode a silent task waits at its checkpoint, as before", async () => {
    await background(false);
    const t = await task();
    expect(await taskToCarryOn(admin(), me())).toBeNull();
    const reply = await exchange(admin(), me(), { results: [] });
    expect(reply.continue).toBeUndefined();
    expect((await taskRow(t)).status).toBe("waiting");
  });

  it("with Background Mode the silent task is not paused: the computer is told to continue it", async () => {
    const t = await task();
    const reply = await exchange(admin(), me(), { results: [] });
    expect(reply.continue).toBe(t);
    expect((await taskRow(t)).status).toBe("running");
  });

  it("a task whose surface is still there is left to it", async () => {
    await task(1);
    expect(await taskToCarryOn(admin(), me())).toBeNull();
    expect((await exchange(admin(), me(), { results: [] })).continue).toBeUndefined();
  });

  it("a step awaiting the person's confirmation is never carried past", async () => {
    const t = await task();
    await sql(
      `insert into public.jarvis_activity (user_id, task_id, device_id, summary, action, status)
       values ('${A}', '${t}', '${device}', 'Permanently deleting x', '{"action":"file_delete","path":"x"}'::jsonb, 'needs_confirmation')`,
    );
    expect(await taskToCarryOn(admin(), me())).toBeNull();
    await exchange(admin(), me(), { results: [] });
    // Nobody is there to answer: it waits, and Resume asks again.
    expect((await taskRow(t)).status).toBe("waiting");
  });

  it("only the task's own computer, in the task's own account", async () => {
    const t = await task();
    const { model, seen } = scripted();
    for (const other of [
      { id: otherDevice, userId: A },
      { id: strangerDevice, userId: B },
      { id: device, userId: B },
    ]) {
      expect(await taskToCarryOn(admin(), other)).toBeNull();
      expect(await carryOn(admin(), other, t, { model })).toEqual({ state: "idle" });
    }
    expect(seen).toEqual([]);
    expect((await taskRow(t)).controller).toBe(TAB);
    expect(await actionsOf(t)).toEqual([]);
  });
});

describe("carrying on", () => {
  it("plans one step at a time through the same queue, and finishes the task", async () => {
    const t = await task();
    const first = scripted(call("computer", { action: "file_list", path: ".", step: 1 }));
    expect(await carryOn(admin(), me(), t, first)).toEqual({ state: "queued" });
    expect((await taskRow(t)).controller).toBe(device);
    expect(first.seen[0]!.some((line) => line === "user: Tidy the reports folder")).toBe(true);
    expect(first.seen[0]![0]).toContain("this computer is carrying on with the open task");

    // It reaches the computer through the exchange, like any other action.
    const command = await computerRuns({ detail: { entries: [{ name: "q3.xlsx" }] } });
    expect(command.action).toEqual({ action: "file_list", path: "." });

    // Now the loop is this computer's: it is asked again although the task was just touched.
    expect((await exchange(admin(), me(), { results: [] })).continue).toBe(t);
    const second = scripted(
      call("finish_task", {
        outcome: "completed",
        result: "The reports are tidy.",
        evidence: ["q3.xlsx"],
      }),
    );
    expect(await carryOn(admin(), me(), t, second)).toEqual({ state: "finished" });
    const shown = second.seen[0]!.join("\n");
    expect(shown).toContain('assistant: Called computer {"path":".","action":"file_list"}');
    expect(shown).toContain("q3.xlsx");
    expect(shown.indexOf("Tidy the reports folder")).toBeLessThan(shown.indexOf("Called computer"));

    const done = await taskRow(t);
    expect(done).toMatchObject({
      status: "completed",
      result: "The reports are tidy.",
      current_step: 2,
    });
    const said = await sql<{ content: string }>(
      `select content from public.ocade_messages where conversation_id = '${conversation}' and role = 'assistant'`,
    );
    expect(said.map((row) => row.content)).toEqual(["The reports are tidy."]);
    expect(notified.map((n) => n.title)).toEqual(["JARVIS finished: Tidy the reports"]);
    expect((await exchange(admin(), me(), { results: [] })).continue).toBeUndefined();
  });

  it("a surface that speaks again takes the loop back, even mid-plan", async () => {
    const t = await task();
    const { model } = scripted(async () => {
      // While the step was being planned, the person's tab claimed the task.
      await sql(`update public.jarvis_tasks set controller = '${TAB}' where id = '${t}'`);
      return call("computer", { action: "file_list", path: "." });
    });
    expect(await carryOn(admin(), me(), t, { model })).toEqual({ state: "idle" });
    expect(await actionsOf(t)).toEqual([]);
    // And while that tab is alive the computer is not asked again.
    expect(await taskToCarryOn(admin(), me())).toBeNull();
  });

  it("STOP while a step is being planned queues nothing", async () => {
    const t = await task();
    const { model } = scripted(async () => {
      await exchange(admin(), me(), { results: [], stop: true });
      return call("computer", { action: "file_list", path: "." });
    });
    expect(await carryOn(admin(), me(), t, { model })).toEqual({ state: "idle" });
    expect(await actionsOf(t)).toEqual([]);
    expect((await taskRow(t)).status).toBe("stopped");
  });

  it("what needs a confirmation waits for the person, and they are told", async () => {
    const t = await task();
    const { model } = scripted(call("computer", { action: "file_delete", path: "old.txt" }));
    expect(await carryOn(admin(), me(), t, { model })).toEqual({ state: "waiting" });
    const row = await taskRow(t);
    expect(row.status).toBe("waiting");
    expect(row.blocker).toBe("JARVIS needs you to confirm: Permanently deleting old.txt");
    expect((await actionsOf(t)).map((a) => a.status)).toEqual(["cancelled"]);
    expect((await exchange(admin(), me(), { results: [] })).commands).toEqual([]);
    expect(notified.map((n) => n.title)).toEqual(["JARVIS needs you: Tidy the reports"]);
  });

  it("a permission that is off refuses the step, and the next plan is told why", async () => {
    await permit("terminal", false);
    const t = await task();
    const first = scripted(call("computer", { action: "run", command: "dir" }));
    expect(await carryOn(admin(), me(), t, first)).toEqual({ state: "queued" });
    expect((await actionsOf(t)).map((a) => [a.status, a.summary])).toEqual([
      ["failed", "Running commands is turned off for this device."],
    ]);
    expect((await exchange(admin(), me(), { results: [] })).commands).toEqual([]);
    const second = scripted(
      call("finish_task", { outcome: "blocked", result: "Commands are off." }),
    );
    await carryOn(admin(), me(), t, second);
    expect(second.seen[0]!.join("\n")).toContain("Running commands is turned off for this device.");
  });

  it("the task's own tests run at once; other commands wait, and only the exact one allowed runs again", async () => {
    await permit("terminal", true);
    const t = await task();
    const first = scripted(call("computer", { action: "run", command: 'python -c "print(1)"' }));
    expect(await carryOn(admin(), me(), t, first)).toEqual({ state: "waiting" });
    expect((await taskRow(t)).blocker).toBe(
      'JARVIS needs you to confirm: Running python -c "print(1)"',
    );
    expect((await exchange(admin(), me(), { results: [] })).commands).toEqual([]);
    await sql(
      `update public.jarvis_tasks set status = 'running', blocker = null where id = '${t}'`,
    );

    // A routine test run is not a question for the person (owner policy, 2026-10-02).
    const tests = scripted(call("computer", { action: "run", command: "npm test" }));
    expect(await carryOn(admin(), me(), t, tests)).toEqual({ state: "queued" });
    expect((await exchange(admin(), me(), { results: [] })).commands[0]?.action).toEqual({
      action: "run",
      command: "npm test",
    });
    await sql(
      `update public.jarvis_activity set status = 'done' where task_id = '${t}' and action is not null`,
    );

    // Once the task has read a web page, a script could be the page's: it is asked, once.
    await sql(
      `insert into public.jarvis_activity (user_id, task_id, device_id, summary, action, status)
       values ('${A}', '${t}', '${device}', 'Reading the page', '{"action":"observe"}'::jsonb, 'done')`,
    );
    const script = scripted(call("computer", { action: "run", command: "python build.py" }));
    expect(await carryOn(admin(), me(), t, script)).toEqual({ state: "waiting" });
    await sql(
      `insert into public.jarvis_activity (user_id, task_id, device_id, summary, action, status, confirmed)
       values ('${A}', '${t}', '${device}', 'Running python build.py',
               '{"action":"run","command":"python build.py"}'::jsonb, 'done', true),
              ('${A}', '${t}', '${device}', 'Running git push',
               '{"action":"run","command":"git push"}'::jsonb, 'done', true)`,
    );
    await sql(
      `update public.jarvis_tasks set status = 'running', blocker = null where id = '${t}'`,
    );
    const again = scripted(call("computer", { action: "run", command: "python build.py" }));
    expect(await carryOn(admin(), me(), t, again)).toEqual({ state: "queued" });
    await sql(
      `update public.jarvis_activity set status = 'done' where task_id = '${t}' and action is not null`,
    );
    // Publishing asks every time, however often it was allowed.
    const push = scripted(call("computer", { action: "run", command: "git push" }));
    expect(await carryOn(admin(), me(), t, push)).toEqual({ state: "waiting" });
  });

  it("an action that is not one of OCADE's is refused and recorded, never sent", async () => {
    const t = await task();
    const { model } = scripted(call("computer", { action: "format_disk", drive: "C" }));
    expect(await carryOn(admin(), me(), t, { model })).toEqual({ state: "queued" });
    expect((await actionsOf(t)).map((a) => [a.status, a.summary])).toEqual([
      ["failed", expect.stringMatching(/^That computer action is not valid \(action: /)],
    ]);
    expect((await exchange(admin(), me(), { results: [] })).commands).toEqual([]);
  });

  it("after three failed steps in a row it waits for the person instead of spending more uses", async () => {
    const t = await task();
    const bad = () => scripted(call("computer", { action: "format_disk", drive: "C" }));
    for (let i = 0; i < 3; i += 1) {
      expect(await carryOn(admin(), me(), t, bad())).toEqual({ state: "queued" });
    }
    const unused = scripted(); // any model call now throws
    expect(await carryOn(admin(), me(), t, unused)).toEqual({ state: "waiting" });
    expect(unused.seen).toHaveLength(0);
  });

  it("a human check hands the task to the person and is not asked about twice", async () => {
    const t = await task();
    const first = scripted(call("browser", { action: "observe" }));
    await permit("browser", true);
    await sql(
      `update public.jarvis_devices set capabilities = capabilities || '{"browser_isolated":true}'::jsonb where id = '${device}'`,
    );
    expect(await carryOn(admin(), me(), t, first)).toEqual({ state: "queued" });
    await computerRuns({ observation: { humanBoundary: "captcha", url: "https://example.com/" } });

    const none = scripted();
    expect(await carryOn(admin(), me(), t, none)).toEqual({ state: "waiting" });
    expect(none.seen).toEqual([]);
    expect(await taskRow(t)).toMatchObject({
      status: "taken_over",
      blocker: "This page asks you to prove you are human. Take over to continue.",
    });
    expect(notified).toHaveLength(1);

    // The person passes it and resumes from the tray: now it continues.
    await exchange(admin(), me(), { results: [], resume: true });
    const after = scripted(call("browser", { action: "observe" }));
    expect(await carryOn(admin(), me(), t, after)).toEqual({ state: "queued" });
  });

  it("words without a step are a question for the person, kept in the conversation", async () => {
    const t = await task();
    const { model } = scripted({ text: "Which quarter should I start with?", toolCalls: [] });
    expect(await carryOn(admin(), me(), t, { model })).toEqual({ state: "waiting" });
    expect(await taskRow(t)).toMatchObject({
      status: "waiting",
      blocker: "JARVIS needs your answer to continue.",
    });
    const said = await sql<{ content: string }>(
      `select content from public.ocade_messages where conversation_id = '${conversation}' and role = 'assistant'`,
    );
    expect(said.map((row) => row.content)).toEqual(["Which quarter should I start with?"]);
  });

  it("no use left, or OCADE busy, waits honestly and spends nothing more", async () => {
    for (const [answer, blocker] of [
      [null, "No JARVIS use was available just now. Resume to try again."],
      ["unavailable", "Waiting for OCADE JARVIS to be available again."],
    ] as const) {
      await sql(`delete from public.jarvis_tasks where user_id = '${A}'`);
      const t = await task();
      const { model } = scripted(answer);
      expect(await carryOn(admin(), me(), t, { model })).toEqual({ state: "waiting" });
      expect(await taskRow(t)).toMatchObject({ status: "waiting", blocker });
      expect(await taskToCarryOn(admin(), me())).toBeNull();
    }
  });

  it("a task that does not converge is stopped, not driven for ever", async () => {
    const t = await task();
    await sql(
      `insert into public.jarvis_activity (user_id, task_id, device_id, summary, action, status, result)
       select '${A}', '${t}', '${device}', 'Listed .', '{"action":"file_list","path":"."}'::jsonb, 'done', '{"status":"done"}'::jsonb
       from generate_series(1, ${BACKGROUND_MAX_ACTIONS})`,
    );
    const { model, seen } = scripted();
    expect(await carryOn(admin(), me(), t, { model })).toEqual({ state: "finished" });
    expect(seen).toEqual([]);
    expect(await taskRow(t)).toMatchObject({
      status: "blocked",
      result: "Stopped after too many steps without finishing.",
    });
  });

  it("OCADE's emergency stop means nothing is planned", async () => {
    const t = await task();
    process.env.JARVIS_EXECUTION_DISABLED = "1";
    const { model, seen } = scripted();
    expect(await carryOn(admin(), me(), t, { model })).toEqual({ state: "idle" });
    expect(seen).toEqual([]);
    expect((await taskRow(t)).controller).toBe(TAB);
  });

  it("with JARVIS turned off for the account nothing is planned", async () => {
    await permit("master", false);
    const t = await task();
    const { model, seen } = scripted();
    expect(await carryOn(admin(), me(), t, { model })).toEqual({ state: "idle" });
    expect(seen).toEqual([]);
  });
});
