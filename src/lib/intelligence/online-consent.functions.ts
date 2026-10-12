/**
 * The account's agreement to online intelligence (20261013091000). Online answers run
 * on a free model tier whose provider may use what is sent to improve its products;
 * the Online boundary sends nothing for an account that has not agreed.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "@/lib/security/session-middleware";
import { ONLINE_CONSENT_VERSION } from "./online-consent-version";

export const readOnlineConsent = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("online_ai_consent_at, online_ai_consent_version")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as {
      online_ai_consent_at: string | null;
      online_ai_consent_version: string | null;
    } | null;
    return {
      agreedAt:
        row?.online_ai_consent_version === ONLINE_CONSENT_VERSION ? row.online_ai_consent_at : null,
    };
  });

export const recordOnlineConsent = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .validator((i) => z.object({ given: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: at, error } = await context.supabase.rpc("ocade_record_online_ai_consent", {
      p_version: ONLINE_CONSENT_VERSION,
      p_given: data.given,
    });
    if (error) throw new Error(error.message);
    return { agreedAt: (at as string | null) ?? null };
  });
