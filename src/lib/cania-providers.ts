/**
 * CANIA provider adapters — client-safe catalog only.
 *
 * Each adapter describes an authorized data source that a future
 * server-side fetcher will call. Nothing here fetches. Status stays
 * "setup_required" until an operator supplies a key via project secrets
 * AND connects the adapter through the admin surface.
 *
 * NO fake live data anywhere. If status !== "connected", the UI must render
 * a truthful Setup Required / Native Companion Required / Provider Error
 * state — never a fabricated headline, price, forecast or advisory.
 */

export type CaniaProviderKind =
  | "news"
  | "weather"
  | "traffic"
  | "currency"
  | "markets"
  | "commodities"
  | "sports"
  | "government"
  | "risk";

export type CaniaProviderStatus =
  | "setup_required"
  | "connected"
  | "planned";

export type CaniaProviderAuth =
  | "none"
  | "api_key"
  | "oauth"
  | "native_companion";

export interface CaniaProviderAdapter {
  id: string;
  displayName: string;
  kind: CaniaProviderKind;
  auth: CaniaProviderAuth;
  /** Server-side env variable name the future fetcher will read. */
  secretName?: string;
  /** Human-readable coverage note. */
  coverage: string;
  /** Where to obtain the key/credential (docs URL, plain text). */
  setupHint: string;
  /** Sections this adapter can power (matches CaniaSectionDef.id). */
  sections: string[];
  /** Default label the adapter's cards would carry when live. */
  defaultLabel: "live" | "delayed" | "estimated" | "ai_summary";
  /** Current status — never set to "connected" without a real health check. */
  status: CaniaProviderStatus;
}

