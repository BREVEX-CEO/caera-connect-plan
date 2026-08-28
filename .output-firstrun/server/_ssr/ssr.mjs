//#region node_modules/.nitro/vite/services/ssr/index.js
var lastCapturedError;
var TTL_MS = 5e3;
function record(error) {
	lastCapturedError = {
		error,
		at: Date.now()
	};
}
if (typeof globalThis.addEventListener === "function") {
	globalThis.addEventListener("error", (event) => record(event.error ?? event));
	globalThis.addEventListener("unhandledrejection", (event) => record(event.reason));
}
function consumeLastCapturedError() {
	if (!lastCapturedError) return void 0;
	if (Date.now() - lastCapturedError.at > TTL_MS) {
		lastCapturedError = void 0;
		return;
	}
	const { error } = lastCapturedError;
	lastCapturedError = void 0;
	return error;
}
function renderErrorPage() {
	return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
/** Version shared by every OCADE source package in this release candidate. */
var OCADE_RELEASE_VERSION = "0.1.0";
var HEALTH_PATH = "/api/health";
var LOCAL_DEPLOYMENT_ID = "local";
var HEALTH_HEADERS = {
	"cache-control": "no-store",
	"content-type": "application/json; charset=utf-8",
	"x-content-type-options": "nosniff"
};
/**
* Nitro attaches the native Cloudflare bindings to the augmented Request.
* TanStack's custom server entry is invoked inside Nitro, so its second
* argument is not guaranteed to be the platform env object.
*/
function cloudflareRequestEnv(request, env) {
	const runtimeEnv = request.runtime?.cloudflare?.env;
	return runtimeEnv && typeof runtimeEnv === "object" ? runtimeEnv : env;
}
function deploymentMetadata(env) {
	const metadata = env && typeof env === "object" ? env.CF_VERSION_METADATA : void 0;
	const deploymentId = typeof metadata?.id === "string" && metadata.id.length > 0 ? metadata.id : LOCAL_DEPLOYMENT_ID;
	const deploymentTag = typeof metadata?.tag === "string" && metadata.tag.length > 0 ? metadata.tag : void 0;
	return deploymentTag ? {
		deploymentId,
		deploymentTag
	} : { deploymentId };
}
function configurationMetadata(env) {
	const runtime = env && typeof env === "object" ? env : void 0;
	return { supabasePublic: typeof runtime?.SUPABASE_URL === "string" && runtime.SUPABASE_URL.length > 0 && typeof runtime?.SUPABASE_PUBLISHABLE_KEY === "string" && runtime.SUPABASE_PUBLISHABLE_KEY.length > 0 };
}
function releaseHealthResponse(request, env) {
	if (new URL(request.url).pathname !== HEALTH_PATH) return null;
	const deployment = deploymentMetadata(cloudflareRequestEnv(request, env));
	const configuration = configurationMetadata(cloudflareRequestEnv(request, env));
	if (request.method !== "GET" && request.method !== "HEAD") return new Response(JSON.stringify({
		status: "method_not_allowed",
		service: "ocade-web",
		version: OCADE_RELEASE_VERSION,
		...deployment,
		configuration
	}), {
		status: 405,
		headers: {
			...HEALTH_HEADERS,
			allow: "GET, HEAD"
		}
	});
	const body = JSON.stringify({
		status: "ok",
		service: "ocade-web",
		version: OCADE_RELEASE_VERSION,
		...deployment,
		configuration,
		scope: "liveness"
	});
	return new Response(request.method === "HEAD" ? null : body, {
		status: 200,
		headers: HEALTH_HEADERS
	});
}
/**
* Canonical current company and product facts.
*
* Public UI, SEO, legal copy, and release tests must derive their identity
* claims from this authority. Historical evidence and compatibility
* identifiers are deliberately outside its scope.
*/
var COMPANY_FACTS = {
	companyName: "CARCC CADANE",
	companyAlternateName: "Carcc Cadane",
	productName: "OCADE",
	productFormalName: "OCADE BY CARCC CADANE",
	tagline: "Command the Next Era.",
	founderName: "Haans Antoni",
	founderDisplayName: "HAANS ANTONI",
	founderLeadershipStatement: "HAANS ANTONI — CEO, Chairman and Founder",
	founderRoles: "CEO, Chairman and Founder",
	foundingDateIso: "2026-08-28",
	foundingDateLabel: "28 August 2026",
	launchAtIso: "2026-08-27T22:58:00Z",
	location: "Bengaluru, Karnataka, India",
	status: "launched"
};
/**
* Canonical OCADE production launch window.
*
* One module owns the launch instant. Everything else — the edge gate, robots,
* sitemap, runbook checks and tests — reads it from here so the date can never
* drift between the worker and the documentation.
*
* Two independent conditions must both hold before the production product is
* reachable:
*
*   1. Server/edge time is at or after `LAUNCH_AT_ISO`.
*   2. An explicit server-side readiness flag (`OCADE_LAUNCH_READY=true`) is set
*      by a human after the real pre-launch checks passed.
*
* The clock alone never launches anything: an unready release stays locked
* rather than opening broken. The browser clock is never consulted.
*/
/** Exact launch instant. 28 August 2026, 08:28:00 IST. */
var LAUNCH_AT_ISO = COMPANY_FACTS.launchAtIso;
/** Milliseconds since epoch for `LAUNCH_AT_ISO`. */
var LAUNCH_AT_MS = Date.parse(LAUNCH_AT_ISO);
/**
* The only launch wording allowed in public copy, metadata or structured data.
* The exact time of day is deliberately absent.
*/
var LAUNCH_PUBLIC_DATE_LABEL = COMPANY_FACTS.foundingDateLabel;
function readEnv(env, key) {
	const fromEnv = env && typeof env === "object" ? env[key] : void 0;
	if (typeof fromEnv === "string") return fromEnv;
	const fromProcess = (typeof process !== "undefined" ? process.env : void 0)?.[key];
	return typeof fromProcess === "string" ? fromProcess : void 0;
}
function isTrue(value) {
	return value === "true";
}
/**
* Hosts that are development or approved internal preview surfaces. These stay
* testable before launch; none of them is the production product.
*/
function isInternalHost(hostname) {
	const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
	if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") return true;
	if (host.endsWith(".localhost") || host.endsWith(".local")) return true;
	if (host.endsWith(".lovableproject.com")) return true;
	if (host.startsWith("id-preview--") && host.endsWith(".lovable.app")) return true;
	if (host.endsWith("-dev.lovable.app")) return true;
	return false;
}
/**
* Decide whether the shipping application may be served for this request.
*
* `now` must come from the server/edge clock.
*/
function evaluateLaunchGate(options) {
	const { hostname, env } = options;
	const nowMs = typeof options.now === "number" ? options.now : options.now.getTime();
	if (isInternalHost(hostname) || isTrue(readEnv(env, "OCADE_LAUNCH_PREVIEW"))) return {
		open: true,
		reason: "open_internal_preview",
		internal: true,
		retryAfterSeconds: 0
	};
	if (nowMs < LAUNCH_AT_MS) {
		const remaining = Math.ceil((LAUNCH_AT_MS - nowMs) / 1e3);
		return {
			open: false,
			reason: "locked_before_launch",
			internal: false,
			retryAfterSeconds: Math.min(Math.max(remaining, 60), 3600)
		};
	}
	return {
		open: true,
		reason: "open_launched",
		internal: false,
		retryAfterSeconds: 0
	};
}
var PUBLIC_IDENTITY = {
	brand: COMPANY_FACTS.companyName,
	brandAlternateName: COMPANY_FACTS.companyAlternateName,
	tagline: COMPANY_FACTS.tagline,
	product: COMPANY_FACTS.productName,
	productPronunciation: "OH-kayd",
	productMeaning: "Orbital-scale command and autonomous decision engine",
	founder: COMPANY_FACTS.founderName,
	founderAlternateName: COMPANY_FACTS.founderDisplayName,
	founderRoles: COMPANY_FACTS.founderRoles,
	plannedFoundingDate: COMPANY_FACTS.foundingDateIso,
	plannedLaunchDate: COMPANY_FACTS.foundingDateLabel,
	status: COMPANY_FACTS.status
};
function organizationStructuredData(now = Date.now()) {
	const founded = now >= Date.parse(`${PUBLIC_IDENTITY.plannedFoundingDate}T00:00:00+05:30`);
	return {
		"@context": "https://schema.org",
		"@type": "Organization",
		"@id": "https://ocade.in/#organization",
		name: PUBLIC_IDENTITY.brand,
		alternateName: [PUBLIC_IDENTITY.brandAlternateName, PUBLIC_IDENTITY.tagline],
		url: "https://ocade.in/company",
		logo: "https://ocade.in/brand/ocade-carcc-mark.png",
		image: "https://ocade.in/brand/ocade-carcc-wordmark.png",
		slogan: PUBLIC_IDENTITY.tagline,
		...founded ? { foundingDate: PUBLIC_IDENTITY.plannedFoundingDate } : {},
		description: "CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE.",
		founder: {
			"@type": "Person",
			"@id": "https://ocade.in/#haans-antoni",
			name: PUBLIC_IDENTITY.founder,
			alternateName: PUBLIC_IDENTITY.founderAlternateName,
			jobTitle: PUBLIC_IDENTITY.founderRoles,
			url: "https://ocade.in/founder/haans-antoni"
		}
	};
}
var FOUNDER_STRUCTURED_DATA = {
	"@context": "https://schema.org",
	"@type": "ProfilePage",
	mainEntity: {
		"@type": "Person",
		"@id": "https://ocade.in/#haans-antoni",
		name: PUBLIC_IDENTITY.founder,
		alternateName: PUBLIC_IDENTITY.founderAlternateName,
		jobTitle: PUBLIC_IDENTITY.founderRoles,
		url: "https://ocade.in/founder/haans-antoni",
		worksFor: {
			"@type": "Organization",
			"@id": "https://ocade.in/#organization",
			name: PUBLIC_IDENTITY.brand
		}
	}
};
var WEBSITE_STRUCTURED_DATA = {
	"@context": "https://schema.org",
	"@type": "WebSite",
	"@id": "https://ocade.in/#website",
	name: `${PUBLIC_IDENTITY.brand} — ${PUBLIC_IDENTITY.product}`,
	alternateName: `${PUBLIC_IDENTITY.product} by ${PUBLIC_IDENTITY.brand}`,
	url: "https://ocade.in/",
	publisher: {
		"@type": "Organization",
		"@id": "https://ocade.in/#organization",
		name: PUBLIC_IDENTITY.brand
	}
};
var OCADE_STRUCTURED_DATA = {
	"@context": "https://schema.org",
	"@type": "SoftwareApplication",
	"@id": "https://ocade.in/#ocade",
	name: PUBLIC_IDENTITY.product,
	alternateName: "Ocade",
	url: "https://ocade.in/products/ocade",
	applicationCategory: "ProductivityApplication",
	operatingSystem: "Web, Windows, macOS, Android, iOS",
	author: {
		"@type": "Organization",
		"@id": "https://ocade.in/#organization",
		name: PUBLIC_IDENTITY.brand
	},
	creator: {
		"@type": "Person",
		"@id": "https://ocade.in/#haans-antoni",
		name: PUBLIC_IDENTITY.founder,
		alternateName: PUBLIC_IDENTITY.founderAlternateName
	},
	description: `OCADE, defined by its creator as ${PUBLIC_IDENTITY.productMeaning}, is a local-first AI workspace whose formal public-launch date is ${PUBLIC_IDENTITY.plannedLaunchDate}, with optional private synchronization and permissioned current-information retrieval.`
};
/**
* Public edge documents served while the authenticated OCADE product is locked.
* These responses contain no application JavaScript and never grant product access.
*/
var PRELAUNCH_PUBLIC_PATHS = /* @__PURE__ */ new Set([
	"/",
	"/about",
	"/privacy",
	"/terms",
	"/support",
	"/company",
	"/founder/haans-antoni",
	"/products/ocade"
]);
var PRELAUNCH_PUBLIC_ASSET_PATHS = /* @__PURE__ */ new Set([
	"/brand/ocade-carcc-mark.png",
	"/brand/ocade-carcc-wordmark.png",
	"/fonts/inter-latin.woff2",
	"/fonts/instrument-serif-latin.woff2",
	"/fonts/instrument-serif-italic-latin.woff2",
	"/fonts/jetbrains-mono-latin.woff2"
]);
[...PRELAUNCH_PUBLIC_PATHS];
var NOINDEX = "noindex, nofollow, noarchive";
var CLOUDFLARE_WEB_ANALYTICS = "https://static.cloudflareinsights.com/beacon.min.js https://static.cloudflareinsights.com/beacon.min.js/";
function lockedHeaders(decision, contentType) {
	return {
		"content-type": contentType,
		"cache-control": "no-store",
		"content-security-policy": `default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src ${CLOUDFLARE_WEB_ANALYTICS}; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
		"cross-origin-resource-policy": "same-origin",
		"referrer-policy": "no-referrer",
		"x-robots-tag": NOINDEX,
		"retry-after": String(decision.retryAfterSeconds),
		"x-content-type-options": "nosniff",
		"x-ocade-launch-state": "prelaunch"
	};
}
function publicHeaders(contentType) {
	return {
		"content-type": contentType,
		"cache-control": "public, max-age=300",
		"content-security-policy": `default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src 'self'; script-src 'unsafe-inline' ${CLOUDFLARE_WEB_ANALYTICS}; connect-src 'self' https://stream.mux.com; media-src https://stream.mux.com blob:; worker-src blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
		"cross-origin-resource-policy": "same-origin",
		"referrer-policy": "strict-origin-when-cross-origin",
		"x-robots-tag": "index, follow, max-image-preview:large",
		"x-content-type-options": "nosniff",
		"x-ocade-launch-state": "prelaunch-public-information"
	};
}
function escapeHtml(value) {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\"", "&quot;").replaceAll("'", "&#39;");
}
function webPageStructuredData(name, description, url) {
	return {
		"@context": "https://schema.org",
		"@type": "WebPage",
		name,
		description,
		url,
		isPartOf: {
			"@type": "WebSite",
			name: "OCADE",
			url: "https://ocade.in/"
		}
	};
}
function publicDocument(pathname) {
	if (pathname === "/") return {
		title: "OCADE by CARCC CADANE — Local-first AI workspace",
		description: "Official OCADE home page by CARCC CADANE with product, privacy, legal, launch and contact information.",
		eyebrow: "Official OCADE home",
		heading: "OCADE",
		lead: `OCADE is a local-first AI workspace by CARCC CADANE for private chat, research, work and permissioned computer-control tasks. Formal founding and public launch are scheduled for ${LAUNCH_PUBLIC_DATE_LABEL}.`,
		sections: [
			{
				heading: "Private intelligence, permissioned action",
				paragraphs: ["Supported AI generation is designed around local inference on the user's device rather than public-cloud AI inference. Optional authentication, Private Sync, current-information retrieval, support, payments and other user-requested online services are separated from normal local generation.", "Feature availability varies by device, hardware, platform and release readiness. These public information pages do not grant access to the authenticated product before the launch gate opens."]
			},
			{
				heading: "CARCC CADANE",
				paragraphs: ["CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE. HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE. The official tagline is “Command the Next Era.”"]
			},
			{
				heading: `Formal founding and public launch — ${LAUNCH_PUBLIC_DATE_LABEL}`,
				paragraphs: [`CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as its formal founding date and the scheduled public launch of OCADE. Legal, privacy, support, identity and verification pages are available earlier so users and external services can review them before the authenticated product opens.`, "The date alone does not open an unfinished build. Production access also requires the separate launch-readiness approval after final coding and release checks."]
			},
			{
				heading: "Privacy, Terms and contact",
				paragraphs: ["The Privacy notice explains Google Sign-In, local-first processing, optional online services and support data. The Terms explain AI limitations, computer-control risk, payments, refunds, liability, acceptable use, investor enquiries and disputes. The Support page explains the current ticket-based contact system."]
			}
		],
		structuredData: OCADE_STRUCTURED_DATA
	};
	if (pathname === "/about") {
		const description = "Official information about CARCC CADANE, OCADE, leadership, the 28 August 2026 founding and launch, and investor or strategic-partnership enquiries.";
		return {
			title: "About CARCC CADANE and OCADE",
			description,
			eyebrow: "Official CARCC CADANE information",
			heading: "Building the next era of private AI",
			lead: "CARCC CADANE is an independent technology enterprise, business brand and venture building OCADE — a local-first AI workspace designed around private intelligence, user control and permissioned action.",
			sections: [
				{
					heading: "CARCC CADANE",
					paragraphs: ["CARCC CADANE is the technology enterprise, business brand and venture behind OCADE. OCADE is the active AI product within that identity. The official CARCC CADANE tagline is “Command the Next Era.”", "Public materials use the CARCC CADANE brand name consistently and do not publish an unverified corporate form or registration category."]
				},
				{
					heading: "OCADE",
					paragraphs: ["OCADE is a cross-platform AI workspace for chat, research, work, creation and permissioned computer-control tasks. Supported AI generation is designed around local inference on the user's own hardware where supported.", "Optional authentication, Private Sync, current-information retrieval, support, payments and user-requested network services are separated from normal local AI generation."]
				},
				{
					heading: "Leadership",
					paragraphs: ["HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE. Product direction, brand strategy and the OCADE technology vision are led under that role."]
				},
				{
					heading: `Formal founding and public launch — ${LAUNCH_PUBLIC_DATE_LABEL}`,
					paragraphs: [`CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as its formal founding date and the scheduled public launch date for OCADE. Legal, privacy, identity, support and verification pages can be available earlier while the authenticated product remains protected by the launch gate.`]
				},
				{
					heading: "Investors, strategic partners and future ownership discussions",
					paragraphs: [
						"CARCC CADANE welcomes serious enquiries from prospective investors and strategic partners who want to discuss product strategy, commercial collaboration, future investment or a possible future ownership or equity transaction.",
						"No outside investor or shareholder is publicly announced by this page today. Nothing on this website is an offer to sell securities, an investment prospectus, a solicitation to invest, a promise of allocation, valuation, dividend, return, future listing or a guarantee that equity or shareholding will be offered.",
						"Any future investment, ownership or shareholder arrangement requires a separate private discussion, diligence, valuation, legal documentation, approvals and compliance with the laws that apply to that transaction."
					]
				},
				{
					heading: "Investor and partnership contact",
					paragraphs: ["Until dedicated investor email infrastructure is activated and verified, prospective investors and strategic partners should use the OCADE ticket system when account intake is available and choose the Investor or Partnership category. Dedicated domain email channels will be published only after they are active and verified."]
				}
			],
			structuredData: webPageStructuredData("About CARCC CADANE and OCADE", description, "https://ocade.in/about")
		};
	}
	if (pathname === "/privacy") {
		const description = "Privacy notice for OCADE by CARCC CADANE, effective 25 August 2026.";
		return {
			title: "Privacy notice — OCADE",
			description,
			eyebrow: "Effective and last updated 25 August 2026",
			heading: "Privacy notice",
			lead: "This notice explains how CARCC CADANE handles or intends to handle information for the OCADE website, authentication, local-first AI, Private Sync, support and other user-requested services.",
			sections: [
				{
					heading: "Who is responsible",
					paragraphs: ["CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE and is responsible for the OCADE service operations described in this notice. This notice uses the public CARCC CADANE brand identity and does not publish an unverified legal form, registration category, address or corporate status."]
				},
				{
					heading: "Information OCADE may handle",
					paragraphs: ["OCADE may handle account identifiers and authentication events, basic profile and settings data, device registrations, conversations, messages and files under the storage mode you choose, support tickets and messages, security and abuse-prevention records, payment status or provider references if payments are enabled, and feature-specific information needed for a user-requested connector or action.", "Do not place passwords, one-time codes, PINs, recovery codes, private keys, full card numbers, CVVs or other payment or authentication secrets in support tickets."]
				},
				{
					heading: "Google Sign-In",
					paragraphs: ["If you choose Google Sign-In, Google may provide OCADE with authentication identifiers and basic account information such as your name, email address and profile image according to the permissions shown during sign-in. OCADE uses that information to authenticate the account, maintain the session, protect the service and provide account features.", "Google account information is not sold or used by OCADE for targeted advertising and is not used to train a public AI model."]
				},
				{
					heading: "Local-first does not mean local-only",
					paragraphs: ["Supported AI generation is designed to run locally on your device. Device-only processing keeps supported data under your device controls. Optional Google authentication, Private Sync, Supabase, Cloudflare, current-information retrieval, payments, mobile pairing, support and other user-requested network services may process the minimum information reasonably necessary to provide those features.", "OCADE does not silently send normal chat generation to a public-cloud AI inference provider."]
				},
				{
					heading: "Purposes and service providers",
					paragraphs: ["Information may be used to provide requested features, authenticate and secure accounts, synchronize selected data when you choose Private Sync, maintain reliability, prevent abuse, investigate security events, process support or rights requests, maintain payment records when payments are enabled and comply with applicable law.", "Depending on the feature, recipients may include Supabase, Cloudflare, Google or another authentication provider, cited source websites, app stores, payment providers and other services necessary to deliver the requested feature. OCADE does not sell personal information to advertisers."]
				},
				{
					heading: "Retention, deletion and rights",
					paragraphs: ["Device-only data remains subject to your device controls. Cloud records are intended to be retained only while reasonably necessary for the account, requested service, security, legal obligation, payment record or dispute. Backup deletion may take additional time and some records may need to be retained where law requires.", "Depending on applicable law, you may have rights to access, correct or erase personal information, withdraw consent, object to certain processing or raise a grievance. Use the data-rights route where available or create a Privacy ticket through OCADE Support."]
				},
				{
					heading: "Users aged 16 or 17",
					paragraphs: ["OCADE is intended for users aged 16 or older, but age rules differ by jurisdiction. Where applicable law treats a 16- or 17-year-old as a child for personal-data processing, the required verified parent or lawful-guardian consent must be obtained before the relevant processing unless a lawful exemption applies.", "If OCADE does not yet provide the legally required consent flow, that user must wait until legally eligible to use the affected account or personal-data feature."]
				},
				{
					heading: "Security and contact",
					paragraphs: ["OCADE uses measures including access controls, row-level security, restricted storage patterns and security checks appropriate to the relevant feature, but no device, network or online service can guarantee absolute security.", "Privacy, security and grievance requests use the OCADE ticket system while dedicated domain email channels are being established. Dedicated email addresses will be published only after they are activated and verified."]
				}
			],
			structuredData: webPageStructuredData("OCADE Privacy notice", description, "https://ocade.in/privacy")
		};
	}
	if (pathname === "/terms") {
		const description = "Terms of service for OCADE by CARCC CADANE, effective 25 August 2026.";
		return {
			title: "Terms of service — OCADE",
			description,
			eyebrow: "Effective and last updated 25 August 2026",
			heading: "Terms of service",
			lead: `These Terms apply now to the OCADE public website and to OCADE services as they become available. CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as the formal founding and scheduled public-launch date for OCADE.`,
			sections: [
				{
					heading: "1. Agreement and CARCC CADANE",
					paragraphs: ["These Terms govern the OCADE public website and every OCADE service that becomes available under the CARCC CADANE brand. CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE. HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE.", "These Terms use the public CARCC CADANE brand identity and do not describe a Private Limited Company, LLP, listed company or other legal form unless that status is separately established and published."]
				},
				{
					heading: "2. Effective date, eligibility and launch",
					paragraphs: [`These Terms are effective from 25 August 2026. CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as its formal founding date and scheduled public launch date for OCADE. Public legal and verification pages can be available earlier without opening the authenticated product.`, "OCADE is intended for users aged 16 or older. A user aged 16 or 17 may use account or personal-data features only where all consent or authorization required by applicable law has been validly obtained and the relevant OCADE flow supports it."]
				},
				{
					heading: "3. Local-first service architecture",
					paragraphs: ["OCADE combines local software with optional online authentication, Private Sync, current-information retrieval, support, payments and permissioned computer or remote-device features. Supported chat generation is designed to run on the user's own device rather than through a public-cloud AI inference provider.", "Feature availability may vary by device, hardware, browser, operating system, region, release stage and plan."]
				},
				{
					heading: "4. Accounts, devices and security",
					paragraphs: ["Users are responsible for safeguarding their devices, accounts, recovery methods and credentials used with third-party services. Never provide OCADE Support with a password, one-time code, PIN, recovery code, private key, CVV or full payment credential."]
				},
				{
					heading: "5. AI output can be wrong",
					paragraphs: ["OCADE may produce inaccurate, incomplete, outdated, misleading, duplicated or otherwise incorrect output. Users must independently verify important output before relying on it.", "OCADE is not a substitute for a qualified lawyer, doctor, accountant, tax professional, investment or financial adviser, cybersecurity professional or emergency service. Users remain responsible for decisions made using OCADE."]
				},
				{
					heading: "6. Computer control and authorized actions",
					paragraphs: ["Permissioned computer-control features may open applications, read visible screens, type, click, create, edit, move or delete files, navigate websites and perform other actions a user authorizes. AI can select the wrong control, open the wrong application, alter or delete the wrong file, submit incorrect information or send content to an unintended destination.", "Users may use computer control only on systems, accounts and content they are authorized to control. Important actions may require confirmation, but users must still supervise the agent, review important work and maintain appropriate backups."]
				},
				{
					heading: "7. User content and AI output",
					paragraphs: ["Users retain the rights they have in prompts, files and other content they provide. Subject to applicable law, third-party rights and separately disclosed licences, users may use OCADE-generated output for personal or commercial purposes, including posts, videos, reels, documents and business work.", "AI output is not guaranteed to be unique and other users may receive similar output."]
				},
				{
					heading: "8. OCADE and CARCC CADANE intellectual property",
					paragraphs: ["CARCC CADANE and its rights holders retain their rights in OCADE software, original code, interfaces, designs, systems, proprietary technology, brand materials, logos and the tagline “Command the Next Era.” Third-party and open-source materials remain governed by their own licences and rights."]
				},
				{
					heading: "9. Acceptable use",
					paragraphs: ["Users may not use OCADE to violate law, infringe rights, access systems or accounts without authorization, distribute malware, commit fraud, evade security or payment controls, attack OCADE or another service, intentionally harm people or repeatedly violate these Terms."]
				},
				{
					heading: "10. Suspension, termination and feature changes",
					paragraphs: ["CARCC CADANE may limit, suspend or terminate online access for illegal activity, hacking, malware, fraud, abuse, security-bypass attempts, attacks, non-payment, material or repeated Terms violations, security emergencies or legal requirements.", "CARCC CADANE may modify, discontinue or replace a feature or service subject to rights that applicable law does not permit these Terms to waive."]
				},
				{
					heading: "11. Free period, future paid plans and checkout",
					paragraphs: ["OCADE may initially be available without charge while coding, release and payment work is completed. Free availability can change. Paid plans, subscriptions or other commercial services may be introduced later.", "Before a paid purchase, the checkout should display the applicable price, taxes where required, duration or renewal rule, cancellation information and purchase-specific conditions."]
				},
				{
					heading: "12. Refunds and payment errors",
					paragraphs: ["Except where applicable law requires otherwise, a paid digital service is not eligible for a voluntary refund after the purchased service has been activated or used.", "A refund, reversal, credit or other remedy may still be required for a duplicate charge, billing or payment-processing error, non-delivery, material service defect, unauthorized transaction where law provides protection or another non-waivable consumer right."]
				},
				{
					heading: "13. Third-party services",
					paragraphs: ["OCADE may depend on Google, Supabase, Cloudflare, app stores, payment providers, cited websites, network operators and other third parties. CARCC CADANE does not control those services and cannot guarantee their availability, accuracy, security, policies or continued operation."]
				},
				{
					heading: "14. Service provided as available",
					paragraphs: ["To the maximum extent permitted by applicable law, OCADE is provided on an “as is” and “as available” basis. CARCC CADANE does not promise uninterrupted, error-free, loss-free or perfectly accurate operation, or that every defect will be corrected.", "Users should maintain independent records and backups for important information."]
				},
				{
					heading: "15. Limitation of liability and assumed risks",
					paragraphs: ["To the maximum extent permitted by applicable law, CARCC CADANE, OCADE and their founder, personnel and service providers are not liable for indirect, incidental, special, exemplary, punitive or consequential loss, or for lost profits, revenue, business, opportunities, investment loss, data loss or corruption, business interruption, reputational harm, device or software problems, or losses caused by reliance on AI output, computer-control actions or third-party services.", "Where liability cannot lawfully be excluded and except for liability that applicable law does not permit to be capped, aggregate liability arising from a paid OCADE service is limited to the amount actually paid by the claimant for the affected OCADE service during the three months immediately before the event giving rise to the claim. Mandatory statutory rights and liabilities remain unaffected."]
				},
				{
					heading: "16. Indemnity for unlawful or unauthorized use",
					paragraphs: ["To the extent permitted by law, a user is responsible for third-party claims and reasonable losses caused by that user's unlawful use of OCADE, intentional infringement of another person's rights, or use of OCADE to access systems, accounts or content without authorization."]
				},
				{
					heading: "17. Governing law and disputes",
					paragraphs: ["These Terms are governed by the laws of India without removing mandatory protections that may apply to a user elsewhere. The parties should first try in good faith to resolve a dispute through the OCADE support process.", "Where legally capable of arbitration and not resolved informally, a dispute may be referred to arbitration under the Arbitration and Conciliation Act, 1996, in English, subject to non-waivable consumer, regulatory, urgent-relief and other statutory rights."]
				},
				{
					heading: "18. Communications and marketing",
					paragraphs: ["OCADE may send essential account, authentication, security, legal and service messages. Marketing communications are sent only where the required permission exists and include the applicable opt-out method."]
				},
				{
					heading: "19. Changes to these Terms",
					paragraphs: ["CARCC CADANE may update these Terms as OCADE changes. Material changes will be identified through an appropriate notice where required. If a change legally requires fresh consent, OCADE will request that consent."]
				},
				{
					heading: "20. Support, legal, privacy and investor enquiries",
					paragraphs: ["OCADE uses a ticket-based support system. Intended categories include Account, Billing, Technical, Privacy, Security, Feedback, Legal, Investor and Partnership.", "Investor and partnership enquiries start a private discussion only. Nothing on this website is an offer to sell securities, a solicitation to invest or a promise that equity or shareholding will be offered."]
				}
			],
			structuredData: webPageStructuredData("OCADE Terms of service", description, "https://ocade.in/terms")
		};
	}
	if (pathname === "/support") {
		const description = "Current support, privacy, legal, security, investor and partnership contact options for OCADE by CARCC CADANE.";
		return {
			title: "Support and contact — OCADE",
			description,
			eyebrow: "Support and contact",
			heading: "OCADE support",
			lead: "OCADE uses a ticket-based support queue and administrative review workspace. Dedicated domain email addresses will be published only after they are activated and verified.",
			sections: [
				{
					heading: "Ticket categories",
					paragraphs: ["Account, Billing, Technical, Privacy, Security, Feedback, Legal, Investor and Partnership are the intended support categories. Signed-in tickets can be attached to the user's account and reviewed in the OCADE administrative support workspace once account intake is open."]
				},
				{
					heading: "Privacy, legal and security requests",
					paragraphs: ["Use the relevant ticket category when intake is available. Do not place passwords, one-time codes, PINs, recovery codes, private keys, full card numbers, CVVs or other authentication or payment secrets in a ticket."]
				},
				{
					heading: "Investor and partnership enquiries",
					paragraphs: ["Prospective investors and strategic partners may use the Investor or Partnership category when account intake is available. An enquiry begins a private discussion only; it is not an offer of securities, solicitation to invest or promise that equity or shareholding will be offered."]
				},
				{
					heading: "Dedicated email channels",
					paragraphs: ["Support, privacy, legal, security and investor domain email addresses may be added later. No address is published as active until the mailbox, delivery, access controls and handling process have been verified."]
				}
			],
			structuredData: webPageStructuredData("OCADE Support and contact", description, "https://ocade.in/support")
		};
	}
	if (pathname === "/company") return {
		title: "CARCC CADANE — Company and founder information",
		description: "Official information about CARCC CADANE, OCADE and founder HAANS ANTONI.",
		eyebrow: "Official company information",
		heading: "CARCC CADANE",
		lead: `CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE. ${LAUNCH_PUBLIC_DATE_LABEL} is recorded as its formal founding date and OCADE's scheduled public launch date.`,
		sections: [
			{
				heading: "Technology enterprise and brand",
				paragraphs: ["CARCC CADANE develops technology products and systems under a single enterprise and brand identity. OCADE is its active AI product. Public pages do not publish an unverified corporate form or registration category."]
			},
			{
				heading: "Leadership and product",
				paragraphs: ["HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE. OCADE is the active product in development and is being prepared for its controlled public opening."]
			},
			{
				heading: "Launch status",
				paragraphs: [`CARCC CADANE records ${LAUNCH_PUBLIC_DATE_LABEL} as its formal founding date and OCADE public-launch date. The authenticated product remains protected until both the launch date and production-readiness approval are satisfied.`]
			}
		],
		structuredData: organizationStructuredData()
	};
	if (pathname === "/founder/haans-antoni") return {
		title: "HAANS ANTONI — Founder, CEO and Chairman of CARCC CADANE",
		description: "Official profile connecting HAANS ANTONI with CARCC CADANE and OCADE.",
		eyebrow: "Official founder profile",
		heading: "HAANS ANTONI",
		lead: "HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE.",
		sections: [{
			heading: "Role",
			paragraphs: ["Haans Antoni leads product direction, brand strategy and the technology vision for OCADE, a local-first AI workspace being prepared for public launch.", "This page records the founder's public role. It does not imply funding, press coverage, trademark registration, public listing or another status that has not been independently established."]
		}, {
			heading: "Official references",
			paragraphs: ["The CARCC CADANE company page, About page and OCADE product page are the canonical first-party references for this public identity. Search engines decide independently how and when those facts appear."]
		}],
		structuredData: FOUNDER_STRUCTURED_DATA
	};
	if (pathname === "/products/ocade") return {
		title: "OCADE — Local-first AI workspace by CARCC CADANE",
		description: "Official product information for OCADE by CARCC CADANE.",
		eyebrow: "OCADE",
		heading: "Private intelligence. Permissioned action.",
		lead: `OCADE is a local-inference AI workspace created by Haans Antoni under CARCC CADANE. Public launch is scheduled for ${LAUNCH_PUBLIC_DATE_LABEL}.`,
		sections: [
			{
				heading: "Product boundary",
				paragraphs: ["Supported chat generation is designed to run on the user's device. Sign-in, optional Private Sync, support and permissioned current-information retrieval can require network services; those services are not public-cloud AI inference.", "Web launch, Windows, macOS, Android, iOS and browser-extension releases are separate readiness claims and may not become available at exactly the same time."]
			},
			{
				heading: "Launch access",
				paragraphs: ["OCADE may initially be available without charge while final product and payment work is completed. Paid plans may be introduced later only with checkout terms displayed before purchase."]
			},
			{
				heading: "AI and computer control",
				paragraphs: ["AI can be inaccurate. Permissioned computer-control features can also take an unintended action. Important work must be reviewed and high-impact decisions should not rely on OCADE alone."]
			}
		],
		structuredData: OCADE_STRUCTURED_DATA
	};
	return null;
}
function renderPrelaunchPublicPage(pathname) {
	const document = publicDocument(pathname);
	if (!document) return null;
	const canonical = `https://ocade.in${pathname}`;
	const isHome = pathname === "/";
	const sections = document.sections.map((section, index) => `<section class="card ${index === 0 ? "card-wide" : ""}" data-tilt style="--i:${index}"><div class="card-index">${String(index + 1).padStart(2, "0")}</div><h2>${escapeHtml(section.heading)}</h2>${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</section>`).join("");
	const structuredData = JSON.stringify(document.structuredData).replaceAll("<", "\\u003c");
	const launchStats = isHome ? `<section class="stats" aria-label="OCADE facts"><div><strong>LOCAL</strong><span>AI generation first</span></div><div><strong>16+</strong><span>Intended user age</span></div><div><strong>28 AUG</strong><span>Formal launch 2026</span></div></section>` : "";
	const homeCtas = isHome ? `<div class="hero-actions"><a class="btn btn-solid" href="/products/ocade">Explore OCADE <span>↗</span></a><a class="btn btn-ghost" href="/about">About CARCC CADANE</a></div><div class="scroll-cue" aria-hidden="true"><span>SCROLL</span><i></i></div>` : `<div class="hero-actions"><a class="btn btn-ghost" href="/">Back to OCADE</a></div>`;
	const loader = isHome ? `<div id="loader" class="loader" aria-hidden="true"><div class="loader-top">OCADE / CARCC CADANE</div><div class="loader-word" id="loaderWord">PRIVATE</div><div class="loader-count" id="loaderCount">000</div><div class="loader-track"><div id="loaderBar"></div></div></div>` : "";
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(document.title)}</title><meta name="description" content="${escapeHtml(document.description)}" />
<meta name="robots" content="index,follow,max-image-preview:large" /><link rel="canonical" href="${canonical}" />
<meta property="og:type" content="website" /><meta property="og:site_name" content="CARCC CADANE" />
<meta property="og:title" content="${escapeHtml(document.title)}" /><meta property="og:description" content="${escapeHtml(document.description)}" />
<meta property="og:image" content="https://ocade.in/brand/ocade-carcc-wordmark.png" /><meta name="twitter:card" content="summary_large_image" />
<link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<script type="application/ld+json">${structuredData}<\/script>
<style>
/* Self-hosted, so the holding page needs no third party and works from cache. */
@font-face{font-family:"Inter";font-style:normal;font-weight:300 700;font-display:swap;src:url("/fonts/inter-latin.woff2") format("woff2")}
@font-face{font-family:"Instrument Serif";font-style:normal;font-weight:400;font-display:swap;src:url("/fonts/instrument-serif-latin.woff2") format("woff2")}
@font-face{font-family:"Instrument Serif";font-style:italic;font-weight:400;font-display:swap;src:url("/fonts/instrument-serif-italic-latin.woff2") format("woff2")}
@font-face{font-family:"JetBrains Mono";font-style:normal;font-weight:300 600;font-display:swap;src:url("/fonts/jetbrains-mono-latin.woff2") format("woff2")}
:root{color-scheme:dark;--bg:#0a0a0b;--surface:#101013;--surface2:#151519;--text:#f5f5f7;--muted:#8d8d98;--stroke:#26262c;--silver:#c9ccd4;--gold:#c89d4c;--aub:#4f2d63;--crimson:#5c1f31;--mx:50vw;--my:20vh}
*{box-sizing:border-box}html{scroll-behavior:smooth;background:var(--bg)}body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font:400 15px/1.65 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;overflow-x:hidden}
body:before{content:"";position:fixed;inset:0;z-index:-3;pointer-events:none;background:radial-gradient(700px circle at var(--mx) var(--my),rgba(105,72,132,.13),transparent 46%),radial-gradient(500px circle at 90% 60%,rgba(178,130,58,.07),transparent 50%),#080809}
body:after{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;opacity:.18;background-image:radial-gradient(circle,rgba(255,255,255,.18) .7px,transparent .8px);background-size:28px 28px;mask-image:linear-gradient(to bottom,#000,transparent 82%)}
a{color:inherit}.loader{position:fixed;inset:0;z-index:9999;background:#080809;transition:opacity .55s ease,visibility .55s ease}.loader.done{opacity:0;visibility:hidden}.loader-top{position:absolute;left:28px;top:25px;color:#777782;font-size:10px;letter-spacing:.28em;text-transform:uppercase}.loader-word{position:absolute;inset:0;display:grid;place-items:center;font:italic clamp(44px,8vw,104px)/1 "Instrument Serif",serif;color:rgba(245,245,247,.86);letter-spacing:-.035em}.loader-count{position:absolute;right:28px;bottom:32px;font:400 clamp(62px,10vw,132px)/.8 "Instrument Serif",serif;color:#ececf0;font-variant-numeric:tabular-nums}.loader-track{position:absolute;left:0;right:0;bottom:0;height:3px;background:#18181c}.loader-track div{height:100%;width:100%;transform:scaleX(0);transform-origin:left;background:linear-gradient(90deg,#bfc5cf 0%,#6f4a86 48%,#c89d4c 100%);box-shadow:0 0 14px rgba(126,89,151,.45)}
.video-stage{position:absolute;inset:0;overflow:hidden;background:radial-gradient(circle at 50% 36%,#17121c 0,#09090b 48%,#070708 100%)}.video-stage video{position:absolute;left:50%;top:50%;width:100%;height:100%;min-width:100%;min-height:100%;object-fit:cover;transform:translate(-50%,-50%) scale(1.025);opacity:.62;filter:saturate(.72) contrast(1.06) brightness(.62)}.video-stage:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,5,7,.24) 0%,rgba(5,5,7,.16) 42%,#080809 100%),radial-gradient(circle at center,transparent 20%,rgba(6,6,8,.68) 100%)}
.nav-wrap{position:fixed;left:0;right:0;top:0;z-index:80;display:flex;justify-content:center;padding:18px 16px;pointer-events:none}.nav{pointer-events:auto;display:inline-flex;align-items:center;gap:5px;max-width:calc(100vw - 28px);padding:7px;border:1px solid rgba(255,255,255,.10);border-radius:999px;background:rgba(12,12,15,.68);backdrop-filter:blur(22px) saturate(1.25);box-shadow:0 14px 44px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.04);transition:background .25s ease,box-shadow .25s ease}.nav.scrolled{background:rgba(10,10,12,.88);box-shadow:0 18px 55px rgba(0,0,0,.34)}.nav-logo{display:grid;place-items:center;width:38px;height:38px;padding:2px;border-radius:50%;background:linear-gradient(135deg,#d8dbe2,#4f2d63 58%,#c89d4c);text-decoration:none}.nav-logo img{display:block;width:34px;height:34px;border-radius:50%;object-fit:cover;background:#080809;transition:transform .3s ease}.nav-logo:hover img{transform:scale(1.08) rotate(-4deg)}.nav-divider{width:1px;height:20px;margin:0 4px;background:#2b2b30}.nav-links{display:flex;align-items:center;gap:2px;overflow:auto;scrollbar-width:none}.nav-links::-webkit-scrollbar{display:none}.nav-links a{white-space:nowrap;text-decoration:none;color:#9c9ca6;font-size:11px;padding:8px 11px;border-radius:999px;transition:.22s ease}.nav-links a:hover,.nav-links a:focus-visible{color:#fff;background:#202024;outline:none}.nav-contact{margin-left:3px;color:#0b0b0c!important;background:#f0f0f2!important;font-weight:600!important}
.hero{position:relative;min-height:${isHome ? "100svh" : "68svh"};display:flex;align-items:center;justify-content:center;overflow:hidden;padding:120px 24px 82px}.hero-inner{position:relative;z-index:4;width:min(1100px,100%);text-align:center}.hero-wordmark{display:block;width:min(560px,78vw);height:auto!important;margin:0 auto 34px;object-fit:contain;filter:drop-shadow(0 28px 70px rgba(0,0,0,.55));animation:heroFloat 7s ease-in-out infinite}.eyebrow{margin:0 0 22px;color:#a6a6b0;font-size:10px;font-weight:600;letter-spacing:.32em;text-transform:uppercase}.hero h1{margin:0 auto;max-width:1000px;font:italic clamp(56px,9vw,112px)/.9 "Instrument Serif",serif;font-weight:400;letter-spacing:-.055em;text-wrap:balance}.inner-page .hero h1{font-size:clamp(48px,7vw,86px)}.lead{max-width:710px;margin:26px auto 0;color:#aaaab4;font-size:clamp(15px,1.8vw,18px);line-height:1.75;text-wrap:balance}.hero-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:34px}.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:0 23px;border-radius:999px;text-decoration:none;font-size:13px;font-weight:600;transition:transform .22s ease,background .22s ease,border-color .22s ease}.btn:hover{transform:translateY(-2px) scale(1.015)}.btn-solid{background:#f1f1f3;color:#09090a;border:1px solid #f1f1f3}.btn-ghost{background:rgba(9,9,11,.46);color:#efeff2;border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(16px)}.btn-ghost:hover{border-color:rgba(200,157,76,.42);background:rgba(20,18,23,.78)}.scroll-cue{position:absolute;left:50%;bottom:24px;z-index:6;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;color:#73737c;font-size:9px;letter-spacing:.25em}.scroll-cue i{position:relative;width:1px;height:38px;background:#28282d;overflow:hidden}.scroll-cue i:after{content:"";position:absolute;left:0;top:-100%;width:1px;height:44%;background:#c8c8ce;animation:scrollDown 1.5s ease-in-out infinite}
.content{position:relative;z-index:7;width:min(1180px,calc(100% - 34px));margin:-2px auto 0;padding:70px 0 110px}.section-head{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:28px}.section-kicker{display:flex;align-items:center;gap:10px;color:#777781;font-size:10px;text-transform:uppercase;letter-spacing:.28em}.section-kicker:before{content:"";width:34px;height:1px;background:#343439}.section-head h2{margin:12px 0 0;font:italic clamp(38px,5vw,62px)/1 "Instrument Serif",serif;font-weight:400}.grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:18px;perspective:1200px}.card{position:relative;grid-column:span 6;min-height:230px;padding:28px;border:1px solid rgba(255,255,255,.075);border-radius:28px;background:linear-gradient(145deg,rgba(19,19,23,.86),rgba(11,11,13,.76));box-shadow:inset 0 1px rgba(255,255,255,.035),0 24px 80px rgba(0,0,0,.18);overflow:hidden;transform:perspective(1000px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) translateY(var(--lift,0));transform-style:preserve-3d;transition:transform .18s ease,border-color .25s ease,background .25s ease}.card-wide{grid-column:span 7}.card:nth-child(2n){grid-column:span 5}.card:nth-child(4n){grid-column:span 7}.card:before{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1px;background:linear-gradient(135deg,rgba(198,202,212,.18),rgba(79,45,99,.4),rgba(200,157,76,.14));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:0;transition:opacity .3s}.card:after{content:"";position:absolute;width:220px;height:220px;right:-90px;top:-110px;border-radius:50%;background:radial-gradient(circle,rgba(101,65,125,.17),transparent 68%);pointer-events:none}.card:hover{--lift:-5px;border-color:rgba(255,255,255,.13);background:linear-gradient(145deg,rgba(24,23,29,.94),rgba(12,12,15,.86))}.card:hover:before{opacity:1}.card-index{color:#5f5f69;font-size:10px;letter-spacing:.2em;margin-bottom:42px}.card h2{position:relative;z-index:1;margin:0 0 16px;font:italic 31px/1.05 "Instrument Serif",serif;font-weight:400;letter-spacing:-.02em}.card p{position:relative;z-index:1;margin:10px 0;color:#9898a3;font-size:14px;line-height:1.8}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin:72px 0 0;border:1px solid #222228;border-radius:28px;overflow:hidden;background:#222228}.stats div{display:flex;flex-direction:column;justify-content:center;min-height:170px;padding:28px;background:#0d0d10}.stats strong{font:italic clamp(32px,5vw,58px)/1 "Instrument Serif",serif;font-weight:400;color:#f0f0f2}.stats span{margin-top:10px;color:#777781;font-size:11px;letter-spacing:.13em;text-transform:uppercase}
.marquee{position:relative;z-index:4;overflow:hidden;border-top:1px solid #1f1f23;border-bottom:1px solid #1f1f23;padding:22px 0;background:#09090b}.marquee-track{display:flex;width:max-content;white-space:nowrap;font:italic clamp(38px,6vw,76px)/1 "Instrument Serif",serif;color:#17171b;animation:marquee 32s linear infinite}.marquee-track span{padding-right:32px}.footer{position:relative;z-index:4;padding:70px 24px 38px;background:radial-gradient(circle at 50% 120%,rgba(79,45,99,.18),transparent 38%),#080809;text-align:center}.footer h2{margin:0 auto;max-width:800px;font:italic clamp(48px,7vw,90px)/.95 "Instrument Serif",serif;font-weight:400;letter-spacing:-.04em}.footer p{max-width:560px;margin:20px auto 0;color:#83838d}.footer-actions{margin-top:30px}.footer-bar{width:min(1180px,100%);margin:70px auto 0;padding-top:22px;border-top:1px solid #1f1f24;display:flex;justify-content:space-between;gap:18px;color:#666670;font-size:11px}.footer-links{display:flex;flex-wrap:wrap;gap:16px}.footer-links a{color:#8d8d96;text-decoration:none}.footer-links a:hover{color:#fff}
@keyframes heroFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes scrollDown{0%{transform:translateY(-100%)}100%{transform:translateY(320%)}}@keyframes marquee{to{transform:translateX(-50%)}}@media(max-width:780px){.nav-wrap{padding-top:10px}.nav-divider,.nav-contact{display:none}.nav{max-width:calc(100vw - 18px)}.nav-links a{padding:8px 9px}.hero{padding-left:18px;padding-right:18px}.hero-wordmark{width:min(460px,88vw);margin-bottom:28px}.content{width:min(100% - 24px,1180px);padding-top:50px}.grid{display:block}.card{min-height:0;margin-bottom:14px}.card-index{margin-bottom:28px}.stats{grid-template-columns:1fr}.stats div{min-height:120px}.footer-bar{flex-direction:column;align-items:center}.loader-top{left:18px}.loader-count{right:18px}.section-head{display:block}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.hero-wordmark,.scroll-cue i:after,.marquee-track{animation:none}.card,.btn{transition:none}.loader{display:none}}
</style></head>
<body class="${isHome ? "home-page" : "inner-page"}">${loader}
<div class="nav-wrap"><nav class="nav" id="nav" aria-label="Public information"><a class="nav-logo" href="/" aria-label="OCADE home"><img src="/brand/ocade-carcc-mark.png" alt="" width="96" height="96"></a><span class="nav-divider"></span><div class="nav-links"><a href="/">Home</a><a href="/about">About</a><a href="/products/ocade">OCADE</a><a href="/company">Company</a><a href="/founder/haans-antoni">Founder</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div><span class="nav-divider"></span><a class="nav-contact" href="/support">Contact ↗</a></nav></div>
<section class="hero"><div class="video-stage"><video id="heroVideo" muted loop playsinline preload="metadata" aria-hidden="true"></video></div><div class="hero-inner"><img class="hero-wordmark" src="/brand/ocade-carcc-wordmark.png" alt="OCADE by CARCC CADANE — Command the Next Era." width="2172" height="724"><p class="eyebrow">${escapeHtml(document.eyebrow)}</p><h1>${escapeHtml(document.heading)}</h1><p class="lead">${escapeHtml(document.lead)}</p>${homeCtas}</div></section>
<main class="content"><div class="section-head"><div><div class="section-kicker">${isHome ? "Inside OCADE" : "Official information"}</div><h2>${isHome ? "Designed for the next era." : "Clear. Current. Verifiable."}</h2></div></div><div class="grid">${sections}</div>${launchStats}</main>
<div class="marquee" aria-hidden="true"><div class="marquee-track"><span>COMMAND THE NEXT ERA • PRIVATE INTELLIGENCE • PERMISSIONED ACTION • </span><span>COMMAND THE NEXT ERA • PRIVATE INTELLIGENCE • PERMISSIONED ACTION • </span></div></div>
<footer class="footer"><h2>Building the next era.</h2><p>OCADE by CARCC CADANE. Local-first AI, optional connected services, and a controlled public launch.</p><div class="footer-actions"><a class="btn btn-ghost" href="/support">Contact / Support ↗</a></div><div class="footer-bar"><span>© 2026 CARCC CADANE</span><div class="footer-links"><a href="/about">About</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/support">Contact</a></div><span>Command the Next Era.</span></div></footer>
<script>
(function(){
  // Native adaptive streaming where the browser has it, the progressive file
  // everywhere else. No third-party player script: the application pages
  // dropped theirs when the route sweep proved the CSP had been refusing it on
  // every request, and this page has no reason to keep one either.
  const source="https://stream.mux.com/Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g.m3u8";
  const progressive="https://stream.mux.com/Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g/high.mp4";
  const video=document.getElementById("heroVideo");
  if(video){
    try{
      video.src=video.canPlayType("application/vnd.apple.mpegurl")?source:progressive;
      video.play().catch(()=>{});
    }catch(e){}
  }
  const nav=document.getElementById("nav");
  const onScroll=()=>nav&&nav.classList.toggle("scrolled",window.scrollY>80);
  onScroll();window.addEventListener("scroll",onScroll,{passive:true});
  if(!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    window.addEventListener("pointermove",(e)=>{document.documentElement.style.setProperty("--mx",e.clientX+"px");document.documentElement.style.setProperty("--my",e.clientY+"px");},{passive:true});
    document.querySelectorAll("[data-tilt]").forEach((card)=>{
      card.addEventListener("pointermove",(e)=>{const r=card.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5;const y=(e.clientY-r.top)/r.height-.5;card.style.setProperty("--ry",(x*3.2)+"deg");card.style.setProperty("--rx",(-y*3.2)+"deg");});
      card.addEventListener("pointerleave",()=>{card.style.setProperty("--ry","0deg");card.style.setProperty("--rx","0deg");});
    });
    const loader=document.getElementById("loader"),count=document.getElementById("loaderCount"),bar=document.getElementById("loaderBar"),word=document.getElementById("loaderWord");
    if(loader&&count&&bar&&word){const words=["PRIVATE","LOCAL","OCADE"];const start=performance.now(),duration=1650;const tick=(now)=>{const p=Math.min(1,(now-start)/duration);const n=Math.floor(p*100);count.textContent=String(n).padStart(3,"0");bar.style.transform="scaleX("+p+")";word.textContent=words[Math.min(words.length-1,Math.floor(p*words.length))];if(p<1)requestAnimationFrame(tick);else setTimeout(()=>loader.classList.add("done"),260)};requestAnimationFrame(tick);}
  }
})();
<\/script></body></html>`;
}
function prelaunchPublicResponse(pathname) {
	const html = renderPrelaunchPublicPage(pathname);
	return html ? new Response(html, {
		status: 200,
		headers: publicHeaders("text/html; charset=utf-8")
	}) : null;
}
function prelaunchSitemapResponse() {
	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...PRELAUNCH_PUBLIC_PATHS].map((pathname) => `  <url><loc>https://ocade.in${pathname}</loc></url>`).join("\n")}\n</urlset>\n`;
	return new Response(body, {
		status: 200,
		headers: publicHeaders("application/xml; charset=utf-8")
	});
}
/** Minimal dependency-free page for every route that must remain locked. */
function renderPrelaunchPage() {
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="robots" content="${NOINDEX}" /><title>CARCC CADANE — OCADE</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 20%,#1c1023 0,#08090b 42%,#050506 100%);color:#e6e8ec;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;padding:2rem}main{max-width:34rem;text-align:center;border:1px solid rgba(255,255,255,.08);border-radius:24px;background:rgba(255,255,255,.025);box-shadow:0 28px 100px rgba(0,0,0,.48);backdrop-filter:blur(18px);padding:3rem 2rem}img{display:block;width:min(28rem,100%);height:auto;margin:0 auto 2rem}.brand{font-size:.72rem;letter-spacing:.32em;text-transform:uppercase;color:#a9a1ad}h1{margin:1.25rem 0 0;font-size:1.9rem;font-weight:650;letter-spacing:-.02em}p{margin:1rem 0 0;color:#9aa3af;line-height:1.7;font-size:.95rem}</style></head><body><main><img src="/brand/ocade-carcc-wordmark.png" alt="OCADE by CARCC CADANE — Command the Next Era." width="2172" height="724" /><p class="brand">CARCC CADANE</p><h1>OCADE</h1><p>Authenticated product access is not open yet.</p><p>Public information, Privacy, Terms, About and Support remain available through the navigation on the OCADE home page.</p></main></body></html>`;
}
/** Robots remains crawlable while the authenticated product is locked. */
function prelaunchRobotsResponse(decision) {
	const body = [
		"User-agent: *",
		"Disallow: /",
		...[...PRELAUNCH_PUBLIC_PATHS].map((pathname) => `Allow: ${pathname}`),
		"Allow: /brand/ocade-carcc-wordmark.png",
		"Allow: /brand/ocade-carcc-mark.png",
		"Sitemap: https://ocade.in/sitemap.xml",
		""
	].join("\n");
	return new Response(body, {
		status: 200,
		headers: {
			...publicHeaders("text/plain; charset=utf-8"),
			"retry-after": String(decision.retryAfterSeconds)
		}
	});
}
/**
* The response for any locked request. Public factual/legal pages stay 200;
* everything else remains a 503/no-store/noindex response.
*/
function prelaunchResponse(pathname, decision) {
	const canonicalPath = pathname.length > 1 && pathname.endsWith("/") ? pathname.replace(/\/+$/, "") : pathname;
	if (canonicalPath !== pathname && PRELAUNCH_PUBLIC_PATHS.has(canonicalPath)) return new Response(null, {
		status: 308,
		headers: {
			...publicHeaders("text/html; charset=utf-8"),
			location: canonicalPath
		}
	});
	if (pathname === "/robots.txt") return prelaunchRobotsResponse(decision);
	if (pathname === "/sitemap.xml") return prelaunchSitemapResponse();
	if (PRELAUNCH_PUBLIC_PATHS.has(pathname)) return prelaunchPublicResponse(pathname) ?? new Response(renderPrelaunchPage(), {
		status: 503,
		headers: lockedHeaders(decision, "text/html; charset=utf-8")
	});
	return new Response(renderPrelaunchPage(), {
		status: 503,
		headers: lockedHeaders(decision, "text/html; charset=utf-8")
	});
}
var DEFAULT_SECURITY_HEADERS = {
	"content-security-policy": [
		"default-src 'self'",
		"base-uri 'self'",
		"object-src 'none'",
		"frame-ancestors 'none'",
		"form-action 'self'",
		"script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://static.cloudflareinsights.com/beacon.min.js https://static.cloudflareinsights.com/beacon.min.js/",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https:",
		"font-src 'self' data:",
		"connect-src 'self' https: wss: blob: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
		"worker-src 'self' blob:",
		"media-src 'self' blob: data:",
		"manifest-src 'self'",
		"upgrade-insecure-requests"
	].join("; "),
	"strict-transport-security": "max-age=31536000",
	"cross-origin-opener-policy": "same-origin-allow-popups",
	"cross-origin-resource-policy": "same-origin",
	"origin-agent-cluster": "?1",
	"permissions-policy": "camera=(self), microphone=(self), geolocation=(), payment=(self), usb=(), browsing-topics=()",
	"referrer-policy": "strict-origin-when-cross-origin",
	"x-content-type-options": "nosniff",
	"x-frame-options": "DENY"
};
/** Preserve a response's status/body and add only headers it has not set. */
function withPublicSecurityHeaders(response) {
	const headers = new Headers(response.headers);
	for (const [name, value] of Object.entries(DEFAULT_SECURITY_HEADERS)) if (!headers.has(name)) headers.set(name, value);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
var offline_default = "<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"utf-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n    <title>OCADE Local Mode</title>\n    <meta name=\"theme-color\" content=\"#0a0a09\" />\n    <style>\n      :root {\n        color-scheme: dark;\n      }\n      body {\n        margin: 0;\n        min-height: 100vh;\n        display: grid;\n        place-items: center;\n        background: #0a0a09;\n        color: #e8e8e6;\n        font-family:\n          ui-sans-serif,\n          system-ui,\n          -apple-system,\n          \"Segoe UI\",\n          sans-serif;\n        padding: 1.5rem;\n      }\n      main {\n        max-width: 30rem;\n        text-align: center;\n      }\n      h1 {\n        font-size: 1.125rem;\n        font-weight: 600;\n        margin: 0 0 0.75rem;\n      }\n      p {\n        font-size: 0.875rem;\n        line-height: 1.6;\n        color: #a3a3a0;\n        margin: 0 0 0.75rem;\n      }\n      .actions {\n        display: flex;\n        flex-wrap: wrap;\n        justify-content: center;\n        gap: 0.65rem;\n        margin-top: 1rem;\n      }\n      button,\n      a {\n        margin-top: 0.5rem;\n        padding: 0.5rem 1rem;\n        font: inherit;\n        font-size: 0.875rem;\n        color: #e8e8e6;\n        background: transparent;\n        border: 1px solid #33332f;\n        border-radius: 0.5rem;\n        cursor: pointer;\n        text-decoration: none;\n      }\n      button:hover,\n      a:hover {\n        background: #171715;\n      }\n    </style>\n  </head>\n  <body>\n    <main>\n      <h1>OCADE local mode</h1>\n      <!--\n        Says what is and is not available, rather than \"no internet connection\".\n        A local-first product that stores conversations in the browser vault and\n        can run an engine on the device genuinely does keep working here — but\n        only the parts that never needed the network, and the user is entitled\n        to know which those are before they start typing.\n      -->\n      <p>Network services are unavailable right now; OCADE is keeping your device-only work available.</p>\n      <p>\n        Conversations kept in Browser Only or PC Vault storage remain here. A local answer also\n        needs an engine that was prepared on this device while connected.\n      </p>\n      <div class=\"actions\">\n        <a href=\"/demo/ocade\">Open device-only demo</a>\n        <button type=\"button\" onclick=\"location.reload()\">Reconnect</button>\n      </div>\n      <script>\n        addEventListener(\"online\", () => location.reload(), { once: true });\n      <\/script>\n    </main>\n  </body>\n</html>\n";
var serverEntryPromise;
async function getServerEntry() {
	if (!serverEntryPromise) serverEntryPromise = import("./server-BhOIy7w3.mjs").then((m) => m.default ?? m);
	return serverEntryPromise;
}
async function normalizeCatastrophicSsrResponse(response) {
	if (response.status < 500) return response;
	if (!(response.headers.get("content-type") ?? "").includes("application/json")) return response;
	const body = await response.clone().text();
	if (!isH3SwallowedErrorBody(body)) return response;
	console.error(consumeLastCapturedError() ?? /* @__PURE__ */ new Error(`h3 swallowed SSR error: ${body}`));
	return new Response(renderErrorPage(), {
		status: 500,
		headers: { "content-type": "text/html; charset=utf-8" }
	});
}
function isH3SwallowedErrorBody(body) {
	try {
		const payload = JSON.parse(body);
		return payload.unhandled === true && payload.message === "HTTPError";
	} catch {
		return false;
	}
}
var server_default = { async fetch(request, env, ctx) {
	const runtimeEnv = cloudflareRequestEnv(request, env);
	const health = releaseHealthResponse(request, runtimeEnv);
	if (health) return withPublicSecurityHeaders(health);
	const url = new URL(request.url);
	const gate = evaluateLaunchGate({
		now: Date.now(),
		hostname: url.hostname,
		env: runtimeEnv
	});
	const isPaymentWebhook = url.pathname === "/api/public/payments/webhook";
	const isPublicPrelaunchAsset = (request.method === "GET" || request.method === "HEAD") && PRELAUNCH_PUBLIC_ASSET_PATHS.has(url.pathname);
	if (!gate.open && !isPaymentWebhook && !isPublicPrelaunchAsset) return withPublicSecurityHeaders(prelaunchResponse(url.pathname, gate));
	if (gate.open && (request.method === "GET" || request.method === "HEAD") && url.pathname === "/offline.html") return withPublicSecurityHeaders(new Response(request.method === "HEAD" ? null : offline_default, {
		status: 200,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "public, max-age=3600"
		}
	}));
	try {
		return withPublicSecurityHeaders(await normalizeCatastrophicSsrResponse(await (await getServerEntry()).fetch(request, env, ctx)));
	} catch (error) {
		console.error(error);
		return withPublicSecurityHeaders(new Response(renderErrorPage(), {
			status: 500,
			headers: { "content-type": "text/html; charset=utf-8" }
		}));
	}
} };
//#endregion
export { organizationStructuredData as a, server_default as default, WEBSITE_STRUCTURED_DATA as i, OCADE_STRUCTURED_DATA as n, renderErrorPage as o, PUBLIC_IDENTITY as r, FOUNDER_STRUCTURED_DATA as t };
