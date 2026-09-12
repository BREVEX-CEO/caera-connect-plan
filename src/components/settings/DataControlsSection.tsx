import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useInstallation } from "@/lib/brain/use-installation";
import { deleteAllLibraryItems, listLibraryItems } from "@/lib/library/library.functions";

/**
 * DATA CONTROLS: WHAT THIS DEVICE HOLDS, AND WHAT THIS ACCOUNT HOLDS.
 *
 * Two things a person may want to get rid of, and they are genuinely different:
 * Offline Intelligence is bytes on THIS device that cost nothing to fetch again,
 * and a Library is content on the ACCOUNT that nothing can bring back. They sit
 * on one screen because that is where somebody looks for either, and their
 * confirmations are separate because their consequences are.
 *
 * OFFLINE INTELLIGENCE, AS THE PERSON WHO OWNS THE DEVICE SEES IT.
 *
 * Until now nobody could see it. The whole lifecycle was built, tested and
 * running — preparing on the first visit, downloading in parallel, resuming,
 * verifying, repairing — with no screen anywhere, so the one control `PLAN.md`
 * insists on ("only explicit Remove deletes it") could not be pressed and the
 * state it publishes could not be read. The reachability gate said so.
 *
 * WHAT IT MAY SAY. `PLAN.md` Phase 7 fixes the vocabulary: Preparing OCADE,
 * Downloading <percent>, Verifying, Ready, Repairing, Removed. The line comes
 * from `describeInstall`, which is the one authority for it — no second
 * opinion is composed here, and nothing on this screen names a model, a
 * runtime, a vendor, a file or a size.
 *
 * REMOVE IS DELIBERATE AND STAYS DELIBERATE. It asks once, because it throws
 * away something that took a while to fetch; and afterwards nothing reinstalls
 * automatically until the person presses Install.
 */
export function DataControlsSection() {
  return (
    <div>
      <OfflineIntelligenceSection />
      <LibrarySection />
    </div>
  );
}

/**
 * Emptying the Library, which is the only irreversible control in Settings.
 *
 * It says how many things it is about to remove, because "delete everything" is
 * a different decision when it is four files and when it is four hundred.
 */
function LibrarySection() {
  const client = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const items = useQuery({ queryKey: ["library", "items"], queryFn: () => listLibraryItems() });
  const empty = useMutation({
    mutationFn: () => deleteAllLibraryItems(),
    onSuccess: () => {
      setConfirming(false);
      void client.invalidateQueries({ queryKey: ["library", "items"] });
    },
  });
  const count = items.data?.length ?? 0;

  return (
    <Row
      label="Library"
      description={
        count === 0
          ? "Nothing is in your Library."
          : `${count} item${count === 1 ? "" : "s"}. Deleting them cannot be undone, on any device.`
      }
    >
      {count === 0 ? null : confirming ? (
        <div className="flex items-center gap-2">
          <Action
            label={empty.isPending ? "Deleting…" : "Delete everything"}
            busy={empty.isPending}
            onClick={() => empty.mutate()}
          />
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-8 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Keep
          </button>
        </div>
      ) : (
        <Action label="Delete everything" onClick={() => setConfirming(true)} />
      )}
    </Row>
  );
}

function OfflineIntelligenceSection() {
  const install = useInstallation();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const removed = install.state.stage === "idle" && install.state.detail !== null;

  return (
    <div>
      <Row
        label="Offline Intelligence"
        description="OCADE can answer on this device, with no network. It prepares itself once and is reused after that."
      >
        <span className="text-sm text-foreground" role="status">
          {install.line}
        </span>
      </Row>

      {install.state.stage === "downloading" && install.state.fraction !== null ? (
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-secondary"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(install.state.fraction * 100)}
          aria-label="Downloading"
        >
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${Math.round(install.state.fraction * 100)}%` }}
          />
        </div>
      ) : null}

      <Row
        label={removed ? "Install" : "Remove"}
        description={
          removed
            ? "Put OCADE's offline intelligence back on this device."
            : "Delete it from this device. Nothing reinstalls until you ask for it again."
        }
      >
        {removed ? (
          <Action
            label="Install"
            busy={busy}
            onClick={() => {
              setBusy(true);
              install.reinstall();
              setBusy(false);
            }}
          />
        ) : confirming ? (
          <div className="flex items-center gap-2">
            <Action
              label="Remove"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                await install.uninstall();
                setBusy(false);
                setConfirming(false);
              }}
            />
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-8 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Keep
            </button>
          </div>
        ) : (
          <Action label="Remove" onClick={() => setConfirming(true)} />
        )}
      </Row>

      {/*
        REPAIR IS OFFERED ONLY WHEN SOMETHING IS WRONG. A permanent "Repair"
        button invites people to repair a device that is fine, which costs them
        a re-verification of a gigabyte to be told what the line above already
        said.
      */}
      {install.remedies.includes("retry") ? (
        <Row
          label="Repair"
          description="Check what is on this device and fetch only what is missing."
        >
          <Action label="Repair" onClick={install.repair} />
        </Row>
      ) : null}
    </div>
  );
}

function Action({
  label,
  onClick,
  busy,
}: {
  label: string;
  onClick: () => void | Promise<void>;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onClick()}
      className="h-8 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
    >
      {label}
    </button>
  );
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
