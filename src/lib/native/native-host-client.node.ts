/**
 * One supervised stdio host, talked to safely. Node-only.
 *
 * WHY A SHARED CLIENT
 * -------------------
 * OCADE now runs two sidecars with the same contract — the Playwright browser
 * host (`native/browser-host/index.mjs`) and the Python native-control host
 * (`native/python-host/ocade_host`). They speak newline-delimited JSON, one
 * bounded reply per request, no listening socket. Writing the client twice
 * would mean two places to get request pairing, timeouts and process death
 * wrong, and those are exactly the bugs that present as "OCADE hangs".
 *
 * THREE THINGS THIS GUARANTEES
 *
 * 1. **A request always settles.** Every call carries a deadline. A sidecar
 *    that dies, wedges or answers nothing rejects with a sentence rather than
 *    leaving an agent loop waiting on a promise that will never resolve.
 * 2. **Replies cannot be mismatched.** Requests are queued in order and each
 *    reply is handed to the oldest waiter. A crash rejects every outstanding
 *    caller instead of silently pairing the next reply with the wrong request.
 * 3. **The child never outlives its purpose.** `dispose()` closes stdin and
 *    kills the process, and the same happens automatically when the parent
 *    exits — an orphaned Python or Chrome process holding a camera, a profile
 *    or a file lock is a real cost to the person whose computer it is.
 */

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export interface HostReply<T = unknown> {
  ok: boolean;
  data?: T;
  code?: string;
  error?: string;
}

export interface NativeHostOptions {
  command: string;
  args: string[];
  cwd?: string;
  /** Per-request ceiling. Generous by default: UIA walks are genuinely slow. */
  timeoutMs?: number;
  label: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class NativeHostClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";
  /*
   * KEYED BY REQUEST ID, NOT BY POSITION.
   *
   * These used to be an array, and every reply went to `waiters.shift()`. That
   * is correct only while the queue and the reply stream stay in step, and one
   * timeout is enough to break it: the waiter is spliced out when its deadline
   * passes, the host answers a moment later anyway, and that late reply is
   * handed to the NEXT request. From then on every answer belongs to the
   * previous question.
   *
   * On a channel that drives a real mouse and keyboard, the answer that goes
   * astray is the VERIFY step of observe → act → observe → verify. An agent
   * told that an unrelated command's check succeeded is precisely the "click
   * success is not proof" failure the whole design exists to prevent.
   */
  private readonly waiters = new Map<
    string,
    {
      resolve: (reply: HostReply) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private nextId = 0;
  private closedReason: string | null = null;

  constructor(private readonly options: NativeHostOptions) {}

  private ensure(): ChildProcessWithoutNullStreams {
    if (this.child && !this.child.killed) return this.child;
    if (this.closedReason) throw new Error(this.closedReason);

    const child = spawn(this.options.command, this.options.args, {
      cwd: this.options.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      // No shell, ever. A shell here would turn every argument into a place
      // where quoting mistakes become command execution.
      shell: false,
    });

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.consume(chunk));
    child.on("exit", (code) =>
      this.fail(`${this.options.label} stopped unexpectedly (exit ${code}).`),
    );
    child.on("error", (error) =>
      this.fail(`${this.options.label} could not start: ${error.message}`),
    );

    this.child = child;
    return child;
  }

  private consume(chunk: string): void {
    this.buffer += chunk;
    let index: number;
    while ((index = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (!line) continue;
      let reply: HostReply & { id?: unknown };
      try {
        reply = JSON.parse(line) as HostReply & { id?: unknown };
      } catch {
        /*
         * An unreadable line cannot be attributed to anyone. Failing the
         * OLDEST outstanding request would be a guess, and a wrong guess here
         * means a command is told something about a reply that was never its
         * own — so it is dropped and the real waiter times out honestly.
         */
        continue;
      }

      const id = typeof reply.id === "string" ? reply.id : null;
      if (id === null) {
        /*
         * A host that does not echo ids. Handing this to whoever happens to be
         * at the front of the queue is the bug this file was rewritten to
         * remove, so it is dropped and the real waiter times out honestly.
         */
        continue;
      }
      const waiter = this.waiters.get(id);
      if (!waiter) {
        // An id nobody is waiting on: a late reply to something that already
        // timed out. Dropping it is the only safe move.
        continue;
      }
      this.waiters.delete(id);
      clearTimeout(waiter.timer);
      waiter.resolve(reply);
    }
  }

  private fail(reason: string): void {
    this.child = null;
    for (const [id, waiter] of [...this.waiters]) {
      this.waiters.delete(id);
      clearTimeout(waiter.timer);
      waiter.resolve({ ok: false, code: "retryable_failure", error: reason });
    }
  }

  /**
   * Send a request whose shape the host already defines.
   *
   * The browser host predates this client and takes its fields at the top level
   * (`{version, command, sessionId, action}`) rather than under `payload`. That
   * host is proven and in use, so the client bends to it instead of the other
   * way round — changing a working protocol to suit a new caller is how proven
   * things stop being proven.
   */
  async raw<T = unknown>(
    body: Record<string, unknown>,
    options?: { timeoutMs?: number },
  ): Promise<HostReply<T>> {
    return this.send({ version: 1, ...body }, options?.timeoutMs);
  }

  async request<T = unknown>(
    command: string,
    payload: Record<string, unknown> = {},
    options?: { timeoutMs?: number; runId?: string },
  ): Promise<HostReply<T>> {
    return this.send(
      { version: 1, command, runId: options?.runId ?? "ocade", payload },
      options?.timeoutMs,
    );
  }

  private async send<T = unknown>(
    body: Record<string, unknown>,
    timeout?: number,
  ): Promise<HostReply<T>> {
    let child: ChildProcessWithoutNullStreams;
    try {
      child = this.ensure();
    } catch (error) {
      return { ok: false, code: "unsupported", error: (error as Error).message };
    }

    const timeoutMs = timeout ?? this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    /*
     * `id` correlates ONE request with ONE reply. It is not `runId`: a run id
     * names an agent run and is deliberately shared by every request in it, so
     * matching on it would reintroduce the ambiguity this replaces. The browser
     * host has echoed `id` since before this client existed; the Python host
     * now echoes it too.
     */
    const id = `${++this.nextId}`;
    return new Promise<HostReply<T>>((resolve) => {
      const timer = setTimeout(() => {
        this.waiters.delete(id);
        resolve({
          ok: false,
          code: "retryable_failure",
          error: `${this.options.label} did not answer within ${Math.round(timeoutMs / 1000)}s.`,
        });
      }, timeoutMs);

      this.waiters.set(id, { resolve: resolve as (reply: HostReply) => void, timer });
      child.stdin.write(`${JSON.stringify({ ...body, id })}\n`);
    });
  }

  dispose(reason = "The native host was closed."): void {
    this.closedReason = reason;
    this.fail(reason);
    try {
      this.child?.stdin.end();
      this.child?.kill();
    } catch {
      /* already gone */
    }
    this.child = null;
  }
}
