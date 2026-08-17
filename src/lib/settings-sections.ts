import type { LucideIcon } from "lucide-react";
import {
  User,
  ShieldCheck,
  HardDrive,
  Database,
  Monitor,
  Gauge,
  SlidersHorizontal,
  Cpu,
  Mic,
  Lock,
  Palette,
  Cloud,
  Puzzle,
  Plug,
  Terminal,
  Globe,
  Brain,
  MessageSquare,
  Smartphone,
  Image as ImageIcon,
  Activity,
  LifeBuoy,
  Wand2,
  ListChecks,
} from "lucide-react";

/**
 * The settings map.
 *
 * WHAT THIS REPLACED. Fifty entries in seven groups, of which SIXTEEN were
 * `setup_required` — pages that existed only to say they did not exist yet.
 * Someone looking for the one switch they came for read past a Profile page
 * that could not be edited, a Billing page with no plan, a Notifications page
 * that notified nothing, and four more, in a sidebar long enough to scroll.
 * Placeholders are not navigation; they are a list of promises filed under
 * settings.
 *
 * ELEVEN CATEGORIES, and the count is the design. Everything a person actually
 * changes belongs in one of them, and if a new control does not obviously
 * belong in one, that is a signal about the control rather than a reason for a
 * twelfth category.
 *
 * ADVANCED IS OPT-IN AND SEPARATE. Software skills, browser control,
 * connectors, computer control, diagnostics and the rest are real and some
 * people need them — but presenting them as peers of "Voice" and "Account"
 * told every ordinary user that this is an engineering tool. They now sit
 * behind one switch, off by default. `advanced: true` is the only thing that
 * marks them; the shell decides whether to show the group.
 *
 * A SECTION HERE MUST HAVE A PAGE. Every slug below resolves to either a
 * dedicated route or an entry in the catch-all's implementation map — asserted
 * by `settings-sections-reachable.test.ts`. That guard is why removing the
 * placeholders was safe: it fails if this file ever again lists a destination
 * that does not render.
 */

export type SettingsStatus = "active" | "external";

export type SettingsSection = {
  slug: string; // URL slug (empty string for the /settings root)
  label: string;
  icon: LucideIcon;
  status: SettingsStatus;
  description: string;
  keywords?: string[]; // for search
  externalTo?: string; // for status "external"
  externalHint?: string;
};

