/**
 * Governed email and authenticated web work (Stage 2, Phase 29).
 *
 * This module composes existing OCADE controls instead of bypassing them:
 * official/approved email connectors are preferred, a paired browser is an
 * explicit fallback, protected input remains user-controlled, every mutation
 * is bound to an immutable preview, and success requires an independent
 * receipt/observation.
 */
import {
  getBrowserBridge,
  isProtectedField,
  originOf,
  runBrowserAction,
  type BrowserAction,
  type BrowserActionReceipt,
  type BrowserFileHandoff,
  type BrowserTarget,
  type BrowserVerificationExpectation,
  type SitePolicy,
} from "../native/browser-bridge";
import { isProtectedText } from "../native/companion-bridge";
import { hasProtectedFields, type PageSummary } from "../native/browser-dom";
import {
  selectUniversalRoute,
  type UniversalRouteCandidate,
  type UniversalRouteDecision,
} from "./route-selector";

const EMAIL_PROTOCOL_VERSION = "1.0";
const MAX_RECIPIENTS = 100;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 50 * 1024 * 1024;
const MAX_BODY_LENGTH = 1_000_000;
const PREVIEW_TTL_MS = 15 * 60 * 1000;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const MIME = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

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
    return null;
  }
}

export interface EmailAttachment {
  name: string;
  mimeType: string;
  dataBase64: string;
  byteLength: number;
  sha256: string;
  /** Set only after the user selected or explicitly approved these exact bytes. */
  approved: boolean;
}

export interface EmailDraft {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
  /** Exact addresses the user or trusted address book confirmed for this send. */
  verifiedRecipients: string[];
}

