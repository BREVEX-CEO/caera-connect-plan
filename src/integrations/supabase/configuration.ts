/**
 * IS SUPABASE CONFIGURED? — answerable without building a Supabase client.
 *
 * This lived in `client.ts`, and that file constructs the client at module
 * scope. So every page that only wanted to know whether an environment binding
 * exists — the public status page, the sign-in page's "can we even offer this?"
 * check, the status API route — pulled 203 KiB of auth stack onto the entry
 * chunk's static import graph to read two environment variables.
 *
 * Measured: that was the largest single item left in the landing route's
 * blocking time at four-times CPU throttling, and the landing route is the one
 * visit where somebody is deciding whether to stay.
 *
 * `client.ts` re-exports both functions, so nothing that legitimately wants the
 * client is affected and no call site had to learn a second name for the same
 * question. What changed is that asking the question no longer answers it by
 * constructing the thing being asked about.
 */

export interface SupabaseBrowserConfiguration {
  configured: boolean;
  url?: string;
  publishableKey?: string;
  missing: Array<"SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY">;
}

export function resolveSupabaseBrowserConfiguration(input: {
  url?: string;
  publishableKey?: string;
}): SupabaseBrowserConfiguration {
  const missing: SupabaseBrowserConfiguration["missing"] = [];
  if (!input.url) missing.push("SUPABASE_URL");
  if (!input.publishableKey) missing.push("SUPABASE_PUBLISHABLE_KEY");
  return {
    configured: missing.length === 0,
    url: input.url || undefined,
    publishableKey: input.publishableKey || undefined,
    missing,
  };
}

/**
 * Resolve configuration without creating a client. Public pages use this to
 * stay available when an environment binding is missing, while authenticated
 * features still fail closed instead of silently using another project.
 */
export function getSupabaseBrowserConfiguration(): SupabaseBrowserConfiguration {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const publishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  return resolveSupabaseBrowserConfiguration({ url, publishableKey });
}

/** Shared header handling preserves caller JWTs across all three client constructors. */
function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

export function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}
