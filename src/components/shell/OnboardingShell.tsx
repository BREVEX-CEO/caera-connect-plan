import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "./BrandMark";
import { GlassPanel } from "./GlassPanel";

export function OnboardingShell({
  children,
  step,
  total,
  title,
  subtitle,
}: {
  children: ReactNode;
  step: number;
  total: number;
  title: string;
  subtitle?: string;
}) {
  const pct = Math.round((step / total) * 100);
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/" aria-label="CAERA CADANE home">
            <BrandMark />
          </Link>
          <div className="text-xs text-muted-foreground">
            Step {step} of {total}
          </div>
        </div>
        <div className="h-1 w-full bg-border/40">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
            aria-label={`${pct}% complete`}
          />
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <GlassPanel strong className="p-6">
          {children}
        </GlassPanel>
      </main>
    </div>
  );
}
