import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * The one thing the browser genuinely cannot see for itself: whether this
 * deployment has a cloud engine configured at all.
 *
 * Presence of the key only. No request is made to any provider — a health page
 * that pings an upstream on every visit is a health page that costs money and
 * rate limit to look at. "Configured" is therefore an honest claim about
 * configuration, and the capability report says exactly that.
 */
export const getCapabilityEnvironment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { cloudConfigured: Boolean(process.env.LOVABLE_API_KEY) };
  });
