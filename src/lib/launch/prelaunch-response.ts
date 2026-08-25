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
      title: "OCADE by CARCC CADANE — Local-first AI workspace",
      description:
        "Official OCADE home page by CARCC CADANE with product, privacy, legal, launch and contact information.",
      eyebrow: "Official OCADE home",
      heading: "OCADE",
      lead: `OCADE is a local-first AI workspace by CARCC CADANE for private chat, research, work and permissioned computer-control tasks. Formal founding and public launch are scheduled for ${LAUNCH_PUBLIC_DATE_LABEL}.`,
      sections: [
        {
          heading: "Private intelligence, permissioned action",
          paragraphs: [
            "Supported AI generation is designed around local inference on the user's device rather than public-cloud AI inference. Optional authentication, Private Sync, current-information retrieval, support, payments and other user-requested online services are separated from normal local generation.",
            "Feature availability varies by device, hardware, platform and release readiness. These public information pages do not grant access to the authenticated product before the launch gate opens.",
          ],
        },
        {
          heading: "CARCC CADANE",
          paragraphs: [
            "CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE. HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE. The official tagline is “Command the Next Era.”",
          ],
        },
        {
          heading: `Formal founding and public launch — ${LAUNCH_PUBLIC_DATE_LABEL}`,
          paragraphs: [
            `CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as its formal founding date and the scheduled public launch of OCADE. Legal, privacy, support, identity and verification pages are available earlier so users and external services can review them before the authenticated product opens.`,
            "The date alone does not open an unfinished build. Production access also requires the separate launch-readiness approval after final coding and release checks.",
          ],
        },
        {
          heading: "Privacy, Terms and contact",
          paragraphs: [
            "The Privacy notice explains Google Sign-In, local-first processing, optional online services and support data. The Terms explain AI limitations, computer-control risk, payments, refunds, liability, acceptable use, investor enquiries and disputes. The Support page explains the current ticket-based contact system.",
          ],
        },
      ],
      structuredData: OCADE_STRUCTURED_DATA,
    };
  }

  if (pathname === "/about") {
    const description =
      "Official information about CARCC CADANE, OCADE, leadership, the 28 August 2026 founding and launch, and investor or strategic-partnership enquiries.";
    return {
      title: "About CARCC CADANE and OCADE",
      description,
      eyebrow: "Official CARCC CADANE information",
      heading: "Building the next era of private AI",
      lead:
        "CARCC CADANE is an independent technology enterprise, business brand and venture building OCADE — a local-first AI workspace designed around private intelligence, user control and permissioned action.",
      sections: [
        {
          heading: "CARCC CADANE",
          paragraphs: [
            "CARCC CADANE is the technology enterprise, business brand and venture behind OCADE. OCADE is the active AI product within that identity. The official CARCC CADANE tagline is “Command the Next Era.”",
            "Public materials use the CARCC CADANE brand name consistently and do not publish an unverified corporate form or registration category.",
          ],
        },
        {
          heading: "OCADE",
          paragraphs: [
            "OCADE is a cross-platform AI workspace for chat, research, work, creation and permissioned computer-control tasks. Supported AI generation is designed around local inference on the user's own hardware where supported.",
            "Optional authentication, Private Sync, current-information retrieval, support, payments and user-requested network services are separated from normal local AI generation.",
          ],
        },
        {
          heading: "Leadership",
          paragraphs: [
            "HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE. Product direction, brand strategy and the OCADE technology vision are led under that role.",
          ],
        },
        {
          heading: `Formal founding and public launch — ${LAUNCH_PUBLIC_DATE_LABEL}`,
          paragraphs: [
            `CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as its formal founding date and the scheduled public launch date for OCADE. Legal, privacy, identity, support and verification pages can be available earlier while the authenticated product remains protected by the launch gate.`,
          ],
        },
        {
          heading: "Investors, strategic partners and future ownership discussions",
          paragraphs: [
            "CARCC CADANE welcomes serious enquiries from prospective investors and strategic partners who want to discuss product strategy, commercial collaboration, future investment or a possible future ownership or equity transaction.",
            "No outside investor or shareholder is publicly announced by this page today. Nothing on this website is an offer to sell securities, an investment prospectus, a solicitation to invest, a promise of allocation, valuation, dividend, return, future listing or a guarantee that equity or shareholding will be offered.",
            "Any future investment, ownership or shareholder arrangement requires a separate private discussion, diligence, valuation, legal documentation, approvals and compliance with the laws that apply to that transaction.",
          ],
        },
        {
          heading: "Investor and partnership contact",
          paragraphs: [
            "Until dedicated investor email infrastructure is activated and verified, prospective investors and strategic partners should use the OCADE ticket system when account intake is available and choose the Investor or Partnership category. Dedicated domain email channels will be published only after they are active and verified.",
          ],
        },
      ],
      structuredData: webPageStructuredData("About CARCC CADANE and OCADE", description, "https://ocade.in/about"),
    };
  }

  if (pathname === "/privacy") {
    const description = "Privacy notice for OCADE by CARCC CADANE, effective 25 August 2026.";
    return {
      title: "Privacy notice — OCADE",
      description,
      eyebrow: "Effective and last updated 25 August 2026",
      heading: "Privacy notice",
      lead:
        "This notice explains how CARCC CADANE handles or intends to handle information for the OCADE website, authentication, local-first AI, Private Sync, support and other user-requested services.",
      sections: [
        {
          heading: "Who is responsible",
          paragraphs: [
            "CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE and is responsible for the OCADE service operations described in this notice. This notice uses the public CARCC CADANE brand identity and does not publish an unverified legal form, registration category, address or corporate status.",
          ],
        },
        {
          heading: "Information OCADE may handle",
          paragraphs: [
            "OCADE may handle account identifiers and authentication events, basic profile and settings data, device registrations, conversations, messages and files under the storage mode you choose, support tickets and messages, security and abuse-prevention records, payment status or provider references if payments are enabled, and feature-specific information needed for a user-requested connector or action.",
            "Do not place passwords, one-time codes, PINs, recovery codes, private keys, full card numbers, CVVs or other payment or authentication secrets in support tickets.",
          ],
        },
        {
          heading: "Google Sign-In",
          paragraphs: [
            "If you choose Google Sign-In, Google may provide OCADE with authentication identifiers and basic account information such as your name, email address and profile image according to the permissions shown during sign-in. OCADE uses that information to authenticate the account, maintain the session, protect the service and provide account features.",
            "Google account information is not sold or used by OCADE for targeted advertising and is not used to train a public AI model.",
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
          heading: "Purposes and service providers",
          paragraphs: [
            "Information may be used to provide requested features, authenticate and secure accounts, synchronize selected data when you choose Private Sync, maintain reliability, prevent abuse, investigate security events, process support or rights requests, maintain payment records when payments are enabled and comply with applicable law.",
            "Depending on the feature, recipients may include Supabase, Cloudflare, Google or another authentication provider, cited source websites, app stores, payment providers and other services necessary to deliver the requested feature. OCADE does not sell personal information to advertisers.",
          ],
        },
        {
          heading: "Retention, deletion and rights",
          paragraphs: [
            "Device-only data remains subject to your device controls. Cloud records are intended to be retained only while reasonably necessary for the account, requested service, security, legal obligation, payment record or dispute. Backup deletion may take additional time and some records may need to be retained where law requires.",
            "Depending on applicable law, you may have rights to access, correct or erase personal information, withdraw consent, object to certain processing or raise a grievance. Use the data-rights route where available or create a Privacy ticket through OCADE Support.",
          ],
        },
        {
          heading: "Users aged 16 or 17",
          paragraphs: [
            "OCADE is intended for users aged 16 or older, but age rules differ by jurisdiction. Where applicable law treats a 16- or 17-year-old as a child for personal-data processing, the required verified parent or lawful-guardian consent must be obtained before the relevant processing unless a lawful exemption applies.",
            "If OCADE does not yet provide the legally required consent flow, that user must wait until legally eligible to use the affected account or personal-data feature.",
          ],
        },
        {
          heading: "Security and contact",
          paragraphs: [
            "OCADE uses measures including access controls, row-level security, restricted storage patterns and security checks appropriate to the relevant feature, but no device, network or online service can guarantee absolute security.",
            "Privacy, security and grievance requests use the OCADE ticket system while dedicated domain email channels are being established. Dedicated email addresses will be published only after they are activated and verified.",
          ],
        },
      ],
      structuredData: webPageStructuredData("OCADE Privacy notice", description, "https://ocade.in/privacy"),
    };
  }

  if (pathname === "/terms") {
    const description = "Terms of service for OCADE by CARCC CADANE, effective 25 August 2026.";
    return {
      title: "Terms of service — OCADE",
      description,
      eyebrow: "Effective and last updated 25 August 2026",
      heading: "Terms of service",
      lead:
        `These Terms apply now to the OCADE public website and to OCADE services as they become available. CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as the formal founding and scheduled public-launch date for OCADE.`,
      sections: [
        {
          heading: "1. Agreement and CARCC CADANE",
          paragraphs: [
            "These Terms govern the OCADE public website and every OCADE service that becomes available under the CARCC CADANE brand. CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE. HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE.",
            "These Terms use the public CARCC CADANE brand identity and do not describe a Private Limited Company, LLP, listed company or other legal form unless that status is separately established and published.",
          ],
        },
        {
          heading: "2. Effective date, eligibility and launch",
          paragraphs: [
            `These Terms are effective from 25 August 2026. CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as its formal founding date and scheduled public launch date for OCADE. Public legal and verification pages can be available earlier without opening the authenticated product.`,
            "OCADE is intended for users aged 16 or older. A user aged 16 or 17 may use account or personal-data features only where all consent or authorization required by applicable law has been validly obtained and the relevant OCADE flow supports it.",
          ],
        },
        {
          heading: "3. Local-first service architecture",
          paragraphs: [
            "OCADE combines local software with optional online authentication, Private Sync, current-information retrieval, support, payments and permissioned computer or remote-device features. Supported chat generation is designed to run on the user's device rather than through a public-cloud AI inference provider.",
            "Feature availability can vary by device, hardware, browser, operating system, region, release stage and plan.",
          ],
        },
        {
          heading: "4. Accounts and security",
          paragraphs: [
            "You are responsible for safeguarding your device, account, recovery methods and third-party credentials. Never give OCADE Support your password, one-time code, PIN, recovery code, private key, full card number, CVV or other payment secret.",
          ],
        },
        {
          heading: "5. AI output can be inaccurate or wrong",
          paragraphs: [
            "OCADE can produce inaccurate, incomplete, outdated, misleading, duplicated, fabricated or otherwise incorrect output. You must independently verify important output before relying on it.",
            "OCADE is not a substitute for a qualified lawyer, doctor, accountant, tax professional, investment or financial adviser, cybersecurity professional, emergency service or another licensed professional. You remain responsible for decisions you make using OCADE.",
          ],
        },
        {
          heading: "6. High-impact decisions",
          paragraphs: [
            "Do not rely on OCADE alone for medical, legal, tax, accounting, investment, lending, insurance, employment, education, safety, cybersecurity, emergency, regulatory or other high-impact decisions. Obtain appropriate independent verification or professional advice when a decision can materially affect money, health, safety, legal rights or another person.",
          ],
        },
        {
          heading: "7. Computer control and user supervision",
          paragraphs: [
            "Permissioned computer-control features may open applications, read visible screens, type, click, navigate websites, create or edit files, move or delete files, interact with accounts and perform other actions you authorize. AI can choose the wrong control, modify or delete the wrong file, submit incorrect information, make an unintended action or send content to an unintended destination.",
            "You may use these features only on systems, accounts and content you are authorized to control. Confirmation controls do not remove your responsibility to supervise the agent, review important work, maintain appropriate backups and stop the agent when an action is wrong or unexpected.",
          ],
        },
        {
          heading: "8. Your content and commercial use of output",
          paragraphs: [
            "You retain the rights you have in prompts, files and other content you provide. Subject to applicable law, third-party rights and separately disclosed licences, you may use OCADE-generated output for personal or commercial purposes, including posts, reels, videos, documents, presentations, software and business work.",
            "AI output is not guaranteed to be unique, copyrightable, accurate or free of third-party rights, and other users may receive similar output.",
          ],
        },
        {
          heading: "9. OCADE and CARCC CADANE intellectual property",
          paragraphs: [
            "CARCC CADANE and its applicable rights holders retain their rights in OCADE software, original code, interfaces, designs, systems, proprietary technology, brand materials, logos, product identity and the tagline “Command the Next Era.” Third-party and open-source materials remain governed by their own licences and rights.",
          ],
        },
        {
          heading: "10. Acceptable use and account enforcement",
          paragraphs: [
            "You may not use OCADE to violate law, infringe rights, access systems without authorization, distribute malware, commit fraud, facilitate theft, evade security or payment controls, attack OCADE or another service, intentionally harm people or repeatedly violate these Terms.",
            "CARCC CADANE may limit, suspend or terminate online access for illegal activity, hacking, malware, fraud, abuse, security-bypass attempts, attacks, non-payment, material or repeated Terms violations, security emergencies or legal requirements.",
          ],
        },
        {
          heading: "11. Free launch and future paid services",
          paragraphs: [
            "OCADE may initially be offered without charge while product and payment work is completed. Free availability can change. Paid plans, subscriptions, fixed-duration access, add-ons or other commercial services may be introduced later.",
            "Before a paid purchase, checkout must display the applicable price, taxes where required, duration or renewal rule, cancellation information and purchase-specific conditions.",
          ],
        },
        {
          heading: "12. Refunds and payment errors",
          paragraphs: [
            "Except where applicable law requires otherwise, a paid digital service is not eligible for a voluntary refund after the purchased service has been activated, accessed or used. Changing your mind after activation or use does not create a contractual right to a refund.",
            "A refund, reversal, credit or other remedy may still be required for a duplicate charge, billing or payment-processing error, non-delivery, unauthorized transaction where law provides protection, material service defect or deficiency, or another non-waivable consumer right.",
          ],
        },
        {
          heading: "13. Third-party services",
          paragraphs: [
            "OCADE may depend on Google, Supabase, Cloudflare, app stores, payment providers, network operators, cited websites, search or retrieval sources and other third parties. CARCC CADANE does not control those services and cannot guarantee their availability, accuracy, security, pricing, policies or continued operation.",
          ],
        },
        {
          heading: "14. Service provided as available",
          paragraphs: [
            "To the maximum extent permitted by applicable law, OCADE is provided on an “as is” and “as available” basis. CARCC CADANE does not promise uninterrupted, error-free, loss-free, perfectly secure or perfectly accurate operation, or that every defect will be corrected.",
            "You should maintain independent records and backups for information that is important to you.",
          ],
        },
        {
          heading: "15. Limitation of liability and assumed risk",
          paragraphs: [
            "To the maximum extent permitted by applicable law, CARCC CADANE, OCADE and their founder, personnel, contractors and service providers are not liable for indirect, incidental, special, exemplary, punitive or consequential loss; lost profits, revenue, business, opportunities or anticipated savings; investment or trading loss; data loss or corruption; business interruption; reputational harm; device, software or account problems; or losses caused by reliance on AI output, computer-control actions, third-party services, external information or incorrect professional decisions.",
            "This exclusion is intended to apply broadly, including to legal, medical, accounting, tax, investment, financial, cybersecurity and business decisions made using OCADE. Where liability cannot lawfully be excluded, and except for liability that applicable law does not permit to be capped, any aggregate contractual liability arising from a paid OCADE service is limited to the amount actually paid by the claimant for the affected service in the three months immediately before the event giving rise to the claim.",
            "A free service does not create a promise to pay compensation merely because it was offered without charge. Nothing here excludes, limits or waives a statutory right, remedy or liability that applicable law does not permit a contract to exclude, limit or waive.",
          ],
        },
        {
          heading: "16. Indemnity for unlawful or unauthorized use",
          paragraphs: [
            "To the extent permitted by law, you agree to be responsible for third-party claims and reasonable losses caused by your unlawful use of OCADE, intentional infringement of another person's rights, fraud or use of OCADE to access systems, accounts or content without authorization.",
          ],
        },
        {
          heading: "17. Investors, future ownership and shareholders",
          paragraphs: [
            "Public references to investors, future ownership, equity or shareholding are invitations to begin a private discussion only. They are not an offer of securities, investment prospectus, solicitation to invest, crowdfunding offer, promise of allocation, valuation, dividend, liquidity event, return or future listing.",
            "Any future investment, ownership or shareholder arrangement requires separate diligence, legal advice, documentation, approvals, valuation discussions and compliance with the laws that apply to that transaction. No outside shareholder or investor is announced by these Terms.",
          ],
        },
        {
          heading: "18. Governing law and dispute process",
          paragraphs: [
            "These Terms are governed by the laws of India, without removing mandatory protections that may apply to a user in another jurisdiction. The parties should first try in good faith to resolve a dispute through OCADE Support and direct negotiation.",
            "If an eligible dispute is not resolved informally, the parties may use mediation and, where the dispute is legally capable of arbitration, arbitration under the Arbitration and Conciliation Act, 1996, in English, by a mutually appointed sole arbitrator or another lawful appointment method. These Terms do not create an exclusive court-jurisdiction clause and do not block access to a consumer commission, regulator, non-arbitrable statutory forum, urgent interim relief or another forum that applicable law makes available and does not permit the parties to exclude.",
          ],
        },
        {
          heading: "19. Communications, changes and feature parity",
          paragraphs: [
            "OCADE may send essential authentication, account, security, service, transaction, support and legal communications. Marketing communications will be sent only where the required permission exists and will include an applicable way to opt out.",
            "CARCC CADANE may update these Terms as OCADE changes. Material changes will be identified through an appropriate notice and fresh consent will be requested where the law requires it.",
            "Web, Windows, macOS, Android, iOS, browser-extension and other releases may differ in capability, timing and availability. A source-code feature, demo, roadmap or test build is not a promise of production availability on every platform.",
          ],
        },
        {
          heading: "20. Support, legal, privacy and investor contact",
          paragraphs: [
            "OCADE uses a ticket-based support system rather than publishing unverified email addresses. Supported categories include Account, Billing, Technical, Privacy, Security, Feedback, Legal, Investor and Partnership. Dedicated domain email channels may be published later only after they are activated and verified.",
            "Nothing in these Terms removes consumer, data-protection or other statutory rights that applicable law does not allow a contract to waive.",
          ],
        },
      ],
      structuredData: webPageStructuredData("OCADE Terms of service", description, "https://ocade.in/terms"),
    };
  }

  if (pathname === "/support") {
    const description =
      "Current support, privacy, legal, security, investor and partnership contact options for OCADE by CARCC CADANE.";
    return {
      title: "Support and contact — OCADE",
      description,
      eyebrow: "Support and contact",
      heading: "OCADE support",
      lead:
        "OCADE uses a ticket-based support queue and administrative review workspace. Dedicated domain email addresses will be published only after they are activated and verified.",
      sections: [
        {
          heading: "Ticket categories",
          paragraphs: [
            "Account, Billing, Technical, Privacy, Security, Feedback, Legal, Investor and Partnership are the intended support categories. Signed-in tickets can be attached to the user's account and reviewed in the OCADE administrative support workspace once account intake is open.",
          ],
        },
        {
          heading: "Privacy, legal and security requests",
          paragraphs: [
            "Use the relevant ticket category when intake is available. Do not place passwords, one-time codes, PINs, recovery codes, private keys, full card numbers, CVVs or other authentication or payment secrets in a ticket.",
          ],
        },
        {
          heading: "Investor and partnership enquiries",
          paragraphs: [
            "Prospective investors and strategic partners may use the Investor or Partnership category when account intake is available. An enquiry begins a private discussion only; it is not an offer of securities, solicitation to invest or promise that equity or shareholding will be offered.",
          ],
        },
        {
          heading: "Dedicated email channels",
          paragraphs: [
            "Support, privacy, legal, security and investor domain email addresses may be added later. No address is published as active until the mailbox, delivery, access controls and handling process have been verified.",
          ],
        },
      ],
      structuredData: webPageStructuredData("OCADE Support and contact", description, "https://ocade.in/support"),
    };
  }

  if (pathname === "/company") {
    return {
      title: "CARCC CADANE — Company and founder information",
      description: "Official information about CARCC CADANE, OCADE and founder HAANS ANTONI.",
      eyebrow: "Official company information",
      heading: "CARCC CADANE",
      lead: `CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE. ${LAUNCH_PUBLIC_DATE_LABEL} is recorded as its formal founding date and OCADE's scheduled public launch date.`,
      sections: [
        {
          heading: "Technology enterprise and brand",
          paragraphs: [
            "CARCC CADANE develops technology products and systems under a single enterprise and brand identity. OCADE is its active AI product. Public pages do not publish an unverified corporate form or registration category.",
          ],
        },
        {
          heading: "Leadership and product",
          paragraphs: [
            "HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE. OCADE is the active product in development and is being prepared for its controlled public opening.",
          ],
        },
        {
          heading: "Launch status",
          paragraphs: [
            `CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as its formal founding date and OCADE public-launch date. The authenticated product remains protected until both the launch date and production-readiness approval are satisfied.`,
          ],
        },
      ],
      structuredData: organizationStructuredData(),
    };
  }

  if (pathname === "/founder/haans-antoni") {
    return {
      title: "HAANS ANTONI — Founder, CEO and Chairman of CARCC CADANE",
      description: "Official profile connecting HAANS ANTONI with CARCC CADANE and OCADE.",
      eyebrow: "Official founder profile",
      heading: "HAANS ANTONI",
      lead: "HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE.",
      sections: [
        {
          heading: "Role",
          paragraphs: [
            "Haans Antoni leads product direction, brand strategy and the technology vision for OCADE, a local-first AI workspace being prepared for public launch.",
            "This page records the founder's public role. It does not imply funding, press coverage, trademark registration, public listing or another status that has not been independently established.",
          ],
        },
        {
          heading: "Official references",
          paragraphs: [
            "The CARCC CADANE company page, About page and OCADE product page are the canonical first-party references for this public identity. Search engines decide independently how and when those facts appear.",
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
      eyebrow: "OCADE",
      heading: "Private intelligence. Permissioned action.",
      lead: `OCADE is a local-inference AI workspace created by Haans Antoni under CARCC CADANE. Public launch is scheduled for ${LAUNCH_PUBLIC_DATE_LABEL}.`,
      sections: [
        {
          heading: "Product boundary",
          paragraphs: [
            "Supported chat generation is designed to run on the user's device. Sign-in, optional Private Sync, support and permissioned current-information retrieval can require network services; those services are not public-cloud AI inference.",
            "Web launch, Windows, macOS, Android, iOS and browser-extension releases are separate readiness claims and may not become available at exactly the same time.",
          ],
        },
        {
          heading: "Launch access",
          paragraphs: [
            "OCADE may initially be available without charge while final product and payment work is completed. Paid plans may be introduced later only with checkout terms displayed before purchase.",
          ],
        },
        {
          heading: "AI and computer control",
          paragraphs: [
            "AI can be inaccurate. Permissioned computer-control features can also take an unintended action. Important work must be reviewed and high-impact decisions should not rely on OCADE alone.",
          ],
        },
      ],
      structuredData: OCADE_STRUCTURED_DATA,
    };
  }

  return null;
}

function renderPrelaunchPublicPage(pathname: string): string | null {
  const document = publicDocument(pathname);
  if (!document) return null;

  const canonical = `https://ocade.in${pathname}`;
  const sections = document.sections
    .map(
      (section, index) =>
        `<section class="card" style="--i:${index}"><h2>${escapeHtml(section.heading)}</h2>${section.paragraphs
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
<style>
:root{color-scheme:dark;--bg:#050506;--surface:#0b090d;--surface2:#111016;--text:#f4f0f7;--muted:#aaa2ae;--stroke:#28232c;--aub:#3c234c;--gold:#d2a64d;--crimson:#551b2a}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% -10%,rgba(96,57,123,.24),transparent 31rem),radial-gradient(circle at 92% 32%,rgba(142,104,35,.10),transparent 27rem),var(--bg);color:var(--text);font:15px/1.75 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;overflow-x:hidden}body:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.16;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:54px 54px;mask-image:linear-gradient(to bottom,#000,transparent 78%)}a{color:inherit}header,main,footer{width:min(1040px,calc(100% - 32px));margin:auto;position:relative;z-index:1}header{padding:22px 0 8px}.brand{display:block;width:min(410px,76vw);filter:drop-shadow(0 18px 38px rgba(0,0,0,.55))}nav{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:999px;background:rgba(11,9,13,.74);backdrop-filter:blur(18px);box-shadow:inset 0 1px rgba(255,255,255,.04),0 14px 50px rgba(0,0,0,.24)}nav a{padding:7px 11px;border-radius:999px;text-decoration:none;color:#b8b0bc;font-size:12px;transition:.2s ease}nav a:hover,nav a:focus-visible{color:#fff;background:rgba(255,255,255,.07);outline:none}main{padding:48px 0 80px}.hero{position:relative;isolation:isolate;overflow:hidden;padding:48px clamp(22px,5vw,58px);border:1px solid rgba(255,255,255,.09);border-radius:34px;background:linear-gradient(145deg,rgba(17,16,22,.82),rgba(5,5,6,.62));box-shadow:0 36px 120px rgba(0,0,0,.5),inset 0 1px rgba(255,255,255,.045);backdrop-filter:blur(20px);perspective:900px}.orb{position:absolute;right:-75px;top:-105px;width:290px;height:290px;border-radius:50%;border:1px solid rgba(255,255,255,.08);background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.18),rgba(93,52,122,.12) 30%,rgba(0,0,0,0) 70%);box-shadow:inset -38px -38px 80px rgba(0,0,0,.67),0 36px 90px rgba(0,0,0,.4);transform:rotateX(62deg) rotateZ(-24deg);animation:orbit 34s linear infinite;z-index:-1}.orb2{position:absolute;right:20%;bottom:-75px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle at 30% 25%,rgba(221,181,91,.20),rgba(78,43,102,.09) 43%,transparent 70%);filter:blur(.4px);z-index:-1}.eyebrow{margin:0;color:var(--gold);font-size:11px;font-weight:800;letter-spacing:.25em;text-transform:uppercase}.hero h1{max-width:790px;margin:14px 0 20px;font-size:clamp(42px,8vw,76px);line-height:1.01;letter-spacing:-.045em}.lead{max-width:780px;margin:0;color:#c8c0cb;font-size:clamp(17px,2.6vw,22px);line-height:1.65}.grid{display:grid;gap:16px;margin-top:24px}.card{position:relative;overflow:hidden;padding:24px;border:1px solid rgba(255,255,255,.075);border-radius:24px;background:rgba(255,255,255,.018);box-shadow:inset 0 1px rgba(255,255,255,.04),0 18px 54px rgba(0,0,0,.16);transform:translateZ(0);transition:transform .28s ease,border-color .28s ease,background .28s ease}.card:before{content:"";position:absolute;inset:0 auto 0 0;width:1px;background:linear-gradient(transparent,rgba(210,166,77,.55),transparent);opacity:.2}.card:hover{transform:perspective(900px) translateY(-3px) rotateX(.6deg);border-color:rgba(255,255,255,.13);background:rgba(255,255,255,.026)}h2{margin:0 0 10px;font-size:20px;letter-spacing:-.02em}p{margin:9px 0;color:var(--muted)}footer{padding:28px 0 42px;border-top:1px solid rgba(255,255,255,.07);color:#8f8794;font-size:12px}footer strong{color:#d8d2dc}.footer-links{display:flex;flex-wrap:wrap;gap:14px;margin-top:10px}.footer-links a{color:#aaa2ae}@keyframes orbit{to{transform:rotateX(62deg) rotateZ(336deg)}}@media(min-width:760px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.card:nth-child(3n){grid-column:span 2}}@media(max-width:700px){header{padding-top:14px}nav{border-radius:22px}.hero{padding-top:38px}.orb{opacity:.62}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.orb{animation:none}.card{transition:none}.card:hover{transform:none}}
</style></head>
<body><header><a href="/" aria-label="OCADE home"><img class="brand" src="/brand/ocade-carcc-wordmark.png" alt="OCADE by CARCC CADANE — Command the Next Era." width="2172" height="724" /></a><nav aria-label="Public information"><a href="/">Home</a><a href="/about">About</a><a href="/products/ocade">OCADE</a><a href="/company">Company</a><a href="/founder/haans-antoni">Founder</a><a href="/support">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></header>
<main><section class="hero"><div class="orb" aria-hidden="true"></div><div class="orb2" aria-hidden="true"></div><p class="eyebrow">${escapeHtml(document.eyebrow)}</p><h1>${escapeHtml(document.heading)}</h1><p class="lead">${escapeHtml(document.lead)}</p></section><div class="grid">${sections}</div></main>
<footer><strong>CARCC CADANE</strong><div>OCADE — Command the Next Era.</div><div class="footer-links"><a href="/about">About</a><a href="/support">Contact</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div><div style="margin-top:10px">© 2026 CARCC CADANE.</div></footer></body></html>`;
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

/** Minimal dependency-free page for every route that must remain locked. */
function renderPrelaunchPage(): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="robots" content="${NOINDEX}" /><title>CARCC CADANE — OCADE</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 20%,#1c1023 0,#08090b 42%,#050506 100%);color:#e6e8ec;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;padding:2rem}main{max-width:34rem;text-align:center;border:1px solid rgba(255,255,255,.08);border-radius:24px;background:rgba(255,255,255,.025);box-shadow:0 28px 100px rgba(0,0,0,.48);backdrop-filter:blur(18px);padding:3rem 2rem}img{display:block;width:min(28rem,100%);height:auto;margin:0 auto 2rem}.brand{font-size:.72rem;letter-spacing:.32em;text-transform:uppercase;color:#a9a1ad}h1{margin:1.25rem 0 0;font-size:1.9rem;font-weight:650;letter-spacing:-.02em}p{margin:1rem 0 0;color:#9aa3af;line-height:1.7;font-size:.95rem}</style></head><body><main><img src="/brand/ocade-carcc-wordmark.png" alt="OCADE by CARCC CADANE — Command the Next Era." width="2172" height="724" /><p class="brand">CARCC CADANE</p><h1>OCADE</h1><p>Authenticated product access is not open yet.</p><p>Public information, Privacy, Terms, About and Support remain available through the navigation on the OCADE home page.</p></main></body></html>`;
}

/** Robots remains crawlable while the authenticated product is locked. */
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

/**
 * The response for any locked request. Public factual/legal pages stay 200;
 * everything else remains a 503/no-store/noindex response.
 */
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
    return (
      prelaunchPublicResponse(pathname) ??
      new Response(renderPrelaunchPage(), {
        status: 503,
        headers: lockedHeaders(decision, "text/html; charset=utf-8"),
      })
    );
  }

  return new Response(renderPrelaunchPage(), {
    status: 503,
    headers: lockedHeaders(decision, "text/html; charset=utf-8"),
  });
}
