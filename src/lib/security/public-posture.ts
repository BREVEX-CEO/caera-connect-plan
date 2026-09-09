/**
 * WHAT OCADE IS ALLOWED TO SAY ABOUT ITS OWN SECURITY, AND WHAT IMPLEMENTS IT.
 *
 * PLAN.md §J requires a public `/security` surface and forbids a long list of
 * claims: SOC 2, ISO, "GDPR certified", HIPAA compliance, a penetration test,
 * zero incidents, badges. The forbidding is the easy half — a person can simply
 * not type those words. The hard half is the claim that was TRUE when it was
 * written and stopped being true when somebody refactored, because a security
 * page is the last place anyone thinks to update.
 *
 * So every statement here carries `implementedBy`: the modules a reader could
 * open to check it. `public-security-claims.test.ts` asserts each named file
 * exists and still contains the specific thing the claim depends on. A
 * protection that is removed takes the sentence advertising it down with it,
 * which is the only version of this page that stays honest by itself.
 *
 * EVERY STATEMENT BELOW WAS READ IN THE SOURCE BEFORE IT WAS WRITTEN DOWN, and
 * several are narrower than the obvious version because the obvious version was
 * an overclaim — "IndexedDB is encrypted" is not true of the metadata, and
 * saying it plainly is worth more than the stronger sentence.
 */

export interface SecurityStatement {
  /** The short claim, shown in bold. */
  claim: string;
  /** What it actually means, including what it does NOT cover. */
  detail: string;
  /** Files a reader — or a test — can check the claim against. */
  implementedBy: readonly string[];
  /** A string the implementation must still contain for the claim to hold. */
  evidence: readonly string[];
}

export interface SecurityGroup {
  id: string;
  title: string;
  statements: readonly SecurityStatement[];
  /** Said out loud rather than left for somebody to discover. */
  limitation?: string;
}

