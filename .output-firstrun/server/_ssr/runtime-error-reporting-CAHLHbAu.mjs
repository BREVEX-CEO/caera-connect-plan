import { i as recordErrorInJournal } from "./error-journal-BvqPVLIA.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/runtime-error-reporting-CAHLHbAu.js
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
/**
* A sentence about what went wrong.
*
* Loaders and server functions commonly throw a raw `Response`, and
* `String(it)` is the opaque "[object Response]" — so the status and the URL
* are pulled out instead, which is the difference between a report somebody
* can act on and one they cannot.
*/
function describeError(error) {
	if (error instanceof Response) return `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`;
	return error instanceof Error ? error.message : String(error);
}
function reportRuntimeError(error, context = {}) {
	if (typeof window === "undefined") return;
	recordErrorInJournal({
		where: typeof context.boundary === "string" ? context.boundary : "runtime",
		route: window.location.pathname,
		message: describeError(error),
		stack: error instanceof Error ? error.stack : void 0
	});
	window.__lovableEvents?.captureException?.(error, {
		source: "react_error_boundary",
		route: window.location.pathname,
		...context
	}, {
		mechanism: "react_error_boundary",
		handled: false,
		severity: "error"
	});
	window.__lovableReportRuntimeError?.({
		message: describeError(error),
		stack: error instanceof Error ? error.stack : void 0,
		filename: window.location.pathname
	});
}
//#endregion
export { reportRuntimeError as t };
