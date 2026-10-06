import { useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useInstallation } from "@/lib/brain/use-installation";
import { deleteAllLibraryItems, listLibraryItems } from "@/lib/library/library.functions";
import { deleteAllConversations, listConversations } from "@/lib/ocade.functions";
import { exportMyAccountData } from "@/lib/account-data.functions";
import { useConfirmIdentity } from "@/components/security/ConfirmIdentity";
import { saveFile } from "@/lib/utils";
import {
  deviceRegistrationProblem,
  watchDeviceRegistration,
} from "@/lib/commercial/device-identity";
import { useSession } from "@/lib/session";
import { Action, Confirm, Row } from "./rows";

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
      <ConversationsSection />
      <LibrarySection />
      <ExportSection />
      <OfflineIntelligenceSection />
    </div>
  );
}

/**
 * What a row says about account data: still reading, could not be read, the refusal of a delete,
 * or the count. A failed read is never "you have none".
 */
function stated(
  read: { isPending: boolean; isError: boolean },
  remove: { isError: boolean; error: Error | null },
  loaded: string,
): string {
  if (read.isPending) return "Checking…";
  if (read.isError) return "This could not be read just now. Close Settings and open it again.";
  if (remove.isError) return `${loaded} Deleting did not work: ${remove.error?.message ?? "try again"}.`;
  return loaded;
}

/** Every conversation, gone for good. */
function ConversationsSection() {
  const client = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const conversations = useQuery({
    queryKey: ["conversations", "all"],
    queryFn: () => listConversations(),
  });
  const empty = useMutation({
    mutationFn: () => deleteAllConversations(),
    onSuccess: () => {
      setConfirming(false);
      void client.invalidateQueries({ queryKey: ["conversations", "all"] });
    },
  });
  const count = conversations.data?.length ?? 0;

  return (
    <Row
      label="Conversations"
      description={stated(
        conversations,
        empty,
        count === 0
          ? "You have no conversations."
          : `${count} conversation${count === 1 ? "" : "s"}, with their messages. Deleting them cannot be undone.`,
      )}
    >
      {count === 0 ? null : confirming ? (
        <Confirm
          label={empty.isPending ? "Deleting…" : "Delete everything"}
          busy={empty.isPending}
          onConfirm={() => empty.mutate()}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <Action label="Delete everything" onClick={() => setConfirming(true)} />
      )}
    </Row>
  );
}

/**
 * A copy of everything, as a file the person keeps.
 *
 * Downloaded rather than emailed: an export is the whole account in one place,
 * and the safest thing to do with it is hand it straight to the person who
 * asked and keep no copy.
 */
function ExportSection() {
  const [problem, setProblem] = useState<string | null>(null);
  const { withProof, dialog } = useConfirmIdentity();
  const download = useMutation({
    mutationFn: async () => {
      setProblem(null);
      const data = await withProof(() => exportMyAccountData());
      saveFile(
        `ocade-account-export-${new Date().toISOString().slice(0, 10)}.json`,
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
    },
    onError: (error: Error) => setProblem(error.message),
  });

  return (
    <Row
      label="Export your data"
      description={
        problem ??
        "A file containing everything on this account. It may ask you to confirm who you are first."
      }
    >
      {dialog}
      <Action
        label={download.isPending ? "Preparing…" : "Export"}
        busy={download.isPending}
        onClick={() => download.mutate()}
      />
    </Row>
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
  const erasing = empty.data?.pending
    ? " Some files are still being erased and will be retried."
    : "";

  return (
    <Row
      label="Library"
      description={
        stated(
          items,
          empty,
          count === 0
            ? "Nothing is in your Library."
            : `${count} item${count === 1 ? "" : "s"}. Deleting them cannot be undone, on any device.`,
        ) + erasing
      }
    >
      {count === 0 ? null : confirming ? (
        <Confirm
          label={empty.isPending ? "Deleting…" : "Delete everything"}
          busy={empty.isPending}
          onConfirm={() => empty.mutate()}
          onCancel={() => setConfirming(false)}
        />
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
  /*
   * READY MEANS READY TO ANSWER, NOT MERELY DOWNLOADED.
   *
   * The artifact's lifecycle and this browser's offline allocation were two
   * independent authorities on the same screen, so Settings could say "Ready"
   * here while Usage & Limits said OCADE cannot answer offline in this browser
   * at all. Both are true of different things and the pair is a lie about the
   * product, so readiness is stated once, from both.
   */
  const { user } = useSession();
  const account = user?.id ?? null;
  const allocation = useSyncExternalStore(
    watchDeviceRegistration,
    () => deviceRegistrationProblem(account),
    () => null,
  );
  const line =
    install.ready && allocation
      ? allocation === "device_limit"
        ? "Installed, but this browser has no offline place on your account"
        : "Installed, but its allowance could not be reserved yet"
      : install.line;

  return (
    <div>
      <Row
        label="Offline Intelligence"
        description={
          install.ready && allocation === "device_limit"
            ? "OCADE is on this device, but every offline place on your account is taken. Remove a device under Usage & Limits to answer without a network here."
            : "OCADE can answer on this device, with no network. It prepares itself once and is reused after that."
        }
      >
        <span className="text-sm text-foreground" role="status">
          {line}
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
          <Confirm
            label="Remove"
            busy={busy}
            onConfirm={async () => {
              setBusy(true);
              await install.uninstall();
              setBusy(false);
              setConfirming(false);
            }}
            onCancel={() => setConfirming(false)}
          />
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
