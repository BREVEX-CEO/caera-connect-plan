import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bindPreviewConfirmation,
  executeEmailSend,
  executeWebWork,
  prepareEmailPreview,
  prepareWebWork,
  setEmailConnector,
  type EmailAttachment,
  type EmailConnector,
  type EmailConnectorStatus,
  type EmailDraft,
} from "../control/email-web-work";
import {
  DEFAULT_SITE_POLICY,
  setBrowserBridge,
  UnavailableBrowserBridge,
  type BrowserAction,
  type BrowserRunResult,
  type SitePolicy,
} from "../native/browser-bridge";
import type { PageSummary } from "../native/extension-protocol";

const ORIGIN = "https://mail.example.test";
const NOW = new Date("2026-07-26T08:00:00.000Z");
const HELLO: EmailAttachment = {
  name: "report.txt",
  mimeType: "text/plain",
  dataBase64: "aGVsbG8=",
  byteLength: 5,
  sha256: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  approved: true,
};

const POLICY: SitePolicy = {
  ...DEFAULT_SITE_POLICY,
  allowOrigins: [ORIGIN],
  readOrigins: [ORIGIN],
  fillOrigins: [ORIGIN],
};

function draft(overrides: Partial<EmailDraft> = {}): EmailDraft {
  return {
    from: "owner@example.test",
    to: ["person@example.test"],
    subject: "Quarterly report",
    body: "Please review the attached report.",
    attachments: [HELLO],
    verifiedRecipients: ["person@example.test"],
    ...overrides,
  };
}

function status(overrides: Partial<EmailConnectorStatus> = {}): EmailConnectorStatus {
  return {
    available: true,
    authenticated: true,
    providerId: "fixture-mail",
    accountAddress: "owner@example.test",
    route: "api",
    officialOrApproved: true,
    evidence: "Fixture OAuth connector passed its health check.",
    ...overrides,
  };
}

function connector(overrides: Partial<EmailConnector> = {}): EmailConnector {
  return {
    status: vi.fn(async () => status()),
    createDraft: vi.fn(async () => ({
      ok: true,
      draftId: "draft-1",
      evidence: "Draft stored by connector.",
    })),
    sendDraft: vi.fn(async () => ({
      ok: true,
      receiptId: "receipt-1",
      evidence: "Connector accepted the send.",
    })),
    verifySent: vi.fn(async () => ({
      ok: true,
      verified: true,
      messageId: "message-1",
      sentAt: "2026-07-26T08:01:00.000Z",
      evidence: "Sent-folder lookup matched the provider receipt.",
    })),
    ...overrides,
  };
}

function verifiedResult(action: BrowserAction): BrowserRunResult {
  return {
    ok: true,
    result: { ok: true, detail: `${action.kind} executed.` },
    receipt: {
      runId: "run-browser",
      operationId: `operation:${action.kind}`,
      action: action.kind,
      origin: "url" in action ? ORIGIN : null,
      status: "completed_verified",
      executionEvidence: `${action.kind} executed.`,
      verificationEvidence: `${action.kind} independently observed.`,
      recordedAt: NOW.toISOString(),
    },
  };
}

function installAvailableBrowser() {
  setBrowserBridge({
    status: async () => ({ available: true }),
    perform: async () => ({ ok: false, detail: "Tests inject a controlled runner." }),
  });
}

afterEach(() => {
  setEmailConnector(null);
  setBrowserBridge(new UnavailableBrowserBridge());
});

describe("email preview and confirmation", () => {
  it("normalises verified recipients, verifies attachment bytes and warns without sending", async () => {
    const result = await prepareEmailPreview(
      draft({
        from: " Owner@Example.Test ",
        to: [" PERSON@example.test "],
        body: "This contains medical record information and legal advice.",
      }),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data.draft.from).toBe("owner@example.test");
    expect(result.data.draft.to).toEqual(["person@example.test"]);
    expect(result.data.draft.attachments[0].sha256).toBe(HELLO.sha256);
    expect(result.data.warnings).toEqual(["health", "legal"]);
    expect(result.data.previewHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.evidence).toMatch(/nothing was sent/i);
  });

  it("refuses unverified or duplicate recipients and changed attachments", async () => {
    expect(await prepareEmailPreview(draft({ verifiedRecipients: [] }), NOW)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/not verified/i),
    });
    expect(await prepareEmailPreview(draft({ cc: ["person@example.test"] }), NOW)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/more than once/i),
    });
    expect(
      await prepareEmailPreview(
        draft({ attachments: [{ ...HELLO, dataBase64: "d29ybGQ=" }] }),
        NOW,
      ),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/changed/i) });
  });

  it("expires the preview and binds confirmation to its exact digest", async () => {
    const prepared = await prepareEmailPreview(draft(), NOW);
    if (!prepared.ok) throw new Error(prepared.reason);
    expect(
      bindPreviewConfirmation(prepared.data, new Date("2026-07-26T08:16:00.000Z")),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/expired/i) });
    const confirmation = bindPreviewConfirmation(
      prepared.data,
      new Date("2026-07-26T08:01:00.000Z"),
    );
    expect(confirmation).toMatchObject({
      ok: true,
      data: { previewHash: prepared.data.previewHash },
    });
  });
});

