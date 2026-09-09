/**
 * OCADE'S ONE HELP AUTHORITY.
 *
 * PLAN.md §L asks for a Help Center with searchable articles, categories,
 * article pages with stable slugs, applicability, related reading and
 * escalation — and then adds the constraint that matters most: "No duplicate
 * FAQ database or support system."
 *
 * There WAS one. `public-faq.ts` held twenty-odd question-and-answer pairs with
 * no slugs, no dates, no applicability and no way to link to a single answer,
 * and the public search index pointed at `/faq` as a whole rather than at any
 * answer in it. Building a Help Center beside it would have produced two sets
 * of answers that drift, which is worse than one incomplete set: a person who
 * finds the stale one has no way to tell.
 *
 * So this is the single authority, and `/faq` became a VIEW of it — the
 * articles that answer a question, grouped by category. Nothing was thrown
 * away; every answer that existed is here, with the things it was missing.
 *
 * SLUGS ARE PERMANENT. A help URL ends up in a support reply, a bookmark and
 * somebody's runbook. Renaming one silently turns all three into a 404, so a
 * slug is never reused for different content and never changed to match a
 * retitled article.
 *
 * DATES ARE HONEST. `lastUpdated` is the day the ANSWER changed, not the day
 * the file was touched. An article whose answer is unchanged keeps its date,
 * because "updated today" on unchanged text is a small lie that makes every
 * other date on the site untrustworthy.
 */

import { CHECKOUT_UNAVAILABLE_NOTICE } from "@/lib/payments/checkout-availability";

import type { SupportedLocale } from "@/lib/locale/supported-locales";
import type { ArticleTranslation } from "./article-locales";

export type SupportCategoryId =
  | "getting-started"
  | "account-and-sign-in"
  | "sync-and-devices"
  | "offline-intelligence"
  | "privacy-and-data"
  | "billing-and-plans"
  | "security"
  | "computer-control";

export interface SupportCategory {
  id: SupportCategoryId;
  title: string;
  description: string;
}

export const SUPPORT_CATEGORIES: readonly SupportCategory[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "What OCADE is, and the first things to do with it.",
  },
  {
    id: "account-and-sign-in",
    title: "Account and sign-in",
    description: "Signing in, signing out, and getting back in.",
  },
  {
    id: "sync-and-devices",
    title: "Sync and devices",
    description: "What follows you between machines, and what deliberately does not.",
  },
  {
    id: "offline-intelligence",
    title: "Offline Intelligence",
    description: "The on-device model: preparing it, using it, and removing it.",
  },
  {
    id: "privacy-and-data",
    title: "Privacy and your data",
    description: "Where things are stored, how to export them, and how to delete them.",
  },
  {
    id: "billing-and-plans",
    title: "Billing and plans",
    description: "Free, Pro and Max, and what OCADE can charge for today.",
  },
  { id: "security", title: "Security", description: "Second factors, sessions and recovery." },
  {
    id: "computer-control",
    title: "Browser and computer control",
    description: "What OCADE can do on your machine, and what it needs first.",
  },
];

/** Where an article applies. An empty list means everywhere. */
export type SupportPlatform = "web" | "windows" | "macos" | "android" | "ios" | "extension";

export interface SupportArticle {
  /** Permanent. Never reused, never renamed. */
  slug: string;
  title: string;
  /**
   * The question form, when the article answers one.
   *
   * `/faq` is exactly the articles that have this, which is what makes the FAQ
   * a view of the Help Center rather than a second copy of it.
   */
  question?: string;
  summary: string;
  category: SupportCategoryId;
  /** Paragraphs. Deliberately plain text: no markup to sanitise, no injection. */
  body: readonly string[];
  keywords: readonly string[];
  /** Empty or absent means every platform. */
  platforms?: readonly SupportPlatform[];
  /** The product version from which this answer is accurate. */
  appliesFrom: string;
  /** ISO date the ANSWER last changed. */
  lastUpdated: string;
  /** Slugs of articles worth reading next. Validated by test, never guessed. */
  related?: readonly string[];
  /** A draft is not routable, not searchable and not linkable. */
  status: "draft" | "published";
  /**
   * Editorial selection, and labelled as that on the page.
   *
   * PLAN.md §L allows "real metrics OR editorial selection". OCADE has no
   * article-view metrics — there is no store for them — so presenting a list as
   * "most popular" would be an invented statistic. These are the ones support
   * needs most often, chosen by hand and said to be chosen by hand.
   */
  featured?: boolean;
  /**
   * The language this article was WRITTEN in.
   *
   * A full tag rather than a bare "en": `en` matches nothing in
   * `SUPPORTED_LOCALES`, so every comparison against a reader's locale was
   * against a value the locale authority does not recognise. §L asks for locale
   * support, and it starts with the article knowing which locale it is in.
   */
  locale: SupportedLocale;
  /**
   * The same article, written again in another language.
   *
   * Absent for every article today, and deliberately not filled with machine
   * translation — see `article-locales.ts` for why, and for what a reader in an
   * untranslated language is told instead. The mechanism is here so a
   * translation can be added as text rather than as a feature.
   */
  translations?: Partial<Record<SupportedLocale, ArticleTranslation>>;
}

