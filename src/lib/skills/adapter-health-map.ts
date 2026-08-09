import { initialHealth, recordOutcome, type AdapterHealth } from "./adapter-health";
import type { ControlMethod } from "./skill-pack";

/**
 * Health bookkeeping for the control adapters, as a plain map.
 *
 * Lifted out of the panel that displays it. Both functions are pure and are
 * called from two panels and a test; leaving them beside a component tied the
 * bookkeeping's lifetime to that component's.
 */
/** Seed a health map so the panel has real entries to report. */
export function seedHealth(methods: ControlMethod[]): Map<ControlMethod, AdapterHealth> {
  return new Map(methods.map((m) => [m, initialHealth(m)]));
}

/** Fold an observed outcome into a health map. */
export function applyOutcome(
  health: Map<ControlMethod, AdapterHealth>,
  method: ControlMethod,
  outcome: { ok: boolean; latencyMs?: number; reason?: string },
): Map<ControlMethod, AdapterHealth> {
  const next = new Map(health);
  next.set(method, recordOutcome(health.get(method) ?? initialHealth(method), outcome));
  return next;
}
