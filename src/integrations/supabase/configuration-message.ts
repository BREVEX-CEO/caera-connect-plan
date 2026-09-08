/**
 * The one sentence OCADE says when an account binding is absent.
 *
 * NAMED ONCE, AND NAMED CORRECTLY. This message existed in three copies —
 * browser client, server client, auth middleware — and each ended "Connect
 * Supabase in Lovable Cloud", naming the scaffold this project started from
 * rather than anything OCADE has to do with. It reaches a console and, through
 * a thrown error, can reach a person; either way it sent them somewhere that
 * cannot help them.
 *
 * IN ITS OWN MODULE, with no imports, because all three callers need it and one
 * of them runs on the server. Putting it in `client.ts` would drag the browser
 * client's dependencies into the server bundle to read one string.
 *
 * It names the variables and nothing else. Never the values, never a partial
 * value, never a URL — a configuration error is not a reason to print a
 * credential into a log.
 */
export function missingSupabaseConfigurationMessage(missing: readonly string[]): string {
  return (
    `Missing Supabase environment variable(s): ${missing.join(", ")}. ` +
    `Set them on this deployment before signing in; OCADE fails closed rather ` +
    `than reaching another project.`
  );
}
