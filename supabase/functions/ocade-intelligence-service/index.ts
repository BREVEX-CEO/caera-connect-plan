/**
 * OCADE Online Intelligence, as OCADE's own server reaches it: the planning
 * loop a computer carries on with after the person closed OCADE. No browser
 * can use this door: it has no allowed origin and accepts no session, only a
 * server key, and the permit it spends must already exist for that person.
 */
import { handleOnlineIntelligence } from "../../../src/lib/intelligence/edge-handler.ts";
import { boundary, verifyOcadeServer } from "../_shared/boundary.ts";

Deno.serve((request) =>
  handleOnlineIntelligence(request, {
    ...boundary,
    allowedOrigins: new Set(),
    verifyJwt: () => Promise.resolve(null),
    verifyService: verifyOcadeServer,
  }),
);