const V1 = "1.0";

export const SUPPORT_ARTICLES: readonly SupportArticle[] = [
  /* ---------------- getting started ---------------- */
  {
    slug: "what-is-ocade",
    title: "What OCADE is",
    question: "Who is OCADE?",
    summary: "The assistant built by CARCC CADANE, and what it will tell you about itself.",
    category: "getting-started",
    body: [
      "OCADE is the assistant built by CARCC CADANE. It answers as OCADE by CARCC CADANE.",
      "If you ask which engine is running a request, it tells you truthfully rather than deflecting. Every answer also carries a receipt naming the engine and the exact sampling settings used, so the claim is something you can check rather than something you are told.",
    ],
    keywords: ["ocade", "about", "assistant", "carcc cadane", "engine"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["which-engine-answered", "offline-intelligence-what-it-is"],
    status: "published",
    featured: true,
    locale: "en-GB",
  },
  {
    slug: "which-engine-answered",
    title: "Telling which engine answered",
    question: "How do I know whether an answer came from my machine or from the cloud?",
    summary:
      "Open the answer receipt. It names the engine and the settings that produced the text.",
    category: "getting-started",
    body: [
      "Every answer carries a receipt. It records which engine produced the text and the exact sampling settings used, so 'this was answered on my machine' is verifiable rather than assumed.",
      "When OCADE answers with Offline Intelligence, the prompt and the answer are produced in your browser and nothing about that exchange is sent anywhere. That is also why it keeps working with the network off.",
    ],
    keywords: ["receipt", "engine", "local", "cloud", "which model"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["what-is-ocade", "offline-intelligence-what-it-is"],
    status: "published",
    locale: "en-GB",
  },

  /* ---------------- account and sign-in ---------------- */
  {
    slug: "how-to-sign-in",
    title: "Signing in to OCADE",
    question: "How do I sign in?",
    summary: "Google, a one-time code by phone or email, or email and password.",
    category: "account-and-sign-in",
    body: [
      "OCADE supports Google, one-time codes by phone or email, and email with a password, depending on what the deployment has configured.",
      "If the identity service is unavailable or misconfigured, sign-in fails closed and names the missing configuration rather than appearing to work. It never signs you in against a different project than the one this deployment is bound to.",
    ],
    keywords: ["sign in", "login", "google", "otp", "password"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["forgot-password", "google-sign-in-failed", "second-factor-setup"],
    status: "published",
    featured: true,
    locale: "en-GB",
  },
  {
    slug: "forgot-password",
    title: "Resetting a forgotten password",
    question: "I forgot my password. What now?",
    summary: "Use “Forgot password?” on the sign-in screen.",
    category: "account-and-sign-in",
    body: [
      "Use “Forgot password?” on the sign-in screen. When email delivery is configured, the identity service sends a reset link.",
      "OCADE never claims a message was delivered unless the provider accepted the request. If it could not be sent, it says so instead of leaving you waiting for mail that is not coming.",
    ],
    keywords: ["password", "reset", "forgot", "email"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["how-to-sign-in", "lost-second-factor"],
    status: "published",
    locale: "en-GB",
  },
  {
    slug: "google-sign-in-failed",
    title: "When Google sign-in does not complete",
    question: "Google sign-in failed or I cancelled it. Is something broken?",
    summary: "Cancelling returns you to sign-in without creating a session.",
    category: "account-and-sign-in",
    body: [
      "Closing or cancelling the Google window returns you to the sign-in screen without creating a session. Nothing is wrong and nothing was signed in.",
      "A genuine failure can also mean a blocked pop-up, a rate limit, or incomplete configuration on this deployment. OCADE shows the cause it has rather than treating a failure as success.",
    ],
    keywords: ["google", "oauth", "popup", "cancelled", "failed"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["how-to-sign-in"],
    status: "published",
    locale: "en-GB",
  },

  /* ---------------- security ---------------- */
  {
    slug: "second-factor-setup",
    title: "Turning on a second factor",
    question: "How do I add two-factor authentication?",
    summary: "Settings → Security. Scan the code, then enter one code to finish.",
    category: "security",
    body: [
      "Open Settings → Security and start the second-factor setup. Scan the code with any authenticator app, then enter one code from it.",
      "The enrolment only counts as protection once a code has been verified — an unverified enrolment protects nothing and is cleared away rather than left looking active.",
      "Once it is on, high-risk actions ask for both the second factor and a recent proof of it, so a session that authenticated hours ago cannot quietly change your security settings.",
    ],
    keywords: ["2fa", "mfa", "totp", "authenticator", "second factor"],
    platforms: ["web", "windows", "macos"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["lost-second-factor", "see-and-end-sessions"],
    status: "published",
    featured: true,
    locale: "en-GB",
  },
  {
    slug: "lost-second-factor",
    title: "Getting back in without your authenticator",
    question: "I lost my phone. How do I get back into my account?",
    summary: "Use a recovery code on the challenge screen.",
    category: "security",
    body: [
      "The challenge screen offers a recovery-code route. Enter one of the codes you saved when you turned the second factor on.",
      "A recovery code resets your factors so you can enrol a new authenticator. It is not a way to sign in on its own, and each code works once.",
      "If you have no codes left, open a Security ticket from a signed-in session on a device that still works. There is no way for OCADE to verify a request from an account it cannot reach at all.",
    ],
    keywords: ["recovery code", "lost phone", "locked out", "authenticator"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["second-factor-setup", "contact-support"],
    status: "published",
    locale: "en-GB",
  },
  {
    slug: "see-and-end-sessions",
    title: "Seeing where you are signed in, and ending a session",
    question: "How do I sign out of a device I no longer have?",
    summary: "Settings → Security lists real sessions and can end any of them.",
    category: "security",
    body: [
      "Settings → Security lists the sessions that can currently read your account, newest activity first, with the browser and a coarse address for each.",
      "This is a list of sessions, not of devices you once approved — a device record outlives a sign-out and answers a different question.",
      "Ending a session immediately stops it being renewed. An access token issued moments earlier stays valid until it expires, which is a bounded window rather than an instant cut-off, and the page says so rather than implying otherwise.",
    ],
    keywords: ["sessions", "sign out", "revoke", "stolen laptop", "devices"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["second-factor-setup", "device-limit"],
    status: "published",
    locale: "en-GB",
  },

  /* ---------------- sync and devices ---------------- */
  {
    slug: "sync-across-devices",
    title: "What follows you between devices",
    question: "Do my chats appear on my phone and my computer?",
    summary: "Everything does. Your work is kept in your account, not in one browser.",
    category: "sync-and-devices",
    body: [
      "Conversations, projects, tasks, artifacts and what OCADE remembers are kept in your account, so they are there on every device you sign in on.",
      "There is no per-device mode to choose any more. There used to be, and it was a poor trade: work made on a laptop was invisible on a phone, and clearing a browser deleted it with no warning.",
      "Two things are still on the device by design. Offline Intelligence — the local model — never leaves the machine it was installed on, and preferences like your theme or send key are per device because a laptop and a phone reasonably want different answers.",
      "A message you send while your account is unreachable waits in that tab and is sent when the connection returns. Closing the tab before then discards it, and OCADE says so at the time rather than afterwards.",
    ],
    keywords: ["sync", "devices", "phone", "computer", "account"],
    appliesFrom: V1,
    lastUpdated: "2026-09-09",
    related: ["missing-on-second-device", "device-limit"],
    status: "published",
    featured: true,
    locale: "en-GB",
  },
  {
    slug: "what-stays-on-this-device",
    title: "What stays on this device",
    question: "Is anything kept only on my machine?",
    summary: "Offline Intelligence and your per-device preferences. Nothing else.",
    category: "sync-and-devices",
    body: [
      "Offline Intelligence is the local model. It is large, it is not personal data, and it never leaves the machine it was installed on — which is the point of it. It survives signing out and even deleting your account, and only Remove Offline Intelligence deletes it.",
      "Preferences that are genuinely about this machine stay here too: your theme, your send key, which voice it speaks with, how a table is laid out. Carrying those between devices would be wrong rather than helpful.",
      "Everything else — conversations, projects, tasks, artifacts, what OCADE remembers about you — is kept in your account. There is no mode that keeps them in one browser, and OCADE will not silently answer from a copy that only one machine can see.",
    ],
    keywords: ["local", "device", "offline", "model", "preferences"],
    appliesFrom: V1,
    lastUpdated: "2026-09-09",
    related: ["sync-across-devices", "missing-on-second-device"],
    status: "published",
    locale: "en-GB",
  },
  {
    slug: "device-limit",
    title: "How many devices you can use",
    question: "How many devices can I use?",
    summary: "Two desktop and two mobile device records per account.",
    category: "sync-and-devices",
    body: [
      "The current policy allows two desktop and two mobile device records per account.",
      "You can name, approve and revoke them in Settings → Devices. A revocation is recorded on your account, so it applies to every device you own rather than only the one you performed it on.",
    ],
    keywords: ["devices", "limit", "how many", "approve", "revoke"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["sync-across-devices", "see-and-end-sessions"],
    status: "published",
    locale: "en-GB",
  },
  {
    slug: "missing-on-second-device",
    title: "Something is missing on another device",
    question: "Something is missing on my second device.",
    summary: "Check you are signed in to the same account, then check the status page.",
    category: "sync-and-devices",
    body: [
      "Your work is kept in your account, so the first thing to check is that both devices are signed in to the same one.",
      "If they are, the account data service may not be reachable from the device that is missing something. OCADE shows an error rather than an empty list when it cannot read your work — an empty screen and an unreachable account must never look the same, because one of them means nothing is lost.",
      "A message written while a device was offline is held in that tab only. If the tab was closed before the connection returned, that message was discarded, and OCADE warned about it at the time.",
    ],
    keywords: ["missing", "not syncing", "second device", "signed in"],
    appliesFrom: V1,
    lastUpdated: "2026-09-09",
    related: ["what-stays-on-this-device", "sync-across-devices"],
    status: "published",
    locale: "en-GB",
  },

  /* ---------------- offline intelligence ---------------- */
  {
    slug: "offline-intelligence-what-it-is",
    title: "Offline Intelligence",
    question: "What is Offline Intelligence?",
    summary: "A model that runs in your browser, so answers work with the network off.",
    category: "offline-intelligence",
    body: [
      "Offline Intelligence is a model that runs on your own machine. Preparing it downloads the weights once into the browser's private origin filesystem.",
      "Preparation never blocks the product. Progress appears in a status panel in the corner; OCADE does not put a full-screen gate in front of the application while it downloads, and a failed download never leaves you stuck.",
      "While it is prepared, answers can be produced with no network at all, and nothing about those exchanges leaves the device.",
    ],
    keywords: ["offline", "on-device", "model", "download", "local engine"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["deleting-data-keeps-the-model", "which-engine-answered"],
    status: "published",
    featured: true,
    locale: "en-GB",
  },
  {
    slug: "deleting-data-keeps-the-model",
    title: "Deleting your data does not delete the model",
    question: "If I delete my data or sign out, do I have to download the model again?",
    summary: "No. Offline Intelligence is kept apart from account data on purpose.",
    category: "offline-intelligence",
    body: [
      "No. The model lives in the browser's private origin filesystem, separate from account data and from the record store.",
      "Signing out, deleting private data and deleting your account all leave it in place. Only the model vault's own uninstall removes it, and only when you ask for that specifically.",
      "Deleting data also does not restart a download or start probing for the model again — that behaviour would undo the point of keeping it separate.",
    ],
    keywords: ["delete", "sign out", "model", "redownload", "opfs"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["offline-intelligence-what-it-is", "delete-account"],
    status: "published",
    locale: "en-GB",
  },

  /* ---------------- privacy and data ---------------- */
  {
    slug: "delete-account",
    title: "Deleting your account and data",
    question: "Can I delete my account and data?",
    summary:
      "Settings → Account. Device-local data goes immediately; account data is deleted by the service.",
    category: "privacy-and-data",
    body: [
      "Settings → Account provides the deletion control. It removes device-local OCADE data directly and asks the account data service to delete account-held records and the sign-in identity.",
      "OCADE reports completion only after that service returns a verified result. If part of it could not be done, it tells you what remains rather than showing a success screen.",
      "Offline Intelligence is not removed by account deletion. Removing it is a separate, explicit choice.",
    ],
    keywords: ["delete account", "erase", "gdpr", "remove data"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["deleting-data-keeps-the-model", "data-rights-request"],
    status: "published",
    locale: "en-GB",
  },
  {
    slug: "data-rights-request",
    title: "Making a data-rights request",
    question: "How do I ask for a copy of my data, or a correction?",
    summary: "Use the data-rights request builder, then send it through support.",
    category: "privacy-and-data",
    body: [
      "The data-rights page prepares a request you can copy and send: what you are asking for, the account it concerns, and the identity checks that may be needed before you send sensitive documents.",
      "Do not include passwords, one-time codes, recovery codes or full card numbers in a request. They are never needed to identify you and a ticket is not the place for them.",
    ],
    keywords: ["data rights", "export", "access request", "correction", "erasure"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["delete-account", "contact-support"],
    status: "published",
    locale: "en-GB",
  },

  /* ---------------- billing ---------------- */
  {
    slug: "plans-and-what-they-cost",
    title: "Free, Pro and Max",
    question: "Which plans does OCADE offer?",
    summary: "Free, Pro and Max, with weekly and monthly cadences on the paid tiers.",
    category: "billing-and-plans",
    body: [
      "OCADE's catalogue is Free, Pro and Max. Pro and Max are offered weekly or monthly; the pricing page carries the current figures, which come from the same catalogue the server bills from.",
      "Every plan's allowance is measured against a session window and a weekly window anchored to your account, not to a clock somebody can restart. Settings → Usage shows where you are.",
    ],
    keywords: ["plans", "pricing", "free", "pro", "max", "cost"],
    appliesFrom: V1,
    lastUpdated: "2026-09-04",
    related: ["can-i-buy-a-plan-now", "payment-taken-plan-not-changed"],
    status: "published",
    locale: "en-GB",
    /*
     * THE ONE TRANSLATION THAT CAN BE WRITTEN HONESTLY TODAY.
     *
     * OCADE supports eight locales and its interface text is English; §26
     * settled that machine translation is not shipped, and an article somebody
     * reads while they are already stuck is the worst place to break that rule.
     * What CAN be written correctly is the other Englishes — and this article
     * is the one where they genuinely differ, because it is about money and the
     * currency an Indian reader expects is not the one a British reader does.
     *
     * It exists so the locale mechanism is exercised by a real article rather
     * than being a feature with no user. Every other article resolves through
     * the fallback, which says so.
     */
    translations: {
      "en-IN": {
        title: "Free, Pro and Max",
        question: "Which plans does OCADE offer?",
        summary: "Free, Pro and Max, with weekly and monthly cadences on the paid tiers.",
        body: [
          "OCADE's catalogue is Free, Pro and Max. Pro and Max are offered weekly or monthly. The pricing page carries the current figures in rupees, which come from the same catalogue the server bills from — the amount you are shown is the amount the server charges, not a converted estimate.",
          "Every plan's allowance is measured against a session window and a weekly window anchored to your account, not to a clock somebody can restart. Settings → Usage shows where you are.",
        ],
      },
    },
  },
  {
    slug: "can-i-buy-a-plan-now",
    title: "Whether a plan can be bought on this deployment",
    question: "Can I pay for Pro or Max right now?",
    summary:
      "Only where the deployment is configured to take payments. Otherwise checkout is not offered at all.",
    category: "billing-and-plans",
    body: [
      CHECKOUT_UNAVAILABLE_NOTICE,
      "Whether checkout appears is derived from whether this deployment is genuinely configured to complete, verify and refund a payment — not from a switch somebody remembers to flip. Where it is not, no purchase control is shown, rather than a button that opens onto a payment the server could not finish.",
      "Paid access is never granted by arriving back from a payment page. It becomes active only after the server has independently verified the payment with the provider.",
    ],
    keywords: ["buy", "checkout", "payment", "upgrade", "purchase"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["plans-and-what-they-cost", "payment-taken-plan-not-changed"],
    status: "published",
    locale: "en-GB",
  },
  {
    slug: "payment-taken-plan-not-changed",
    title: "A payment went through but the plan has not changed",
    question: "My payment succeeded but the plan has not changed yet.",
    summary:
      "Wait for the provider confirmation, then contact support with the receipt. Do not retry.",
    category: "billing-and-plans",
    body: [
      "Confirmation from a payment provider is asynchronous, so a short wait is normal. Once it arrives the plan appears in Settings → Billing without anyone having to do anything.",
      "If it is still missing after an hour, contact support with the provider receipt and the email you paid with. Do not retry the payment and never send card numbers, one-time codes or any other credential in a ticket.",
    ],
    keywords: ["payment", "not applied", "receipt", "billing", "stuck"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["can-i-buy-a-plan-now", "contact-support"],
    status: "published",
    locale: "en-GB",
  },

  /* ---------------- computer control ---------------- */
  {
    slug: "can-ocade-control-my-computer",
    title: "What OCADE can do on your machine",
    question: "Can OCADE control my computer?",
    summary: "Only what you permit, and only what the current environment genuinely allows.",
    category: "computer-control",
    body: [
      "In the browser, OCADE can act through the OCADE extension you install and approve.",
      "Control of the operating system itself requires the native companion running on that machine. Until it is connected, OCADE says so rather than reporting an action it did not take.",
      "OCADE's servers can never answer as your computer. The paired-computer bridge only exists where a machine has been explicitly enabled, and the hosted deployment never enables it — the endpoint is absent there, not merely refusing.",
    ],
    keywords: ["computer control", "extension", "companion", "automation", "bridge"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["what-is-ocade", "contact-support"],
    status: "published",
    locale: "en-GB",
  },

  /* ---------------- escalation ---------------- */
  {
    slug: "contact-support",
    title: "Contacting support",
    question: "How do I contact a person?",
    summary: "Open a ticket from a signed-in account. It stays attached to the account.",
    category: "getting-started",
    body: [
      "Open a support ticket from a signed-in account. It arrives in the administrative support queue attached to your account, which is how it can be followed up.",
      "Categories include Account, Billing, Technical, Privacy, Security, Feedback, Legal, Investor and Partnership.",
      "OCADE does not publish a dedicated support, legal, privacy or security email address, because no such mailbox has been activated and verified. One will be published once it exists and delivery to it has been confirmed.",
      "Never put passwords, one-time codes, PINs, recovery codes, private keys, full card numbers or payment secrets in a ticket.",
    ],
    keywords: ["support", "contact", "ticket", "help", "email"],
    appliesFrom: V1,
    lastUpdated: "2026-09-03",
    related: ["data-rights-request", "lost-second-factor"],
    status: "published",
    featured: true,
    locale: "en-GB",
  },
];

/**
 * Drop anything not published.
 *
 * A named function rather than an inline filter so the RULE can be tested with
 * a draft in hand. The catalogue happens to contain no drafts today, and a test
 * that loops over the real list would therefore pass without exercising
 * anything — a vacuous check that would keep passing on the day somebody
 * removes the filter.
 */
export function publishedOnly(articles: readonly SupportArticle[]): SupportArticle[] {
  return articles.filter((article) => article.status === "published");
}

/** Only published articles are ever routable, searchable or linkable. */
export const PUBLISHED_ARTICLES: readonly SupportArticle[] = publishedOnly(SUPPORT_ARTICLES);

export function findArticle(slug: string): SupportArticle | undefined {
  return PUBLISHED_ARTICLES.find((article) => article.slug === slug);
}

export function articlesInCategory(category: SupportCategoryId): SupportArticle[] {
  return PUBLISHED_ARTICLES.filter((article) => article.category === category);
}

/** The editorial selection, labelled as editorial wherever it is shown. */
export function featuredArticles(): SupportArticle[] {
  return PUBLISHED_ARTICLES.filter((article) => article.featured);
}

/**
 * The FAQ, as a VIEW rather than a second database: every published article
 * that answers a question, grouped by category in catalogue order.
 */
export function faqView(): { category: SupportCategory; articles: SupportArticle[] }[] {
  return SUPPORT_CATEGORIES.map((category) => ({
    category,
    articles: PUBLISHED_ARTICLES.filter(
      (article) => article.category === category.id && article.question,
    ),
  })).filter((group) => group.articles.length > 0);
}
