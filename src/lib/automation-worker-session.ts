import type { DesktopAutomationWorkerHost } from "./automation-worker-host";
import { type NativeCompanionAdapter } from "./native/companion-bridge";
import { redactForAudit } from "@/lib/security/protected-text";
import type { BootstrapResult } from "./native/tauri-companion";

export interface AutomationWorkerSessionInput {
  bootstrap(): Promise<BootstrapResult>;
  getCompanion(): NativeCompanionAdapter;
  subscribe(listener: (adapter: NativeCompanionAdapter) => void): () => void;
  createHost(
    companion: NativeCompanionAdapter,
  ): Pick<DesktopAutomationWorkerHost, "start" | "stop">;
  onBootstrapUnavailable(reason: string): void;
  onError(reason: string): void;
}

/**
 * Keeps one desktop worker host bound to the latest validated in-memory
 * companion adapter. Adapter changes are serialized so an old secure session
 * is stopped before its replacement can poll.
 */
export class AutomationWorkerCompanionSession {
  private started = false;
  private generation = 0;
  private desiredAdapter: NativeCompanionAdapter | null = null;
  private host: Pick<DesktopAutomationWorkerHost, "start" | "stop"> | null = null;
  private unsubscribe: (() => void) | null = null;
  private transition: Promise<void> = Promise.resolve();
  private bootstrapAttempt: Promise<void> | null = null;

  constructor(private readonly input: AutomationWorkerSessionInput) {}

  private safeReason(error: unknown, fallback: string): string {
    return redactForAudit(error instanceof Error ? error.message : fallback).replace(
      /\b(token|authorization|api[_-]?key|password|secret)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[REDACTED]",
    );
  }

  start(): Promise<void> {
    if (!this.started) {
      this.started = true;
      this.generation += 1;
      // Subscribe before bootstrapping so the adapter installed by the secure
      // handshake cannot be missed between await boundaries.
      this.unsubscribe = this.input.subscribe((adapter) => {
        void this.bind(adapter);
      });
    }
    return this.retryBootstrap();
  }

  retryBootstrap(): Promise<void> {
    if (!this.started) return this.start();
    if (this.bootstrapAttempt) return this.bootstrapAttempt;

    const generation = this.generation;
    const attempt = (async () => {
      try {
        const result = await this.input.bootstrap();
        if (!this.started || generation !== this.generation) return;
        if (!result.installed) {
          this.input.onBootstrapUnavailable(result.reason);
          return;
        }
        await this.bind(this.input.getCompanion());
      } catch (error) {
        if (this.started && generation === this.generation) {
          this.input.onError(
            this.safeReason(error, "The secure companion session could not be opened."),
          );
        }
      }
    })();
    const tracked = attempt.finally(() => {
      if (this.bootstrapAttempt === tracked) this.bootstrapAttempt = null;
    });
    this.bootstrapAttempt = tracked;
    return this.bootstrapAttempt;
  }

  private bind(adapter: NativeCompanionAdapter): Promise<void> {
    if (!this.started || this.desiredAdapter === adapter) return this.transition;
    this.desiredAdapter = adapter;

    this.transition = this.transition
      .then(async () => {
        const previous = this.host;
        this.host = null;
        if (previous) {
          await previous.stop("Automation worker stopped because the companion session changed.");
        }
        if (!this.started || this.desiredAdapter !== adapter) return;

        const next = this.input.createHost(adapter);
        this.host = next;
        await next.start();
      })
      .catch((error) => {
        if (this.started) {
          this.input.onError(
            this.safeReason(error, "The automation worker could not follow the companion session."),
          );
        }
      });
    return this.transition;
  }

  async stop(): Promise<void> {
    if (!this.started && !this.host) return;
    this.started = false;
    this.generation += 1;
    this.bootstrapAttempt = null;
    this.desiredAdapter = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    await this.transition;
    const host = this.host;
    this.host = null;
    if (host) {
      await host.stop("Automation worker host stopped because the Automations surface closed.");
    }
  }
}
