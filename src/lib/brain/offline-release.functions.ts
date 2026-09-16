/**
 * WHAT A SIGNED-IN BROWSER IS TOLD ABOUT THE ARTIFACT, AND HOW IT REACHES IT.
 *
 * One call, one answer: the opaque release facts plus a link that expires. The
 * link is minted on the server for this request; there is no permanent URL to
 * publish, no bucket to browse, and nothing in the response that names what the
 * artifact is.
 *
 * AUTHENTICATED, because Offline Intelligence is part of an account's product
 * rather than a public download, and because an unauthenticated mint endpoint
 * is a link generator for anybody who finds it.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mintDeliveryPath } from "./delivery-signature";
import { offlineRelease, type OfflineRelease } from "./offline-release";

export type OfflineReleaseView =
  { available: false } | (OfflineRelease & { available: true; url: string });

export const readOfflineRelease = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<OfflineReleaseView> => {
    const release = offlineRelease();
    // No release published, or no server secret to sign with: either way this
    // deployment cannot complete an install, and saying so is the honest
    // answer. Offering one it cannot finish is not.
    if (!release || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { available: false };

    return {
      ...release,
      available: true,
      url: await mintDeliveryPath(release.releaseId, Date.now()),
    };
  });
