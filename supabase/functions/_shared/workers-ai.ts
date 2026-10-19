/** High is included-only. Unknown, paid, trial, missing or unreadable billing is unavailable.
 * This deliberately conservative subscription predicate still needs qualification against the
 * owner's real account. No environment switch can waive the provider's hard Free-plan cap.
 */
export function hardFreePlan(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const envelope = value as { success?: unknown; result?: unknown };
  if (envelope.success !== true || !Array.isArray(envelope.result)) return false;
  const workers = envelope.result
    .filter((entry: unknown) => {
      const name = (entry as { rate_plan?: { public_name?: unknown } } | null)?.rate_plan
        ?.public_name;
      return typeof name === "string" && /workers/i.test(name);
    })
    .filter(
      (entry: { state?: unknown }) =>
        !["Cancelled", "Expired", "Failed"].includes(String(entry?.state)),
    );
  if (workers.length !== 1) return false;
  const plan = workers[0];
  return (
    plan?.rate_plan?.public_name === "Workers Free" &&
    plan.rate_plan.scope === "account" &&
    plan.price === 0 &&
    plan.state === "Provisioned" &&
    Array.isArray(plan.component_values) &&
    plan.component_values.every((part: { price?: unknown } | null) => part?.price === 0)
  );
}

export async function highIncluded(
  account: string,
  token: string,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<boolean> {
  if (!/^[a-f0-9]{32}$/.test(account) || !token) return false;
  try {
    const response = await request(
      `https://api.cloudflare.com/client/v4/accounts/${account}/subscriptions`,
      {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
      },
    );
    if (!response.ok || Number(response.headers.get("content-length")) > 1_000_000) {
      await response.body?.cancel();
      return false;
    }
    const reader = response.body?.getReader();
    if (!reader) return false;
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 1_000_000) return false;
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.byteLength;
    }
    return hardFreePlan(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return false;
  }
}
