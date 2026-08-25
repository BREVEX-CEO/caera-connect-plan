/**
 * Public edge documents served while the authenticated OCADE product is locked.
 * These responses contain no application JavaScript and never grant product access.
 */
import {
  FOUNDER_STRUCTURED_DATA,
  OCADE_STRUCTURED_DATA,
  organizationStructuredData,
} from "../public-identity";
import { LAUNCH_PUBLIC_DATE_LABEL, type LaunchGateDecision } from "./launch-window";

export const PRELAUNCH_PUBLIC_PATHS = new Set([
  "/",
  "/about",
  "/privacy",
  "/terms",
  "/support",
  "/company",
  "/founder/haans-antoni",
  "/products/ocade",
]);

export const PRELAUNCH_PUBLIC_ASSET_PATHS = new Set([
  "/brand/ocade-carcc-mark.png",
  "/brand/ocade-carcc-wordmark.png",
]);

export const PRELAUNCH_ALLOWED_PATHS = new Set([
  "/robots.txt",
  "/sitemap.xml",
  ...PRELAUNCH_PUBLIC_PATHS,
]);

const NOINDEX = "noindex, nofollow, noarchive";
const CLOUDFLARE_WEB_ANALYTICS =
  "https://static.cloudflareinsights.com/beacon.min.js " +
  "https://static.cloudflareinsights.com/beacon.min.js/";