export interface NormalisedEmailAttachment extends EmailAttachment {
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

export type SensitiveContentCategory =
  "credentials" | "financial" | "identity" | "health" | "legal";

export interface EmailPreview {
  draft: NormalisedEmailDraft;
  previewHash: string;
  preparedAt: string;
  expiresAt: string;
  warnings: SensitiveContentCategory[];
  recipientCount: number;
  attachmentCount: number;
  attachmentBytes: number;
}

export interface BoundConfirmation {
  previewHash: string;
  confirmedAt: string;
  expiresAt: string;
}

export type PreparationResult<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

function normaliseAddress(value: string): string | null {
  const address = value.trim().toLowerCase();
  return address.length <= 254 && EMAIL.test(address) ? address : null;
}

function canonical(value: unknown): string {
  return JSON.stringify(value);
}

async function digestBytes(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function digestText(text: string): Promise<string> {
  return digestBytes(new TextEncoder().encode(text));
}

function decodeBase64(value: string): Uint8Array | null {
  const compact = value.replace(/\s/g, "");
  if (
    compact.length === 0 ||
    compact.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact)
  ) {
    return null;
  }
  try {
    const decoded = globalThis.atob(compact);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function sensitiveCategories(subject: string, body: string): SensitiveContentCategory[] {
  const text = `${subject}\n${body}`;
  const categories: SensitiveContentCategory[] = [];
  if (
    /(password|passcode|passphrase|\botp\b|one[- ]time|verification code|2fa|mfa|captcha|private key|seed phrase|recovery code)/i.test(
      text,
    )
  ) {
    categories.push("credentials");
  }
  if (
    /(card number|cvv|cvc|iban|routing number|sort code|bank account|wire transfer)/i.test(text)
  ) {
    categories.push("financial");
  }
  if (/(social security|ssn|aadhaar|passport number|driver'?s licen[cs]e)/i.test(text)) {
    categories.push("identity");
  }
  if (/(diagnosis|medical record|patient|prescription|health information)/i.test(text)) {
    categories.push("health");
  }
  if (/(legal advice|settlement|lawsuit|attorney-client|legally binding)/i.test(text)) {
    categories.push("legal");
  }
  return categories;
}

async function validateAttachment(
  attachment: EmailAttachment,
): Promise<PreparationResult<NormalisedEmailAttachment>> {
  if (
    !attachment.name.trim() ||
    attachment.name.length > 255 ||
    /[\\/]/.test(attachment.name) ||
    attachment.name === "." ||
    attachment.name === ".."
  ) {
    return { ok: false, reason: "An attachment has an unsafe or missing filename." };
  }
  if (!MIME.test(attachment.mimeType) || attachment.mimeType.length > 200) {
    return { ok: false, reason: `${attachment.name} has an invalid MIME type.` };
  }
  if (
    !Number.isSafeInteger(attachment.byteLength) ||
    attachment.byteLength <= 0 ||
    attachment.byteLength > MAX_ATTACHMENT_BYTES
  ) {
    return {
      ok: false,
      reason: `${attachment.name} must be non-empty and no larger than 25 MiB.`,
    };
  }
  if (!attachment.approved) {
    return {
      ok: false,
      reason: `${attachment.name} has not been approved for this message.`,
    };
  }
  const claimedHash = attachment.sha256.toLowerCase();
  if (!SHA256.test(claimedHash)) {
    return { ok: false, reason: `${attachment.name} has no valid SHA-256 digest.` };
  }
  const bytes = decodeBase64(attachment.dataBase64);
  if (!bytes || bytes.byteLength !== attachment.byteLength) {
    return {
      ok: false,
      reason: `${attachment.name} does not match its approved byte length.`,
    };
  }
  const actualHash = await digestBytes(bytes);
  if (actualHash !== claimedHash) {
    return {
      ok: false,
      reason: `${attachment.name} changed after it was approved.`,
    };
  }
  return {
    ok: true,
    data: { ...attachment, name: attachment.name.trim(), sha256: actualHash },
    evidence: `${attachment.name} matched its approved bytes and SHA-256 digest.`,
  };
}

function previewPayload(draft: NormalisedEmailDraft) {
  return {
    from: draft.from,
    to: draft.to,
    cc: draft.cc,
    bcc: draft.bcc,
    subject: draft.subject,
    body: draft.body,
    attachments: draft.attachments.map((attachment) => ({
      name: attachment.name,
      mimeType: attachment.mimeType,
      byteLength: attachment.byteLength,
      sha256: attachment.sha256,
    })),
  };
}

/**
 * Validate recipients and exact attachment bytes, then bind the complete draft
 * to a preview digest. Nothing is persisted or sent.
 */
export async function prepareEmailPreview(
  input: EmailDraft,
  now: Date = new Date(),
): Promise<PreparationResult<EmailPreview>> {
  if (!Number.isFinite(now.getTime())) return { ok: false, reason: "The preview time is invalid." };
  const from = normaliseAddress(input.from);
  if (!from) return { ok: false, reason: "The sender address is invalid." };
  if (
    !Array.isArray(input.to) ||
    !Array.isArray(input.cc ?? []) ||
    !Array.isArray(input.bcc ?? []) ||
    !Array.isArray(input.verifiedRecipients)
  ) {
    return { ok: false, reason: "The recipient lists are malformed." };
  }
  const groups = [input.to, input.cc ?? [], input.bcc ?? []];
  const normalisedGroups: string[][] = [];
  for (const group of groups) {
    const addresses = group.map(normaliseAddress);
    if (addresses.some((address) => address === null)) {
      return { ok: false, reason: "At least one recipient address is invalid." };
    }
    normalisedGroups.push(addresses as string[]);
  }
  const [to, cc, bcc] = normalisedGroups;
  const allRecipients = [...to, ...cc, ...bcc];
  if (to.length === 0) return { ok: false, reason: "At least one To recipient is required." };
  if (allRecipients.length > MAX_RECIPIENTS) {
    return { ok: false, reason: `A message may have at most ${MAX_RECIPIENTS} recipients.` };
  }
  if (new Set(allRecipients).size !== allRecipients.length) {
    return {
      ok: false,
      reason: "A recipient appears more than once across To, Cc or Bcc.",
    };
  }
  const verified = new Set(
    input.verifiedRecipients
      .map(normaliseAddress)
      .filter((address): address is string => address !== null),
  );
  const unverified = allRecipients.filter((address) => !verified.has(address));
  if (unverified.length > 0) {
    return {
      ok: false,
      reason: `${unverified.length} recipient${unverified.length === 1 ? " is" : "s are"} not verified for this send.`,
    };
  }
  if (input.subject.length > 998 || input.body.length > MAX_BODY_LENGTH) {
    return { ok: false, reason: "The subject or message body is too large." };
  }

  const attachments: NormalisedEmailAttachment[] = [];
  for (const attachment of input.attachments ?? []) {
    const checked = await validateAttachment(attachment);
    if (!checked.ok) return checked;
    attachments.push(checked.data);
  }
  const attachmentBytes = attachments.reduce(
    (total, attachment) => total + attachment.byteLength,
    0,
  );
  if (attachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    return { ok: false, reason: "The message has more than 50 MiB of attachments." };
  }

  const draft: NormalisedEmailDraft = {
    from,
    to,
    cc,
    bcc,
    subject: input.subject,
    body: input.body,
    attachments,
  };
  const previewHash = await digestText(canonical(previewPayload(draft)));
  const expiresAt = new Date(now.getTime() + PREVIEW_TTL_MS);
  const warnings = sensitiveCategories(input.subject, input.body);
  return {
    ok: true,
    data: {
      draft,
      previewHash,
      preparedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      warnings,
      recipientCount: allRecipients.length,
      attachmentCount: attachments.length,
      attachmentBytes,
    },
    evidence: `Previewed ${allRecipients.length} verified recipient${allRecipients.length === 1 ? "" : "s"} and ${attachments.length} approved attachment${attachments.length === 1 ? "" : "s"}; nothing was sent.`,
  };
}

/**
 * Creates the immutable grant after the UI has displayed the preview and the
 * user explicitly confirms it. Callers must not invoke this pre-emptively.
 */
export function bindPreviewConfirmation(
  preview: Pick<EmailPreview, "previewHash" | "expiresAt">,
  now: Date = new Date(),
): PreparationResult<BoundConfirmation> {
  const confirmed = now.getTime();
  const expires = Date.parse(preview.expiresAt);
  if (!Number.isFinite(confirmed) || !Number.isFinite(expires) || confirmed >= expires) {
    return { ok: false, reason: "That preview has expired and must be reviewed again." };
  }
  return {
    ok: true,
    data: {
      previewHash: preview.previewHash,
      confirmedAt: now.toISOString(),
      expiresAt: preview.expiresAt,
    },
    evidence: "Confirmation was bound to the exact preview digest.",
  };
}

export interface EmailBrowserFallback {
  url: string;
  authenticatedByUser: boolean;
  policy: SitePolicy;
  targets?: Partial<
    Record<"to" | "cc" | "bcc" | "subject" | "body" | "attachment" | "send", BrowserTarget>
  >;
  pageSummary?: PageSummary;
  sentEvidence: BrowserVerificationExpectation;
}

export interface EmailSendReceipt {
  runId: string;
  route: EmailConnectorRoute | "dom";
  providerId: string;
  previewHash: string;
  status: "failed" | "cancelled" | "completed_unverified" | "completed_verified";
  recipientCount: number;
  attachmentCount: number;
  draftId?: string;
  providerReceiptId?: string;
  messageId?: string;
  sentAt?: string;
  evidence: string[];
  recordedAt: string;
}

export interface EmailSendResult {
  ok: boolean;
  routeDecision?: UniversalRouteDecision;
  receipt: EmailSendReceipt;
}

type BrowserRunner = typeof runBrowserAction;

function failedEmailReceipt(input: {
  runId: string;
  preview: EmailPreview;
  route?: EmailSendReceipt["route"];
  providerId?: string;
  status?: EmailSendReceipt["status"];
  evidence: string[];
  now: Date;
}): EmailSendResult {
  return {
    ok: false,
    receipt: {
      runId: input.runId,
      route: input.route ?? "dom",
      providerId: input.providerId ?? "unavailable",
      previewHash: input.preview.previewHash,
      status: input.status ?? "failed",
      recipientCount: input.preview.recipientCount,
      attachmentCount: input.preview.attachmentCount,
      evidence: input.evidence,
      recordedAt: input.now.toISOString(),
    },
  };
}

function connectorCandidate(
  status: EmailConnectorStatus,
  previewedSender: string,
): UniversalRouteCandidate {
  const accountMatches =
    status.accountAddress !== undefined &&
    normaliseAddress(status.accountAddress) === previewedSender;
  return {
    candidateId: `email-${status.providerId}-${status.route}`,
    route: status.route,
    interfaceId: status.providerId,
    available: status.available && status.authenticated && accountMatches,
    officialOrApproved: status.officialOrApproved,
    supportedAppIds: ["ocade.email"],
    versionPrefixes: [EMAIL_PROTOCOL_VERSION],
    taskTypes: ["email.send"],
    requiredPermissions: ["email.send"],
    confidence: 0.99,
    expectedLatencyMs: 1_000,
    verification: { route: status.route, confidence: 0.99, independent: true },
    recovery: { route: status.route, ready: true },
    health: status.available && accountMatches ? "healthy" : "failing",
    supportsRecording: true,
    evidence: accountMatches
      ? status.evidence
      : `${status.evidence} The authenticated account does not match the previewed sender.`,
  };
}

function browserCandidate(
  available: boolean,
  authenticatedByUser: boolean,
): UniversalRouteCandidate {
  return {
    candidateId: "email-browser-dom",
    route: "dom",
    interfaceId: "ocade.managed-browser",
    available: available && authenticatedByUser,
    officialOrApproved: true,
    supportedAppIds: ["ocade.email"],
    versionPrefixes: [EMAIL_PROTOCOL_VERSION],
    taskTypes: ["email.send"],
    requiredPermissions: ["email.send", "site.fill"],
    confidence: 0.95,
    expectedLatencyMs: 4_000,
    verification: { route: "dom", confidence: 0.92, independent: true },
    recovery: { route: "dom", ready: true },
    health: available ? "healthy" : "failing",
    supportsRecording: true,
    evidence:
      "OCADE-managed Playwright/CDP session with per-origin fill permission and post-submit observation.",
  };
}

async function currentPreviewMatches(preview: EmailPreview): Promise<boolean> {
  for (const attachment of preview.draft.attachments) {
    const checked = await validateAttachment(attachment);
    if (!checked.ok) return false;
  }
  return (await digestText(canonical(previewPayload(preview.draft)))) === preview.previewHash;
}

function confirmationValid(
  preview: Pick<EmailPreview, "previewHash" | "preparedAt" | "expiresAt">,
  confirmation: BoundConfirmation,
  now: Date,
): boolean {
  const previewExpiry = Date.parse(preview.expiresAt);
  const confirmationExpiry = Date.parse(confirmation.expiresAt);
  const confirmedAt = Date.parse(confirmation.confirmedAt);
  return (
    confirmation.previewHash === preview.previewHash &&
    confirmation.expiresAt === preview.expiresAt &&
    Number.isFinite(confirmedAt) &&
    Number.isFinite(previewExpiry) &&
    confirmationExpiry === previewExpiry &&
    confirmedAt >= Date.parse(preview.preparedAt) &&
    confirmedAt < previewExpiry &&
    now.getTime() < previewExpiry
  );
}

function field(
  name: string,
  value: string,
  target: BrowserTarget | undefined,
): { name: string; value: string; target?: BrowserTarget } {
  return target ? { name, value, target } : { name, value };
}

async function sendViaBrowser(input: {
  runId: string;
  preview: EmailPreview;
  browser: EmailBrowserFallback;
  runner: BrowserRunner;
  signal?: AbortSignal;
  now: Date;
}): Promise<EmailSendResult> {
  const { draft } = input.preview;
  if (!input.browser.authenticatedByUser) {
    return failedEmailReceipt({
      runId: input.runId,
      preview: input.preview,
      evidence: [
        "The mail site is not already authenticated by the user. OCADE will not enter passwords, OTPs or recovery data.",
      ],
      now: input.now,
    });
  }
  if (input.browser.pageSummary && hasProtectedFields(input.browser.pageSummary)) {
    return failedEmailReceipt({
      runId: input.runId,
      preview: input.preview,
      evidence: [
        "A protected authentication, payment or verification field is present. The user must complete that page personally.",
      ],
      now: input.now,
    });
  }

  const evidence: string[] = [];
  const fields = [
    field("to", draft.to.join(", "), input.browser.targets?.to),
    ...(draft.cc.length > 0 ? [field("cc", draft.cc.join(", "), input.browser.targets?.cc)] : []),
    ...(draft.bcc.length > 0
      ? [field("bcc", draft.bcc.join(", "), input.browser.targets?.bcc)]
      : []),
    field("subject", draft.subject, input.browser.targets?.subject),
    field("body", draft.body, input.browser.targets?.body),
  ];
  const fill = await input.runner(
    { kind: "form.fill", url: input.browser.url, fields },
    input.browser.policy,
    {
      runId: input.runId,
      operationId: `${input.runId}:compose`,
      confirmed: true,
      signal: input.signal,
      verification: {
        fields: fields.map(({ name, value }) => ({ name, value })),
      },
    },
  );
  evidence.push(fill.receipt.executionEvidence);
  if (!fill.ok) {
    evidence.push(fill.receipt.verificationEvidence ?? "Composition was not verified.");
    return failedEmailReceipt({
      runId: input.runId,
      preview: input.preview,
      evidence,
      now: input.now,
    });
  }

  for (const [index, attachment] of draft.attachments.entries()) {
    const uploaded = await input.runner(
      {
        kind: "upload",
        url: input.browser.url,
        path: attachment.name,
        target: input.browser.targets?.attachment ?? { name: "attachment" },
      },
      input.browser.policy,
      {
        runId: input.runId,
        operationId: `${input.runId}:attachment:${index}`,
        confirmed: true,
        signal: input.signal,
        fileHandoff: {
          name: attachment.name,
          mimeType: attachment.mimeType,
          dataBase64: attachment.dataBase64,
          sha256: attachment.sha256,
        },
        verification: { text: attachment.name },
      },
    );
    evidence.push(uploaded.receipt.executionEvidence);
    if (!uploaded.ok) {
      evidence.push(uploaded.receipt.verificationEvidence ?? "Attachment upload was not verified.");
      return failedEmailReceipt({
        runId: input.runId,
        preview: input.preview,
        evidence,
        now: input.now,
      });
    }
  }

  if (input.signal?.aborted) {
    return failedEmailReceipt({
      runId: input.runId,
      preview: input.preview,
      status: "cancelled",
      evidence: [...evidence, "The send was cancelled before submission."],
      now: input.now,
    });
  }
  const submitted = await input.runner(
    {
      kind: "form.submit",
      url: input.browser.url,
      consequential: true,
      target: input.browser.targets?.send ?? { role: "button", name: "Send" },
    },
    input.browser.policy,
    {
      runId: input.runId,
      operationId: `${input.runId}:send`,
      confirmed: true,
      signal: input.signal,
      pageSummary: input.browser.pageSummary,
      verification: input.browser.sentEvidence,
    },
  );
  evidence.push(submitted.receipt.executionEvidence);
  if (submitted.receipt.verificationEvidence) {
    evidence.push(submitted.receipt.verificationEvidence);
  }
  return {
    ok: submitted.receipt.status === "completed_verified",
    receipt: {
      runId: input.runId,
      route: "dom",
      providerId: "ocade.managed-browser",
      previewHash: input.preview.previewHash,
      status: submitted.receipt.status,
      recipientCount: input.preview.recipientCount,
      attachmentCount: input.preview.attachmentCount,
      evidence,
      recordedAt: input.now.toISOString(),
    },
  };
}

/**
 * Send through the strongest adequate interface. A connector failure after a
 * draft or send attempt never falls through to the browser because doing so
 * could duplicate an email whose first outcome is unknown.
 */
export async function executeEmailSend(input: {
  runId: string;
  preview: EmailPreview;
  confirmation: BoundConfirmation;
  connector?: EmailConnector | null;
  browser?: EmailBrowserFallback;
  browserRunner?: BrowserRunner;
  signal?: AbortSignal;
  now?: Date;
}): Promise<EmailSendResult> {
  const now = input.now ?? new Date();
  if (!SAFE_ID.test(input.runId) || !Number.isFinite(now.getTime())) {
    return failedEmailReceipt({
      runId: input.runId,
      preview: input.preview,
      evidence: ["The send run id or time is invalid."],
      now: Number.isFinite(now.getTime()) ? now : new Date(0),
    });
  }
  if (input.signal?.aborted) {
    return failedEmailReceipt({
      runId: input.runId,
      preview: input.preview,
      status: "cancelled",
      evidence: ["The send was cancelled before execution."],
      now,
    });
  }
  if (!confirmationValid(input.preview, input.confirmation, now)) {
    return failedEmailReceipt({
      runId: input.runId,
      preview: input.preview,
      evidence: ["The confirmation is missing, expired or bound to another preview."],
      now,
    });
  }
  if (!(await currentPreviewMatches(input.preview))) {
    return failedEmailReceipt({
      runId: input.runId,
      preview: input.preview,
      evidence: ["The draft or an attachment changed after preview; review it again."],
      now,
    });
  }

  const connector = input.connector === undefined ? installedEmailConnector : input.connector;
  let connectorStatus: EmailConnectorStatus | null = null;
  if (connector) {
    try {
      connectorStatus = await connector.status();
    } catch {
      connectorStatus = null;
    }
  }
  const browserStatus = input.browser
    ? await getBrowserBridge()
        .status()
        .catch(() => ({ available: false }))
    : { available: false };
  const candidates: UniversalRouteCandidate[] = [];
  if (connectorStatus) {
    candidates.push(connectorCandidate(connectorStatus, input.preview.draft.from));
  }
  if (input.browser) {
    candidates.push(browserCandidate(browserStatus.available, input.browser.authenticatedByUser));
  }
  if (candidates.length === 0) {
    return failedEmailReceipt({
      runId: input.runId,
      preview: input.preview,
      evidence: ["No approved email connector or paired browser route is configured."],
      now,
    });
  }

  const selected = selectUniversalRoute({
    appIdentity: {
      appId: "ocade.email",
      product: "OCADE email workflow",
      version: EMAIL_PROTOCOL_VERSION,
    },
    taskType: "email.send",
    risk: "high",
    grantedPermissions: ["email.send", "site.fill"],
    recordingPreference: "video_on",
    candidates,
  });
  if (!selected.ok) {
    return failedEmailReceipt({
      runId: input.runId,
      preview: input.preview,
      evidence: [selected.reason, ...selected.evaluations.flatMap((row) => row.reasons)],
      now,
    });
  }

  if (selected.data.route === "dom") {
    const result = await sendViaBrowser({
      runId: input.runId,
      preview: input.preview,
      browser: input.browser!,
      runner: input.browserRunner ?? runBrowserAction,
      signal: input.signal,
      now,
    });
    return { ...result, routeDecision: selected.data };
  }

  if (!connector || !connectorStatus) {
    return failedEmailReceipt({
      runId: input.runId,
      preview: input.preview,
      route: selected.data.route as EmailConnectorRoute,
      evidence: ["The selected connector disappeared before execution."],
      now,
    });
  }
  const account = connectorStatus.accountAddress
    ? normaliseAddress(connectorStatus.accountAddress)
    : null;
  if (!account || account !== input.preview.draft.from) {
    return failedEmailReceipt({
      runId: input.runId,
      preview: input.preview,
      route: connectorStatus.route,
      providerId: connectorStatus.providerId,
      evidence: ["The authenticated connector account does not match the previewed sender."],
      now,
    });
  }

  const evidence = [...selected.data.evidence];
  let drafted: EmailConnectorDraftResult;
  try {
    drafted = await connector.createDraft(input.preview.draft, {
      idempotencyKey: `${input.preview.previewHash}:draft`,
      signal: input.signal,
    });
  } catch (error) {
    drafted = {
      ok: false,
      evidence:
        error instanceof Error
          ? `Connector draft creation failed: ${error.message}`
          : "Connector draft creation failed unexpectedly.",
    };
  }
  evidence.push(drafted.evidence);
  if (!drafted.ok || !drafted.draftId) {
    return {
      ...failedEmailReceipt({
        runId: input.runId,
        preview: input.preview,
        route: connectorStatus.route,
        providerId: connectorStatus.providerId,
        evidence,
        now,
      }),
      routeDecision: selected.data,
    };
  }
  if (input.signal?.aborted) {
    return {
      ...failedEmailReceipt({
        runId: input.runId,
        preview: input.preview,
        route: connectorStatus.route,
        providerId: connectorStatus.providerId,
        status: "cancelled",
        evidence: [...evidence, "The send was cancelled after draft creation and before sending."],
        now,
      }),
      routeDecision: selected.data,
    };
  }
  let sent: EmailConnectorSendResult;
  try {
    sent = await connector.sendDraft(drafted.draftId, {
      idempotencyKey: `${input.preview.previewHash}:send`,
      signal: input.signal,
    });
  } catch (error) {
    sent = {
      ok: false,
      evidence:
        error instanceof Error
          ? `Connector send failed before a receipt was returned: ${error.message}`
          : "Connector send failed before a receipt was returned.",
    };
  }
  evidence.push(sent.evidence);
  if (!sent.ok || !sent.receiptId) {
    return {
      ...failedEmailReceipt({
        runId: input.runId,
        preview: input.preview,
        route: connectorStatus.route,
        providerId: connectorStatus.providerId,
        evidence: [
          ...evidence,
          "No fallback was attempted because the connector send outcome may be ambiguous.",
        ],
        now,
      }),
      routeDecision: selected.data,
    };
  }
  let verified: EmailConnectorVerification;
  try {
    verified = await connector.verifySent(sent.receiptId, input.signal);
  } catch (error) {
    verified = {
      ok: false,
      verified: false,
      evidence:
        error instanceof Error
          ? `Provider receipt verification failed: ${error.message}`
          : "Provider receipt verification failed unexpectedly.",
    };
  }
  evidence.push(verified.evidence);
  const status = verified.verified ? "completed_verified" : "completed_unverified";
  return {
    ok: verified.verified,
    routeDecision: selected.data,
    receipt: {
      runId: input.runId,
      route: connectorStatus.route,
      providerId: connectorStatus.providerId,
      previewHash: input.preview.previewHash,
      status,
      recipientCount: input.preview.recipientCount,
      attachmentCount: input.preview.attachmentCount,
      draftId: drafted.draftId,
      providerReceiptId: sent.receiptId,
      ...(verified.messageId ? { messageId: verified.messageId } : {}),
      ...(verified.sentAt ? { sentAt: verified.sentAt } : {}),
      evidence,
      recordedAt: now.toISOString(),
    },
  };
}

export interface WebWorkStep {
  action: BrowserAction;
  verification?: BrowserVerificationExpectation;
  file?: EmailAttachment;
}

export interface WebWorkPreview {
  runId: string;
  url: string;
  origin: string;
  steps: WebWorkStep[];
  previewHash: string;
  preparedAt: string;
  expiresAt: string;
}

function webStepPayload(step: WebWorkStep) {
  return {
    action: step.action,
    verification: step.verification ?? null,
    file: step.file
      ? {
          name: step.file.name,
          mimeType: step.file.mimeType,
          byteLength: step.file.byteLength,
          sha256: step.file.sha256.toLowerCase(),
        }
      : null,
  };
}

/** Validate an authenticated web edit/upload/download plan without executing it. */
export async function prepareWebWork(
  input: { runId: string; url: string; steps: WebWorkStep[] },
  now: Date = new Date(),
): Promise<PreparationResult<WebWorkPreview>> {
  const origin = originOf(input.url);
  if (
    !SAFE_ID.test(input.runId) ||
    !origin ||
    !Number.isFinite(now.getTime()) ||
    !Array.isArray(input.steps) ||
    input.steps.length === 0 ||
    input.steps.length > 100
  ) {
    return { ok: false, reason: "The web-work plan is malformed or unbounded." };
  }
  for (const step of input.steps) {
    if (!("url" in step.action) || originOf(step.action.url) !== origin) {
      return { ok: false, reason: "Every web-work step must stay on the previewed origin." };
    }
    if (step.action.kind === "form.fill") {
      if (
        step.action.fields.some(
          (item) => isProtectedField(item.name) || isProtectedText(item.value),
        )
      ) {
        return {
          ok: false,
          reason:
            "Protected passwords, OTPs, payment or identity input must be entered by the user.",
        };
      }
    }
    const fileAction = step.action.kind === "upload" || step.action.kind === "drop";
    if (fileAction !== Boolean(step.file)) {
      return {
        ok: false,
        reason: fileAction
          ? "Every upload or drop needs exact approved file bytes."
          : "File bytes were attached to a step that cannot use them.",
      };
    }
    if (step.file) {
      const checked = await validateAttachment(step.file);
      if (!checked.ok) return checked;
    }
    const mutation = !["dom.read", "a11y.read", "page.wait"].includes(step.action.kind);
    if (mutation && !step.verification) {
      return {
        ok: false,
        reason: `The ${step.action.kind} step has no independent verification expectation.`,
      };
    }
  }
  const payload = {
    runId: input.runId,
    url: input.url,
    steps: input.steps.map(webStepPayload),
  };
  const previewHash = await digestText(canonical(payload));
  return {
    ok: true,
    data: {
      ...input,
      origin,
      previewHash,
      preparedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + PREVIEW_TTL_MS).toISOString(),
    },
    evidence: `Previewed ${input.steps.length} bounded web step${input.steps.length === 1 ? "" : "s"} on ${origin}; nothing was changed.`,
  };
}

export interface WebWorkResult {
  ok: boolean;
  status: "failed" | "cancelled" | "completed_unverified" | "completed_verified";
  receipts: BrowserActionReceipt[];
  evidence: string[];
}

/** Execute a previewed plan only in a browser session the user authenticated. */
export async function executeWebWork(input: {
  preview: WebWorkPreview;
  confirmation: BoundConfirmation;
  authenticatedByUser: boolean;
  policy: SitePolicy;
  pageSummary?: PageSummary;
  browserRunner?: BrowserRunner;
  signal?: AbortSignal;
  now?: Date;
}): Promise<WebWorkResult> {
  const now = input.now ?? new Date();
  const receipts: BrowserActionReceipt[] = [];
  const evidence: string[] = [];
  if (!input.authenticatedByUser) {
    return {
      ok: false,
      status: "failed",
      receipts,
      evidence: ["The user has not authenticated this browser session."],
    };
  }
  if (!confirmationValid(input.preview, input.confirmation, now)) {
    return {
      ok: false,
      status: "failed",
      receipts,
      evidence: ["The web-work confirmation is missing, expired or stale."],
    };
  }
  const actualHash = await digestText(
    canonical({
      runId: input.preview.runId,
      url: input.preview.url,
      steps: input.preview.steps.map(webStepPayload),
    }),
  );
  if (actualHash !== input.preview.previewHash) {
    return {
      ok: false,
      status: "failed",
      receipts,
      evidence: ["The web-work plan changed after preview."],
    };
  }
  if (
    input.pageSummary &&
    hasProtectedFields(input.pageSummary) &&
    input.preview.steps.some((step) => step.action.kind === "form.submit")
  ) {
    return {
      ok: false,
      status: "failed",
      receipts,
      evidence: ["A protected submission is present and must remain user-controlled."],
    };
  }

  const runner = input.browserRunner ?? runBrowserAction;
  for (const [index, step] of input.preview.steps.entries()) {
    if (input.signal?.aborted) {
      return {
        ok: false,
        status: "cancelled",
        receipts,
        evidence: [...evidence, "The web-work run was cancelled before the next step."],
      };
    }
    const fileHandoff: BrowserFileHandoff | undefined = step.file
      ? {
          name: step.file.name,
          mimeType: step.file.mimeType,
          dataBase64: step.file.dataBase64,
          sha256: step.file.sha256,
        }
      : undefined;
    const result = await runner(step.action, input.policy, {
      runId: input.preview.runId,
      operationId: `${input.preview.runId}:${index}:${step.action.kind}`,
      confirmed: true,
      pageSummary: input.pageSummary,
      signal: input.signal,
      fileHandoff,
      verification: step.verification,
      now,
    });
    receipts.push(result.receipt);
    evidence.push(result.receipt.executionEvidence);
    if (result.receipt.verificationEvidence) {
      evidence.push(result.receipt.verificationEvidence);
    }
    if (!result.ok) {
      return {
        ok: false,
        status:
          result.receipt.status === "completed_unverified" ? "completed_unverified" : "failed",
        receipts,
        evidence,
      };
    }
  }
  return {
    ok: true,
    status: "completed_verified",
    receipts,
    evidence,
  };
}
