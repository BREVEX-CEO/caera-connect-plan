/**
 * Pre-launch edge responses.
 *
 * Before the production product is open, the worker answers every public
 * request itself. No application JavaScript, authenticated workspace bundle or
 * app API is reachable. The health route, a tightly scoped set of factual SEO
 * documents, their two supplied brand images, robots and sitemap stay public.
 *
 *   /api/health  — deployment verification (handled before this module)
 * The exact launch time never appears in any response body or header; only the
 * public date label does. Factual pages do not grant access to the product.
 */

import {
  FOUNDER_STRUCTURED_DATA,
  OCADE_STRUCTURED_DATA,
  organizationStructuredData,
} from "../public-identity";
import { LAUNCH_PUBLIC_DATE_LABEL, type LaunchGateDecision } from "./launch-window";

/** Paths the edge gate may answer while the product is locked. */
export const PRELAUNCH_PUBLIC_PATHS = new Set([
  "/",
  "/privacy",
  "/terms",
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

type PublicDocument = {
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  lead: string;
  sections: Array<{ heading: string; paragraphs: string[] }>;
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
        "Official pre-launch home page for OCADE, a local-first AI workspace by CARCC CADANE.",
      eyebrow: "Official OCADE home",
      heading: "OCADE",
      lead: `OCADE is a local-first AI workspace by CARCC CADANE. Chat generation is designed to run on the user's device, while optional sign-in, Private Sync and permissioned current-information services use disclosed network services. Public launch is planned for ${LAUNCH_PUBLIC_DATE_LABEL}.`,
      sections: [
        {
          heading: "What OCADE is",
          paragraphs: [
            "OCADE is being built as a cross-platform AI workspace for chat, research, work and permissioned computer-control tasks. Its normal AI generation path is designed around local inference rather than public-cloud AI inference.",
            "Feature availability differs by platform, hardware and release readiness. A pre-launch information page does not mean the authenticated product or every native application is already publicly available.",
          ],
        },
        {
          heading: "Privacy and account services",
          paragraphs: [
            "Device-only processing keeps supported data on the device. Optional account, Private Sync, authentication, current-information retrieval and other user-requested network features can use disclosed online services.",
            "Read the Privacy notice for the intended data handling and the Terms of service for the intended service rules before OCADE launches.",
          ],
        },
        {
          heading: "Current status",
          paragraphs: [
            `OCADE remains pre-launch until ${LAUNCH_PUBLIC_DATE_LABEL}. The authenticated application, application JavaScript and private product APIs remain blocked by the production launch gate until the authorized opening.`,
          ],
        },
      ],
      structuredData: OCADE_STRUCTURED_DATA,
    };
  }
  if (pathname === "/privacy") {
    const description = "Pre-launch privacy notice describing the intended data handling for OCADE.";
    return {
      title: "Privacy notice — OCADE",
      description,
      eyebrow: "Last updated 15 August 2026",
      heading: "Privacy notice",
      lead:
        "This notice explains the intended data handling for OCADE. It will take effect only after legal review, contact-channel activation and publication with the launched service.",
      sections: [
        {
          heading: "Who is responsible",
          paragraphs: [
            "Before incorporation and formal assignment, Haans Antoni operates the CARCC CADANE brand and is the proposed data fiduciary for OCADE. The final notice must replace this statement with the verified legal entity name, registered address, grievance contact and privacy contact before launch.",
          ],
        },
        {
          heading: "Data OCADE may handle",
          paragraphs: [
            "OCADE may handle account identifiers and authentication events when you sign in; profile, settings, device registrations and subscription records; conversations, messages and files under the storage mode you choose; security and failure records designed to avoid raw user content; and payment status or provider references when payment features are enabled.",
            "Full card details, UPI PINs and payment credentials are intended to remain with the applicable payment provider rather than OCADE.",
          ],
        },
        {
          heading: "Local-first does not mean local-only",
          paragraphs: [
            "Device-only or local processing keeps supported data on your device. Private Sync stores selected account data in the configured Supabase service. Current-information requests, mobile pairing and payments can send the minimum necessary data to the disclosed service after the applicable choice or request.",
            "Chat generation is not sent to a public-cloud AI provider. OCADE must not silently move device-only content to remote storage.",
          ],
        },
        {
          heading: "Purposes, sharing and international processing",
          paragraphs: [
            "Data is intended to be used to provide the service you request, secure accounts and devices, enforce entitlements, maintain reliability, comply with law and respond to support or rights requests.",
            "Depending on the feature, recipients may include Supabase, Cloudflare, cited search or source sites, authentication providers, app stores and payment providers. Final provider locations, retention terms and cross-border safeguards must be verified before those features are enabled.",
          ],
        },
        {
          heading: "Retention, deletion and your choices",
          paragraphs: [
            "Device-only data remains under your device controls. Cloud records should be retained only while necessary for the stated purpose, legal obligations, security and dispute handling. Exact retention periods and backup-deletion windows are not yet approved and must be added before launch.",
            "Depending on applicable law, you may request access, correction, erasure, withdrawal of consent or grievance handling. OCADE must verify a requester without collecting more identity data than necessary.",
          ],
        },
        {
          heading: "Cookies, security and children",
          paragraphs: [
            "The audited source does not include advertising or third-party analytics trackers. Local storage needed for authentication, preferences, security and offline operation is treated as essential. Any future non-essential analytics or marketing technology must remain off until the legally required user choice is available.",
            "Age eligibility and parental-consent handling are not yet finalized. OCADE uses access controls, row-level security and restricted storage patterns, but no service can promise absolute security. A working grievance and privacy contact must be published before launch.",
          ],
        },
      ],
      structuredData: webPageStructuredData("OCADE Privacy notice", description, "https://ocade.in/privacy"),
    };
  }
  if (pathname === "/terms") {
    const description = "Pre-launch terms describing the intended service rules for OCADE.";
    return {
      title: "Terms of service — OCADE",
      description,
      eyebrow: "Last updated 16 August 2026",
      heading: "Terms of service",
      lead:
        "These draft terms describe the intended service rules. They are not effective until legal review, publication and acceptance through the launched service.",
      sections: [
        {
          heading: "Provider and eligibility",
          paragraphs: [
            "The final terms must identify the incorporated provider or, if still lawful and intended, Haans Antoni operating the CARCC CADANE brand. Users must have legal capacity to contract. Age and parental-consent requirements must be finalized before launch.",
          ],
        },
        {
          heading: "OCADE service",
          paragraphs: [
            "OCADE combines local software with optional online account, Private Sync, current-information retrieval, payment and remote-device features. Chat generation stays on the user's device. Feature availability varies by platform, hardware, region and plan.",
            "Pre-release source, demos and test evidence are not promises that a production feature is available.",
          ],
        },
        {
          heading: "Accounts, subscriptions and payments",
          paragraphs: [
            "You are responsible for protecting your account and devices and for keeping recovery information current. OCADE is free during launch and nothing can be purchased today. Plan prices shown elsewhere in the product are for reference only.",
            "If paid plans are introduced, applicable taxes, currency conversion, renewal, cancellation and refund terms must be shown before payment and comply with mandatory consumer rights.",
          ],
        },
        {
          heading: "Your data and content",
          paragraphs: [
            "You retain rights in content you submit. You grant only the permissions needed to provide the selected features, secure the service and meet legal obligations. You remain responsible for having permission to use content, accounts and systems that OCADE accesses at your direction.",
            "The OCADE Privacy notice describes the intended data handling for the service.",
          ],
        },
        {
          heading: "AI and computer-control safety",
          paragraphs: [
            "AI output may be inaccurate or incomplete and must be checked before reliance. Computer control can open apps, type, read screens and act on files or accounts. Users must supervise important actions, respect confirmation prompts and stop the agent when an action is wrong.",
            "OCADE is not a substitute for professional medical, legal or financial advice.",
          ],
        },
        {
          heading: "Acceptable use and legal review",
          paragraphs: [
            "You may not use OCADE to break law, infringe rights, access systems without permission, distribute malware, evade security or payment controls, or harm people.",
            "Consumer rights that cannot be waived remain intact. Final warranty, liability, governing-law and dispute wording requires legal review before these terms become effective.",
          ],
        },
      ],
      structuredData: webPageStructuredData("OCADE Terms of service", description, "https://ocade.in/terms"),
    };
  }
  if (pathname === "/company") {
    return {
      title: "CARCC CADANE — Company and founder information",
      description:
        "Official pre-launch information about CARCC CADANE, OCADE and founder HAANS ANTONI.",
      eyebrow: "Official company information",
      heading: "CARCC CADANE",
      lead: `CARCC CADANE is the independent venture behind OCADE, led from Bengaluru, Karnataka, India by HAANS ANTONI as CEO, Chairman and Founder. Public launch is planned for ${LAUNCH_PUBLIC_DATE_LABEL}.`,
      sections: [
        {
          heading: "Current status",
          paragraphs: [
            "CARCC CADANE is currently a pre-launch brand operated by Haans Antoni. This page does not claim that an Indian company has already been incorporated. CIN, GSTIN, registered-office and registration claims will appear only after independent verification.",
            `The venture records ${LAUNCH_PUBLIC_DATE_LABEL} as its planned founding and public-launch date. Before that date, it is described as planned or pre-launch rather than already founded or launched.`,
          ],
        },
        {
          heading: "Leadership and product",
          paragraphs: [
            "HAANS ANTONI publicly serves as CEO, Chairman and Founder of the CARCC CADANE venture and directs the OCADE product vision.",
            "OCADE is the active product in development. Passing source tests or a deployed pre-launch page is not a claim that every native app, store release or production integration is available.",
          ],
        },
      ],
      structuredData: organizationStructuredData(),
    };
  }
  if (pathname === "/founder/haans-antoni") {
    return {
      title: "HAANS ANTONI — CEO, Chairman and Founder of CARCC CADANE",
      description: "Official profile connecting HAANS ANTONI with CARCC CADANE and OCADE.",
      eyebrow: "Official founder profile",
      heading: "HAANS ANTONI",
      lead: "Haans Antoni is CEO, Chairman and Founder of CARCC CADANE and creator of OCADE, based in Bengaluru, Karnataka, India.",
      sections: [
        {
          heading: "Role",
          paragraphs: [
            "Haans Antoni leads the product direction for OCADE, a local-first AI workspace being prepared for public launch.",
            "This profile records the founder's role. It does not imply incorporation, trademark registration, funding, press coverage or public listing that has not been independently verified.",
          ],
        },
        {
          heading: "Official references",
          paragraphs: [
            "The CARCC CADANE company profile and OCADE product profile are the canonical first-party references. Search engines decide independently how and when these facts appear.",
          ],
        },
      ],
      structuredData: FOUNDER_STRUCTURED_DATA,
    };
  }
  if (pathname === "/products/ocade") {
    return {
      title: "OCADE — Local-first AI workspace by CARCC CADANE",
      description: "Official pre-launch product information for OCADE by CARCC CADANE.",
      eyebrow: "Pre-launch product",
      heading: "OCADE",
      lead: `OCADE is a local-inference AI workspace created by Haans Antoni under CARCC CADANE. Public launch is planned for ${LAUNCH_PUBLIC_DATE_LABEL}.`,
      sections: [
        {
          heading: "Product boundary",
          paragraphs: [
            "Chat generation is designed to run on the user's device. Sign-in, optional Private Sync and permissioned current-information retrieval require network services; they are not public-cloud AI inference.",
            "Web launch, desktop native, Android native, iOS native and extension-store publication are separate readiness claims.",
          ],
        },
        {
          heading: "Free launch",
          paragraphs: [
            "OCADE is configured for a free launch. There is no ordinary paid checkout or paid feature gate during this launch window.",
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
<script type="application/ld+json">${structuredData}</script>
<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#050505;color:#eeeaf1;font:16px/1.7 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}a{color:inherit}header,main,footer{width:min(920px,calc(100% - 32px));margin:auto}header{padding:28px 0 18px}header img{display:block;width:min(540px,100%);height:auto}nav{display:flex;flex-wrap:wrap;gap:18px;padding:16px 0;border-top:1px solid #2a2630;border-bottom:1px solid #2a2630}main{padding:56px 0}.eyebrow{color:#d6a64f;font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}h1{font-size:clamp(42px,8vw,76px);line-height:1.05;margin:12px 0 22px;letter-spacing:-.035em}.lead{max-width:760px;color:#c6beca;font-size:clamp(18px,3vw,23px)}section{margin-top:28px;padding:24px;border:1px solid #2a2630;border-radius:18px;background:#0b090d}h2{margin:0 0 10px;font-size:22px}p{margin:10px 0;color:#aaa2ae}footer{padding:26px 0 40px;border-top:1px solid #2a2630;color:#918896;font-size:13px}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}</style></head>
<body><header><a href="/" aria-label="OCADE home page"><img src="/brand/ocade-carcc-wordmark.png" alt="OCADE by CARCC CADANE — Command the Next Era." width="2172" height="724" /></a><nav aria-label="Public information"><a href="/">Home</a><a href="/products/ocade">OCADE</a><a href="/company">Company</a><a href="/founder/haans-antoni">Founder</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></header>
<main><p class="eyebrow">${escapeHtml(document.eyebrow)}</p><h1>${escapeHtml(document.heading)}</h1><p class="lead">${escapeHtml(document.lead)}</p>${sections}</main>
<footer>© 2026 CARCC CADANE. Pre-launch factual information. <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></footer></body></html>`;
}

function prelaunchPublicResponse(pathname: string): Response | null {
  const html = renderPrelaunchPublicPage(pathname);
  return html
    ? new Response(html, { status: 200, headers: publicHeaders("text/html; charset=utf-8") })
    : null;
}

function prelaunchSitemapResponse(): Response {
  const urls = [...PRELAUNCH_PUBLIC_PATHS]
    .map((pathname) => `  <url><loc>https://ocade.in${pathname}</loc></url>`)
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, {
    status: 200,
    headers: publicHeaders("application/xml; charset=utf-8"),
  });
}

/** Minimal, dependency-free pre-launch page. Contains no application script. */
export function renderPrelaunchPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="${NOINDEX}" />
    <title>CARCC CADANE — OCADE</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #08090b;
        color: #e6e8ec;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        padding: 2rem;
      }
      main {
        max-width: 32rem;
        text-align: center;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 0.75rem;
        background: rgba(255, 255, 255, 0.02);
        padding: 3rem 2rem;
      }
      img { display: block; width: min(28rem, 100%); height: auto; margin: 0 auto 2rem; }
      .brand {
        font-size: 0.75rem;
        letter-spacing: 0.32em;
        text-transform: uppercase;
        color: #9aa3af;
      }
      h1 { margin: 1.25rem 0 0; font-size: 1.75rem; font-weight: 600; letter-spacing: -0.01em; }
      p { margin: 1rem 0 0; color: #9aa3af; line-height: 1.7; font-size: 0.95rem; }
    </style>
  </head>
  <body>
    <main>
      <img src="/brand/ocade-carcc-wordmark.png" alt="OCADE by CARCC CADANE — Command the Next Era." width="2172" height="724" />
      <p class="brand">CARCC CADANE</p>
      <h1>OCADE</h1>
      <p>Planned launch ${LAUNCH_PUBLIC_DATE_LABEL}</p>
    </main>
  </body>
</html>
`;
}

/** Disallow-all robots directive served while the product is locked. */
export function prelaunchRobotsResponse(decision: LaunchGateDecision): Response {
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
 * The response for any locked request. `503 + Retry-After` for page and asset
 * requests; `/robots.txt` keeps a crawlable 200 disallow-all directive so
 * crawlers record the rule instead of retrying an error.
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
  if (PRELAUNCH_PUBLIC_PATHS.has(pathname)) return prelaunchPublicResponse(pathname)!;
  return new Response(renderPrelaunchPage(), {
    status: 503,
    headers: lockedHeaders(decision, "text/html; charset=utf-8"),
  });
}