function lockedHeaders(decision: LaunchGateDecision, contentType: string): HeadersInit {
  return {
    "content-type": contentType,
    "cache-control": "no-store",
    "content-security-policy":
      `default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src ${CLOUDFLARE_WEB_ANALYTICS}; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    "cross-origin-resource-policy": "same-origin",
    "referrer-policy": "no-referrer",
    "x-robots-tag": NOINDEX,
    "retry-after": String(decision.retryAfterSeconds),
    "x-content-type-options": "nosniff",
    "x-ocade-launch-state": "prelaunch",
  };
}

function publicHeaders(contentType: string): Record<string, string> {
  return {
    "content-type": contentType,
    "cache-control": "public, max-age=300",
    "content-security-policy":
      `default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline' ${CLOUDFLARE_WEB_ANALYTICS}; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    "cross-origin-resource-policy": "same-origin",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-robots-tag": "index, follow, max-image-preview:large",
    "x-content-type-options": "nosniff",
    "x-ocade-launch-state": "prelaunch-public-information",
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type PublicSection = { heading: string; paragraphs: string[] };
type PublicDocument = {
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  lead: string;
  sections: PublicSection[];
  structuredData: Record<string, unknown>;
};

function webPageStructuredData(name: string, description: string, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    description,
    url,
    isPartOf: {
      "@type": "WebSite",
      name: "OCADE",
      url: "https://ocade.in/",
    },
  };
}

function publicDocument(pathname: string): PublicDocument | null {
  if (pathname === "/") {
    return {
      title: "OCADE — Local-first AI workspace by CARCC CADANE",
      description:
        "Official OCADE home page by CARCC CADANE, including product, privacy, legal and launch information.",
      eyebrow: "Official OCADE home",
      heading: "OCADE",
      lead: `OCADE is a local-first AI workspace by CARCC CADANE for chat, research, work and permissioned computer-control tasks. The scheduled public launch is ${LAUNCH_PUBLIC_DATE_LABEL}.`,
      sections: [
        {
          heading: "What OCADE is",
          paragraphs: [
            "Supported AI generation is designed around local inference on the user's device rather than public-cloud AI inference. Optional authentication, Private Sync, current-information retrieval and other user-requested online services are handled separately.",
            "Feature availability varies by platform, hardware and release readiness. Public information pages do not grant access to the authenticated product before the launch gate opens.",
          ],
        },
        {
          heading: "CARCC CADANE",
          paragraphs: [
            "CARCC CADANE is the independent technology enterprise, business brand and venture building OCADE. HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE.",
          ],
        },
        {
          heading: "Privacy and legal information",
          paragraphs: [
            "The Privacy notice explains Google Sign-In, local-first processing, optional online services and support data. The Terms of service explain AI limitations, computer-control risks, user responsibilities, payments, refunds, liability and dispute rules.",
          ],
        },
      ],
      structuredData: OCADE_STRUCTURED_DATA,
    };
  }

  if (pathname === "/about") {
    const description =
      "About CARCC CADANE, OCADE, leadership, launch information and investor or strategic-partnership enquiries.";
    return {
      title: "About CARCC CADANE and OCADE",
      description,
      eyebrow: "About CARCC CADANE",
      heading: "Building OCADE",
      lead:
        "CARCC CADANE is an independent technology enterprise, business brand and venture building OCADE, a local-first AI workspace.",
      sections: [
        {
          heading: "CARCC CADANE",
          paragraphs: [
            "CARCC CADANE develops technology products and systems under a single enterprise and brand identity. OCADE is its active AI product. The official tagline is “Command the Next Era.”",
          ],
        },
        {
          heading: "Leadership",
          paragraphs: [
            "HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE.",
          ],
        },
        {
          heading: "Founding and public launch",
          paragraphs: [
            `CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as its scheduled founding date and the scheduled public launch of OCADE. Public identity, privacy, legal and verification pages may be available before that opening while the authenticated product remains launch-gated.`,
          ],
        },
        {
          heading: "Investors, strategic partners and future ownership discussions",
          paragraphs: [
            "CARCC CADANE welcomes serious enquiries from prospective investors and strategic partners who want to discuss product strategy, commercial collaboration, future investment or a possible future ownership or equity transaction. No outside investor or shareholder is publicly announced on this page today.",
            "Nothing on this website is an offer to sell securities, an investment prospectus, a solicitation to invest, a promise of allocation, valuation or return, or a guarantee that equity or shareholding will be offered. Any future investment or ownership arrangement requires separate diligence, documentation, approvals and legal compliance.",
            "Until dedicated investor email infrastructure is activated and verified, prospective investors and strategic partners should use the OCADE ticket system when signed-in account intake is available and choose the Investor or Partnership category.",
          ],
        },
        {
          heading: "Contact",
          paragraphs: [
            "OCADE uses a ticket-based support and administrative review system. Dedicated support, privacy, legal and investor email addresses will be published only after they are activated and verified.",
          ],
        },
      ],
      structuredData: webPageStructuredData("About CARCC CADANE and OCADE", description, "https://ocade.in/about"),
    };
  }

  if (pathname === "/privacy") {
    const description =
      "Privacy notice for OCADE by CARCC CADANE, effective 25 August 2026.";
    return {
      title: "Privacy notice — OCADE",
      description,
      eyebrow: "Effective and last updated 25 August 2026",
      heading: "Privacy notice",
      lead:
        "This notice explains how CARCC CADANE intends to handle information for the OCADE website, authentication, local-first AI, Private Sync, support and other user-requested services.",
      sections: [
        {
          heading: "Who is responsible",
          paragraphs: [
            "CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE and is responsible for the OCADE service operations described in this notice. This public notice does not claim a legal form, registration category, address or corporate status that has not separately been published and verified.",
          ],
        },
        {
          heading: "Information OCADE may handle",
          paragraphs: [
            "OCADE may handle account identifiers and authentication events, basic profile and settings data, device registrations, conversations, messages and files under the storage mode you choose, support tickets and messages, security and abuse-prevention records, and payment status or provider references if payments are enabled.",
            "Full card details, UPI PINs, passwords, one-time codes, recovery codes and similar secrets should not be placed in support tickets and are not required by OCADE Support.",
          ],
        },
        {
          heading: "Google Sign-In",
          paragraphs: [
            "If you choose Google Sign-In, Google may provide OCADE with authentication identifiers and basic account information such as your name, email address and profile image according to the permissions shown during sign-in. OCADE uses that information to authenticate the account, maintain the session, protect the service and provide account features. Google account information is not sold or used for targeted advertising by OCADE.",
          ],
        },
        {
          heading: "Local-first does not mean local-only",
          paragraphs: [
            "Supported AI generation is designed to run locally on your device. Device-only processing keeps supported data under your device controls. Optional Google authentication, Private Sync, Supabase, Cloudflare, current-information retrieval, payments, mobile pairing, support and other user-requested network services may process the minimum information reasonably necessary to provide those features.",
            "OCADE does not silently send normal chat generation to a public-cloud AI inference provider.",
          ],
        },
        {
          heading: "Purposes and sharing",
          paragraphs: [
            "Information may be used to provide requested features, authenticate and secure accounts, synchronize data when you choose Private Sync, maintain reliability, prevent abuse, process support or rights requests, maintain payment records when payments are enabled and comply with law.",
            "Depending on the feature, recipients may include Supabase, Cloudflare, Google or another authentication provider, cited source websites, app stores, payment providers and other service providers necessary to deliver that feature. OCADE does not sell personal information to advertisers.",
          ],
        },
        {
          heading: "Retention, deletion and rights",
          paragraphs: [
            "Device-only data remains controlled through your device and OCADE's local controls. Cloud records are intended to be retained only while reasonably necessary for the relevant account, requested service, security, legal obligation or dispute. Backup deletion may take additional time and some payment or security records may need to be retained where law requires.",
            "Depending on applicable law, you may have rights to access, correct or erase personal information, withdraw consent, object to certain processing or raise a grievance. Use the data-rights route where available or create a Privacy ticket through OCADE Support.",
          ],
        },
        {
          heading: "Users aged 16 or 17",
          paragraphs: [
            "OCADE is intended for users aged 16 or older, but age rules differ by jurisdiction. Where applicable law treats a 16- or 17-year-old as a child for personal-data processing, the required verified parent or lawful-guardian consent must be obtained before the relevant processing unless a lawful exemption applies. If OCADE does not yet provide the legally required consent flow, that user must wait until legally eligible to use the affected account or personal-data feature.",
          ],
        },
        {
          heading: "Security and contact",
          paragraphs: [
            "OCADE uses measures including access controls, row-level security and restricted storage patterns, but no device, network or online service can guarantee absolute security.",
            "Privacy, security and grievance requests use the OCADE ticket system while dedicated domain email channels are being established. Dedicated email addresses will be published only after they are activated and verified.",
          ],
        },
      ],
      structuredData: webPageStructuredData("OCADE Privacy notice", description, "https://ocade.in/privacy"),
    };
  }

  if (pathname === "/terms") {
    const description =
      "Terms of service for OCADE by CARCC CADANE, effective 25 August 2026.";
    return {
      title: "Terms of service — OCADE",
      description,
      eyebrow: "Effective and last updated 25 August 2026",
      heading: "Terms of service",
      lead:
        `These Terms apply now to the OCADE public website and to OCADE services as they become available. CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as the scheduled founding and public-launch date for OCADE.`,
      sections: [
        {
          heading: "Agreement, provider and eligibility",
          paragraphs: [
            "These Terms form the rules for using the OCADE website and OCADE services made available by CARCC CADANE, the independent technology enterprise, business brand and venture behind OCADE. HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE.",
            "OCADE is intended for users aged 16 or older. A user aged 16 or 17 may use account or personal-data features only where any consent or authorization required by applicable law has been validly obtained and the relevant OCADE flow supports it. Where a legally required verified guardian-consent flow is not available, the user must wait until legally eligible to use that feature.",
          ],
        },
        {
          heading: "Service and local-first architecture",
          paragraphs: [
            "OCADE combines local software with optional online authentication, Private Sync, current-information retrieval, support, payments and permissioned remote-device features. Supported chat generation is designed to run on the user's device rather than through a public-cloud AI inference provider. Feature availability may vary by device, hardware, browser, operating system, region, release stage and plan.",
          ],
        },
        {
          heading: "AI output can be wrong",
          paragraphs: [
            "OCADE may produce inaccurate, incomplete, outdated, misleading, duplicated or otherwise incorrect output. Users must independently verify important output before relying on it.",
            "OCADE is not a substitute for a qualified lawyer, doctor, accountant, tax professional, investment or financial adviser, cybersecurity professional or emergency service. Users remain responsible for decisions made using OCADE.",
          ],
        },
        {
          heading: "Computer control and user supervision",
          paragraphs: [
            "Permissioned computer-control features may open applications, read visible screens, type, click, create, edit, move or delete files, navigate websites and perform other actions the user authorizes. AI can select the wrong control, open the wrong application, alter or delete the wrong file, submit incorrect information or send content to an unintended destination.",
            "Users may use computer control only on systems, accounts and content they are authorized to control. Important actions may require confirmation, but users must still supervise the agent, review important work, maintain appropriate backups and stop the agent when an action is wrong or unexpected.",
          ],
        },
        {
          heading: "Content, output and intellectual property",
          paragraphs: [
            "Users retain the rights they have in prompts, files and other content they provide. Subject to applicable law, third-party rights and separately disclosed licences, users may use OCADE-generated output for personal or commercial purposes, including posts, videos, reels, documents and business work. AI output is not guaranteed to be unique and other users may receive similar output.",
            "CARCC CADANE and its rights holders retain their rights in OCADE software, original code, interfaces, designs, systems, proprietary technology, brand materials, logos and the tagline “Command the Next Era.” Third-party and open-source materials remain governed by their own licences and rights.",
          ],
        },
        {
          heading: "Acceptable use, suspension and service changes",
          paragraphs: [
            "Users may not use OCADE to violate law, infringe rights, access systems without authorization, distribute malware, commit fraud, evade security or payment controls, attack OCADE or another service, intentionally harm people, or repeatedly violate these Terms.",
            "CARCC CADANE may limit, suspend or terminate online access for illegal activity, hacking, malware, fraud, abuse, security bypass attempts, attacks, non-payment, material or repeated Terms violations, security emergencies or legal requirements. CARCC CADANE may also modify, discontinue or replace a feature or service, subject to rights applicable law does not permit these Terms to waive.",
          ],
        },
        {
          heading: "Free launch, future payments and refunds",
          paragraphs: [
            "OCADE may initially be offered without charge while product and payment work is completed. Free availability can change. Before a paid purchase, checkout must display the applicable price, taxes where required, duration or renewal rule, cancellation information and purchase-specific conditions.",
            "Except where applicable law requires otherwise, a paid digital service is not eligible for a voluntary refund after the purchased service has been activated or used. A refund, reversal, credit or other remedy may still be required or appropriate for a duplicate charge, billing or payment-processing error, non-delivery, a material service defect or deficiency, an unauthorized transaction where law provides protection, or another non-waivable consumer right.",
          ],
        },
        {
          heading: "Third-party services and availability",
          paragraphs: [
            "OCADE may depend on Google, Supabase, Cloudflare, app stores, payment providers, cited websites, network operators and other third parties. CARCC CADANE does not control those services and cannot guarantee their availability, accuracy, security or continued operation.",
            "To the maximum extent permitted by applicable law, OCADE is provided on an “as is” and “as available” basis without a promise of uninterrupted, error-free, loss-free or perfectly accurate operation. Users should maintain appropriate independent records and backups for important information.",
          ],
        },
        {
          heading: "Limitation of liability and assumed risks",
          paragraphs: [
            "To the maximum extent permitted by applicable law, CARCC CADANE, OCADE and their founder, personnel and service providers are not liable for indirect, incidental, special, exemplary, punitive or consequential loss, or for lost profits, lost revenue, lost business, lost opportunities, investment loss, data loss or corruption, business interruption, reputational harm, device or software problems, or losses caused by relying on AI output, computer-control actions, third-party services, or incorrect legal, medical, tax, accounting, financial, investment, cybersecurity or other professional decisions.",
            "Where liability cannot lawfully be excluded, and except for liability that applicable law does not permit to be capped, aggregate liability arising from a paid OCADE service is limited to the amount actually paid by the claimant for the affected OCADE service during the three months immediately before the event giving rise to the claim. A free service does not create a promise to pay compensation merely because it was free. Mandatory statutory rights and liabilities remain unaffected.",
          ],
        },
        {
          heading: "Indemnity",
          paragraphs: [
            "To the extent permitted by law, a user is responsible for third-party claims and reasonable losses caused by the user's unlawful use of OCADE, intentional infringement of another person's rights, or use of OCADE to access systems, accounts or content without authorization. This does not require a consumer to indemnify CARCC CADANE for liability where the law does not permit that result.",
          ],
        },
        {
          heading: "Law, negotiation and arbitration",
          paragraphs: [
            "These Terms are governed by the laws of India without removing mandatory protections that may apply to a user in another jurisdiction. Before starting a formal dispute, the parties should first try in good faith to resolve it through the OCADE support process.",
            "Where a dispute is legally capable of arbitration and is not resolved informally, it may be referred to arbitration under the Arbitration and Conciliation Act, 1996, in English, by a mutually appointed sole arbitrator or an appointment method permitted by law. This does not prevent access to a consumer commission, statutory regulator, non-arbitrable forum, court for urgent interim relief or another forum where applicable law gives a right that cannot validly be excluded.",
          ],
        },
        {
          heading: "Communications, updates and contact",
          paragraphs: [
            "OCADE may send essential account, authentication, security, legal and service messages. Marketing communications will be sent only where the required permission exists and will include the applicable way to opt out.",
            "CARCC CADANE may update these Terms as OCADE changes. Material changes will be identified through an appropriate notice where required, and fresh consent will be requested where applicable law requires it.",
            "OCADE uses a ticket-based support system for account, billing, technical, privacy, security, feedback, legal, investor and partnership enquiries. Dedicated domain email channels will be published only after they are activated and verified. Investor and partnership enquiries are discussions only and are not an offer of securities or a solicitation to invest.",
          ],
        },
      ],
      structuredData: webPageStructuredData("OCADE Terms of service", description, "https://ocade.in/terms"),
    };
  }

  if (pathname === "/support") {
    const description =
      "Current support, legal, privacy, security, investor and partnership contact options for OCADE.";
    return {
      title: "Support and contact — OCADE",
      description,
      eyebrow: "Support and contact",
      heading: "OCADE support",
      lead:
        "OCADE uses a ticket-based support queue and administrative review workspace. Dedicated domain email addresses will be published only after they are activated and verified.",
      sections: [
        {
          heading: "Ticket-based contact",
          paragraphs: [
            "Signed-in OCADE accounts can create support cases that remain attached to the account and appear in the OCADE administrative support queue. Categories include Account, Billing, Technical, Privacy, Security, Feedback, Legal, Investor and Partnership.",
            "Before authenticated account access opens, this public page is the authoritative contact status: no dedicated support, legal, privacy, security or investor email address is claimed to be active.",
          ],
        },
        {
          heading: "Privacy, legal and security requests",
          paragraphs: [
            "Use a Privacy, Legal or Security ticket when signed-in ticket intake is available. Do not place passwords, one-time codes, PINs, recovery codes, private keys, full card numbers or payment secrets in a ticket.",
          ],
        },
        {
          heading: "Investor and partnership enquiries",
          paragraphs: [
            "Prospective investors and strategic partners may use the Investor or Partnership ticket category when account intake is available. An enquiry starts a private discussion only; it is not an offer of securities, a solicitation to invest or a promise that equity or shareholding will be offered.",
          ],
        },
      ],
      structuredData: webPageStructuredData("OCADE support and contact", description, "https://ocade.in/support"),
    };
  }

  if (pathname === "/company") {
    return {
      title: "CARCC CADANE — Company and brand information",
      description:
        "Official information about CARCC CADANE, the technology enterprise and brand behind OCADE.",
      eyebrow: "Official information",
      heading: "CARCC CADANE",
      lead:
        `CARCC CADANE is an independent technology enterprise, business brand and venture building OCADE. The scheduled founding and public-launch date is ${LAUNCH_PUBLIC_DATE_LABEL}.`,
      sections: [
        {
          heading: "What CARCC CADANE is",
          paragraphs: [
            "CARCC CADANE is the technology enterprise and product venture behind OCADE. It develops software, AI systems and related products under the CARCC CADANE identity. The official tagline is “Command the Next Era.”",
            "Public references use the CARCC CADANE enterprise and brand identity. Legal-form, securities, trademark, funding or registration claims are published only when they are separately established and appropriate to disclose.",
          ],
        },
        {
          heading: "Leadership and product",
          paragraphs: [
            "HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE. OCADE is the active local-first AI workspace in development.",
          ],
        },
        {
          heading: "Investors and strategic partners",
          paragraphs: [
            "CARCC CADANE welcomes serious enquiries from prospective investors and strategic partners. No outside shareholder or investor is publicly announced on this page today, and nothing on this website is an offer to sell securities or a solicitation to invest.",
          ],
        },
      ],
      structuredData: organizationStructuredData(),
    };
  }

  if (pathname === "/founder/haans-antoni") {
    return {
      title: "HAANS ANTONI — Founder, CEO and Chairman of CARCC CADANE",
      description:
        "Official profile of HAANS ANTONI, Founder, CEO and Chairman of CARCC CADANE and creator of OCADE.",
      eyebrow: "Official founder profile",
      heading: "HAANS ANTONI",
      lead:
        "HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE.",
      sections: [
        {
          heading: "Role",
          paragraphs: [
            `Haans Antoni leads CARCC CADANE and directs the product vision for OCADE, a local-first AI workspace scheduled for public launch on ${LAUNCH_PUBLIC_DATE_LABEL}.`,
          ],
        },
        {
          heading: "Contribution record",
          paragraphs: [
            "Haans Antoni created and directs OCADE's local-first product vision, established the CARCC CADANE and OCADE brand concepts, and leads product, safety, launch and evidence requirements.",
          ],
        },
        {
          heading: "Public profile scope",
          paragraphs: [
            "This profile contains only the founder identity and work record intentionally published by CARCC CADANE. It does not expose private OCADE account activity, personal contact details or private communications, and it does not imply an unannounced funding round, public listing or securities offering.",
          ],
        },
      ],
      structuredData: FOUNDER_STRUCTURED_DATA,
    };
  }

  if (pathname === "/products/ocade") {
    return {
      title: "OCADE — Local-first AI workspace by CARCC CADANE",
      description: "Official product information for OCADE by CARCC CADANE.",
      eyebrow: "OCADE product",
      heading: "OCADE",
      lead:
        `OCADE is a local-first AI workspace created by HAANS ANTONI under CARCC CADANE. Public launch is scheduled for ${LAUNCH_PUBLIC_DATE_LABEL}.`,
      sections: [
        {
          heading: "Product boundary",
          paragraphs: [
            "Supported chat generation is designed to run on the user's device. Sign-in, optional Private Sync and permissioned current-information retrieval require network services; they are not public-cloud AI inference.",
            "Web launch, desktop native, Android native, iOS native and extension-store publication are separate readiness claims.",
          ],
        },
        {
          heading: "Free launch and future plans",
          paragraphs: [
            "OCADE may initially be available without charge while product and payment work is completed. Paid plans may be introduced later only with applicable checkout terms disclosed before purchase.",
          ],
        },
      ],
      structuredData: OCADE_STRUCTURED_DATA,
    };
  }

  return null;
}

export function renderPrelaunchPublicPage(pathname: string): string | null {
  const document = publicDocument(pathname);
  if (!document) return null;

  const canonical = `https://ocade.in${pathname}`;
  const sections = document.sections
    .map(
      (section) =>
        `<section><h2>${escapeHtml(section.heading)}</h2>${section.paragraphs
          .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
          .join("")}</section>`,
    )
    .join("");
  const structuredData = JSON.stringify(document.structuredData).replaceAll("<", "\\u003c");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(document.title)}</title><meta name="description" content="${escapeHtml(document.description)}" />
<meta name="robots" content="index,follow,max-image-preview:large" /><link rel="canonical" href="${canonical}" />
<meta property="og:type" content="website" /><meta property="og:site_name" content="CARCC CADANE" />
<meta property="og:title" content="${escapeHtml(document.title)}" /><meta property="og:description" content="${escapeHtml(document.description)}" />
<meta property="og:image" content="https://ocade.in/brand/ocade-carcc-wordmark.png" /><meta name="twitter:card" content="summary_large_image" />
<script type="application/ld+json">${structuredData}<\/script>
<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#050505;color:#eeeaf1;font:16px/1.7 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}a{color:inherit}header,main,footer{width:min(920px,calc(100% - 32px));margin:auto}header{padding:28px 0 18px}header img{display:block;width:min(540px,100%);height:auto}nav{display:flex;flex-wrap:wrap;gap:18px;padding:16px 0;border-top:1px solid #2a2630;border-bottom:1px solid #2a2630}main{padding:56px 0}.eyebrow{color:#d6a64f;font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}h1{font-size:clamp(42px,8vw,76px);line-height:1.05;margin:12px 0 22px;letter-spacing:-.035em}.lead{max-width:760px;color:#c6beca;font-size:clamp(18px,3vw,23px)}section{margin-top:28px;padding:24px;border:1px solid #2a2630;border-radius:18px;background:#0b090d}h2{margin:0 0 10px;font-size:22px}p{margin:10px 0;color:#aaa2ae}footer{padding:26px 0 40px;border-top:1px solid #2a2630;color:#918896;font-size:13px}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}</style></head>
<body><header><a href="/" aria-label="OCADE home page"><img src="/brand/ocade-carcc-wordmark.png" alt="OCADE by CARCC CADANE — Command the Next Era." width="2172" height="724" /></a><nav aria-label="Public information"><a href="/">Home</a><a href="/products/ocade">OCADE</a><a href="/about">About</a><a href="/company">Company</a><a href="/founder/haans-antoni">Founder</a><a href="/support">Support</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></header>
<main><p class="eyebrow">${escapeHtml(document.eyebrow)}</p><h1>${escapeHtml(document.heading)}</h1><p class="lead">${escapeHtml(document.lead)}</p>${sections}</main>
<footer>© 2026 CARCC CADANE. Official public information.</footer></body></html>`;
}

function prelaunchPublicResponse(pathname: string): Response | null {
  const html = renderPrelaunchPublicPage(pathname);
  return html
    ? new Response(html, {
        status: 200,
        headers: publicHeaders("text/html; charset=utf-8"),
      })
    : null;
}

function prelaunchSitemapResponse(): Response {
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
    ...PRELAUNCH_PUBLIC_PATHS,
  ]
    .map((pathname) => `  <url><loc>https://ocade.in${pathname}</loc></url>`)
    .join("\n")}\n</urlset>\n`;
  return new Response(body, {
    status: 200,
    headers: publicHeaders("application/xml; charset=utf-8"),
  });
}

function renderPrelaunchPage(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="${NOINDEX}" /><title>CARCC CADANE — OCADE</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#08090b;color:#e6e8ec;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;padding:2rem}main{max-width:32rem;text-align:center;border:1px solid rgba(255,255,255,.08);border-radius:.75rem;background:rgba(255,255,255,.02);padding:3rem 2rem}img{display:block;width:min(28rem,100%);height:auto;margin:0 auto 2rem}.brand{font-size:.75rem;letter-spacing:.32em;text-transform:uppercase;color:#9aa3af}h1{margin:1.25rem 0 0;font-size:1.75rem;font-weight:600}p{margin:1rem 0 0;color:#9aa3af;line-height:1.7}</style></head><body><main><img src="/brand/ocade-carcc-wordmark.png" alt="OCADE by CARCC CADANE — Command the Next Era." width="2172" height="724" /><p class="brand">CARCC CADANE</p><h1>OCADE</h1><p>Scheduled public launch ${LAUNCH_PUBLIC_DATE_LABEL}</p></main></body></html>`;
}

