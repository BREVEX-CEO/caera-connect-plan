import { isAllowedOnlineModel } from "../../../src/lib/intelligence/online-models.ts";

/** Only the authenticated, provider-native gateway may receive these credentials.
 * No arbitrary base URL, redirects, caching, payload logs or second retry owner.
 * A missing/partial configuration disables online inference instead of bypassing it.
 */
export function cloudflareProviderRequest(input: {
  accountId: string;
  gatewayId: string;
  token: string;
  key: string;
  model: string;
  body: Record<string, unknown>;
  signal: AbortSignal;
}): Request | null {
  if (
    !/^[a-f0-9]{32}$/.test(input.accountId) ||
    !/^[a-z0-9_]+(?:-[a-z0-9_]+)*$/.test(input.gatewayId) ||
    input.gatewayId.length > 64 ||
    !/^[\x21-\x7e]+$/.test(input.token) ||
    !/^[\x21-\x7e]+$/.test(input.key) ||
    !isAllowedOnlineModel(input.model)
  )
    return null;
  return new Request(
    `https://gateway.ai.cloudflare.com/v1/${input.accountId}/${input.gatewayId}/google-ai-studio/v1beta/models/${input.model}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.key,
        "cf-aig-authorization": `Bearer ${input.token}`,
        "cf-aig-skip-cache": "true",
        "cf-aig-collect-log": "false",
        "cf-aig-collect-log-payload": "false",
        "cf-aig-max-attempts": "1",
      },
      body: JSON.stringify(input.body),
      signal: input.signal,
    },
  );
}
