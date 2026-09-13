/**
 * WHICH WAYS IN EXIST — ASKED OF SUPABASE, NOT OF THE BUILD.
 *
 * This module used to answer from three build flags:
 *
 *   VITE_AUTH_GOOGLE_ENABLED
 *   VITE_AUTH_PHONE_ENABLED
 *   VITE_AUTH_EMAIL_DELIVERY_READY
 *
 * each defaulting to `false` in production. That is a second authority over
 * what authentication the product has, sitting beside the only real one, and
 * `docs/RULES.md` #16 says Supabase Auth is the identity authority. The two
 * could disagree in both directions and did: the live project has Google
 * configured and working, and a production build with the variable unset
 * offered no Google button at all. The opposite drift is worse — a flag set
 * for a provider the project has since turned off sends people into a
 * handshake that is going to be rejected.
 *
 * GoTrue publishes the answer itself at `/auth/v1/settings`. It is public, it
 * is the same source the hosted dashboard reflects, and it cannot be stale
 * relative to the project because it IS the project. So the question is asked
 * there, once, when the sign-in screen loads.
 *
 * WHEN IT CANNOT BE ASKED, OFFER EVERYTHING. A failed read means OCADE does
 * not know, and there are only two ways to be wrong. Hiding every method makes
 * signing in impossible over a hiccup that may have nothing to do with the
 * providers. Offering them means at worst somebody presses a method the
 * project has disabled and gets Supabase's own refusal, sanitized, in a
 * second. The second failure is recoverable and the first is not.
 */

export type AuthProviderAvailability = {
  google: boolean;
  phone: boolean;
  emailDelivery: boolean;
};

/** Offered when the project cannot be asked. See the note above. */
export const ASSUME_AVAILABLE: AuthProviderAvailability = {
  google: true,
  phone: true,
  emailDelivery: true,
};

/** The shape of `/auth/v1/settings` that this cares about. */
interface GoTrueSettings {
  external?: Record<string, unknown>;
}

export function readAuthProviderAvailability(settings: unknown): AuthProviderAvailability {
  const external = (settings as GoTrueSettings | null)?.external;
  if (!external || typeof external !== "object") return ASSUME_AVAILABLE;
  // GoTrue reports every provider as a boolean under `external`, including the
  // two built-in channels. An ABSENT key is a provider this version of GoTrue
  // does not report, which is not the same as one turned off, so it is offered
  // for the same reason a failed read is.
  const flag = (name: string): boolean => external[name] === undefined || external[name] === true;
  return {
    google: flag("google"),
    phone: flag("phone"),
    emailDelivery: flag("email"),
  };
}

/**
 * Ask the project what it offers.
 *
 * Never throws: every failure resolves to `ASSUME_AVAILABLE`, because a
 * sign-in screen that cannot be used is worse than one that offers a method
 * the project will refuse out loud.
 */
export async function fetchAuthProviderAvailability(
  configuration: { url?: string; publishableKey?: string; configured: boolean },
  fetcher: typeof fetch = (input, init) => globalThis.fetch(input, init),
): Promise<AuthProviderAvailability> {
  if (!configuration.configured || !configuration.url || !configuration.publishableKey) {
    return ASSUME_AVAILABLE;
  }
  try {
    const response = await fetcher(`${configuration.url.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: configuration.publishableKey },
    });
    if (!response.ok) return ASSUME_AVAILABLE;
    return readAuthProviderAvailability(await response.json());
  } catch {
    return ASSUME_AVAILABLE;
  }
}
