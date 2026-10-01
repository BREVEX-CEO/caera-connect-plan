/**
 * THE WAY INTO THE CONSOLE: ONE SIGN-IN, HANDED OVER, NEVER COPIED.
 *
 * The console lives on its own origin (`console-host.ts`), and the database
 * lets only a session the console opened for itself operate (migration
 * 20261001090000). So the site does not pass its session across: it asks for a
 * one-time sign-in for the same account, and the console's server redeems it
 * into a NEW session and records that session as the console's. The new session
 * starts without its second factor, so a staff member answers it there before
 * anything opens — whatever the site session had already proved.
 *
 * Anyone who reads the one-time sign-in off the site's page gets exactly that:
 * a session that still needs the authenticator app — except the Primary Owner
 * before any factor is enrolled, who may look and never change (the bootstrap
 * rule in 20260930093000), the same as before the console moved. The console
 * also refuses sessions arriving in an address (client.ts), so a session
 * minted elsewhere cannot be planted in it for the owner to upgrade.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSession } from "@/lib/security/session-middleware";
import { consoleOrigin, isConsoleHost } from "./console-host";

const COULD_NOT_OPEN = "The console could not open just now. Try again.";

/** On the site: a one-time address that signs this staff account into the console. */
export const openConsole = createServerFn({ method: "POST" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<{ url: string }> => {
    const { data: staff, error } = await context.supabase.rpc("ocade_my_staff");
    if (error) throw new Error(COULD_NOT_OPEN);
    const email = typeof context.claims.email === "string" ? context.claims.email : "";
    if (!staff?.[0] || !email) throw new Error("Not found");
    /*
     * The hand-over mints a NEW session, which any factor enrolled before it
     * looks older than. So nothing may have been enrolled since THIS session
     * began, answered or not: a stolen site token could otherwise add its own
     * authenticator and answer it in the console (20261001095000).
     */
    const { data: newer, error: factorError } = await context.supabase.rpc(
      "ocade_factor_added_since_sign_in",
      { p_unverified_too: true },
    );
    if (factorError) throw new Error(COULD_NOT_OPEN);
    if (newer) {
      throw new Error(
        "You set up two-step verification after signing in here. Sign out, sign in again, then open the console.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    // Only ever this caller's own account, whatever the address resolves to.
    if (!linkError && link.user?.id !== context.userId) throw new Error("Not found");
    if (linkError || !link.properties?.hashed_token) {
      throw new Error(
        linkError?.status === 429 ? "Wait a minute, then open the console again." : COULD_NOT_OPEN,
      );
    }
    const site = new URL(getRequest().url);
    // In the fragment, which no server and no Referer ever sees.
    return { url: `${consoleOrigin(site)}/auth/console#t=${link.properties.hashed_token}` };
  });

/** Whatever a JWT says about itself. Only ever applied to a token GoTrue just issued. */
function claimsOf(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
}

/**
 * On the console: redeem the one-time sign-in into the console's own session.
 * Refused anywhere but the console origin, so the site can never mint one.
 */
export const enterConsole = createServerFn({ method: "POST" })
  .validator((input) => z.object({ token: z.string().regex(/^[0-9a-f]{20,128}$/) }).parse(input))
  .handler(async ({ data }): Promise<{ access_token: string; refresh_token: string }> => {
    if (!isConsoleHost(new URL(getRequest().url).hostname)) throw new Error("Not found");
    /*
     * Straight to Supabase Auth, not through a client: a client that verified
     * would keep the new session and use it for every later call it makes —
     * which, for the shared service-role client, would be a disaster.
     */
    const redeemed = await fetch(`${process.env.SUPABASE_URL}/auth/v1/verify`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
        "content-type": "application/json",
      },
      body: JSON.stringify({ type: "magiclink", token_hash: data.token }),
    }).catch(() => null);
    const session = redeemed?.ok
      ? ((await redeemed.json()) as {
          access_token?: string;
          refresh_token?: string;
          user?: { id?: string };
        })
      : null;
    if (!session?.access_token || !session.refresh_token || !session.user?.id) {
      throw new Error("This way in has already been used or has expired. Open the console again.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = session.user.id;
    const end = () => supabaseAdmin.auth.admin.signOut(session.access_token!, "local");

    const { data: member } = await supabaseAdmin
      .from("ocade_staff")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    const sessionId = claimsOf(session.access_token).session_id;
    if (!member || typeof sessionId !== "string") {
      await end();
      throw new Error("Not found");
    }
    const { error: recordError } = await supabaseAdmin
      .from("ocade_console_sessions")
      .insert({ session_id: sessionId, user_id: userId });
    if (recordError) {
      await end();
      throw new Error(COULD_NOT_OPEN);
    }
    return { access_token: session.access_token, refresh_token: session.refresh_token };
  });
