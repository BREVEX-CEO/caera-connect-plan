import { useSyncExternalStore, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Action, Confirm, Pending, Row, describeWhen } from "./rows";
import {
  USAGE_QUERY_KEY,
  describeReset,
  useCommercialUsage,
  type UsageWindowView,
} from "@/lib/commercial/use-commercial-usage";
import {
  deviceRegistrationProblem,
  watchDeviceRegistration,
} from "@/lib/commercial/device-identity";
import { listOfflineDevices, revokeOfflineDevice } from "@/lib/commercial/offline-devices";
import { useSession } from "@/lib/session";

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
      ></Row>
      {usage.data.unlimited ? (
        <Row
          label="Unlimited"
          description={
            usage.data.unlimited.endsAt
              ? `No limit until ${new Date(usage.data.unlimited.endsAt).toLocaleString()}. Your use is still counted.`
              : "No limit on Chat or JARVIS. Your use is still counted."
          }
        />
      ) : null}
      {session ? <WindowRow label="This session" window={session} /> : null}
      {week ? <WindowRow label="This week" window={week} /> : null}
      <OfflineRow held={session?.offlineAllocated ?? 0} />
      <DevicesRows />
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
  const problem = useDeviceRegistrationProblem();

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

/**
 * The refusal, read for the account that is actually signed in.
 *
 * The published answer is module state, and it used to be shared across an
 * account change: account B could be shown account A's device-limit refusal
 * until a background refresh happened to overwrite it.
 */
function useDeviceRegistrationProblem() {
  const { user } = useSession();
  const account = user?.id ?? null;
  return useSyncExternalStore(
    watchDeviceRegistration,
    () => deviceRegistrationProblem(account),
    () => null,
  );
}

/**
 * THE DEVICES THAT HOLD THIS ACCOUNT'S OFFLINE SLOTS, AND REMOVE BESIDE EACH.
 *
 * The cap has always been enforced and the revocation function has always
 * existed; nothing called it. A person on their third browser was told OCADE
 * could not answer offline there and had nowhere to go — the only way out was
 * a support request about a limit they could have managed themselves.
 *
 * Shown only when there is something to manage. An account with one device does
 * not need a device manager, and a settings screen that lists one row to say so
 * is the developer-dashboard clutter `docs/JARVIS_DESIGN_SYSTEM.md` forbids.
 */
function DevicesRows() {
  const client = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);
  const devices = useQuery({
    queryKey: ["commercial", "devices"],
    queryFn: () => listOfflineDevices(),
  });
  const remove = useMutation({
    mutationFn: (id: string) => revokeOfflineDevice(id),
    onSuccess: () => {
      setConfirming(null);
      void client.invalidateQueries({ queryKey: ["commercial", "devices"] });
      void client.invalidateQueries({ queryKey: USAGE_QUERY_KEY });
    },
  });

  const rows = devices.data ?? [];
  if (devices.isError) {
    return <Row label="Devices" description="Your devices could not be read just now." />;
  }
  if (devices.isPending || rows.length === 0) return null;
  // Two places with one name are told apart by when each was added (F19).
  const shared = (name: string) => rows.filter((row) => row.name === name).length > 1;

  return (
    <div>
      <Row
        label="Devices that answer without a network"
        description={
          remove.error instanceof Error
            ? remove.error.message
            : "Removing one frees its place for another browser. It keeps answering over the network."
        }
      />
      {rows.map((device) => (
        <Row
          key={device.id}
          label={device.current ? `${device.name} — this browser` : device.name}
          description={`${
            shared(device.name)
              ? `Added ${new Date(device.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}. `
              : ""
          }Last used ${describeWhen(device.lastActiveAt)}.`}
        >
          {confirming === device.id ? (
            <Confirm
              label={remove.isPending ? "Removing…" : "Remove"}
              busy={remove.isPending}
              onConfirm={() => remove.mutate(device.id)}
              onCancel={() => setConfirming(null)}
            />
          ) : (
            <Action label="Remove" onClick={() => setConfirming(device.id)} />
          )}
        </Row>
      ))}
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