export type SettingsGroup = {
  id: string;
  label: string;
  items: SettingsSection[];
  /**
   * Hidden unless the reader has asked for it. One group carries this, and one
   * switch reveals it — see the note at the top of this file.
   */
  advanced?: boolean;
};

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: "general",
    label: "General",
    items: [
      {
        slug: "",
        label: "General",
        icon: SlidersHorizontal,
        status: "active",
        description: "How OCADE opens and behaves.",
        keywords: ["general", "start", "default", "home"],
      },
      {
        slug: "chat",
        label: "Chat",
        icon: MessageSquare,
        status: "active",
        description: "How the transcript reads and how a message is sent.",
        keywords: ["chat", "markdown", "density", "enter", "send", "drafts"],
      },
    ],
  },
  {
    id: "appearance",
    label: "Appearance & Motion",
    items: [
      {
        slug: "appearance",
        label: "Appearance",
        icon: Palette,
        status: "active",
        description: "Theme, contrast and text size.",
        keywords: ["appearance", "theme", "dark", "light", "contrast", "font", "cursor"],
      },
      {
        slug: "motion",
        label: "Motion & depth",
        icon: Wand2,
        status: "active",
        description: "How much the interface moves on this device.",
        keywords: ["motion", "animation", "3d", "depth", "reduced"],
      },
    ],
  },
  {
    id: "privacy",
    label: "Privacy",
    items: [
      {
        slug: "privacy",
        label: "Privacy mode",
        icon: ShieldCheck,
        status: "active",
        description: "Where your work is allowed to go.",
        keywords: ["privacy", "device only", "sync", "cloud", "mode"],
      },
      {
        slug: "cloud-permission",
        label: "Cloud permission",
        icon: Cloud,
        status: "active",
        description: "Which conversations may use the cloud.",
        keywords: ["cloud", "permission", "consent", "allow"],
      },
      {
        slug: "permissions",
        label: "Permissions",
        icon: Lock,
        status: "active",
        description: "What OCADE may do without asking again.",
        keywords: ["permission", "approval", "confirm", "allow"],
      },
    ],
  },
  {
    id: "local",
    label: "Local & Offline",
    items: [
      {
        slug: "local-engine",
        label: "Local engine",
        icon: Cpu,
        status: "active",
        description: "The engine that answers on this device.",
        keywords: ["local", "engine", "on device", "model", "download"],
      },
      {
        slug: "offline",
        label: "Offline storage",
        icon: HardDrive,
        status: "active",
        description: "What is kept here so OCADE works with no connection.",
        keywords: ["offline", "storage", "cache", "download", "install"],
      },
      {
        slug: "providers",
        label: "Cloud engines",
        icon: Globe,
        status: "active",
        description: "Metered engines, used only when you allow them.",
        keywords: ["cloud", "provider", "metered", "online"],
      },
    ],
  },
  {
    id: "voice",
    label: "Voice",
    items: [
      {
        slug: "voice",
        label: "Voice",
        icon: Mic,
        status: "active",
        description: "Speaking to OCADE, and hearing it back.",
        keywords: ["voice", "speech", "dictation", "microphone", "read aloud"],
      },
    ],
  },
  {
    id: "memory",
    label: "Memory",
    items: [
      {
        slug: "memory",
        label: "Memory",
        icon: Brain,
        status: "active",
        description: "What OCADE remembers between conversations.",
        keywords: ["memory", "remember", "forget", "context"],
      },
    ],
  },
  {
    id: "devices",
    label: "Devices",
    items: [
      {
        slug: "devices",
        label: "Devices",
        icon: Monitor,
        status: "active",
        description: "The computers and phones approved for this account.",
        keywords: ["device", "computer", "phone", "pair", "revoke", "mobile"],
      },
      {
        slug: "mobile",
        label: "Mobile control",
        icon: Smartphone,
        status: "active",
        description: "Pair a phone and supervise scoped PC tasks.",
        keywords: ["mobile", "phone", "remote", "pair", "approval", "emergency stop"],
      },
    ],
  },
  {
    id: "subscription",
    label: "Usage",
    items: [
      {
        slug: "usage",
        label: "Usage & plan",
        icon: Gauge,
        status: "active",
        description: "What you have used, and what your plan allows.",
        keywords: ["usage", "plan", "allowance", "limit"],
      },
    ],
  },
  {
    id: "data",
    label: "Data",
    items: [
      {
        slug: "vault",
        label: "Your data",
        icon: Database,
        status: "active",
        description: "Export or delete what OCADE holds.",
        keywords: ["data", "export", "delete", "vault", "download"],
      },
      {
        slug: "tasks",
        label: "Tasks",
        icon: ListChecks,
        status: "active",
        description: "Automations on this account and the runs they produced.",
        keywords: ["task", "automation", "run", "schedule", "queue", "cancel", "pause"],
      },
      {
        slug: "activity",
        label: "Activity",
        icon: Activity,
        status: "active",
        description: "What has been done on this account.",
        keywords: ["activity", "history", "log", "audit"],
      },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      {
        slug: "account",
        label: "Account",
        icon: User,
        status: "active",
        description: "Your sign-in and account details.",
        keywords: ["account", "email", "password", "sign in", "profile", "security"],
      },
      {
        slug: "security",
        label: "Security",
        icon: Lock,
        status: "active",
        description: "Password, sign-in methods, active sessions and security events.",
        keywords: ["security", "password", "session", "sign out", "reset", "2fa", "login"],
      },
      {
        slug: "support",
        label: "Customer support",
        icon: LifeBuoy,
        status: "active",
        description: "Cases, replies and support history.",
        keywords: ["support", "help", "ticket", "case", "billing", "history"],
      },
    ],
  },
  {
    id: "about",
    label: "About",
    items: [
      {
        slug: "about",
        label: "About",
        icon: ShieldCheck,
        status: "active",
        description: "Version, licences and third-party notices.",
        keywords: ["about", "licence", "license", "version", "notices"],
      },
    ],
  },

  /* ------------------------------------------------------------ advanced -- */
  {
    id: "advanced",
    label: "Advanced",
    advanced: true,
    items: [
      {
        slug: "images",
        label: "Images",
        icon: ImageIcon,
        status: "active",
        description: "How OCADE reads and produces images.",
        keywords: ["image", "vision", "picture", "generate"],
      },
      {
        slug: "work",
        label: "Computer control",
        icon: Terminal,
        status: "active",
        description: "Letting OCADE operate this computer.",
        keywords: ["work", "computer", "control", "automation", "desktop"],
      },
      {
        slug: "skills",
        label: "Software skills",
        icon: Puzzle,
        status: "active",
        description: "Applications OCADE has been taught to drive.",
        keywords: ["skill", "software", "application", "trust"],
      },
      {
        slug: "browser",
        label: "Browser control",
        icon: Globe,
        status: "active",
        description: "Letting OCADE read and act in a browser.",
        keywords: ["browser", "web", "control", "extension"],
      },
      {
        slug: "connectors",
        label: "Connectors",
        icon: Plug,
        status: "active",
        description: "Outside services OCADE may reach.",
        keywords: ["connector", "integration", "service", "api"],
      },
      {
        slug: "updates",
        label: "Updates",
        icon: Cpu,
        status: "active",
        description: "How this application updates itself.",
        keywords: ["update", "version", "release", "patch"],
      },
      {
        slug: "diagnostics",
        label: "Diagnostics",
        icon: Terminal,
        status: "active",
        description: "Verification receipts and technical detail.",
        keywords: ["diagnostic", "debug", "receipt", "proof", "integrity", "developer"],
      },
      {
        slug: "accessibility",
        label: "Accessibility",
        icon: Monitor,
        status: "active",
        description: "Keyboard and screen-reader behaviour.",
        keywords: ["accessibility", "keyboard", "screen reader", "a11y"],
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
