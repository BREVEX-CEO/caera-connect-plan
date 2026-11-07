/**
 * Before any model change (requirement 23): is the configured model actually available to
 * each configured provider key, and with which limits? Run by the owner where the keys live
 * (never in CI, which holds no secrets):
 *
 *   GEMINI_API_KEY_PRIMARY=... [GEMINI_API_KEY_SECONDARY=...] [GEMINI_MODEL=...] \
 *     npm run model:availability [-- --model <candidate model>]
 *
 * It reads the provider's model metadata only (no generation, no tokens spent, no customer
 * data) and prints, per key slot: whether the model answers, the HTTP status, and its input
 * and output token limits and supported methods. Keys are never printed. Exits 1 if any
 * configured slot cannot use the model. Quota is the project's and is not exposed by this
 * metadata; how OCADE behaves when the provider refuses (quota, busy, revoked key) is covered
 * by tests/security/provider-errors.test.ts.
 */
import { parseArgs } from "node:util";
import {
  DEFAULT_ONLINE_MODEL,
  PROVIDER_KEY_ENVIRONMENT,
  PROVIDER_KEY_SLOTS,
} from "../src/lib/intelligence/online-models.ts";

const { values } = parseArgs({ options: { model: { type: "string" } } });
const model = values.model ?? process.env.GEMINI_MODEL ?? DEFAULT_ONLINE_MODEL;
const slots = PROVIDER_KEY_SLOTS.filter((slot) => process.env[PROVIDER_KEY_ENVIRONMENT[slot]]);
if (!slots.length) {
  console.error(`Set ${PROVIDER_KEY_ENVIRONMENT.primary} (and any other configured slot) first.`);
  process.exit(2);
}

let unavailable = 0;
for (const slot of slots) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,
    {
      headers: { "x-goog-api-key": process.env[PROVIDER_KEY_ENVIRONMENT[slot]]! },
      signal: AbortSignal.timeout(20_000),
    },
  ).catch(() => null);
  const body = response?.ok ? ((await response.json()) as Record<string, unknown>) : null;
  if (!body) unavailable++;
  console.log(
    JSON.stringify({
      slot,
      model,
      available: Boolean(body),
      status: response?.status ?? "unreachable",
      inputTokenLimit: body?.inputTokenLimit ?? null,
      outputTokenLimit: body?.outputTokenLimit ?? null,
      methods: body?.supportedGenerationMethods ?? null,
    }),
  );
}
process.exit(unavailable ? 1 : 0);
