import { useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { Pending, Row } from "./rows";
import {
  describeReset,
  useCommercialUsage,
  type UsageWindowView,
} from "@/lib/commercial/use-commercial-usage";
import {
  deviceRegistrationProblem,
  watchDeviceRegistration,
} from "@/lib/commercial/device-identity";

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
      <OfflineRow held={session?.offlineAllocated ?? 0} />
      <Row
        label="How it counts"
        description="One request you make counts once, however much work it takes OCADE to answer it. Answers on your own device count the same as answers over the network."
      />
    </div>
  );
}

/**
 * WHERE THE MISSING REQUESTS WENT, AND WHY THIS BROWSER MAY HAVE NONE.
 *
 * A device that can answer without a network holds some of the account's
 * requests up front, so the number above is lower than a person expects and
 * nothing else on any screen explained it. The same row carries the refusal:
 * registering a device can fail, it used to fail in a background task that
 * swallowed the reason, and an account at its device limit would simply never
 * work offline here with nothing said anywhere.
 */
function OfflineRow({ held }: { held: number }) {
  const problem = useSyncExternalStore(
    watchDeviceRegistration,
    deviceRegistrationProblem,
    () => null,
  );

  if (problem === "device_limit") {
    return (
      <Row
        label="Offline on this device"
        description="OCADE already answers without a network on as many of your devices as this account allows, so it cannot do that in this browser. Answers over the network work normally here."
      />
    );
  }
  if (problem === "unavailable") {
    return (
      <Row
        label="Offline on this device"
        description="OCADE could not reserve requests for this browser to use without a network. It tries again the next time you open OCADE with a connection."
      />
    );
  }
  // Nothing held and nothing wrong: the row below already says that answers on
  // your own device count the same, and saying it twice is not saying it twice.
  if (held === 0) return null;
  return (
    <Row
      label="Offline on your devices"
      description={`${held} of this session's requests are held on the devices that can answer without a network. They are yours to spend there, and they return at the reset.`}
    />
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
