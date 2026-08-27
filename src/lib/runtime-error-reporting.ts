/**
 * Where a crash goes.
 *
 * NOTHING LEAVES THE DEVICE IN PRODUCTION, AND THAT IS BY CONSTRUCTION RATHER
 * THAN BY POLICY.
 *
 * The two globals below are injected by the editor preview this project was
 * first built in. On ocade.in, and in any Cloudflare deployment, they do not
 * exist — so both calls are no-ops and no error, route or stack is sent
 * anywhere. That is the whole reason this is safe to keep: it is a development
 * convenience that cannot become telemetry by accident, because there is
 * nothing on the other end.
 *
 * It was called `reportLovableError`, which put a former platform's name in ten
 * call sites and in the product's vocabulary. The behaviour is unchanged; only
 * the name is OCADE's now.
 *
 * That sink now exists, and it is local exactly as described: a ring buffer in
 * `lib/diagnostics/error-journal.ts` that Settings › Diagnostics shows to the
 * person it happened to. Nothing in this file sends anything anywhere.
 */

import { recordErrorInJournal } from "@/lib/diagnostics/error-journal";

type PreviewErrorOptions = {
  mechanism?: "manual" | "onerror" | "unhandledrejection" | "react_error_boundary";
  handled?: boolean;
  severity?: "error" | "warning" | "info";
};

type PreviewErrorEvents = {
  captureException?: (
    error: unknown,
    context?: Record<string, unknown>,
    options?: PreviewErrorOptions,
  ) => void;
};

/**
 * A sentence about what went wrong.
 *
 * Loaders and server functions commonly throw a raw `Response`, and
 * `String(it)` is the opaque "[object Response]" — so the status and the URL
 * are pulled out instead, which is the difference between a report somebody
 * can act on and one they cannot.
 */
function describeError(error: unknown): string {
  if (error instanceof Response) {
    return `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`;
  }
  return error instanceof Error ? error.message : String(error);
}

declare global {
  interface Window {
    __lovableEvents?: PreviewErrorEvents;
    __lovableReportRuntimeError?: (payload: {
      message: string;
      stack?: string;
      filename?: string;
    }) => void;
  }
}

export function reportRuntimeError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  /*
   * Written down FIRST, before anything that might itself throw. Everything
   * below is optional preview plumbing; the journal is the part a person on
   * ocade.in can actually read afterwards.
   */
  recordErrorInJournal({
    where: typeof context.boundary === "string" ? context.boundary : "runtime",
    route: window.location.pathname,
    message: describeError(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  window.__lovableEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
  // Production React does not rethrow boundary-caught errors to window.onerror,
  // so a preview that only listens there sees nothing. This forwards to the
  // preview's own hook, which exists only inside that editor.
  window.__lovableReportRuntimeError?.({
    message: describeError(error),
    stack: error instanceof Error ? error.stack : undefined,
    filename: window.location.pathname,
  });
}
