import { useQuery } from "@tanstack/react-query";
import { readCommercialUsage, type CommercialUsageView } from "@/lib/commercial/usage.functions";

/**
 * WHAT THIS ACCOUNT HAS LEFT, AND WHEN IT RETURNS.
 *
 * Read from the server and already shaped there by the tier: Free is shown
 * exact numbers because it has twenty-eight of something to plan around, and
 * paid plans are shown a proportion because a Standard Work Equivalent is not a
 * unit anybody can convert into their own work. The browser cannot ask for the
 * raw equivalents behind a percentage — it is not sent them.
 *
 * ONE READ, ONE AUTHORITY. The allowance is account-wide, so this shows the
 * same number on every device the person signs in on, and nothing here caches
 * a second opinion of it.
 */
export function UsageSection() {
  const usage = useQuery<CommercialUsageView>({
    queryKey: ["usage", "commercial"],
    queryFn: () => readCommercialUsage(),
    /*
     * ALWAYS FRESH WHEN OPENED, because the number is the reason somebody
     * opened it. A cached answer here is wrong in the two cases that matter:
     * just after sending on this device, and at any time after sending on
     * another one.
     */
    staleTime: 0,
    refetchOnMount: "always",
  });

  if (usage.isPending) {
    return (
      <p className="py-4 text-sm text-muted-foreground" role="status">
        Reading your allowance…
      </p>
    );
  }

  if (usage.isError || !usage.data) {
    return (
      <p className="py-4 text-sm text-muted-foreground" role="alert">
        Your allowance could not be read just now.
      </p>
    );
  }

  const session = usage.data.windows.find((window) => window.kind === "session");
  const week = usage.data.windows.find((window) => window.kind === "week");

  return (
    <div>
      <Row
        label="Plan"
        description={
          usage.data.tier === "free"
            ? "Free. Requests are shared across every device you sign in on."
            : `${usage.data.tier === "pro" ? "Pro" : "Max"}. Requests are shared across every device you sign in on.`
        }
      />
      {session ? <WindowRow label="This session" window={session} /> : null}
      {week ? <WindowRow label="This week" window={week} /> : null}
      <Row
        label="How it counts"
        description="One request you make counts once, however much work it takes OCADE to answer it. Answers on your own device count the same as answers over the network."
      />
    </div>
  );
}

function WindowRow({
  label,
  window,
}: {
  label: string;
  window: CommercialUsageView["windows"][number];
}) {
  const returns = describeReset(window.resetsInMs);
  if (window.display === "raw") {
    return (
      <Row label={label} description={`Returns ${returns}.`}>
        <span className="text-sm text-foreground">
          {window.remaining ?? 0} of {window.allowance ?? 0} left
        </span>
      </Row>
    );
  }
  return (
    <Row label={label} description={`Returns ${returns}.`}>
      <span className="text-sm text-foreground">{window.remainingPercent ?? 0}% left</span>
    </Row>
  );
}

/** "in about 3 hours" — a person plans around when, not around a timestamp. */
function describeReset(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/50 py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {description ? (
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}
