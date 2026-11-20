import type { ActionIntent } from "./contracts.ts";

/**
 * PARALLEL LANES (plan 14F.1.1, 14F.3): the steps of one planning turn that touch disjoint
 * resources run at the same time on separate companion workers; steps that share a resource,
 * or follow a step whose own result guards them, stay in one lane and run in order.
 *
 * A step's resources are what it reads or writes: workspace paths (`fs:/a/b`), the OCADE browser
 * (`web`), the person's desktop input (`desktop`, lane 0 only: there is one mouse and keyboard),
 * or `*` for a step whose effects cannot be bounded (commands, jobs, external tools, the verifier),
 * which conflicts with everything. A path conflicts with itself and with its ancestors and
 * descendants. The database re-checks the same rule when the steps are queued
 * (20261121090000), so a wrong lane can never let two steps race on one resource.
 */
export const LANES = 4;
export const DESKTOP = "desktop";

/** Where each operation's workspace paths are; an operation not named here is unbounded. */
const PATHS: Readonly<Record<string, readonly string[]>> = {
  "fs.list": ["path"],
  "fs.read_text": ["path"],
  "fs.write_text": ["path"],
  "fs.manage": ["path", "to"],
  "office.inspect_workbook": ["path"],
  "office.write_workbook": ["path"],
  "office.write_presentation": ["path"],
  "office.write_document": ["docx", "pdf"],
  "image.edit": ["source", "output"],
  "media.inspect": ["path"],
  "media.preview": ["path"],
  "media.analyze": ["path"],
  "media.trim": ["source", "output"],
};
/** Reads of the computer itself that share nothing with any other step. */
const FREE: ReadonlySet<string> = new Set([
  "system.inspect",
  "apps.list",
  "system.dependency",
  "verify.dependency",
]);

function workspaceKey(path: string): string {
  const parts = path
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => part && part !== ".");
  return `fs:/${parts.join("/").toLowerCase()}`;
}

export function resources(action: ActionIntent): string[] {
  const operation = action.operation;
  if (operation.startsWith("ui.") || operation === "apps.launch") return [DESKTOP];
  if (operation.startsWith("web.")) return ["web"];
  if (FREE.has(operation)) return [];
  const keys = PATHS[operation];
  if (!keys) return ["*"];
  const args = action.arguments as Record<string, unknown>;
  return keys.flatMap((key) =>
    typeof args[key] === "string" ? [workspaceKey(args[key] as string)] : [],
  );
}

export function conflicts(a: readonly string[], b: readonly string[]): boolean {
  return a.some((x) =>
    b.some(
      (y) =>
        x === "*" ||
        y === "*" ||
        x === y ||
        (x.startsWith("fs:") && y.startsWith(`${x}/`)) ||
        (y.startsWith("fs:") && x.startsWith(`${y}/`)) ||
        (x === "fs:/" && y.startsWith("fs:")) ||
        (y === "fs:/" && x.startsWith("fs:")),
    ),
  );
}

/**
 * Lanes for one turn's steps, in order. Steps joined by a shared resource, or guarded by an
 * earlier step's expectation, form one group; groups go to separate lanes, desktop work to
 * lane 0, the rest round-robin (several groups may share a lane: it runs them in order).
 */
export function assignLanes(
  steps: readonly ActionIntent[],
): { lane: number; resources: string[] }[] {
  const touched = steps.map(resources);
  const parent = steps.map((_, index) => index);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i]!)));
  const join = (a: number, b: number) => {
    const [x, y] = [root(a), root(b)];
    if (x !== y) parent[Math.max(x, y)] = Math.min(x, y);
  };
  for (let i = 0; i < steps.length; i += 1) {
    for (let j = i + 1; j < steps.length; j += 1) {
      // A guarded step's result decides whether everything after it runs.
      if (steps[i]!.expect?.length || conflicts(touched[i]!, touched[j]!)) join(i, j);
    }
  }
  const lanes = new Map<number, number>();
  const desktop = steps.some((_, i) => touched[i]!.includes(DESKTOP));
  let next = desktop ? 1 : 0;
  return steps.map((_, i) => {
    const group = root(i);
    if (!lanes.has(group)) {
      const onDesktop = steps.some((_, j) => root(j) === group && touched[j]!.includes(DESKTOP));
      lanes.set(group, onDesktop ? 0 : next);
      if (!onDesktop) next = next + 1 >= LANES ? (desktop ? 1 : 0) : next + 1;
    }
    return { lane: lanes.get(group)!, resources: touched[i]! };
  });
}