export const CANIA_PROVIDERS: CaniaProviderAdapter[] = [
  // News
  {
    id: "gnews",
    displayName: "GNews",
    kind: "news",
    auth: "api_key",
    secretName: "GNEWS_API_KEY",
    coverage: "Global and country-scoped headlines.",
    setupHint: "Sign up at gnews.io and add GNEWS_API_KEY to project secrets.",
    sections: ["world_news", "country_news"],
    defaultLabel: "delayed",
    status: "setup_required",
  },
  {
    id: "newsapi",
    displayName: "NewsAPI",
    kind: "news",
    auth: "api_key",
    secretName: "NEWSAPI_API_KEY",
    coverage: "Business, technology, general news.",
    setupHint: "Register at newsapi.org and add NEWSAPI_API_KEY.",
    sections: ["world_news", "country_news", "business", "technology", "finance"],
    defaultLabel: "delayed",
    status: "setup_required",
  },
  {
    id: "guardian_open",
    displayName: "The Guardian Open Platform",
    kind: "news",
    auth: "api_key",
    secretName: "GUARDIAN_API_KEY",
    coverage: "UK and international news with generous free tier.",
    setupHint: "Request a developer key at open-platform.theguardian.com.",
    sections: ["world_news", "business", "technology"],
    defaultLabel: "delayed",
    status: "setup_required",
  },
  {
    id: "alphavantage_news",
    displayName: "Alpha Vantage News",
    kind: "news",
    auth: "api_key",
    secretName: "ALPHAVANTAGE_API_KEY",
    coverage: "Financial news sentiment.",
    setupHint: "Free key at alphavantage.co.",
    sections: ["finance"],
    defaultLabel: "delayed",
    status: "setup_required",
  },

  // Weather
  {
    id: "openweather",
    displayName: "OpenWeather",
    kind: "weather",
    auth: "api_key",
    secretName: "OPENWEATHER_API_KEY",
    coverage: "Current + forecast for coordinates or city.",
    setupHint: "openweathermap.org — add OPENWEATHER_API_KEY.",
    sections: ["weather"],
    defaultLabel: "live",
    status: "setup_required",
  },
  {
    id: "meteostat",
    displayName: "Meteostat",
    kind: "weather",
    auth: "api_key",
    secretName: "METEOSTAT_API_KEY",
    coverage: "Historical weather (via RapidAPI).",
    setupHint: "Subscribe on RapidAPI and add METEOSTAT_API_KEY.",
    sections: ["weather"],
    defaultLabel: "delayed",
    status: "setup_required",
  },

  // Traffic
  {
    id: "tomtom_traffic",
    displayName: "TomTom Traffic",
    kind: "traffic",
    auth: "api_key",
    secretName: "TOMTOM_API_KEY",
    coverage: "Live traffic flow and incidents.",
    setupHint: "developer.tomtom.com — add TOMTOM_API_KEY.",
    sections: ["traffic"],
    defaultLabel: "live",
    status: "setup_required",
  },
  {
    id: "here_traffic",
    displayName: "HERE Traffic",
    kind: "traffic",
    auth: "api_key",
    secretName: "HERE_API_KEY",
    coverage: "Traffic flow, incidents and routing.",
    setupHint: "developer.here.com — add HERE_API_KEY.",
    sections: ["traffic"],
    defaultLabel: "live",
    status: "setup_required",
  },

  // Currency
  {
    id: "openexchangerates",
    displayName: "Open Exchange Rates",
    kind: "currency",
    auth: "api_key",
    secretName: "OPENEXCHANGERATES_APP_ID",
    coverage: "170+ currencies, hourly updates.",
    setupHint: "openexchangerates.org — add OPENEXCHANGERATES_APP_ID.",
    sections: ["currency"],
    defaultLabel: "delayed",
    status: "setup_required",
  },
  {
    id: "frankfurter",
    displayName: "Frankfurter (ECB)",
    kind: "currency",
    auth: "none",
    coverage: "ECB reference rates. No key required.",
    setupHint: "No secret needed. Enable in admin once server route is ready.",
    sections: ["currency"],
    defaultLabel: "delayed",
    status: "setup_required",
  },

  // Markets
  {
    id: "alphavantage",
    displayName: "Alpha Vantage",
    kind: "markets",
    auth: "api_key",
    secretName: "ALPHAVANTAGE_API_KEY",
    coverage: "Equities, FX, crypto and indices (delayed).",
    setupHint: "alphavantage.co — add ALPHAVANTAGE_API_KEY.",
    sections: ["markets"],
    defaultLabel: "delayed",
    status: "setup_required",
  },
  {
    id: "polygon",
    displayName: "Polygon.io",
    kind: "markets",
    auth: "api_key",
    secretName: "POLYGON_API_KEY",
    coverage: "US equities and options (paid tiers for live).",
    setupHint: "polygon.io — add POLYGON_API_KEY.",
    sections: ["markets"],
    defaultLabel: "delayed",
    status: "setup_required",
  },

  // Commodities
  {
    id: "eia_open",
    displayName: "US EIA Open Data",
    kind: "commodities",
    auth: "api_key",
    secretName: "EIA_API_KEY",
    coverage: "Crude, natural gas, refined products.",
    setupHint: "eia.gov/opendata — add EIA_API_KEY.",
    sections: ["commodities"],
    defaultLabel: "delayed",
    status: "setup_required",
  },
  {
    id: "alphavantage_commodities",
    displayName: "Alpha Vantage Commodities",
    kind: "commodities",
    auth: "api_key",
    secretName: "ALPHAVANTAGE_API_KEY",
    coverage: "Commodity time series.",
    setupHint: "Uses the shared ALPHAVANTAGE_API_KEY.",
    sections: ["commodities"],
    defaultLabel: "delayed",
    status: "setup_required",
  },

  // Sports
  {
    id: "thesportsdb",
    displayName: "TheSportsDB",
    kind: "sports",
    auth: "api_key",
    secretName: "THESPORTSDB_API_KEY",
    coverage: "Fixtures, results and team info.",
    setupHint: "thesportsdb.com — add THESPORTSDB_API_KEY.",
    sections: ["sports"],
    defaultLabel: "delayed",
    status: "setup_required",
  },
  {
    id: "sportradar",
    displayName: "Sportradar",
    kind: "sports",
    auth: "api_key",
    secretName: "SPORTRADAR_API_KEY",
    coverage: "Professional-grade live scores (paid).",
    setupHint: "developer.sportradar.com — add SPORTRADAR_API_KEY.",
    sections: ["sports"],
    defaultLabel: "live",
    status: "setup_required",
  },

  // Government / Travel / Risk
  {
    id: "gov_press_office",
    displayName: "Government press office feed",
    kind: "government",
    auth: "none",
    coverage: "Country-specific official RSS/JSON feeds. Configured per country.",
    setupHint: "Add feed URLs in admin once server route is ready.",
    sections: ["government"],
    defaultLabel: "delayed",
    status: "setup_required",
  },
  {
    id: "in_pib",
    displayName: "India — Press Information Bureau",
    kind: "government",
    auth: "none",
    coverage: "PIB India press releases (public RSS).",
    setupHint: "No secret needed. Enable in admin once server route is ready.",
    sections: ["government"],
    defaultLabel: "delayed",
    status: "setup_required",
  },
  {
    id: "gov_travel_advisory",
    displayName: "Foreign-office travel advisories",
    kind: "government",
    auth: "none",
    coverage: "Official travel advisories per issuing country.",
    setupHint: "Add feed URLs in admin once server route is ready.",
    sections: ["travel_warnings"],
    defaultLabel: "delayed",
    status: "setup_required",
  },
  {
    id: "ofac_sanctions",
    displayName: "US OFAC Sanctions List",
    kind: "risk",
    auth: "none",
    coverage: "Consolidated sanctions data (public).",
    setupHint: "No secret needed. Enable in admin once server route is ready.",
    sections: ["business_risks"],
    defaultLabel: "delayed",
    status: "setup_required",
  },
  {
    id: "sec_edgar",
    displayName: "US SEC EDGAR",
    kind: "risk",
    auth: "none",
    coverage: "Company filings and disclosures.",
    setupHint: "Public. Enable in admin once server route is ready.",
    sections: ["business_risks"],
    defaultLabel: "delayed",
    status: "setup_required",
  },
  {
    id: "gleif_lei",
    displayName: "GLEIF LEI",
    kind: "risk",
    auth: "none",
    coverage: "Global Legal Entity Identifiers.",
    setupHint: "Public. Enable in admin once server route is ready.",
    sections: ["business_risks"],
    defaultLabel: "delayed",
    status: "setup_required",
  },
];

export function getCaniaProvider(id: string): CaniaProviderAdapter | undefined {
  return CANIA_PROVIDERS.find((p) => p.id === id);
}

export function providersForSection(sectionId: string): CaniaProviderAdapter[] {
  return CANIA_PROVIDERS.filter((p) => p.sections.includes(sectionId));
}
