/**
 * THE SAME BROWSER CLIENT, FETCHED WHEN IT IS FIRST NEEDED.
 *
 * Not a second client and not a second configuration authority: this resolves
 * the SAME module singleton `./client` exports, one dynamic import later.
 *
 * WHY IT EXISTS, WITH THE NUMBER THAT PAID FOR IT. `@supabase/supabase-js`
 * bundles auth, PostgREST, realtime and storage, and it lands as a 200 KiB
 * chunk. Three modules in the root's static graph imported the client — the
 * theme provider, the legal-consent gate and the root itself — so that chunk
 * was in the ENTRY graph, and every visitor to the public landing page,
 * `/about`, `/privacy` or `/terms` parsed all of it before the page could
 * answer a tap. None of those three uses it to draw anything: each one runs in
 * an effect, after hydration, and two of them do nothing at all unless somebody
 * is signed in.
 *
 * WHY THIS IS NOT A DEFERRED FAILURE. Every caller here is already async or
 * already inside an effect, so nothing gains a new race by waiting a
 * microtask. And on the screens that genuinely use Supabase — `/auth` and every
 * authenticated route — the module is already in the registry by the time these
 * run, so `import()` resolves without touching the network.
 *
 * WHEN NOT TO USE THIS. If a module needs the client to render, import it
 * directly: an authenticated route chunk already carries Supabase and gains
 * nothing from indirection. This is for code in the ENTRY graph.
 */

import type * as SupabaseClientModule from "./client";

/** The browser client, the same instance `./client` exports. */
export function loadSupabaseClient(): Promise<typeof SupabaseClientModule.supabase> {
  return import("./client").then((module) => module.supabase);
}

/** Whether this deployment is bound to a project, resolved the same way. */
export function loadSupabaseConfiguration(): Promise<
  ReturnType<typeof SupabaseClientModule.getSupabaseBrowserConfiguration>
> {
  return import("./client").then((module) => module.getSupabaseBrowserConfiguration());
}
