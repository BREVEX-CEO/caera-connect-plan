export type AuthProviderAvailability = {
  google: boolean;
  phone: boolean;
  emailDelivery: boolean;
};

type AuthEnvironment = Record<string, unknown> & {
  MODE?: string;
  PROD?: boolean;
};

function booleanFlag(value: unknown, fallback: boolean): boolean {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return fallback;
}

/**
 * Public provider readiness, never provider credentials.
 *
 * Development and test sessions keep every form reachable. Production is
 * fail-closed: a provider only appears after its external configuration has
 * been completed and the matching public build flag has been set. This avoids
 * sending a person into a provider that the live Supabase project will reject.
 */
export function resolveAuthProviderAvailability(
  environment: AuthEnvironment = import.meta.env,
): AuthProviderAvailability {
  const production = environment.PROD === true || environment.MODE === "production";
  const developmentFallback = !production;
  return {
    google: booleanFlag(environment.VITE_AUTH_GOOGLE_ENABLED, developmentFallback),
    phone: booleanFlag(environment.VITE_AUTH_PHONE_ENABLED, developmentFallback),
    emailDelivery: booleanFlag(environment.VITE_AUTH_EMAIL_DELIVERY_READY, developmentFallback),
  };
}

export const authProviderAvailability = resolveAuthProviderAvailability();
