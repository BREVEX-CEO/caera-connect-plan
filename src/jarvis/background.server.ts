/**
 * THE COMPUTER CARRIES ON.
 *
 * A planning loop normally runs in the OCADE surface that started the task. A
 * phone that is locked, or a tab that is closed, stops that loop, and the task
 * used to wait at its checkpoint until somebody came back. With Background Mode
 * on for the task's computer, the computer asks OCADE for the next step instead
 * (`/api/jarvis/continue`, signed with its device key), and OCADE plans exactly
 * one step here and queues it like any other action.
 *
 * NOTHING HERE IS A SECOND AUTHORITY. The step is queued through the same
 * `queueTaskAction` a tab uses, so permissions, Allowed Apps and confirmations
 * are decided in the one place, and it reaches the computer through the same
 * exchange, where they are checked again. The loop's lease is the task's
 * `controller`: the computer's own id while it holds the loop. A tab that
 * speaks again takes the lease back, and this stops at its next write.
 *
 * STATELESS BY DESIGN. Each step is planned from what the database holds: the
 * conversation, and every action of the task with its result. Nothing is
 * remembered between steps, so a restart, a redeploy or a second request can
 * neither lose the task nor replay a step.
 *
 * WHAT NEEDS THE PERSON WAITS FOR THE PERSON. A confirmation, a sign-in, a
 * question: the task waits, they are notified, and nothing is decided for them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { NormalizedAttachment, NormalizedMessage } from "@/lib/intelligence/contract";
import { compact, memoryMessage, systemPrompt, type ModelStep } from "./agent";
import { executionDisabled, ORPHAN_MS } from "./device.server";
import {
  checkpointOf,
  humanBoundary,
  pairToolHistory,
  pruneOlderResults,
  toolResultMessage,
  TURN_BUDGET,
} from "./engine";
import { isAllowed } from "./permissions";
import {
  browserAction,
  computerAction,
  describeAction,
  finishChange,
  invalidReason,
  NOT_VERIFIED,
  undeclaredFields,
  type TaskStatus,
} from "./protocol";
import { changeTask, permissionsOf, queueTaskAction } from "./task-authority.server";
import { TASK_COLUMNS, type JarvisTaskRow } from "./task-row";

type Admin = SupabaseClient<Database>;

/** Results the model reads in full; older ones are their one-line outcome. */
const FULL_RESULTS = 4;

const CARRYING_ON = `
The person closed OCADE and this computer is carrying on with the open task. Continue it from the latest result with one tool call, or call finish_task with an honest outcome. If the next step needs the person (a choice, a sign-in, something only they know), do not call a tool: say in one short sentence what you need from them.`;

export interface BackgroundDeps {
  /** One billed model step for this person. null: no use available. "unavailable": try later. */
  model(input: {
    quality?: "standard" | "high";
    userId: string;
    conversationId: string;
    /** The task it plans for: the turn is part of that task's one use. */
    taskId: string;
    messages: NormalizedMessage[];
    attachments: NormalizedAttachment[];
  }): Promise<ModelStep | null | "unavailable">;
}

const PENDING = ["queued", "claimed", "needs_confirmation"];

/**
 * The running task this computer should carry on with now, or null: Background
 * Mode is on, the task is its own, nothing is queued, running or awaiting the
 * person, and the loop is either already this computer's or has been silent
 * for as long as a closed surface is.
 */
export async function taskToCarryOn(
  admin: Admin,
  device: { id: string; userId: string },
): Promise<string | null> {
  const [{ data: self }, { data: tasks }] = await Promise.all([
    admin
      .from("jarvis_devices")
      .select("background_enabled")
      .eq("id", device.id)
      .is("revoked_at", null)
      .maybeSingle(),
    admin
      .from("jarvis_tasks")
      .select("id, controller, updated_at")
      .eq("device_id", device.id)
      .eq("user_id", device.userId)
      .eq("status", "running")
      .limit(1),
  ]);
  const task = tasks?.[0];
  if (!self?.background_enabled || !task) return null;
  const silent = Date.parse(task.updated_at) < Date.now() - ORPHAN_MS;
  if (task.controller !== device.id && !silent) return null;
  const { data: pending, error } = await admin
    .from("jarvis_activity")
    .select("id")
    .eq("task_id", task.id)
    .in("status", PENDING)
    .limit(1);
  return error || pending?.length ? null : task.id;
}

