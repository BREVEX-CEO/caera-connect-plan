/**
 * OCADE Online Intelligence, as browsers reach it: a signed-in person's session
 * (the platform checks the token before this runs, and Auth is asked again here).
 */
import { handleOnlineIntelligence } from "../../../src/lib/intelligence/edge-handler.ts";
import { boundary, verifyUserJwt } from "../_shared/boundary.ts";

Deno.serve((request) =>
  handleOnlineIntelligence(request, { ...boundary, verifyJwt: verifyUserJwt }),
);
