import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsAccessContext, useSettingsAccess } from "./use-settings-access";

/**
 * Settings a signed-out visitor can read but not change.
 *
 * THE PATTERN THIS REPLACES. Settings screens usually hide themselves behind a
 * sign-in wall, which means the one question a prospective user actually has —
 * *what can this thing be made to do?* — cannot be answered before they hand
 * over an email address. That is a conversion problem and a trust problem at
 * once: the product looks like it has something to hide.
 *
 * So every category renders for everyone. Controls are DISABLED rather than
 * absent, and each says why in the same words. Nothing is faked — a disabled
 * toggle shows the real shipped default, not an invented value.
 *
 * WHY A CONTEXT AND NOT A PROP. A settings panel is a tree of inputs several
 * levels deep, and threading `readOnly` through every one guarantees somebody
 * misses one. A missed prop here is a control that looks live and silently
 * discards what the user typed, which is worse than a wall.
 */

export function SettingsAccessProvider({
  canEdit,
  reason = "Sign in to change this setting.",
  children,
}: {
  canEdit: boolean;
  reason?: string;
  children: ReactNode;
}) {
  return (
    <SettingsAccessContext.Provider value={{ canEdit, reason }}>
      {children}
    </SettingsAccessContext.Provider>
  );
}

/**
 * One labelled setting, disabled as a whole when there is no account.
 *
 * `inert` is what makes it reliable: it removes the subtree from the tab order
 * and from pointer events without every child remembering its own `disabled`.
 * The dimming is separate and deliberate — `inert` alone is invisible, and an
 * unreachable control that looks reachable is worse than a visibly dead one.
 */
export function SettingsField({
  label,
  description,
  children,
  className,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const { canEdit, reason } = useSettingsAccess();

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 border-b border-border/50 py-3 last:border-b-0",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-foreground">{label}</p>
          {description ? (
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {/*
          `inert` is a real boolean prop in React 19, so it must be passed as
          `true` — the older `inert=""` spelling is falsy and React drops the
          attribute entirely, leaving the control keyboard-reachable while
          merely looking dead. Verified in the browser rather than assumed.
        */}
        <div
          className={cn("shrink-0", !canEdit && "pointer-events-none opacity-50")}
          inert={!canEdit}
        >
          {children}
        </div>
      </div>
      {!canEdit ? (
        <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground/80">
          <Lock className="h-3 w-3 shrink-0" aria-hidden />
          {reason}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The panel-level read-only notice.
 *
 * Once at the top rather than repeated under every field, so a category with
 * twelve settings does not repeat one sentence twelve times.
 */
export function ReadOnlyBanner({
  className,
  linkToSignIn = true,
}: {
  className?: string;
  linkToSignIn?: boolean;
}) {
  const { canEdit } = useSettingsAccess();
  if (canEdit) return null;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5 text-[12.5px] text-muted-foreground",
        className,
      )}
    >
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        <span className="font-medium text-foreground">You are not signed in.</span> Every setting
        below is shown exactly as it ships, so you can see what OCADE does before creating an
        account. Changing one needs an account.{" "}
        {linkToSignIn ? (
          <>
            <Link to="/auth" className="text-primary underline underline-offset-4">
              Create one
            </Link>
            .
          </>
        ) : (
          " Sign in to change these settings."
        )}
      </span>
    </div>
  );
}
