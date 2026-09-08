import { useEffect } from "react";
import { useSession } from "@/lib/session";

/**
 * The one place the consent gate needs to know WHOSE consent this is.
 *
 * Its own module, and loaded lazily by `LegalConsentGate`, for a reason that is
 * about bytes rather than about consent: `useSession` imports the Supabase
 * browser client, the gate is rendered by the root on every route, and a static
 * import therefore put 200 KiB of auth, PostgREST, realtime and storage into
 * the entry bundle. Every visitor to the public landing page, `/about`,
 * `/privacy` or `/terms` parsed all of it before the page could answer a tap —
 * to serve a component those routes never render.
 *
 * It renders nothing. `useSession` fails closed where Supabase is not
 * configured, and the anonymous path keeps working from local consent storage
 * alone; the account receipt is an addition to that, never a precondition.
 */
export default function ConsentAccountBridge({ onUserId }: { onUserId: (userId: string) => void }) {
  const { user } = useSession();
  const userId = user?.id ?? "";
  useEffect(() => onUserId(userId), [onUserId, userId]);
  return null;
}