export const SECURITY_POSTURE: readonly SecurityGroup[] = [
  {
    id: "in-transit",
    title: "In transit",
    statements: [
      {
        claim: "HTTPS is enforced by the browser, not just offered.",
        detail:
          "Every public response carries HSTS with a one-year max-age, so after a first visit the browser refuses plain HTTP to this host without asking anyone. It is deliberately scoped to this host and is not submitted to the browser preload list, because both of those are close to irreversible commitments about hosts this code cannot see.",
        implementedBy: ["src/lib/security/public-response.ts"],
        evidence: ["strict-transport-security", "max-age=31536000"],
      },
      {
        claim: "A content policy limits what the page may load and where it may send.",
        detail:
          "Scripts come from this origin only — a third-party player script was found being blocked on every public page and removed rather than allowed. Framing is denied, MIME sniffing is off, the referrer is trimmed cross-origin, and the permissions policy withholds geolocation and USB outright while keeping camera, microphone and payment to this origin.",
        implementedBy: ["src/lib/security/public-response.ts"],
        evidence: ["permissions-policy", "x-frame-options", "referrer-policy"],
      },
    ],
  },
  {
    id: "on-your-device",
    title: "On your device",
    statements: [
      {
        claim: "Your conversations, projects and files live in your account, not in this browser.",
        detail:
          "Every row is protected by PostgreSQL row-level security scoped to your own user id, so a query that is not yours returns nothing rather than somebody else's work. This replaced an encrypted browser store: one authority means one place to protect, one place to export from, and one place a deletion has to reach.",
        implementedBy: ["src/lib/ocade-chat-store.ts", "src/lib/ocade.functions.ts"],
        evidence: ["user_id", "row-level security"],
      },
      {
        claim:
          "A turn OCADE answers on this device while your account is unreachable waits in the open tab.",
        detail:
          "It is held in memory — never written to disk — shown as unsaved, and warned about before you close or reload the page. When the connection returns it is uploaded exactly once, using a key chosen before it was sent so a retry cannot write it twice.",
        implementedBy: [
          "src/lib/chat/unsynced-turns.ts",
          "src/components/ocade/chat/UnsyncedTurnsBridge.tsx",
        ],
        evidence: ["clientKey", "beforeunload"],
      },
      {
        claim: "Offline Intelligence lives apart from your account data.",
        detail:
          "The model is stored in the browser's private origin filesystem, not in the account database. Deleting account data, deleting this browser's own data and signing out all leave it in place; only the model vault's own uninstall removes it, and only when you ask for that specifically.",
        implementedBy: ["src/lib/device/local-data.ts", "src/lib/brain/model-vault.ts"],
        evidence: ["MODEL_OWNED_KEY_PREFIXES", "OPFS"],
      },
      {
        claim: "What this browser does keep is preferences, not content.",
        detail:
          "A theme, a send key, an unsent draft, a table layout, the model's own metadata. Clearing them is offered separately from exercising a data right, because clearing a shared laptop and deleting your account's work are different requests.",
        implementedBy: ["src/lib/device/local-data.ts"],
        evidence: ["keysForClass", "preferences"],
      },
    ],
    limitation:
      "Anything held on your device is protected by your device. OCADE cannot defend a browser profile that somebody else can already read while it is unlocked.",
  },
  {
    id: "local-and-online",
    title: "What stays local and what goes online",
    statements: [
      {
        claim: "On-device answers do not leave the machine.",
        detail:
          "When OCADE answers with Offline Intelligence, the prompt and the answer are produced in the browser. Nothing about that exchange is sent anywhere, which is also why it keeps working with the network off.",
        implementedBy: ["src/lib/brain/sampler-settings.ts"],
        evidence: ["temperature"],
      },
      {
        claim: "Every answer says which engine produced it.",
        detail:
          "The answer receipt records the engine and the exact sampling settings used, so 'this was answered on my machine' is something you can check rather than something you are told.",
        implementedBy: [
          "src/lib/brain/sampler-settings.ts",
          "src/components/ocade/chat/AnswerReceiptPanel.tsx",
        ],
        evidence: ["temperature"],
      },
    ],
  },
  {
    id: "account-access",
    title: "Reaching your account",
    statements: [
      {
        claim: "A second factor is real TOTP, verified by the auth provider.",
        detail:
          "Enrolment is only protection once a code has been verified, and an unverified enrolment is swept away rather than counted. High-risk actions require both the second factor and a recent proof of it, so a session that authenticated hours ago cannot quietly perform one.",
        implementedBy: ["src/lib/security/mfa.ts", "src/lib/security/assurance.ts"],
        evidence: ["aal2"],
      },
      {
        claim: "Recovery codes reset your factors; they are not a way to sign in.",
        detail:
          "They are stored as HMACs under a server-side pepper, bound to the account, usable once, and rate-limited by a lockout that lives in the database rather than in a server process — so restarting the server does not restart the attempts.",
        implementedBy: ["src/lib/security/recovery-codes.ts"],
        evidence: ["Rejection sampling", "ALPHABET"],
      },
      {
        claim: "You can see every signed-in session and end any of them.",
        detail:
          "The list is of real authenticated sessions, not of devices you once approved — a device record outlives a sign-out and answers a different question. Ending a session kills its refresh token immediately; an access token already issued stays valid until it expires, and the page says so rather than implying an instant cut-off.",
        implementedBy: ["src/lib/security/sessions.functions.ts"],
        evidence: ["ocade_revoke_account_session", "auth.sessions"],
      },
      {
        claim:
          "Server functions take your identity from the verified token, never from the request.",
        detail:
          "There is no parameter anywhere in the session or entitlement paths that names a user, which is what makes 'do this to somebody else's account' impossible to ask for rather than merely refused.",
        implementedBy: ["src/lib/security/sessions.functions.ts"],
        evidence: ["context.userId"],
      },
    ],
    limitation:
      "Revoking a session ends its ability to renew. An access token issued moments earlier remains valid until it expires, which is a bounded window rather than an instant kill.",
  },
  {
    id: "permissions",
    title: "Permissions and receipts",
    statements: [
      {
        claim: "Consent is recorded with the version that was accepted.",
        detail:
          "Which legal document version an account accepted, and when, is written append-only under row-level security once an account exists, and kept locally before there is one. Nothing about the record blocks the product if it cannot be written.",
        implementedBy: ["src/lib/legal/consent-receipts.ts"],
        evidence: ["append-only"],
      },
      {
        claim: "Credentials are recognised as credentials and kept out of audit trails.",
        detail:
          "One rule decides what counts as protected text — keys, tokens, recovery codes — and every subsystem that writes an audit line redacts through it, rather than each keeping its own idea of what is sensitive.",
        implementedBy: ["src/lib/security/protected-text.ts"],
        evidence: ["isProtectedText", "redactForAudit"],
      },
    ],
  },
  {
    id: "boundaries",
    title: "Browser and computer-control boundaries",
    statements: [
      {
        claim: "OCADE's servers can never answer as your computer.",
        detail:
          "The paired-computer bridge only exists where a machine has been explicitly enabled, and OCADE's hosted deployment never sets that flag — so the endpoint is absent in the cloud rather than merely refusing. That is the whole point of a paired device.",
        implementedBy: ["src/routes/api/ocade.bridge.$.ts"],
        evidence: ["OCADE_BRIDGE_ENABLED"],
      },
      {
        claim: "A paired browser must be approved at the computer itself.",
        detail:
          "Requests are signature-checked, origin-checked, expiry-checked and replay-checked, and the only cross-origin allowance is an echo of an origin a person already approved on that machine. The local engine port is never reachable from the browser and is never returned to it.",
        implementedBy: ["src/routes/api/ocade.bridge.$.ts"],
        evidence: ["x-ocade-signature", "corsHeaders"],
      },
    ],
  },
  {
    id: "server-side",
    title: "On OCADE's side",
    statements: [
      {
        claim: "Row-level security is on, and privileged functions are closed to browsers.",
        detail:
          "Account data is constrained per account in the database itself. The functions that read or revoke sessions bypass row-level security by design and are therefore granted to the service role alone — no browser key can execute them, and a permanent test refuses any new one that is granted more widely.",
        implementedBy: ["supabase/migrations/20260902130000_account_session_authority.sql"],
        evidence: ["SECURITY DEFINER", "TO service_role"],
      },
      {
        claim: "Data at rest on the server is protected by the hosting provider.",
        detail:
          "Account data lives in managed Postgres at Supabase, and disk encryption there is the provider's, not something OCADE implements. It is named that way rather than presented as OCADE's own control.",
        implementedBy: ["src/integrations/supabase/client.server.ts"],
        evidence: ["createClient"],
      },
    ],
    limitation:
      "OCADE does not operate the machines its account data sits on and does not hold their disk-encryption keys. Where the data is stored is set by the Supabase project the deployment is bound to.",
  },
  {
    id: "organization",
    title: "Organization policy",
    statements: [
      {
        claim: "An administrator role exists and is checked on the server.",
        detail:
          "Administrative screens verify the role against the database before they load, and being sent to an access-denied page is the expected outcome for an account without it.",
        implementedBy: ["src/lib/admin/route-gate.ts"],
        evidence: ["user_roles", "access-denied"],
      },
    ],
    limitation:
      "Organization-wide security policy — enforced second factors, session lifetime rules, single sign-on and directory provisioning — is not offered yet. It is absent rather than present and unenforced.",
  },
];

/**
 * How to report a vulnerability, and the honest state of the contact route.
 *
 * The disclosure path offered is the one that genuinely works: a Security
 * ticket, which lands in the administrative support queue attached to an
 * account. A dedicated security mailbox is NOT offered, because none has been
 * activated and verified — and publishing an address that nobody reads is worse
 * than publishing none, since the reporter believes they have told somebody.
 */
export const SECURITY_DISCLOSURE = {
  route:
    "Report a suspected vulnerability by opening a Security ticket from a signed-in account. It arrives in the administrative support queue attached to your account, which is how it can be followed up.",
  expectations:
    "Please include what you did, what happened, and what you expected. Do not include passwords, one-time codes, recovery codes, private keys or full card numbers — a report never needs them, and a ticket is not the place for them. Please do not run tests that degrade the service for other people or that reach into another person's account.",
  contactStatus:
    "OCADE does not publish a dedicated security email address, because no such mailbox has been activated and verified on the domain. One will be published here once it exists and delivery to it has been confirmed.",
} as const;
