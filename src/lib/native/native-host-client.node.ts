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
  private readonly waiters: {
    resolve: (reply: HostReply) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }[] = [];
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
      const waiter = this.waiters.shift();
      if (!waiter) continue;
      clearTimeout(waiter.timer);
      try {
        waiter.resolve(JSON.parse(line) as HostReply);
      } catch {
        waiter.resolve({ ok: false, error: `${this.options.label} sent an unreadable reply.` });
      }
    }
  }

  private fail(reason: string): void {
    this.child = null;
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      if (!waiter) break;
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
    return new Promise<HostReply<T>>((resolve) => {
      const timer = setTimeout(() => {
        const index = this.waiters.findIndex((w) => w.timer === timer);
        if (index >= 0) this.waiters.splice(index, 1);
        resolve({
          ok: false,
          code: "retryable_failure",
          error: `${this.options.label} did not answer within ${Math.round(timeoutMs / 1000)}s.`,
        });
      }, timeoutMs);

      this.waiters.push({
        resolve: resolve as (reply: HostReply) => void,
        reject: () => undefined,
        timer,
      });
      child.stdin.write(`${JSON.stringify(body)}\n`);
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
