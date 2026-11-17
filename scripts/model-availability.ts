/**
 * Before any model change (requirement 23): is the configured model actually available to
 * each configured provider key, and with which limits? Run by the owner where the keys live
 * (never in CI, which holds no secrets):
 *
 *   OCADE_MODEL_API_KEYS=... [OCADE_MODEL_PROTOCOL=gemini|openai] [OCADE_MODEL_ENDPOINT=...] \
 *     [OCADE_MODEL=...] npm run model:availability [-- --model <candidate model>]
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
  keySlots,
  plannerKeys,
  plannerProvider,
} from "../src/lib/intelligence/online-models.ts";

const read = (name: string) => process.env[name];
const { values } = parseArgs({ options: { model: { type: "string" } } });
const model = values.model ?? read("OCADE_MODEL") ?? read("GEMINI_MODEL") ?? DEFAULT_ONLINE_MODEL;
const provider = plannerProvider(read);
const keys = plannerKeys(read);
if (!provider || !keys.length) {
  console.error(
    "Set OCADE_MODEL_API_KEYS (or GEMINI_API_KEY_PRIMARY), and a valid HTTPS OCADE_MODEL_ENDPOINT if set.",
  );
  process.exit(2);
}

let unavailable = 0;
for (const [index, slot] of keySlots(keys.length).entries()) {
  const response = await fetch(`${provider.endpoint}/models/${encodeURIComponent(model)}`, {
    headers:
      provider.protocol === "openai"
        ? { Authorization: `Bearer ${keys[index]}` }
        : { "x-goog-api-key": keys[index]! },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  const body = response?.ok ? ((await response.json()) as Record<string, unknown>) : null;
  if (!body) unavailable++;
  console.log(
    JSON.stringify({
      slot,
      model,
      protocol: provider.protocol,
      available: Boolean(body),
      status: response?.status ?? "unreachable",
      inputTokenLimit: body?.inputTokenLimit ?? body?.context_length ?? null,
      outputTokenLimit: body?.outputTokenLimit ?? null,
      methods: body?.supportedGenerationMethods ?? null,
    }),
  );
}
process.exit(unavailable ? 1 : 0);
