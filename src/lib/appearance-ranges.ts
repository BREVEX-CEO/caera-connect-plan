/**
 * Range guards for stored appearance values.
 *
 * A value read back from storage, or typed into a field, is not trusted to
 * be in range: it is clamped to what the artwork stays legible at.
 */
/** Keep a stored or typed pointer size inside the range the artwork stays legible at. */
export function clampCursorSize(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 24;
  return Math.max(16, Math.min(64, Math.round(n)));
}

/** Keep a stored or typed strength inside the range the geometry is tuned for. */
export function clampDepthStrength(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(200, Math.round(n)));
}
