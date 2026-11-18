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
import {
  readOnlineConsent,
  recordOnlineConsent,
} from "@/lib/intelligence/online-consent.functions";
import { Action, Confirm, Row } from "./rows";
import { OfflineModeSetup } from "@/components/offline/OfflineModeSetup";
import { readSetupAcceptance } from "@/lib/brain/installation-state";

/**
 * DATA CONTROLS: WHAT THIS DEVICE HOLDS, AND WHAT THIS ACCOUNT HOLDS.
 *
 * Two things a person may want to get rid of, and they are genuinely different:
 * Offline Mode is files in THIS browser, shared by every account on it, and a
 * Library is content on the ACCOUNT that nothing can bring back. Their
 * confirmations are separate because their consequences are.
 *
 * OFFLINE MODE. Its words come from `OfflineModeSetup` and `describeInstall`,
 * the one authority for them; nothing on this screen names a model, a
 * runtime, a vendor, a file or a size, or says "download" (plan 14B.2).
 * Settings is the only place Offline Mode can be removed. Removal asks once,
 * and afterwards nothing sets itself up again until somebody asks.
 */
export function DataControlsSection() {
  return (
    <div>
      <ConversationsSection />
      <LibrarySection />
      <ExportSection />
      <OfflineModeSection />
      <OnlineConsentSection />
    </div>
  );
}

/** The agreement online answers need (20261013091000), shown and withdrawable here. */
function OnlineConsentSection() {
  const client = useQueryClient();
  const read = useQuery({ queryKey: ["online-consent"], queryFn: () => readOnlineConsent() });
  const change = useMutation({
    mutationFn: (given: boolean) => recordOnlineConsent({ data: { given } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["online-consent"] }),
  });
  const agreedAt = read.data?.agreedAt ?? null;
  return (
    <Row
      label="Online answers"
      description={stated(
        read,
        change,
        agreedAt
          ? `You agreed on ${new Date(agreedAt).toLocaleDateString()} that what you send online may be kept and used by a third-party AI service to improve its products. Withdraw it, and nothing is sent online until you agree again; Offline Chat still works.`
          : "Not agreed: online answers and JARVIS ask before anything is sent. Offline Chat sends nothing.",
      )}
    >
      {agreedAt ? (
        <Action label="Withdraw" busy={change.isPending} onClick={() => change.mutate(false)} />
      ) : null}
    </Row>
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
  if (remove.isError)
    return `${loaded} Deleting did not work: ${remove.error?.message ?? "try again"}.`;
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
      const response = await withProof(() => exportMyAccountData());
      if (!response.ok) throw new Error("The export could not be made just now. Try again.");
      saveFile(
        `ocade-account-export-${new Date().toISOString().slice(0, 10)}.json`,
        new Blob([await response.blob()], { type: "application/json" }),
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

function OfflineModeSection() {
  const install = useInstallation();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  /*
   * READY MEANS READY TO ANSWER, NOT MERELY SET UP.
   *
   * The installation and this browser's offline allocation are two
   * authorities, so readiness is stated once, from both.
   */
  const { user } = useSession();
  const account = user?.id ?? null;
  const allocation = useSyncExternalStore(
    watchDeviceRegistration,
    () => deviceRegistrationProblem(account),
    () => null,
  );
  // Removal is offered whenever something of Offline Mode may be here.
  const removable =
    install.ready ||
    install.preparing ||
    install.state.stage === "paused" ||
    install.state.stage === "recoverable_error" ||
    readSetupAcceptance() !== null;

  return (
    <div>
      <Row
        label="Offline Mode"
        description={
          install.ready && allocation === "device_limit"
            ? "Offline Mode is set up, but every offline place on your account is taken. Remove a device under Usage & Limits to chat with no connection here."
            : install.ready && allocation
              ? "Offline Mode is set up, but its allowance could not be reserved yet."
              : "Chat on this device with no connection. Set up once per browser; every account on this browser reuses it, and each account's chats stay private."
        }
      />
      <div className="pb-4">
        <OfflineModeSetup signedIn={Boolean(user)} />
        <a
          href="/legal/lfm-open-license-v1.0.txt"
          className="mt-2 inline-block text-xs text-muted-foreground underline underline-offset-2"
        >
          Third-party licences
        </a>
      </div>

      {removable ? (
        <Row
          label="Remove Offline Mode"
          description={
            confirming
              ? "This removes Offline Mode from this browser for every account that uses it. Chats are not deleted. Nothing sets itself up again until someone asks."
              : "Remove it from this browser. It stays off until you set it up again."
          }
        >
          {confirming ? (
            <Confirm
              label="Remove Offline Mode"
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
      ) : null}

      {/*
        REPAIR IS OFFERED ONLY WHEN SOMETHING IS WRONG. A permanent "Repair"
        button invites people to repair a browser that is fine.
      */}
      {install.remedies.includes("retry") ? (
        <Row label="Repair" description="Check Offline Mode and fetch only what is missing.">
          <Action label="Repair" onClick={install.repair} />
        </Row>
      ) : null}
    </div>
  );
}
