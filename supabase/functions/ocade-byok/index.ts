/**
 * Settings > BYOK (plan 14B.1A): a signed-in person adds, tests, chooses, turns off and deletes
 * their own model connections. Keys go straight into Vault and never come back out to a browser.
 */
import { handleByok, listPath } from "../../../src/lib/intelligence/byok-handler.ts";
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
      customerFetch(route, modelPath(route.protocol, route.model!, false), body, signal),
    list: (route, signal) => customerFetch(route, listPath(route.protocol), undefined, signal),
    async saveModels(userId, connectionId, models) {
      return (await rpcOrThrow("ocade_byok_models_save", {
        p_user_id: userId,
        p_connection_id: connectionId,
        p_models: models,
      })) as number;
    },
    async setModel(input) {
      return (
        (await rpcOrThrow("ocade_byok_model_set", {
          p_user_id: input.userId,
          p_connection_id: input.connectionId,
          p_model: input.model,
          p_permitted: input.permitted,
          p_input_price: input.inputPrice,
          p_output_price: input.outputPrice,
          p_price_currency: input.currency,
        })) === true
      );
    },
    async recordModel(userId, connectionId, model, callsTools, seesImages) {
      await rpcOrThrow("ocade_byok_model_record", {
        p_user_id: userId,
        p_connection_id: connectionId,
        p_model: model,
        p_calls_tools: callsTools,
        p_sees_images: seesImages,
      });
    },
    async policy(userId, connectionId, policy) {
      return (
        (await rpcOrThrow("ocade_byok_policy", {
          p_user_id: userId,
          p_connection_id: connectionId,
          p_model_mode: policy.modelMode,
          p_spend_mode: policy.spendMode,
          p_free_tier: policy.freeTier,
          p_currency: policy.currency,
          p_time_zone: policy.timeZone,
          p_task: policy.task,
          p_day: policy.day,
          p_month: policy.month,
        })) === true
      );
    },
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
