/**
 * SKILLFORGE (plan 28.2.1, X01): what the person showed once in one app window (`ui.record`),
 * as an editable proposed workflow, saved as their own skill, and run again WITHOUT the model.
 *
 * - A recording's steps become a workflow: each text the person left in a field becomes a named
 *   parameter (its recorded value only the default), each pressed control a step found again by
 *   its automation id or name. A protected field is never recorded; the workflow stops there and
 *   JARVIS hands the rest to the person and the planner, never a guessed value.
 * - The workflow is kept inside the skill's own text (a fenced `ocade-workflow` block), so it is
 *   versioned, edited, restored and deleted with the skill. The person edits it before saving.
 * - Named in a request (`/name field="value"`), its steps are queued one by one without a model
 *   call, each permission-checked and revalidated on the computer as usual; a control that is no
 *   longer there is refused by the computer (fail closed), and the planner takes over from there.
 *   The task's own outcome checks still verify the result independently.
 */
import { z } from "zod";

const FENCE = /```ocade-workflow\n([\s\S]{1,6000}?)\n```/;

const selector = z.union([
  z.strictObject({ automationId: z.string().min(1).max(200) }),
  z.strictObject({ name: z.string().min(1).max(200), controlType: z.string().max(40) }),
]);

export const workflowSchema = z.strictObject({
  app: z.string().min(1).max(260),
  parameters: z
    .array(
      z.strictObject({
        name: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
        default: z.string().max(200),
      }),
    )
    .max(20),
  steps: z
    .array(
      z.union([
        z.strictObject({
          operation: z.literal("ui.invoke"),
          element: selector,
          label: z.string().max(120),
        }),
        z.strictObject({
          operation: z.literal("ui.set_value"),
          element: selector,
          value: z.string().max(400),
          label: z.string().max(120),
        }),
        z.strictObject({ operation: z.literal("secret"), label: z.string().max(120) }),
      ]),
    )
    .min(1)
    .max(30),
});
export type Workflow = z.infer<typeof workflowSchema>;

/** What `ui.record` reported (skillforge.py), read as untrusted evidence. */
const recorded = z.array(
  z.union([
    z.object({
      kind: z.literal("invoke"),
      element: selector,
      label: z.string().max(120).catch(""),
    }),
    z.object({
      kind: z.literal("set_value"),
      element: selector,
      value: z.string().max(200),
      label: z.string().max(120).catch(""),
    }),
    z.object({ kind: z.literal("secret") }),
  ]),
);

function slug(label: string, taken: Set<string>): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^[^a-z]+|_+$/g, "")
      .slice(0, 32) || "field";
  let name = base;
  for (let n = 2; taken.has(name); n += 1) name = `${base}_${n}`;
  taken.add(name);
  return name;
}

/** The proposed workflow for a recording, or null when it recorded nothing usable. */
export function proposeWorkflow(app: string, evidence: unknown): Workflow | null {
  const parsed = recorded.safeParse(evidence);
  if (!parsed.success || !parsed.data.length) return null;
  const taken = new Set<string>();
  const parameters: Workflow["parameters"] = [];
  const steps: Workflow["steps"] = parsed.data.slice(0, 30).map((step) => {
    if (step.kind === "invoke")
      return { operation: "ui.invoke", element: step.element, label: step.label };
    if (step.kind === "secret") return { operation: "secret", label: "Protected text field" };
    const name = slug(step.label || "field", taken);
    if (parameters.length < 20) parameters.push({ name, default: step.value });
    return {
      operation: "ui.set_value",
      element: step.element,
      value: parameters.at(-1)?.name === name ? `{{${name}}}` : step.value,
      label: step.label,
    };
  });
  const workflow = { app, parameters, steps };
  return workflowSchema.safeParse(workflow).success ? workflow : null;
}

/** The skill text for a workflow: readable steps for the person and the planner, then the block. */
export function workflowBody(title: string, workflow: Workflow): string {
  const lines = workflow.steps.map((step, index) =>
    step.operation === "secret"
      ? `${index + 1}. The person types into the protected field themselves.`
      : step.operation === "ui.invoke"
        ? `${index + 1}. Press "${step.label || JSON.stringify(step.element)}".`
        : `${index + 1}. Set "${step.label || JSON.stringify(step.element)}" to ${step.value}.`,
  );
  return [
    `${title} — shown once in ${workflow.app}.`,
    ...lines,
    workflow.parameters.length
      ? `Name values when asking: ${workflow.parameters.map((p) => `${p.name}="…"`).join(" ")}`
      : "",
    "",
    "```ocade-workflow",
    JSON.stringify(workflow),
    "```",
  ]
    .filter((line, index, all) => line || all[index - 1] !== "")
    .join("\n")
    .slice(0, 8000);
}

/** The workflow a skill's text carries, or null (an edited block that no longer parses is none). */
export function workflowOf(body: string): Workflow | null {
  const block = FENCE.exec(body)?.[1];
  if (!block) return null;
  try {
    const parsed = workflowSchema.safeParse(JSON.parse(block));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** `field="value"` pairs a request gives a skill's parameters. */
export function parameterValues(objective: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const match of objective.matchAll(/\b([a-z][a-z0-9_]{0,39})="([^"]{0,400})"/g))
    values[match[1]!] ??= match[2]!;
  return values;
}

/**
 * The replay list a named workflow skill gives this request: its steps with the parameters filled
 * (the request's values, else the recorded defaults), up to its first protected field. The window
 * is named by app only; the planner leases the open window before each step.
 */
export function workflowReplay(workflow: Workflow, objective: string) {
  const given = parameterValues(objective);
  const fill = (value: string) =>
    value.replace(/\{\{([a-z][a-z0-9_]{0,39})\}\}/g, (_, name: string) => {
      return given[name] ?? workflow.parameters.find((p) => p.name === name)?.default ?? "";
    });
  const steps: { operation: string; arguments: Record<string, unknown> }[] = [];
  for (const step of workflow.steps) {
    if (step.operation === "secret") break;
    steps.push({
      operation: step.operation,
      arguments: {
        window: { app: workflow.app },
        element: step.element,
        ...(step.operation === "ui.set_value" ? { value: fill(step.value) } : {}),
      },
    });
  }
  return steps;
}

/** The newest lease of an open window of `app` this task's apps.list or apps.launch reported. */
export function leaseFor(
  app: string,
  steps: readonly {
    intent: { operation: string };
    receipt?: { status?: string; evidence?: Record<string, unknown> } | null;
  }[],
): { exe: string; pid: number; hwnd: number; started: number } | null {
  const wanted = app.toLowerCase();
  const lease = z.object({
    exe: z.string(),
    pid: z.number().int().positive(),
    hwnd: z.number().int().positive(),
    started: z.number().positive(),
  });
  for (const step of [...steps].reverse()) {
    if (step.receipt?.status !== "observed") continue;
    const evidence = step.receipt.evidence ?? {};
    const windows =
      step.intent.operation === "apps.launch"
        ? [evidence.window]
        : step.intent.operation === "apps.list" && Array.isArray(evidence.windows)
          ? evidence.windows
          : [];
    for (const window of windows) {
      const found = lease.safeParse(window);
      if (found.success && found.data.exe.toLowerCase() === wanted) {
        const { exe, pid, hwnd, started } = found.data;
        return { exe, pid, hwnd, started };
      }
    }
  }
  return null;
}
