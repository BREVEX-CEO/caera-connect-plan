/**
 * WHICH `SECURITY DEFINER` FUNCTIONS ACTUALLY BIND THEIR CALLER.
 *
 * `SECURITY DEFINER` runs as the function's owner, so row-level security does
 * not apply inside it. Granting EXECUTE to `authenticated` therefore hands
 * every signed-in browser a door around RLS, one `fetch` from any page on the
 * internet — which is FINE when the function scopes itself to `auth.uid()`, and
 * a cross-account hole when it does not, because an id parameter naming
 * somebody else's row is then simply obeyed.
 *
 * TWO GATES ASKED THIS QUESTION AND BOTH ASKED IT BY READING ONE FUNCTION'S
 * TEXT for `auth.uid()`, with a small hard-coded list of role helpers that also
 * count. That heuristic held until a subsystem did the obviously correct thing:
 * OCADE's organization mutations resolve authorization through two shared
 * helpers, `ocade_org_can_administer` and `ocade_org_is_owner`, so that fourteen
 * functions cannot drift into fourteen slightly different ideas of who may act.
 * Every one of them IS bound to the caller. None says `auth.uid()` out loud.
 *
 * Reading one level deep left two bad choices: weaken both gates with fourteen
 * exemptions whose stated meaning is "a stranger may reach these rows", or
 * inline the check into every function and lose the single authority. So this
 * computes what the gates always meant — a function is caller-scoped if it
 * names `auth.uid()`, or calls a function that is — as a fixpoint, which
 * resolves a chain of any depth and un-scopes everything above a helper that
 * stops being caller-scoped.
 *
 * It lives in `src/lib` rather than in a test file because two suites need it
 * and a second copy would be the thing it exists to prevent.
 */

/** Matches the way `auth.uid()` appears in a function body, however spaced. */
const BINDS_CALLER = /auth\s*\.\s*uid\s*\(\s*\)/i;

/**
 * Function names whose whole job is to answer "who is calling?".
 *
 * They read the JWT through their own path rather than `auth.uid()`, so the
 * text search cannot see it. This list is small and closed on purpose: adding
 * to it asserts that a function IS caller-scoped, which is the opposite of an
 * exemption.
 *
 * It was three while there were tenants. `has_tenant_role` and
 * `is_tenant_member` went with that product in Phase 10.
 */
const CALLER_ORACLES = ["has_role"];

/**
 * The set of public functions that bind their caller, directly or through
 * another function that does.
 *
 * @param definitions function name → `pg_get_functiondef` output.
 */
export function callerScopedFunctions(
  definitions: ReadonlyMap<string, string>,
): ReadonlySet<string> {
  const scoped = new Set<string>(CALLER_ORACLES);
  for (const [name, definition] of definitions) {
    if (BINDS_CALLER.test(definition)) scoped.add(name);
  }

  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, definition] of definitions) {
      if (scoped.has(name)) continue;
      for (const candidate of scoped) {
        // Word-bounded, so `ocade_org_role` does not match a longer name that
        // merely contains it.
        if (new RegExp(`\\b${candidate}\\s*\\(`).test(definition)) {
          scoped.add(name);
          grew = true;
          break;
        }
      }
    }
  }

  return scoped;
}

/**
 * FUNCTIONS AUTHORIZED BY A SECRET IN THEIR ARGUMENT, NOT BY WHO IS CALLING.
 *
 * There is exactly one legitimate reason for a `SECURITY DEFINER` function to
 * be reachable anonymously and to ignore `auth.uid()`: it is opened by a
 * capability — an unguessable token that the caller either has or does not.
 *
 * THE MAP IS EMPTY, and that is the current truth rather than an oversight.
 * `ocade_read_shared_conversation` was the only entry, and conversation sharing
 * went with the products Phase 10 removed. Nothing in OCADE is now reachable by
 * a stranger holding a token.
 *
 * THIS IS NOT AN EXEMPTION LIST, and the distinction is the whole reason it is
 * a separate export. A name here does not get to skip the question; it gets
 * asked a HARDER one, in `security-definer.test.ts`: the function must take a
 * token parameter, must filter on it, must return no account identifier, and an
 * unknown token must return nothing. A function that cannot pass those fails
 * whether or not it is named here.
 */
export const TOKEN_AUTHORIZED_FUNCTIONS: ReadonlyMap<string, string> = new Map();
