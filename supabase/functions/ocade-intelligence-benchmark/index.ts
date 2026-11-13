/**
 * STAGING ONLY: the owner-directed two-model comparison (plan.md §19.4, O2, O14, O15).
 *
 * The same server door as `ocade-intelligence-service` (server key only, no origin, no session),
 * with the planner named by the last segment of its own path, `…/ocade-intelligence-benchmark/
 * <model>`. Only the allowlisted planners exist (`plannerModel`), each planning alone, and only
 * OCADE's server can call it. It lets the comparison run without changing the staging
 * `GEMINI_MODEL` secret or the function every other staging test uses. Never deployed to production.
 */
import { handleOnlineIntelligence } from "../../../src/lib/intelligence/edge-handler.ts";
import { plannerModel } from "../../../src/lib/intelligence/online-models.ts";
import { boundary, verifyOcadeServer } from "../_shared/boundary.ts";

Deno.serve((request) => {
  const named = new URL(request.url).pathname.split("/").filter(Boolean).at(-1);
  const model = named ? plannerModel(decodeURIComponent(named)) : undefined;
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
