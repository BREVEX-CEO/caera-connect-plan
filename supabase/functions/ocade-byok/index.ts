/**
 * Settings > BYOK (plan 14B.1A): a signed-in person adds, tests, chooses, turns off and deletes
 * their own model connections. Keys go straight into Vault and never come back out to a browser.
 */
import { handleByok } from "../../../src/lib/intelligence/byok-handler.ts";
import {
  allowedOrigins,
  customerFetch,
  customerRoute,
  modelPath,
  rpcOrThrow,
  verifyUserJwt,
} from "../_shared/boundary.ts";

Deno.serve((request) =>
  handleByok(request, {
    allowedOrigins,
    verifyJwt: verifyUserJwt,
    async save(input) {
      return (await rpcOrThrow("ocade_byok_save", {
        p_user_id: input.userId,
        p_connection_id: input.connectionId,
        p_alias: input.alias,
        p_protocol: input.protocol,
        p_endpoint: input.endpoint,
        p_model: input.model,
        p_key: input.key,
      })) as string;
    },
    route: (userId, connectionId) => customerRoute(userId, connectionId, null),
    send: (route, body, signal) =>
      customerFetch(route, modelPath(route.protocol, route.model, false), body, signal),
    async record(userId, connectionId, status, seesImages, callsTools) {
      await rpcOrThrow("ocade_byok_record", {
        p_user_id: userId,
        p_connection_id: connectionId,
        p_status: status,
        p_sees_images: seesImages,
        p_calls_tools: callsTools,
      });
    },
    async enable(userId, connectionId, enabled) {
      return (
        (await rpcOrThrow("ocade_byok_enable", {
          p_user_id: userId,
          p_connection_id: connectionId,
          p_enabled: enabled,
        })) === true
      );
    },
    async choose(userId, surface, connectionId) {
      await rpcOrThrow("ocade_byok_choose", {
        p_user_id: userId,
        p_surface: surface,
        p_connection_id: connectionId,
      });
    },
    async remove(userId, connectionId) {
      return (
        (await rpcOrThrow("ocade_byok_delete", {
          p_user_id: userId,
          p_connection_id: connectionId,
        })) === true
      );
    },
  }),
);
