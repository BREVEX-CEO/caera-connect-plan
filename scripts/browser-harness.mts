/**
 * Real browser control harness (H1-H5).
 *
 * Launches a REAL Chrome or Edge, installs the OCADE extension with no manual
 * Developer Mode step and no change to browser security policy, and exposes
 * enough of the DevTools protocol to drive and independently read a page.
 *
 * HOW THE EXTENSION GETS IN, AND A CORRECTION
 * -------------------------------------------
 * `--load-extension` no longer works: Chrome removed it in 137 and Edge shares
 * the engine. An earlier pass concluded from that that enterprise policy — a
 * registry change to the browser's security settings — was the only remaining
 * mechanism. That was wrong twice over:
 *
 *   1. `Extensions.loadUnpacked` over CDP installs it directly, with
 *      --enable-unsafe-extension-debugging and no policy change at all.
 *   2. The earlier Edge check reported failure because it compared against the
 *      CRX-signed id while an unpacked load derives its id from the PATH. Edge
 *      had in fact loaded the extension; the check was looking for the wrong
 *      string.
 *
 * Both are fixed here: `extension/manifest.json` now pins its public key, so the
 * packed and unpacked ids are the same value, and activation is confirmed by
 * finding a service_worker target carrying that exact id rather than by
 * trusting the install call's return.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
export const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
export const EXTENSION_DIR = join(tmpdir(), "ocade-ext-stage");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface CdpTarget {
  type: string;
  url: string;
  id: string;
  webSocketDebuggerUrl?: string;
}

export class Browser {
  private child: ChildProcess | null = null;
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, (msg: Record<string, unknown>) => void>();
  readonly events: { method: string; params: unknown }[] = [];

  // Plain fields rather than TypeScript parameter properties: node's
  // strip-only type removal cannot handle those, and this file is loaded
  // directly by node rather than through a bundler.
  name: "chrome" | "edge";
  binary: string;
  port: number;
  profileDir: string;

  constructor(name: "chrome" | "edge", binary: string, port: number, profileDir?: string) {
    this.name = name;
    this.binary = binary;
    this.port = port;
    this.profileDir = profileDir ?? join(tmpdir(), `ocade-${name}-${port}`);
  }

  /** Launch, optionally reusing the profile so a restart keeps its state. */
  async launch(opts: { keepProfile?: boolean; headless?: boolean } = {}): Promise<void> {
    if (!opts.keepProfile) rmSync(this.profileDir, { recursive: true, force: true });
    mkdirSync(this.profileDir, { recursive: true });
    this.child = spawn(
      this.binary,
      [
        `--user-data-dir=${this.profileDir}`,
        `--remote-debugging-port=${this.port}`,
        "--enable-unsafe-extension-debugging",
        "--remote-allow-origins=*",
        "--no-first-run",
        "--no-default-browser-check",
        ...(opts.headless === false ? [] : ["--headless=new"]),
        "about:blank",
      ],
      { stdio: "ignore", windowsHide: true },
    );
    await this.connect();
  }

  private async connect(): Promise<void> {
    let version: { Browser: string; webSocketDebuggerUrl: string } | null = null;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/json/version`);
        if (res.ok) {
          version = await res.json();
          break;
        }
      } catch {
        /* not up yet */
      }
    }
    if (!version) throw new Error(`${this.name} never exposed its debugging endpoint`);
    this.versionString = version.Browser;

    this.ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      this.ws!.onopen = () => resolve();
      this.ws!.onerror = () => reject(new Error("browser websocket refused"));
      setTimeout(() => reject(new Error("browser websocket timeout")), 15000);
    });
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        this.pending.get(msg.id)!(msg);
        this.pending.delete(msg.id);
      } else if (msg.method) {
        this.events.push({ method: msg.method, params: msg.params });
      }
    };
  }

  versionString = "";

  send(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<Record<string, unknown>> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.ws!.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          resolve({ error: { message: "timed out" } });
        }
      }, 30000);
    });
  }

  /** Install the extension. Returns the id the browser assigned. */
  async installExtension(path = EXTENSION_DIR): Promise<string | null> {
    const res = await this.send("Extensions.loadUnpacked", { path });
    const result = res.result as { id?: string } | undefined;
    return result?.id ?? null;
  }

  async targets(): Promise<CdpTarget[]> {
    return fetch(`http://127.0.0.1:${this.port}/json/list`).then((r) => r.json());
  }

  /**
   * Activation is confirmed by the presence of the extension's own service
   * worker target, not by the install call returning an id — a returned id
   * means the request was accepted, not that the worker is running.
   */
  async extensionActive(id: string): Promise<{ active: boolean; target: CdpTarget | null }> {
    for (let i = 0; i < 10; i++) {
      const found = (await this.targets()).find(
        (t) => t.url.includes(id) && t.type === "service_worker",
      );
      if (found) return { active: true, target: found };
      await sleep(500);
    }
    return { active: false, target: null };
  }

  /** Attach to a page target and return its session id. */
  async attachToPage(url: string): Promise<string> {
    const created = await this.send("Target.createTarget", { url });
    const targetId = (created.result as { targetId: string }).targetId;
    const attached = await this.send("Target.attachToTarget", { targetId, flatten: true });
    return (attached.result as { sessionId: string }).sessionId;
  }

  /** Evaluate in a page and return the value. Used for INDEPENDENT reads. */
  async evaluate(sessionId: string, expression: string): Promise<unknown> {
    const res = await this.send(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    const result = res.result as { result?: { value?: unknown }; exceptionDetails?: unknown };
    if (result?.exceptionDetails) return { __error: JSON.stringify(result.exceptionDetails).slice(0, 200) };
    return result?.result?.value;
  }

  async close(): Promise<void> {
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.child?.kill();
    await sleep(800);
  }
}

export function browserFor(name: "chrome" | "edge", port: number): Browser {
  return new Browser(name, name === "chrome" ? CHROME : EDGE, port);
}
