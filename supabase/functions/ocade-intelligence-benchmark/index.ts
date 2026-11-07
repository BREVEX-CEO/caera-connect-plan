/**
 * STAGING ONLY: the owner-directed model comparison (plan.md §19.4, O15).
 *
 * The same server door as `ocade-intelligence-service` (server key only, no origin, no session),
 * with the model route chosen by the configuration in its own path, `…/ocade-intelligence-
 * benchmark/a|b|c`. Only these three allowlisted routes exist, and only OCADE's server can call
 * it. It lets the comparison run without changing the staging `GEMINI_MODEL` secret or the
 * function every other staging test uses. Never deployed to production.
 */
import { handleOnlineIntelligence } from "../../../src/lib/intelligence/edge-handler.ts";
import { boundary, verifyOcadeServer } from "../_shared/boundary.ts";

const ROUTES: Record<string, string> = {
  a: "gemma-4-31b-it",
  b: "gemini-3.8-live-extended-thinking",
  c: "gemma-4-31b-it,gemini-3.8-live-extended-thinking",
};

Deno.serve((request) => {
  const model = ROUTES[new URL(request.url).pathname.split("/").filter(Boolean).at(-1) ?? ""];
  if (!model)
    return new Response(JSON.stringify({ error: "unknown_configuration" }), { status: 404 });
  return handleOnlineIntelligence(request, {
    ...boundary,
    model,
    allowedOrigins: new Set(),
    verifyJwt: () => Promise.resolve(null),
    verifyService: verifyOcadeServer,
  });
});
