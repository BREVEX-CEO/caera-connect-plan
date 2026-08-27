import { useMemo, useState } from "react";
import { Plus, Trash2, TriangleAlert } from "lucide-react";

import { GlassPanel } from "@/components/shell/GlassPanel";
import { loadRules, saveRules } from "@/lib/runtime/permission-settings";
import type { StoredRule } from "@/lib/runtime/permissions";
import {
  findDuplicateRules,
  findShadowedRules,
  validateRule,
} from "@/primary-logic/permissions/ruleReview";
import type { PermissionBehavior } from "@/primary-logic/permissions/types";

/**
 * The rules, where a person can finally see and write them.
 *
 * WHAT WAS WRONG BEFORE
 * ---------------------
 * The rule engine is the strongest thing OCADE imported: exact, prefix and
 * wildcard matching, per-segment evaluation of compound commands, deny before
 * ask before allow. It was fully wired into every decision the product makes —
 * and `saveRules` had no caller anywhere. Nobody could write a rule, so the
 * whole engine only ever saw the empty list. A capability nothing can reach is
 * not a capability; it is code that passes its tests.
 *
 * This is deliberately in Advanced. Most people should never need it: the
 * permission mode above covers them. Somebody who wants "never ask me about
 * git status again" should be able to say so, and see immediately when what
 * they wrote cannot work.
 */

const BEHAVIOURS: Array<{ value: PermissionBehavior; label: string; hint: string }> = [
  { value: "allow", label: "Allow", hint: "Goes ahead without asking." },
  { value: "ask", label: "Ask", hint: "Always checks with you first." },
  { value: "deny", label: "Never", hint: "Refused, whatever the mode says." },
];

export function PermissionRules() {
  const [rules, setRules] = useState<StoredRule[]>(() => loadRules());
  const [draft, setDraft] = useState("");
  const [behavior, setBehavior] = useState<PermissionBehavior>("allow");
  const [message, setMessage] = useState<string | null>(null);

  const problem = useMemo(() => (draft.trim() ? validateRule(draft) : null), [draft]);
  const shadowed = useMemo(() => findShadowedRules(rules), [rules]);
  const duplicates = useMemo(() => new Set(findDuplicateRules(rules)), [rules]);

  function persist(next: StoredRule[]) {
    setRules(next);
    const saved = saveRules(next);
    setMessage(saved.ok ? "Saved on this device." : saved.error);
  }

  function add() {
    const rule = draft.trim();
    if (!rule || problem) return;
    persist([...rules, { rule, behavior }]);
    setDraft("");
  }

  function remove(index: number) {
    persist(rules.filter((_, position) => position !== index));
  }

  return (
    <GlassPanel className="mt-4 p-5">
      <h2 className="text-sm font-semibold">Rules for particular actions</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        A rule names a tool, and optionally a pattern inside brackets —{" "}
        <code>Bash(git status)</code> for one command, <code>Bash(npm run:*)</code> for anything
        starting that way. Refusals are checked first, then questions, then permissions.
      </p>

      {message ? (
        <p role="status" className="mt-3 rounded-md border border-border/60 px-3 py-2 text-xs">
          {message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-start gap-2">
        <label className="min-w-56 flex-1">
          <span className="sr-only">Rule</span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") add();
            }}
            placeholder="Bash(git status)"
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? "rule-problem" : undefined}
            className="h-10 w-full rounded-md border border-border/70 bg-background px-3 font-mono text-sm"
          />
        </label>
        <label>
          <span className="sr-only">What OCADE should do</span>
          <select
            value={behavior}
            onChange={(event) => setBehavior(event.target.value as PermissionBehavior)}
            className="h-10 rounded-md border border-border/70 bg-background px-3 text-sm"
          >
            {BEHAVIOURS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim() || problem !== null}
          className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border/70 px-3 text-sm disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add rule
        </button>
      </div>

      {problem ? (
        <p
          id="rule-problem"
          role="alert"
          className="mt-2 text-xs text-[color:var(--state-warning)]"
        >
          {problem.reason}
          {problem.fix ? ` ${problem.fix}` : ""}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {BEHAVIOURS.find((option) => option.value === behavior)?.hint}
        </p>
      )}

      {rules.length === 0 ? (
        <p className="mt-5 text-xs text-muted-foreground">
          No rules yet. Without any, the permission setting above decides everything.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {rules.map((entry, index) => {
            const shadow = shadowed.find((item) => item.rule === entry);
            const duplicate = duplicates.has(entry.rule.trim().toLowerCase());
            return (
              <li
                key={`${entry.rule}-${entry.behavior}-${index}`}
                className="rounded-md border border-border/60 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <code className="min-w-0 flex-1 truncate text-xs">{entry.rule}</code>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {BEHAVIOURS.find((option) => option.value === entry.behavior)?.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={`Remove the rule ${entry.rule}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                {shadow ? (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-[color:var(--state-warning)]">
                    <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                    <span>
                      {shadow.reason} {shadow.fix}
                    </span>
                  </p>
                ) : null}
                {duplicate ? (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    This rule is listed more than once. Only the strictest one decides.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </GlassPanel>
  );
}
