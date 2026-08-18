import { useEffect } from "react";
import {
  retryLandingModelWarmup,
  scheduleLandingModelWarmup,
} from "@/lib/brain/landing-model-warmup";

/**
 * Starts the local-model cache from the public landing page without rendering a
 * fake browser download UI. WebLLM/OPFS own the bytes; Chrome's Downloads
 * shelf/permission flow is not used because this is application storage, not a
 * user-initiated file download.
 *
 * There is intentionally no cancellation cleanup for an active warm-up. A
 * client-side route change should not throw away work that can make the demo
 * instant a second later. Closing the browser may terminate the page/worker —
 * no website can override that — so partial data is kept and the next visit
 * retries/resumes it.
 */
export function LandingModelWarmup() {
  useEffect(() => {
    scheduleLandingModelWarmup();
    const onOnline = () => retryLandingModelWarmup();
    window.addEventListener("online", onOnline);

    const onPageHide = () => {
      // Keep the application shell completion retry alive as long as the
      // service worker is allowed to run. Model-weight continuation itself is
      // browser-lifecycle dependent and is resumed on the next real visit.
      navigator.serviceWorker?.controller?.postMessage({ type: "OCADE_RETRY_OFFLINE_CACHE" });
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}