describe("connector-first email execution", () => {
  it("creates a draft, sends once, and requires a provider receipt verification", async () => {
    const prepared = await prepareEmailPreview(draft(), NOW);
    if (!prepared.ok) throw new Error(prepared.reason);
    const confirmation = bindPreviewConfirmation(
      prepared.data,
      new Date("2026-07-26T08:01:00.000Z"),
    );
    if (!confirmation.ok) throw new Error(confirmation.reason);
    const mail = connector();
    const browserRunner = vi.fn(async (action: BrowserAction) => verifiedResult(action));

    const result = await executeEmailSend({
      runId: "email-run",
      preview: prepared.data,
      confirmation: confirmation.data,
      connector: mail,
      browser: {
        url: `${ORIGIN}/compose`,
        authenticatedByUser: true,
        policy: POLICY,
        sentEvidence: { text: "sent" },
      },
      browserRunner,
      now: new Date("2026-07-26T08:02:00.000Z"),
    });

    expect(result.ok).toBe(true);
    expect(result.routeDecision?.route).toBe("api");
    expect(result.receipt).toMatchObject({
      status: "completed_verified",
      providerReceiptId: "receipt-1",
      messageId: "message-1",
    });
    expect(mail.createDraft).toHaveBeenCalledOnce();
    expect(mail.sendDraft).toHaveBeenCalledOnce();
    expect(mail.verifySent).toHaveBeenCalledOnce();
    expect(browserRunner).not.toHaveBeenCalled();
  });

  it("never browser-falls back after an ambiguous connector send failure", async () => {
    const prepared = await prepareEmailPreview(draft(), NOW);
    if (!prepared.ok) throw new Error(prepared.reason);
    const confirmation = bindPreviewConfirmation(prepared.data, new Date(NOW.getTime() + 1_000));
    if (!confirmation.ok) throw new Error(confirmation.reason);
    const mail = connector({
      sendDraft: vi.fn(async () => ({
        ok: false,
        evidence: "Provider connection closed before a receipt arrived.",
      })),
    });
    installAvailableBrowser();
    const browserRunner = vi.fn(async (action: BrowserAction) => verifiedResult(action));

    const result = await executeEmailSend({
      runId: "email-ambiguous",
      preview: prepared.data,
      confirmation: confirmation.data,
      connector: mail,
      browser: {
        url: `${ORIGIN}/compose`,
        authenticatedByUser: true,
        policy: POLICY,
        sentEvidence: { text: "sent" },
      },
      browserRunner,
      now: new Date(NOW.getTime() + 2_000),
    });
    expect(result.ok).toBe(false);
    expect(result.receipt.evidence.join(" ")).toMatch(/No fallback/i);
    expect(browserRunner).not.toHaveBeenCalled();
  });

  it("routes around a connector authenticated as the wrong sender before any mutation", async () => {
    const prepared = await prepareEmailPreview(draft(), NOW);
    if (!prepared.ok) throw new Error(prepared.reason);
    const confirmation = bindPreviewConfirmation(prepared.data, new Date(NOW.getTime() + 1_000));
    if (!confirmation.ok) throw new Error(confirmation.reason);
    const wrongAccount = connector({
      status: vi.fn(async () => status({ accountAddress: "other@example.test" })),
    });
    installAvailableBrowser();
    const browserRunner = vi.fn(async (action: BrowserAction) => verifiedResult(action));
    const result = await executeEmailSend({
      runId: "email-account-mismatch",
      preview: prepared.data,
      confirmation: confirmation.data,
      connector: wrongAccount,
      browser: {
        url: `${ORIGIN}/compose`,
        authenticatedByUser: true,
        policy: POLICY,
        sentEvidence: { text: "sent" },
      },
      browserRunner,
      now: new Date(NOW.getTime() + 2_000),
    });
    expect(result.ok).toBe(true);
    expect(result.routeDecision).toMatchObject({ route: "dom", fallbackFrom: ["api"] });
    expect(wrongAccount.createDraft).not.toHaveBeenCalled();
    expect(browserRunner).toHaveBeenCalled();
  });

  it("turns connector exceptions into an honest failure without throwing or duplicating", async () => {
    const prepared = await prepareEmailPreview(draft(), NOW);
    if (!prepared.ok) throw new Error(prepared.reason);
    const confirmation = bindPreviewConfirmation(prepared.data, new Date(NOW.getTime() + 1_000));
    if (!confirmation.ok) throw new Error(confirmation.reason);
    const broken = connector({
      createDraft: vi.fn(async () => {
        throw new Error("provider timeout");
      }),
    });
    const result = await executeEmailSend({
      runId: "email-provider-error",
      preview: prepared.data,
      confirmation: confirmation.data,
      connector: broken,
      now: new Date(NOW.getTime() + 2_000),
    });
    expect(result.ok).toBe(false);
    expect(result.receipt.evidence.join(" ")).toMatch(/provider timeout/i);
    expect(broken.sendDraft).not.toHaveBeenCalled();
  });

  it("falls back to an already-authenticated paired browser and verifies fill, upload and send", async () => {
    const prepared = await prepareEmailPreview(draft(), NOW);
    if (!prepared.ok) throw new Error(prepared.reason);
    const confirmation = bindPreviewConfirmation(prepared.data, new Date(NOW.getTime() + 1_000));
    if (!confirmation.ok) throw new Error(confirmation.reason);
    const unavailable = connector({
      status: vi.fn(async () =>
        status({ available: false, authenticated: false, evidence: "OAuth disconnected." }),
      ),
    });
    installAvailableBrowser();
    const actions: BrowserAction[] = [];
    const browserRunner = vi.fn(async (action: BrowserAction) => {
      actions.push(action);
      return verifiedResult(action);
    });

    const result = await executeEmailSend({
      runId: "email-browser",
      preview: prepared.data,
      confirmation: confirmation.data,
      connector: unavailable,
      browser: {
        url: `${ORIGIN}/compose`,
        authenticatedByUser: true,
        policy: POLICY,
        targets: { send: { role: "button", name: "Send" } },
        sentEvidence: { text: "Message sent" },
      },
      browserRunner,
      now: new Date(NOW.getTime() + 2_000),
    });
    expect(result.ok).toBe(true);
    expect(result.routeDecision?.route).toBe("dom");
    expect(actions.map((action) => action.kind)).toEqual(["form.fill", "upload", "form.submit"]);
    expect(result.receipt.status).toBe("completed_verified");
  });

  it("refuses browser authentication and protected submissions before touching the page", async () => {
    const prepared = await prepareEmailPreview(draft(), NOW);
    if (!prepared.ok) throw new Error(prepared.reason);
    const confirmation = bindPreviewConfirmation(prepared.data, new Date(NOW.getTime() + 1_000));
    if (!confirmation.ok) throw new Error(confirmation.reason);
    installAvailableBrowser();
    const browserRunner = vi.fn(async (action: BrowserAction) => verifiedResult(action));
    const base = {
      runId: "email-protected",
      preview: prepared.data,
      confirmation: confirmation.data,
      connector: null,
      browserRunner,
      now: new Date(NOW.getTime() + 2_000),
    };
    const unauthenticated = await executeEmailSend({
      ...base,
      browser: {
        url: `${ORIGIN}/compose`,
        authenticatedByUser: false,
        policy: POLICY,
        sentEvidence: { text: "sent" },
      },
    });
    expect(unauthenticated.ok).toBe(false);

    const protectedPage: PageSummary = {
      url: `${ORIGIN}/login`,
      title: "Sign in",
      headings: [],
      text: "",
      fields: [{ name: "password", type: "password", protected: true }],
      links: [],
    };
    const protectedResult = await executeEmailSend({
      ...base,
      browser: {
        url: `${ORIGIN}/login`,
        authenticatedByUser: true,
        policy: POLICY,
        pageSummary: protectedPage,
        sentEvidence: { text: "sent" },
      },
    });
    expect(protectedResult.ok).toBe(false);
    expect(protectedResult.receipt.evidence.join(" ")).toMatch(/protected/i);
    expect(browserRunner).not.toHaveBeenCalled();
  });

  it("refuses a stale confirmation and an attachment mutated after preview", async () => {
    const prepared = await prepareEmailPreview(draft(), NOW);
    if (!prepared.ok) throw new Error(prepared.reason);
    const confirmation = bindPreviewConfirmation(prepared.data, new Date(NOW.getTime() + 1_000));
    if (!confirmation.ok) throw new Error(confirmation.reason);
    const mail = connector();
    const stale = await executeEmailSend({
      runId: "email-stale",
      preview: prepared.data,
      confirmation: { ...confirmation.data, previewHash: "0".repeat(64) },
      connector: mail,
      now: new Date(NOW.getTime() + 2_000),
    });
    expect(stale.ok).toBe(false);
    expect(mail.createDraft).not.toHaveBeenCalled();

    prepared.data.draft.attachments[0].dataBase64 = "d29ybGQ=";
    const changed = await executeEmailSend({
      runId: "email-changed",
      preview: prepared.data,
      confirmation: confirmation.data,
      connector: mail,
      now: new Date(NOW.getTime() + 2_000),
    });
    expect(changed.ok).toBe(false);
    expect(changed.receipt.evidence.join(" ")).toMatch(/changed/i);
    expect(mail.createDraft).not.toHaveBeenCalled();
  });
});

