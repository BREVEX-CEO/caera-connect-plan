/**
 * ONE READ OF THE ALLOWANCE, SHARED BY EVERY SURFACE THAT SHOWS IT.
 *
 * Three places want the same number — the sidebar meter, the warning above
 * Send, and the full breakdown under Billing — and three `useQuery` calls with
 * three key spellings is how they come to disagree by a request. One key, one
 * read, one cache entry.
 */
import { useQuery } from "@tanstack/react-query";
import { readCommercialUsage, type CommercialUsageView } from "./usage.functions";

export const USAGE_QUERY_KEY = ["usage", "commercial"] as const;

export type UsageWindowView = CommercialUsageView["windows"][number];

export function useCommercialUsage(enabled = true) {
  return useQuery<CommercialUsageView>({
    queryKey: USAGE_QUERY_KEY,
    queryFn: () => readCommercialUsage(),
    enabled,
    /*
     * ALWAYS FRESH WHEN OPENED, because the number is the reason somebody
     * looked. A cached answer is wrong in the two cases that matter: just
     * after sending on this device, and at any time after sending on another.
     */
    staleTime: 0,
    refetchOnMount: "always",
  });
}

/**
 * The window closest to running out.
 *
 * What a person needs to know is when they will be stopped, and that is the
 * tighter of the two windows — a comfortable week is no comfort at all when
 * the session has two requests left in it.
 */
export function tightestWindow(view: CommercialUsageView | undefined): UsageWindowView | null {
  if (!view || view.windows.length === 0) return null;
  return view.windows.reduce((tightest, window) =>
    window.remaining < tightest.remaining ? window : tightest,
  );
}

/** "in about 3 hours" — a person plans around when, not around a timestamp. */
export function describeReset(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}
