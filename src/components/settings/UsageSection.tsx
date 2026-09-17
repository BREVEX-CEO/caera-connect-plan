import { Link } from "@tanstack/react-router";
import { Pending, Row } from "./rows";
import {
  describeReset,
  useCommercialUsage,
  type UsageWindowView,
} from "@/lib/commercial/use-commercial-usage";

/**
 * WHAT THIS ACCOUNT HAS LEFT, AND WHEN IT RETURNS.
 *
 * Exact counts on every tier. Pro and Max were shown a percentage while they
 * counted a weighted unit nobody could convert into their own work; they count
 * requests now, so they get the same sentence Free does.
 *
 * ONE READ, ONE AUTHORITY. The allowance is account-wide, so this shows the
 * same number on every device the person signs in on, and it shares its read
 * with the sidebar meter rather than keeping a second opinion of it.
 */
export function UsageSection() {
  const usage = useCommercialUsage();

  if (usage.isPending || usage.isError || !usage.data) {
    return (
      <Pending
        query={usage}
        loading="Reading your allowance…"
        problem="Your allowance could not be read just now."
      />
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
      >
        {usage.data.tier === "max" ? null : (
          <Link to="/pricing" className="text-sm text-foreground underline underline-offset-2">
            See plans
          </Link>
        )}
      </Row>
      {session ? <WindowRow label="This session" window={session} /> : null}
      {week ? <WindowRow label="This week" window={week} /> : null}
      <Row
        label="How it counts"
        description="One request you make counts once, however much work it takes OCADE to answer it. Answers on your own device count the same as answers over the network."
      />
    </div>
  );
}

function WindowRow({ label, window }: { label: string; window: UsageWindowView }) {
  return (
    <Row label={label} description={`Returns ${describeReset(window.resetsInMs)}.`}>
      <span className="text-sm text-foreground">
        {window.remaining} of {window.allowance} left
      </span>
    </Row>
  );
}