describe("authenticated web editing, uploads and downloads", () => {
  it("refuses protected fields, cross-origin steps and unverified mutations at preview", async () => {
    expect(
      await prepareWebWork(
        {
          runId: "web-protected",
          url: `${ORIGIN}/edit`,
          steps: [
            {
              action: {
                kind: "form.fill",
                url: `${ORIGIN}/edit`,
                fields: [{ name: "otp", value: "123456" }],
              },
              verification: { text: "saved" },
            },
          ],
        },
        NOW,
      ),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/Protected/i) });
    expect(
      await prepareWebWork(
        {
          runId: "web-cross-origin",
          url: `${ORIGIN}/edit`,
          steps: [
            {
              action: { kind: "download", url: "https://other.test/file", filename: "x.txt" },
              verification: { text: "x.txt" },
            },
          ],
        },
        NOW,
      ),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/origin/i) });
    expect(
      await prepareWebWork(
        {
          runId: "web-unverified",
          url: `${ORIGIN}/edit`,
          steps: [
            {
              action: {
                kind: "form.fill",
                url: `${ORIGIN}/edit`,
                fields: [{ name: "title", value: "Safe title" }],
              },
            },
          ],
        },
        NOW,
      ),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/verification/i) });
  });

  it("executes a confirmed edit, upload and download and retains every verified receipt", async () => {
    const prepared = await prepareWebWork(
      {
        runId: "web-run",
        url: `${ORIGIN}/edit`,
        steps: [
          {
            action: {
              kind: "form.fill",
              url: `${ORIGIN}/edit`,
              fields: [{ name: "title", value: "Safe title" }],
            },
            verification: { fields: [{ name: "title", value: "Safe title" }] },
          },
          {
            action: {
              kind: "upload",
              url: `${ORIGIN}/edit`,
              path: HELLO.name,
              target: { name: "attachment" },
            },
            file: HELLO,
            verification: { text: HELLO.name },
          },
          {
            action: {
              kind: "download",
              url: `${ORIGIN}/edit`,
              filename: "export.pdf",
            },
            verification: { text: "export.pdf" },
          },
        ],
      },
      NOW,
    );
    if (!prepared.ok) throw new Error(prepared.reason);
    const confirmation = bindPreviewConfirmation(prepared.data, new Date(NOW.getTime() + 1_000));
    if (!confirmation.ok) throw new Error(confirmation.reason);
    const browserRunner = vi.fn(async (action: BrowserAction) => verifiedResult(action));
    const result = await executeWebWork({
      preview: prepared.data,
      confirmation: confirmation.data,
      authenticatedByUser: true,
      policy: POLICY,
      browserRunner,
      now: new Date(NOW.getTime() + 2_000),
    });
    expect(result).toMatchObject({
      ok: true,
      status: "completed_verified",
    });
    expect(result.receipts).toHaveLength(3);
    expect(browserRunner).toHaveBeenCalledTimes(3);
  });

  it("stops on an unverified browser mutation and never claims completion", async () => {
    const prepared = await prepareWebWork(
      {
        runId: "web-unverified-runtime",
        url: `${ORIGIN}/edit`,
        steps: [
          {
            action: {
              kind: "form.fill",
              url: `${ORIGIN}/edit`,
              fields: [{ name: "title", value: "Safe title" }],
            },
            verification: { text: "saved" },
          },
          {
            action: {
              kind: "download",
              url: `${ORIGIN}/edit`,
              filename: "should-not-run.pdf",
            },
            verification: { text: "should-not-run.pdf" },
          },
        ],
      },
      NOW,
    );
    if (!prepared.ok) throw new Error(prepared.reason);
    const confirmation = bindPreviewConfirmation(prepared.data, new Date(NOW.getTime() + 1_000));
    if (!confirmation.ok) throw new Error(confirmation.reason);
    const browserRunner = vi.fn(async (action: BrowserAction) => {
      const result = verifiedResult(action);
      result.ok = false;
      result.receipt.status = "completed_unverified";
      result.receipt.verificationEvidence = "The saved state did not match.";
      return result;
    });
    const result = await executeWebWork({
      preview: prepared.data,
      confirmation: confirmation.data,
      authenticatedByUser: true,
      policy: POLICY,
      browserRunner,
      now: new Date(NOW.getTime() + 2_000),
    });
    expect(result).toMatchObject({
      ok: false,
      status: "completed_unverified",
    });
    expect(browserRunner).toHaveBeenCalledOnce();
  });
});
