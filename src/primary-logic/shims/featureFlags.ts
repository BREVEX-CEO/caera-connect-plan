/**
 * Replaces the donor's `bun:bundle` compile-time macro.
 *
 * Every flag the ported logic asks about names a donor subsystem OCADE does not
 * carry — the remote bridge, the daemon, the hosted coordinator, the telemetry
 * dumps. They are answered false here rather than left as a build-time macro so
 * the dead branches are unreachable and shake out of the bundle.
 */
const ENABLED = new Set<string>();

export function feature(name: string): boolean {
  return ENABLED.has(name);
}
