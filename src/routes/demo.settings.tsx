import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RotateCcw, LogIn, Palette, MousePointer2, Ban } from "lucide-react";
import { DemoShell } from "@/components/shell/DemoShell";
import { PageHeader } from "@/components/shell/PageHeader";
import { GlassPanel } from "@/components/shell/GlassPanel";
import { useDemo } from "@/lib/demo/context";
import { useAppearance } from "@/lib/theme-provider";

export const Route = createFileRoute("/demo/settings")({
  component: DemoSettings,
});

const themes = ["dark", "light", "real"] as const;
const cursors = ["system", "caera_black", "caera_white", "auto_contrast"] as const;

function DemoSettings() {
  const { reset, exit } = useDemo();
  const navigate = useNavigate();
  const { theme, cursor, update } = useAppearance();

  return (
    <DemoShell>
      <PageHeader
        eyebrow="Settings — demo"
        title="Appearance and demo controls"
        description="Theme and cursor apply to your browser. Nothing is saved to a real account."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <GlassPanel className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Palette className="h-4 w-4" aria-hidden />
            Theme
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((t) => (
              <button
                key={t}
                onClick={() => update({ theme: t })}
                className={
                  "rounded-lg border px-3 py-2 text-xs capitalize " +
                  (theme === t
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground")
                }
              >
                {t}
              </button>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <MousePointer2 className="h-4 w-4" aria-hidden />
            Cursor
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {cursors.map((c) => (
              <button
                key={c}
                onClick={() => update({ cursor: c })}
                className={
                  "rounded-lg border px-3 py-2 text-xs capitalize " +
                  (cursor === c
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground")
                }
              >
                {c.replace("_", " ")}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Custom cursor upload is available after sign-in.
          </p>
        </GlassPanel>

        <GlassPanel className="flex flex-col gap-3 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground">Demo controls</h3>
          <p className="text-xs text-muted-foreground">
            Reset restores the initial sample state. Exit clears the demo flag and returns to the
            landing page. Sign-in never copies demo content into your account.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => reset()}
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset demo
            </button>
            <button
              onClick={() => {
                exit();
                navigate({ to: "/" });
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              Exit demo
            </button>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              <LogIn className="h-4 w-4" aria-hidden />
              Create your account
            </Link>
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
            <Ban className="h-3.5 w-3.5" aria-hidden />
            Payments, filings, e-signatures, native device control and destructive account actions
            are disabled in demo.
          </div>
        </GlassPanel>
      </div>
    </DemoShell>
  );
}