export type StepState =
  /** Nothing for this computer to do: not its task, not allowed, or a surface has the loop. */
  | "idle"
  /** A step was planned and queued (or refused and recorded): ask again when it is done. */
  | "queued"
  /** The task needs the person now. */
  | "waiting"
  | "finished";

interface ActionRow {
  id: string;
  controller: string | null;
  action: unknown;
  status: string;
  summary: string;
  result: unknown;
  created_at: string;
}

/** Plan and queue the task's next step. Safe to call at any time, by this computer only. */
export async function carryOn(
  admin: Admin,
  device: { id: string; userId: string; kind?: string },
  taskId: string,
  deps: BackgroundDeps,
): Promise<{ state: StepState }> {
  const idle = { state: "idle" as const };
  const userId = device.userId;
  if (await executionDisabled(admin, device.kind)) return idle;
  if ((await taskToCarryOn(admin, device)) !== taskId) return idle;
  const rows = await permissionsOf(admin, userId);
  if (!isAllowed(rows, "master")) return idle;

  // THE LEASE, each attempt one statement: only while the task still runs, and
  // either already this computer's (a touch) or taken from a loop gone silent.
  //
  // WHILE IT PLANS, THE LEASE NAMES THIS REQUEST, NOT THE COMPUTER (PLAN Phase 05). The computer
  // asks every second; a request that arrived while another was still waiting for the model
  // used to pass the same checks, plan again and queue the same step twice (reproduced on
  // PostgreSQL). Now `controller` is this request's own id until it is done: a second request
  // finds the task held by someone else and stays idle, a step is queued only by the request
  // that holds it (the queue trigger checks), and the lease goes back to the computer at the end.
  const loop = crypto.randomUUID();
  const lease = () =>
    admin
      .from("jarvis_tasks")
      .update({ controller: loop })
      .eq("id", taskId)
      .eq("user_id", userId)
      .eq("device_id", device.id)
      .eq("status", "running");
  const columns = `${TASK_COLUMNS}, live_frame`;
  const mine = await lease().eq("controller", device.id).select(columns).maybeSingle();
  const held =
    mine.data ??
    (
      await lease()
        .lt("updated_at", new Date(Date.now() - ORPHAN_MS).toISOString())
        .select(columns)
        .maybeSingle()
    ).data;
  if (!held) return idle;
  try {
    return await plan(held as unknown as JarvisTaskRow & { live_frame: string | null });
  } finally {
    // Back to the computer, unless a surface took the task meanwhile.
    await admin
      .from("jarvis_tasks")
      .update({ controller: device.id })
      .eq("id", taskId)
      .eq("controller", loop);
  }

  async function plan(
    task: JarvisTaskRow & { live_frame: string | null },
  ): Promise<{ state: StepState }> {
    const change = (patch: Omit<Parameters<typeof changeTask>[3], "id" | "owner">) =>
      changeTask(admin, admin, userId, { id: task.id, owner: loop, ...patch });
    const needsPerson = async (status: TaskStatus, blocker: string, key: string) => {
      if (!(await change({ status, blocker: blocker.slice(0, 300) }))) return idle;
      const { sendNotification } = await import("@/lib/notifications/send.server");
      await sendNotification({
        userId,
        category: "task_outcomes",
        title: `JARVIS needs you: ${task.title.slice(0, 120)}`,
        deepLink: `/ocade-jarvis?c=${task.conversation_id}`,
        idempotencyKey: `jarvis-task-needs-you:${task.id}:${key}`,
      });
      return { state: "waiting" as const };
    };

    const [{ data: activity, error: activityError }, { data: said, error: saidError }] =
      await Promise.all([
        admin
          .from("jarvis_activity")
          .select("id, controller, action, status, summary, result, created_at")
          .eq("task_id", task.id)
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(300),
        admin
          .from("ocade_messages")
          .select("role, content, created_at")
          .eq("conversation_id", task.conversation_id)
          .eq("user_id", userId)
          .in("role", ["user", "assistant"])
          .order("created_at", { ascending: false })
          .limit(21),
      ]);
    // A transcript that could not be read is not a shorter transcript.
    if (activityError || saidError || !activity || !said || activity.length >= 300) return idle;
    const actions = (activity as ActionRow[]).filter((row) => row.action);
    // A completed finish still handing its files over (see handOverThenFinish), and its steps.
    const marker = [...(activity as ActionRow[])]
      .reverse()
      .find((row) => row.status === "note" && (row.result as { finishing?: unknown })?.finishing);
    // In the record's own order (microseconds apart; a millisecond clock would tie them).
    const since = marker
      ? (activity as ActionRow[])
          .slice((activity as ActionRow[]).indexOf(marker) + 1)
          .filter((row) => row.action)
      : [];
    const delivering = (row: ActionRow) =>
      ["file_info", "file_deliver"].includes(String((row.action as { action?: unknown }).action));
    const finishing =
      marker && since.every(delivering)
        ? (marker.result as { finishing: { args: Record<string, unknown> } }).finishing.args
        : null;
    // The step budget is the planner's: handing verified files over never runs it out (B08).
    if (!finishing && actions.length >= TURN_BUDGET.backgroundActions) {
      const done = await change({
        status: "blocked",
        result: "Stopped after too many steps without finishing.",
      });
      return done ? { state: "finished" } : idle;
    }

    // Steps that keep failing only spend the person's uses while nobody is watching.
    const recent = actions.slice(-TURN_BUDGET.failedCalls);
    if (
      !finishing &&
      recent.length === TURN_BUDGET.failedCalls &&
      recent.every((row) => row.status === "failed")
    ) {
      const kept = await change({
        status: "waiting",
        blocker: "JARVIS could not find an allowed way to do the next step. Say how to continue.",
      });
      return kept ? { state: "waiting" } : idle;
    }

    const last = actions.at(-1);
    // Only the person passes a human check. Once they took over and handed back
    // (a later line in the task's history), the next step starts from a fresh look.
    const newest = (activity as ActionRow[]).at(-1);
    const boundary = last && newest?.id === last.id ? humanBoundary(last) : null;
    if (boundary) return needsPerson("taken_over", boundary, last!.id);
    if (last) {
      const kept = await change({ checkpoint: checkpointOf(task, last.summary, last.result) });
      if (!kept) return idle;
    }

    /** Saved (or already saved for this step): true. A refused write is not a said line. */
    const say = async (content: string): Promise<boolean> => {
      if (!content.trim()) return true;
      const { error } = await admin.from("ocade_messages").insert({
        conversation_id: task.conversation_id,
        user_id: userId,
        role: "assistant",
        content: content.slice(0, 200_000),
        // One line per step of this task, however often the step is asked for.
        client_key: `jarvis-step-${task.id}-${actions.length}`,
      });
      return !error || error.code === "23505";
    };
    /** What the model asked for could not run: recorded, so the next step sees why. */
    const record = (action: unknown, summary: string) =>
      admin.from("jarvis_activity").insert({
        user_id: userId,
        task_id: task.id,
        device_id: device.id,
        controller: loop,
        summary: summary.slice(0, 300),
        action: action as never,
        status: "failed",
        result: { status: "refused" },
        completed_at: new Date().toISOString(),
      });

    /** The model's finish, recorded as the task's outcome and said in the conversation. */
    const finishWith = async (
      args: Record<string, unknown>,
      kept: string[] = [],
    ): Promise<{ state: StepState }> => {
      const finish = finishChange(args, task);
      // Said with the result, so nobody is told a file is in their Library when it is not.
      if (kept.length) {
        finish.result =
          `${finish.result ?? ""}\n\nKept on the computer, not in your Library: ${kept.join(", ")}.`.trim();
      }
      let done;
      try {
        done = await change(finish);
      } catch (error) {
        if (!(error instanceof Error && error.message.startsWith(NOT_VERIFIED))) throw error;
        await record({ action: "finish_task" }, error.message);
        return { state: "queued" };
      }
      if (!done) return idle;
      // The recorded result is what the person is told, never rosier words beside it (F06).
      await say(done.result ?? "");
      return { state: "finished" };
    };

    /*
     * A COMPLETED FINISH HANDS ITS FILES TO THE LIBRARY FIRST, as a tab does (plan.md §4.3). Its
     * outcome waits in a note while each due file is read for its size and sent, one step per
     * request and with no model step; a file that cannot go stays on the computer and the task
     * still completes. Anything else after the note (the person, a refusal) returns to the model.
     */
    const handOverThenFinish = async (
      args: Record<string, unknown>,
      since: ActionRow[],
    ): Promise<{ state: StepState }> => {
      const { taskDeliveriesDue } = await import("./task-authority.server");
      const due = await taskDeliveriesDue(admin, userId, task.id);
      // An unreadable record is not "nothing to hand over": the finish waits, resumable (F05).
      if (!due) {
        const kept = await change({
          status: "waiting",
          blocker:
            "OCADE could not read this task's record to hand over its files. Resume to try again.",
        });
        return kept ? { state: "waiting" } : idle;
      }
      const kept: string[] = [];
      for (const path of due) {
        const tried = since.filter((row) => (row.action as { path?: unknown }).path === path);
        const read = [...tried]
          .reverse()
          .find((row) => (row.action as { action?: unknown }).action === "file_info");
        const info = (read?.result as { detail?: { info?: { size?: unknown; folder?: unknown } } })
          ?.detail?.info;
        if (
          tried.some((row) => row.status !== "done") ||
          (read && (info?.folder || typeof info?.size !== "number" || info.size < 1))
        ) {
          kept.push(path);
          continue;
        }
        const action = computerAction.parse(
          read ? { action: "file_deliver", path, size: info!.size } : { action: "file_info", path },
        );
        const queued = await queueTaskAction(admin, admin, userId, {
          taskId: task.id,
          controller: loop,
          action,
        });
        if (queued.ok) return { state: "queued" };
        if (queued.lost || queued.message === "The task is not running.") return idle;
        await record(action, queued.message);
        kept.push(path);
      }
      return finishWith(args, kept);
    };
    if (finishing) return handOverThenFinish(finishing, since);

    const family = (action: unknown) =>
      (action as { action?: string } | null)?.action === "docs"
        ? "docs"
        : browserAction.safeParse(action).success
          ? "browser"
          : "computer";
    // Legacy/foreground steps have no saved native turn; keep their rebuilt history readable.
    const turn = (
      id: string,
      name: string,
      args: Record<string, unknown>,
      result: unknown,
    ): NormalizedMessage[] => [
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: `provider-tool-${id}`, name, arguments: args }],
      },
      toolResultMessage({ id: `provider-tool-${id}`, name }, result),
    ];
    const outcome = (row: ActionRow) => {
      const { status, ...detail } = (row.result ?? {}) as { status?: string };
      return actions.indexOf(row) >= actions.length - FULL_RESULTS
        ? compact({ status: status ?? row.status, summary: row.summary, ...detail })
        : { status: status ?? row.status, summary: row.summary };
    };
    // Notes and actions share the request's controller. This joins an original call to its
    // actual receipts, including a sequence, without inferring identity from time or arguments.
    const native = (activity as ActionRow[]).flatMap((row) => {
      const saved = (row.result as { modelTurn?: ModelStep } | null)?.modelTurn;
      return row.status === "note" && row.controller && Array.isArray(saved?.toolCalls)
        ? [{ row, saved }]
        : [];
    });
    const nativeOwners = new Set(native.map(({ row }) => row.controller));
    const timeline: { at: string; messages: NormalizedMessage[] }[] = [
      ...said.map((message) => ({
        at: message.created_at,
        messages: [{ role: message.role as "user" | "assistant", content: message.content }],
      })),
      // The task's own beginning, as the surface that started it saw it.
      {
        at: task.created_at,
        messages: turn(
          `${task.id}-start`,
          "start_task",
          {
            title: task.title,
            where: actions[0] && family(actions[0].action) === "browser" ? "browser" : "computer",
            steps: task.plan,
          },
          { ok: true, message: "Task started." },
        ),
      },
      ...native.map(({ row, saved }) => {
        const selected = saved.toolCalls.find((call) =>
          ["computer", "browser", "docs", "finish_task"].includes(call.name),
        );
        const receipts = actions.filter((action) => action.controller === row.controller);
        return {
          at: row.created_at,
          messages: [
            {
              role: "assistant" as const,
              content: saved.text,
              ...(saved.toolCalls.length ? { toolCalls: saved.toolCalls } : {}),
              ...(saved.parts ? { parts: saved.parts } : {}),
            },
            ...saved.toolCalls.map((call) =>
              toolResultMessage(
                call,
                call === selected && receipts.length
                  ? { steps: receipts.map(outcome) }
                  : { status: "not_run", summary: "This call was not run. No effect is recorded." },
                "tool",
              ),
            ),
          ],
        };
      }),
      ...actions
        .filter((row) => !nativeOwners.has(row.controller))
        .map((row) => {
          const tool = family(row.action);
          return {
            at: row.created_at,
            messages: turn(row.id, tool, row.action as Record<string, unknown>, outcome(row)),
          };
        }),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    let memories: string[] = [];
    const memoryEnabled = isAllowed(rows, "memory");
    if (memoryEnabled) {
      const { data } = await admin
        .from("jarvis_memories")
        .select("content")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);
      memories = (data ?? []).map((row) => row.content);
    }
    const messages: NormalizedMessage[] = [
      { role: "system", content: systemPrompt({ task }) + CARRYING_ON },
      ...memoryMessage({ memoryEnabled, memories }),
      ...pairToolHistory(timeline.flatMap((entry) => entry.messages)),
    ];
    // As in the foreground: only the newest result is read whole.
    pruneOlderResults(messages, messages.map((message) => !!message.toolResult).lastIndexOf(true));
    const looked =
      last && ["screen", "look"].includes((last.action as { action?: string }).action ?? "");
    const attachments: NormalizedAttachment[] =
      looked && task.live_frame
        ? [
            {
              name: "screen.jpg",
              mime: "image/jpeg",
              sizeBytes: task.live_frame.length,
              image: task.live_frame,
            },
          ]
        : [];

    const reply = await deps.model({
      quality: task.checkpoint?.intelligenceQuality ?? "standard",
      userId,
      conversationId: task.conversation_id,
      taskId: task.id,
      messages,
      attachments,
    });
    if (!reply || reply === "unavailable") {
      const kept = await change({
        status: "waiting",
        blocker: reply
          ? "Waiting for OCADE JARVIS to be available again."
          : "No JARVIS use was available just now. Resume to try again.",
      });
      return kept ? { state: "waiting" } : idle;
    }

    // Persist before any effect. A crash leaves either receipts under this controller or an
    // explicitly unrun call; a failed journal write must never release work to the device.
    // jarvis_activity already restricts writes to the service role and bounds result bytes.
    if (reply.toolCalls.length || reply.parts?.length) {
      const { error } = await admin.from("jarvis_activity").insert({
        user_id: userId,
        task_id: task.id,
        device_id: device.id,
        controller: loop,
        status: "note",
        summary: "Planning the next step",
        result: { modelTurn: reply } as never,
      });
      if (error) {
        const kept = await change({
          status: "waiting",
          blocker: "OCADE could not save the next step. Resume to try again.",
        });
        return kept ? { state: "waiting" } : idle;
      }
    }

    for (const call of reply.toolCalls) {
      const given = (call.arguments ?? {}) as Record<string, unknown>;
      // finish_task and docs take the first action of a sequence; a device call takes them all (below).
      const first = Array.isArray(given.sequence) ? given.sequence[0] : null;
      const args = (first && typeof first === "object" ? first : given) as Record<string, unknown>;
      if (call.name === "finish_task") {
        if (finishChange(args, task).status !== "completed") return finishWith(args);
        const { error } = await admin.from("jarvis_activity").insert({
          user_id: userId,
          task_id: task.id,
          device_id: device.id,
          controller: loop,
          status: "note",
          summary: "Handing the finished files to the Library",
          result: { finishing: { args } } as never,
        });
        // Without the note the files could not be handed over safely: wait, resumable (F05).
        if (error) {
          const kept = await change({
            status: "waiting",
            blocker: "OCADE could not save the finished result. Resume to try again.",
          });
          return kept ? { state: "waiting" } : idle;
        }
        return handOverThenFinish(args, []);
      }
      if (call.name === "docs") {
        // Read here and kept on the task, so the next step sees it and a script after it is asked.
        const { readDocsForTask } = await import("./docs.server");
        const url = String(args.url ?? "").slice(0, 2000);
        if (!(await readDocsForTask(admin, userId, task.id, url, true, loop))) {
          await record({ action: "docs" }, "This task has read enough documentation already.");
        }
        return { state: "queued" };
      }
      if (call.name !== "browser" && call.name !== "computer") continue;
      /*
       * A SEQUENCE RUNS HERE AS IT DOES IN THE FOREGROUND (PLAN Phase 05 V08). Only its first step
       * used to be queued and the rest silently dropped. Now the steps that need no fresh
       * observation are queued together, each through the same validation, permission and
       * confirmation, so a computer that runs segments takes them in one exchange and skips the
       * rest after one that does not finish. A step that acts on what the one before it leaves
       * ("latest"), and everything after a step that could not be queued, is not run, and the
       * next request is told so: it plans them from the real results.
       */
      const steps = Array.isArray(given.sequence)
        ? given.sequence.slice(0, TURN_BUDGET.sequence)
        : [given];
      const notRun = async (from: number) => {
        if (from < steps.length) {
          await record(
            { action: "sequence" },
            `Steps ${from + 1} to ${steps.length} of that sequence were not run. Plan them again from these results.`,
          );
        }
      };
      for (const [index, raw] of steps.entries()) {
        const { step, ...rest } = (raw && typeof raw === "object" ? raw : {}) as Record<
          string,
          unknown
        >;
        if (index > 0 && rest.observationId === "latest") {
          await notRun(index);
          return { state: "queued" };
        }
        const undeclared = undeclaredFields(call.name, rest);
        const parsed = (call.name === "browser" ? browserAction : computerAction).safeParse(rest);
        if (!parsed.success || undeclared.length) {
          await record(
            { action: String(rest.action ?? "").slice(0, 40) },
            !parsed.success
              ? `That ${call.name} action is not valid (${invalidReason(parsed.error)}).`
              : `That ${call.name} action has fields the tool does not have (${undeclared.join(", ")}). Use only its listed fields.`,
          );
          await notRun(index + 1);
          return { state: "queued" };
        }
        if (typeof step === "number" && step >= 1 && step - 1 !== task.current_step) {
          if (!(await change({ currentStep: Math.min(12, Math.floor(step) - 1) }))) return idle;
        }
        const queued = await queueTaskAction(admin, admin, userId, {
          taskId: task.id,
          controller: loop,
          action: parsed.data,
        });
        if (!queued.ok) {
          // A surface took the loop back, or the task stopped while this step was planned.
          if (queued.lost || queued.message === "The task is not running.") return idle;
          await record(parsed.data, queued.message);
          await notRun(index + 1);
          return { state: "queued" };
        }
        if (queued.needsConfirmation) {
          await notRun(index + 1);
          return needsPerson(
            "waiting",
            `JARVIS needs you to confirm: ${describeAction(parsed.data)}`,
            queued.id,
          );
        }
      }
      return { state: "queued" };
    }

    // Words and no step: a question for the person, kept in the conversation. A question that
    // could not be saved is asked again by the next request, never waited on unseen.
    if (!(await say(reply.text))) return idle;
    return needsPerson("waiting", "JARVIS needs your answer to continue.", `say-${actions.length}`);
  }
}
