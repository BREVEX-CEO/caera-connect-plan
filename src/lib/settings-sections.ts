import type { LucideIcon } from "lucide-react";
import {
  User,
  IdCard,
  KeyRound,
  ShieldCheck,
  Shield,
  HardDrive,
  Database,
  ScrollText,
  Monitor,
  Smartphone,
  CreditCard,
  Gauge,
  SlidersHorizontal,
  Cpu,
  Mic,
  Wand2,
  Lock,
  GraduationCap,
  Palette,
  MousePointer,
  Bell,
  Languages,
  Timer,
  Accessibility,
  Puzzle,
  Plug,
  Blocks,
  Terminal,
  Building2,
  Users,
  CheckSquare,
  Globe,
  ClipboardCheck,
  PenTool,
  Brain,
} from "lucide-react";

export type SettingsStatus = "active" | "setup_required" | "external";

export type SettingsSection = {
  slug: string; // URL slug (empty string for the /settings root)
  label: string;
  icon: LucideIcon;
  status: SettingsStatus;
  description: string; // shown on setup_required pages
  keywords?: string[]; // for search
  externalTo?: string; // for status "external"
  externalHint?: string;
};

export type SettingsGroup = {
  id: string;
  label: string;
  items: SettingsSection[];
};

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "account",
    label: "Account",
    items: [
      {
        slug: "",
        label: "General",
        icon: User,
        status: "active",
        description: "Name, preferred name, language, timezone and quick appearance controls.",
        keywords: ["general", "name", "profile", "language", "timezone"],
      },
      {
        slug: "profile",
        label: "Profile",
        icon: IdCard,
        status: "setup_required",
        description:
          "Extended public profile, avatar collections and pronouns arrive with the People slice.",
        keywords: ["profile", "avatar", "bio"],
      },
      {
        slug: "account",
        label: "Account",
        icon: User,
        status: "setup_required",
        description:
          "Change email, phone and merge duplicate accounts. Available with the identity slice.",
        keywords: ["account", "email", "phone", "delete"],
      },
      {
        slug: "authentication",
        label: "Authentication",
        icon: KeyRound,
        status: "setup_required",
        description:
          "Passkeys, hardware keys and provider linking (Google, Apple, phone, email OTP) ship with the auth hardening slice.",
        keywords: ["auth", "password", "passkey", "webauthn", "oauth", "otp"],
      },
      {
        slug: "security",
        label: "Security",
        icon: ShieldCheck,
        status: "setup_required",
        description:
          "Session review, sign-out everywhere and login alerts arrive with the security slice.",
        keywords: ["security", "sessions", "sign out"],
      },
    ],
  },
  {
    id: "privacy",
    label: "Privacy and Data",
    items: [
      {
        slug: "privacy",
        label: "Privacy",
        icon: Shield,
        status: "active",
        description: "Per-data-class privacy: Browser Only, PC Vault (native) or Private Sync.",
        keywords: ["privacy", "storage", "browser only", "cloud"],
      },
      {
        slug: "vault",
        label: "Storage",
        icon: HardDrive,
        status: "active",
        description: "Browser Vault setup, passphrase, WebAuthn and recovery kit.",
        keywords: ["storage", "vault", "encryption", "passphrase", "webauthn", "recovery"],
      },
      {
        slug: "data-controls",
        label: "Data Controls",
        icon: Database,
        status: "setup_required",
        description:
          "Export a copy of your data, request erasure and manage retention windows. Ships with the compliance slice.",
        keywords: ["export", "erasure", "gdpr", "dpdp", "retention"],
      },
      {
        slug: "activity",
        label: "Activity",
        icon: ScrollText,
        status: "active",
        description: "Operational activity and immutable compliance events.",
        keywords: ["activity", "audit", "logs", "compliance"],
      },
      {
        slug: "memory",
        label: "Memory",
        icon: Brain,
        status: "active",
        description:
          "Review, edit and delete what OCADE remembers. Opt-in and separate from chat history.",
        keywords: ["memory", "remember", "personalisation", "forget"],
      },
      {
        slug: "devices",
        label: "Devices",
        icon: Monitor,
        status: "active",
        description: "Two desktop and two mobile devices per account. Approve, name and revoke.",
        keywords: ["devices", "browsers", "revoke"],
      },
      {
        slug: "mobile",
        label: "Mobile companion",
        icon: Smartphone,
        status: "active",
        description:
          "Pair a phone to monitor OCADE, approve or cancel actions and trigger emergency stop. A phone can never take arbitrary control of your computer.",
        keywords: [
          "mobile",
          "phone",
          "pairing",
          "qr",
          "approve",
          "emergency stop",
          "android",
          "ios",
        ],
      },
    ],
  },
  {
    id: "plans",
    label: "Plans and Usage",
    items: [
      {
        slug: "billing",
        label: "Billing",
        icon: CreditCard,
        status: "setup_required",
        description: "Plans, payment methods and invoices ship with the billing slice.",
        keywords: ["billing", "plans", "invoice", "payment"],
      },
      {
        slug: "usage",
        label: "Usage",
        icon: Gauge,
        status: "active",
        description:
          "Cloud allowance remaining, reset time, plan status and what stays available if a plan lapses. Local use is unlimited.",
        keywords: ["usage", "meter", "allowance", "cloud", "plan", "limits"],
      },
      {
        slug: "limits",
        label: "Limits",
        icon: Gauge,
        status: "setup_required",
        description:
          "Per-account and per-tenant limits are configured on the admin side. User-facing view arrives with the metering slice.",
        keywords: ["limits", "quota"],
      },
    ],
  },
  {
    id: "ocade",
    label: "OCADE",
    items: [
      {
        slug: "ocade-preferences",
        label: "OCADE Preferences",
        icon: SlidersHorizontal,
        status: "setup_required",
        description:
          "Default reply length, tone, system instructions and default project ship with OCADE personalization.",
        keywords: ["ocade", "preferences", "tone", "instructions"],
      },
      {
        slug: "ocade-models",
        label: "Model Settings",
        icon: Cpu,
        status: "external",
        externalTo: "/ocade/models",
        externalHint: "Opens the OCADE model control centre.",
        description:
          "Provider connections, latency tests and technical diagnostics live in the OCADE model control centre.",
        keywords: ["models", "openai", "ollama", "providers"],
      },
      {
        slug: "voice",
        label: "Voice",
        icon: Mic,
        status: "active",
        description:
          "Choose your OCADE voice, speed and language, pick a microphone, enable the local wake phrase, captions and greetings.",
        keywords: ["voice", "tts", "stt", "read aloud", "wake phrase", "captions", "microphone"],
      },
      {
        slug: "work",
        label: "Work and Computer Control",
        icon: Wand2,
        status: "active",
        description:
          "Master Computer Use policy, separate web, computer and paired-device channels, background and remote sessions, recording, replay and emergency stop.",
        keywords: [
          "work",
          "computer use",
          "computer control",
          "native companion",
          "emergency stop",
          "recording",
          "replay",
        ],
      },
      {
        slug: "permissions",
        label: "Permissions",
        icon: Lock,
        status: "active",
        description:
          "Default and time-limited Computer Use permission posture with immutable protected-input boundaries and links to app and site-specific policy.",
        keywords: [
          "permissions",
          "browser",
          "clipboard",
          "filesystem",
          "apps",
          "risk",
          "allowance",
        ],
      },
      {
        slug: "learning",
        label: "Learning and Replay",
        icon: GraduationCap,
        status: "setup_required",
        description:
          "Intern Learning Mode captures, practice replays and skill profiles arrive after OCADE Work.",
        keywords: ["learning", "replay", "intern"],
      },
    ],
  },
  {
    id: "application",
    label: "Application",
    items: [
      {
        slug: "appearance",
        label: "Appearance",
        icon: Palette,
        status: "active",
        description: "Dark, Light and REAL themes; motion and performance controls.",
        keywords: ["appearance", "theme", "dark", "light", "real", "motion"],
      },
      {
        slug: "cursor",
        label: "Cursor",
        icon: MousePointer,
        status: "external",
        externalTo: "/settings/appearance",
        externalHint: "Opens Appearance › Cursor.",
        description:
          "Cursor selection, size, trail and accessibility fallback live inside Appearance.",
        keywords: ["cursor", "pointer"],
      },
      {
        slug: "notifications",
        label: "Notifications",
        icon: Bell,
        status: "setup_required",
        description:
          "Per-channel notifications (mentions, approvals, alerts) arrive with the messenger and alerts slice.",
        keywords: ["notifications", "alerts"],
      },
      {
        slug: "language",
        label: "Language and Region",
        icon: Languages,
        status: "setup_required",
        description:
          "Interface language, number format and country pack are set during onboarding today. Standalone editor ships with the localization slice.",
        keywords: ["language", "locale", "region", "country"],
      },
      {
        slug: "time-focus",
        label: "Time and Focus",
        icon: Timer,
        status: "setup_required",
        description:
          "Focus windows, quiet hours and Do-Not-Disturb schedules arrive with the focus slice.",
        keywords: ["time", "focus", "dnd"],
      },
      {
        slug: "accessibility",
        label: "Accessibility",
        icon: Accessibility,
        status: "active",
        description:
          "Always-on keyboard, focus and screen-reader semantics plus reduced motion, high contrast, system pointer and caption routing.",
        keywords: [
          "accessibility",
          "a11y",
          "contrast",
          "screen reader",
          "keyboard",
          "focus",
          "captions",
        ],
      },
      {
        slug: "updates",
        label: "Updates",
        icon: ShieldCheck,
        status: "active",
        description:
          "What OCADE does with an offered update, decided by the updater's own policy engine. Unsigned or unhashed updates are refused, never installed with a warning. Automatic updates stay unavailable until a real signing key replaces the placeholder.",
        keywords: ["update", "updater", "rollback", "signature", "signing", "version", "upgrade"],
      },
    ],
  },
  {
    id: "extensions",
    label: "Extensions",
    items: [
      {
        slug: "skills",
        label: "Software skills",
        icon: Puzzle,
        status: "active",
        description:
          "What OCADE can actually operate on your behalf, which software categories are not supported yet, and the apps it has learned.",
        keywords: ["skills", "software", "apps", "adapters", "coverage", "packs", "automation"],
      },
      {
        slug: "browser",
        label: "Browser control",
        icon: Globe,
        status: "active",
        description:
          "Choose which websites OCADE may act on, and grant reading or form-filling per site. Passwords, one-time codes and payment fields are always refused.",
        keywords: ["browser", "sites", "permissions", "extension", "web", "allowlist"],
      },
      {
        slug: "connectors",
        label: "Connectors",
        icon: Plug,
        status: "active",
        description:
          "Live status and setup routes for the Native Companion, browser extension, mobile companion and model engines, with honest boundaries for unimplemented third-party OAuth services.",
        keywords: [
          "connectors",
          "integrations",
          "oauth",
          "browser extension",
          "native companion",
          "mobile",
          "models",
        ],
      },
      {
        slug: "integrations",
        label: "Integrations",
        icon: Blocks,
        status: "setup_required",
        description:
          "Webhooks, incoming events and workspace-wide integrations ship after the connectors slice.",
        keywords: ["integrations", "webhooks"],
      },
      {
        slug: "developer",
        label: "Developer",
        icon: Terminal,
        status: "setup_required",
        description:
          "API keys, personal access tokens and CLI setup live here once the developer program opens.",
        keywords: ["developer", "api", "cli"],
      },
    ],
  },
  {
    id: "ficia",
    label: "FICIA",
    items: [
      {
        slug: "companies",
        label: "Companies",
        icon: Building2,
        status: "external",
        externalTo: "/ficia",
        externalHint: "Opens the FICIA hub.",
        description:
          "Create, join or switch companies from the FICIA hub. Per-company settings live inside each company workspace.",
        keywords: ["companies", "ficia", "tenants"],
      },
      {
        slug: "roles",
        label: "Roles",
        icon: Users,
        status: "setup_required",
        description:
          "Global role defaults and role templates. Per-company roles are edited inside FICIA › People.",
        keywords: ["roles", "permissions", "rbac"],
      },
      {
        slug: "approvals",
        label: "Approvals",
        icon: CheckSquare,
        status: "setup_required",
        description:
          "Personal approval preferences and delegation. Per-company approval chains live inside FICIA › Approvals.",
        keywords: ["approvals", "delegation"],
      },
      {
        slug: "compliance",
        label: "Compliance Preferences",
        icon: ClipboardCheck,
        status: "setup_required",
        description:
          "Personal compliance defaults (evidence pack style, signature preferences). Company compliance lives inside FICIA.",
        keywords: ["compliance", "evidence"],
      },
      {
        slug: "signature-trust",
        label: "Signature Trust",
        icon: PenTool,
        status: "setup_required",
        description:
          "Signature Trust Network onboarding — certificate chain, manifests and verification. Ships with the Signature Trust slice.",
        keywords: ["signature", "trust", "certificate"],
      },
    ],
  },
];

export function findSection(slug: string): { group: SettingsGroup; item: SettingsSection } | null {
  const target = slug ?? "";
  for (const group of SETTINGS_GROUPS) {
    const item = group.items.find((i) => i.slug === target);
    if (item) return { group, item };
  }
  return null;
}
