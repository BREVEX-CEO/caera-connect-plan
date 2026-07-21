/**
 * CANIA section catalog — client-safe metadata. No live data, no provider keys.
 *
 * A section describes one intelligence surface (World news, Weather, etc.),
 * the provider adapters that COULD power it, and the honest "data label"
 * that a card would carry once a provider is connected.
 */

import {
  Globe2,
  Flag,
  Briefcase,
  Cpu,
  Landmark,
  CloudSun,
  Car,
  Coins,
  LineChart,
  Droplets,
  Trophy,
  Megaphone,
  Plane,
  ShieldAlert,
  BookMarked,
  Bell,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Compass,
  type LucideIcon,
} from "lucide-react";

export type CaniaDataLabel = "live" | "delayed" | "estimated" | "ai_summary";

export interface CaniaSectionDef {
  /** Route path segment after /cania/. Empty for the index (overview). */
  slug: string;
  /** Short id used for saved topics + alerts + telemetry. */
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Provider adapter ids from cania-providers.ts. */
  providerIds: string[];
  /** Default label a card in this section would carry when live. */
  defaultLabel: CaniaDataLabel;
  /** Some sections need the user's location to answer at all. */
  requiresLocation?: boolean;
  /** Whether this section supports saving topics / setting alerts. */
  supportsTopics?: boolean;
  supportsAlerts?: boolean;
  /** Admin/tool routes bypass the DataCard grid. */
  adminOnly?: boolean;
}

export const CANIA_SECTIONS: CaniaSectionDef[] = [
  {
    slug: "",
    id: "overview",
    title: "Overview",
    description: "Signals summary across every CANIA section. Empty until providers are connected.",
    icon: Compass,
    providerIds: [],
    defaultLabel: "ai_summary",
  },
  {
    slug: "world",
    id: "world_news",
    title: "World news",
    description: "Global headlines and developing stories from authorized news providers.",
    icon: Globe2,
    providerIds: ["gnews", "newsapi", "guardian_open"],
    defaultLabel: "delayed",
    supportsTopics: true,
    supportsAlerts: true,
  },
  {
    slug: "country",
    id: "country_news",
    title: "Country news",
    description: "News scoped to the country in your CANIA settings.",
    icon: Flag,
    providerIds: ["gnews", "newsapi"],
    defaultLabel: "delayed",
    supportsTopics: true,
    supportsAlerts: true,
  },
  {
    slug: "business",
    id: "business",
    title: "Business",
    description: "Company, market and industry stories from authorized wires.",
    icon: Briefcase,
    providerIds: ["newsapi", "guardian_open"],
    defaultLabel: "delayed",
    supportsTopics: true,
    supportsAlerts: true,
  },
  {
    slug: "technology",
    id: "technology",
    title: "Technology",
    description: "Tech industry, product launches and research summaries.",
    icon: Cpu,
    providerIds: ["newsapi", "guardian_open"],
    defaultLabel: "delayed",
    supportsTopics: true,
    supportsAlerts: true,
  },
  {
    slug: "finance",
    id: "finance",
    title: "Finance",
    description: "Financial headlines. Prices live in Markets and Currency.",
    icon: Landmark,
    providerIds: ["newsapi", "alphavantage_news"],
    defaultLabel: "delayed",
    supportsTopics: true,
    supportsAlerts: true,
  },
  {
    slug: "weather",
    id: "weather",
    title: "Weather",
    description: "Current conditions and forecasts for your saved locations.",
    icon: CloudSun,
    providerIds: ["openweather", "meteostat"],
    defaultLabel: "live",
    requiresLocation: true,
    supportsAlerts: true,
  },
  {
    slug: "traffic",
    id: "traffic",
    title: "Traffic",
    description: "Traffic conditions and incident feeds where the provider covers.",
    icon: Car,
    providerIds: ["tomtom_traffic", "here_traffic"],
    defaultLabel: "live",
    requiresLocation: true,
    supportsAlerts: true,
  },
  {
    slug: "currency",
    id: "currency",
    title: "Currency",
    description: "Exchange rates between your primary and secondary currencies.",
    icon: Coins,
    providerIds: ["openexchangerates", "frankfurter"],
    defaultLabel: "delayed",
    supportsAlerts: true,
  },
  {
    slug: "markets",
    id: "markets",
    title: "Markets",
    description: "Equity indices and quotes from authorized market data providers.",
    icon: LineChart,
    providerIds: ["alphavantage", "polygon"],
    defaultLabel: "delayed",
    supportsTopics: true,
    supportsAlerts: true,
  },
  {
    slug: "commodities",
    id: "commodities",
    title: "Oil and commodities",
    description: "Crude, natural gas, metals and agricultural benchmarks.",
    icon: Droplets,
    providerIds: ["eia_open", "alphavantage_commodities"],
    defaultLabel: "delayed",
    supportsAlerts: true,
  },
  {
    slug: "sports",
    id: "sports",
    title: "Sports",
    description: "Scores, fixtures and results for your followed teams.",
    icon: Trophy,
    providerIds: ["thesportsdb", "sportradar"],
    defaultLabel: "live",
    supportsTopics: true,
    supportsAlerts: true,
  },
  {
    slug: "government",
    id: "government",
    title: "Government announcements",
    description: "Official press releases, statutes and gazette entries.",
    icon: Megaphone,
    providerIds: ["gov_press_office", "in_pib"],
    defaultLabel: "delayed",
    supportsTopics: true,
    supportsAlerts: true,
  },
  {
    slug: "travel",
    id: "travel_warnings",
    title: "Travel warnings",
    description: "Advisories and entry requirements from official foreign-office sources.",
    icon: Plane,
    providerIds: ["gov_travel_advisory"],
    defaultLabel: "delayed",
    supportsAlerts: true,
  },
  {
    slug: "risks",
    id: "business_risks",
    title: "Business risks",
    description: "Sanctions, regulatory bulletins and industry risk feeds.",
    icon: ShieldAlert,
    providerIds: ["ofac_sanctions", "sec_edgar", "gleif_lei"],
    defaultLabel: "delayed",
    supportsAlerts: true,
  },
  {
    slug: "saved",
    id: "saved_topics",
    title: "Saved topics",
    description: "Topics you follow across every CANIA section.",
    icon: BookMarked,
    providerIds: [],
    defaultLabel: "ai_summary",
    adminOnly: true,
  },
  {
    slug: "alerts",
    id: "alerts",
    title: "Alerts",
    description: "Notification preferences per section and channel.",
    icon: Bell,
    providerIds: [],
    defaultLabel: "ai_summary",
    adminOnly: true,
  },
  {
    slug: "search",
    id: "search",
    title: "Search",
    description: "Cross-section search across authorized providers.",
    icon: SearchIcon,
    providerIds: [],
    defaultLabel: "ai_summary",
    adminOnly: true,
  },
  {
    slug: "settings",
    id: "cania_settings",
    title: "Location, timezone & currency",
    description: "Where CANIA scopes results and which units and currencies to show.",
    icon: SettingsIcon,
    providerIds: [],
    defaultLabel: "ai_summary",
    adminOnly: true,
  },
];

export function getCaniaSection(slug: string): CaniaSectionDef | undefined {
  return CANIA_SECTIONS.find((s) => s.slug === slug);
}

export const CANIA_DATA_LABELS: Record<CaniaDataLabel, string> = {
  live: "Live",
  delayed: "Delayed",
  estimated: "Estimated",
  ai_summary: "AI summary",
};
