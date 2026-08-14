/**
 * The email connector contract, and the registry that holds at most one.
 *
 * SALVAGED FROM A DELETED SIMULATOR, AND ONLY THIS PART.
 *
 * This was the top of `src/lib/control/email-web-work.ts`, a 1,183-line module
 * that composed a simulated browser bridge to "send" mail. That module is gone
 * with the rest of `src/lib/control/`. What is kept is the part with no
 * simulation in it: the interface a real connector would implement, and the
 * single-slot registry the settings screen reads to say whether one is
 * installed.
 *
 * NOTHING IMPLEMENTS THIS YET, AND THE REGISTRY SAYS SO HONESTLY.
 * `getEmailConnectorStatus()` returns null until something calls
 * `setEmailConnector`, and the Connectors panel renders that as "not
 * connected". That is the true state of email in OCADE today. Keeping the
 * contract rather than deleting it is deliberate: it is the shape any real
 * OAuth or approved-plug-in connector has to satisfy, and it is what the
 * settings screen already knows how to display.
 */

export type EmailConnectorRoute = "api" | "plugin";

export interface EmailConnectorStatus {
  available: boolean;
  authenticated: boolean;
  providerId: string;
  accountAddress?: string;
  route: EmailConnectorRoute;
  officialOrApproved: boolean;
  evidence: string;
}

export interface EmailConnectorMutation {
  ok: boolean;
  evidence: string;
}

export interface EmailConnectorDraftResult extends EmailConnectorMutation {
  draftId?: string;
}

export interface EmailConnectorSendResult extends EmailConnectorMutation {
  receiptId?: string;
}

export interface EmailConnectorVerification extends EmailConnectorMutation {
  verified: boolean;
  messageId?: string;
  sentAt?: string;
}

export interface NormalisedEmailAttachment {
  name: string;
  mimeType: string;
  byteLength: number;
  sha256: string;
}

export interface NormalisedEmailDraft {
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  attachments: NormalisedEmailAttachment[];
}

/** Implemented by an OAuth/API connector or an explicitly approved plug-in. */
export interface EmailConnector {
  status(): Promise<EmailConnectorStatus>;
  createDraft(
    draft: NormalisedEmailDraft,
    options: { idempotencyKey: string; signal?: AbortSignal },
  ): Promise<EmailConnectorDraftResult>;
  sendDraft(
    draftId: string,
    options: { idempotencyKey: string; signal?: AbortSignal },
  ): Promise<EmailConnectorSendResult>;
  verifySent(receiptId: string, signal?: AbortSignal): Promise<EmailConnectorVerification>;
}

let installedEmailConnector: EmailConnector | null = null;

/** Installed only after a connector has completed its own approved setup flow. */
export function setEmailConnector(connector: EmailConnector | null): void {
  installedEmailConnector = connector;
}

export function getEmailConnector(): EmailConnector | null {
  return installedEmailConnector;
}

export async function getEmailConnectorStatus(): Promise<EmailConnectorStatus | null> {
  if (!installedEmailConnector) return null;
  try {
    return await installedEmailConnector.status();
  } catch {
    // A connector that cannot report its own state is not a connector the
    // settings screen should describe as working.
    return null;
  }
}