function prelaunchRobotsResponse(decision: LaunchGateDecision): Response {
  const body = [
    "User-agent: *",
    "Disallow: /",
    ...[...PRELAUNCH_PUBLIC_PATHS].map((pathname) => `Allow: ${pathname}`),
    "Allow: /brand/ocade-carcc-wordmark.png",
    "Allow: /brand/ocade-carcc-mark.png",
    "Sitemap: https://ocade.in/sitemap.xml",
    "",
  ].join("\n");
  return new Response(body, {
    status: 200,
    headers: {
      ...publicHeaders("text/plain; charset=utf-8"),
      "retry-after": String(decision.retryAfterSeconds),
    },
  });
}

export function prelaunchResponse(pathname: string, decision: LaunchGateDecision): Response {
  const canonicalPath =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.replace(/\/+$/, "") : pathname;

  if (canonicalPath !== pathname && PRELAUNCH_PUBLIC_PATHS.has(canonicalPath)) {
    return new Response(null, {
      status: 308,
      headers: {
        ...publicHeaders("text/html; charset=utf-8"),
        location: canonicalPath,
      },
    });
  }

  if (pathname === "/robots.txt") return prelaunchRobotsResponse(decision);
  if (pathname === "/sitemap.xml") return prelaunchSitemapResponse();
  if (PRELAUNCH_PUBLIC_PATHS.has(pathname)) {
    return prelaunchPublicResponse(pathname) ?? new Response(renderPrelaunchPage(), {
      status: 503,
      headers: lockedHeaders(decision, "text/html; charset=utf-8"),
    });
  }

  return new Response(renderPrelaunchPage(), {
    status: 503,
    headers: lockedHeaders(decision, "text/html; charset=utf-8"),
  });
}
