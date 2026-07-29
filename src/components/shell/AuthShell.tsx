import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "./BrandMark";
import { GlassPanel } from "./GlassPanel";

export function AuthShell({
  children,
  title,
  subtitle,
  footer,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      {/*
        A main landmark, so assistive tech can jump straight to the form.
        No skip link here: there is no navigation ahead of the content to skip.
      */}
      <main
        id="main-content"
        className="mx-auto flex min-h-screen w-full max-w-md flex-col items-stretch justify-center gap-6 px-4 py-10"
      >
        <div className="flex flex-col items-center gap-6">
          <Link to="/" aria-label="CAERA CADANE home">
            <BrandMark />
          </Link>
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        <GlassPanel strong className="p-6">
          {children}
        </GlassPanel>
        {footer ? <div className="text-center text-xs text-muted-foreground">{footer}</div> : null}
      </main>
    </div>
  );
}
