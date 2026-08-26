/**
 * The donor moved JSON work onto a worker thread to keep a 60fps terminal
 * render loop free. OCADE's callers are already off the paint path, so the
 * honest implementation is the synchronous one — with the donor's guarantee
 * kept: never throw on a cyclic or unserialisable value.
 */

export function jsonStringify(value: unknown, indent?: number): string {
  try {
    return JSON.stringify(value, replacer(), indent) ?? "";
  } catch {
    return "";
  }
}

function replacer(): (key: string, value: unknown) => unknown {
  const seen = new WeakSet<object>();
  return (_key, value) => {
    if (typeof value === "bigint") return value.toString();
    if (typeof value !== "object" || value === null) return value;
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    return value;
  };
}
