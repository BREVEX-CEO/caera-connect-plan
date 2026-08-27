import type { LucideIcon } from "lucide-react";
import {
  Accessibility,
  Activity,
  Brain,
  Cpu,
  Database,
  Gauge,
  Globe,
  Image as ImageIcon,
  LifeBuoy,
  ListChecks,
  Lock,
  MessageSquare,
  Mic,
  Monitor,
  Palette,
  Plug,
  Puzzle,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Terminal,
  User,
  Wand2,
} from "lucide-react";

export type SettingsStatus = "active" | "external";

export type SettingsSection = {
  slug: string;
  label: string;
  icon: LucideIcon;
  status: SettingsStatus;
  description: string;
  keywords?: string[];
  externalTo?: string;
  externalHint?: string;
};

export type SettingsGroup = {
  id: string;
  label: string;
  items: SettingsSection[];
  advanced?: boolean;
};

/**
 * Customer-facing settings are intentionally grouped by intent, not by
 * implementation subsystem. The app may have dozens of underlying controls;
 * a normal user should not have to learn that architecture to change one.
 *
 * EIGHT GROUPS, AND THE LIST IS CLOSED.
 *
 * General, Account & Security, Appearance, Chat & Voice, Privacy & Data,
 * Devices & Control, Plan, Advanced. A ninth group is how a settings screen
 * becomes a control panel: each new subsystem asks for a heading of its own,
 * every heading is defensible on its own, and the reader ends up scanning
 * fourteen of them to find the one switch they came for. New controls go
 * INSIDE one of these eight, or into Advanced, which is the group that exists
 * precisely so the other seven can stay short.
 *
 * `settings-groups.test.ts` holds the list to eight and to these names.
 */
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
        description: "Your identity, language and personal OCADE instructions.",
        keywords: ["general", "profile", "language", "timezone", "instructions"],
      },
    ],
  },
  {
    id: "account",
    label: "Account & Security",
    items: [
      {
        slug: "account",
        label: "Account",
        icon: User,
        status: "active",
        description: "Your sign-in and account details.",
        keywords: ["account", "email", "password", "sign in", "profile"],
      },
      {
        slug: "security",
        label: "Security",
        icon: Lock,
        status: "active",
        description: "Password, sign-in methods and active sessions.",
        keywords: ["security", "password", "session", "2fa", "login"],
      },
    ],
  },
  {
    id: "appearance",
    label: "Appearance",
    items: [
      {
        slug: "appearance",
        label: "Appearance",
        icon: Palette,
        status: "active",
        description: "Visual style, motion and 3D depth.",
        keywords: ["appearance", "theme", "motion", "3d", "depth", "contrast"],
      },
    ],
  },
  {
    id: "ai-voice",
    label: "Chat & Voice",
    items: [
      {
        slug: "chat",
        label: "Chat",
        icon: MessageSquare,
        status: "active",
        description: "How conversations read and how messages are sent.",
        keywords: ["chat", "markdown", "density", "send", "drafts"],
      },
      {
        slug: "voice",
        label: "Voice",
        icon: Mic,
        status: "active",
        description: "Speaking to OCADE and hearing it back.",
        keywords: ["voice", "speech", "dictation", "microphone", "read aloud"],
      },
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
    id: "privacy-data",
    label: "Privacy & Data",
    items: [
      {
        slug: "privacy",
        label: "Privacy",
        icon: ShieldCheck,
        status: "active",
        description: "Where your work is allowed to go.",
        keywords: ["privacy", "device only", "sync", "data"],
      },
      {
        slug: "permissions",
        label: "Permissions",
        icon: Lock,
        status: "active",
        description: "What OCADE may do without asking again.",
        keywords: ["permission", "approval", "confirm", "allow"],
      },
      {
        slug: "vault",
        label: "Your data",
        icon: Database,
        status: "active",
        description: "Export or delete what OCADE holds.",
        keywords: ["data", "export", "delete", "vault", "download"],
      },
      {
        slug: "activity",
        label: "Activity",
        icon: Activity,
        status: "active",
        description: "What has been done on this account.",
        keywords: ["activity", "history", "audit"],
      },
    ],
  },
  {
    id: "devices-control",
    label: "Devices & Control",
    items: [
      {
        slug: "devices",
        label: "Devices",
        icon: Monitor,
        status: "active",
        description: "Computers and phones approved for this account.",
        keywords: ["device", "computer", "phone", "pair", "revoke"],
      },
      {
        slug: "mobile",
        label: "Mobile",
        icon: Smartphone,
        status: "active",
        description: "Pair a phone and supervise scoped tasks.",
        keywords: ["mobile", "phone", "remote", "pair", "stop"],
      },
      {
        slug: "work",
        label: "Computer control",
        icon: Terminal,
        status: "active",
        description: "Let OCADE operate this computer with approvals.",
        keywords: ["work", "computer", "control", "desktop", "cowork"],
      },
      {
        slug: "browser",
        label: "Browser control",
        icon: Globe,
        status: "active",
        description: "Let OCADE read and act in an approved browser session.",
        keywords: ["browser", "web", "control", "extension"],
      },
    ],
  },
  {
    id: "plan",
    label: "Plan",
    items: [
      {
        slug: "usage",
        label: "Usage & plan",
        icon: Gauge,
        status: "active",
        description: "Current access and future paid-plan information.",
        keywords: ["usage", "plan", "limit", "subscription", "billing"],
      },
      {
        slug: "tasks",
        label: "Tasks",
        icon: ListChecks,
        status: "active",
        description: "Automations and the runs they produced.",
        keywords: ["task", "automation", "run", "schedule", "pause"],
      },
      {
        slug: "support",
        label: "Support",
        icon: LifeBuoy,
        status: "active",
        description: "Cases, replies and support history.",
        keywords: ["support", "help", "ticket", "case"],
      },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    advanced: true,
    items: [
      {
        slug: "local-engine",
        label: "Local Intelligence",
        icon: Cpu,
        status: "active",
        description: "Install and manage the on-device intelligence runtime.",
        keywords: ["local", "engine", "model", "runtime", "download"],
      },
      {
        slug: "offline",
        label: "Offline data",
        icon: Database,
        status: "active",
        description: "Technical details for content kept on this device.",
        keywords: ["offline", "storage", "cache", "download"],
      },
      {
        slug: "motion",
        label: "Motion diagnostics",
        icon: Wand2,
        status: "active",
        description: "Fine-grained motion and depth diagnostics.",
        keywords: ["motion", "animation", "3d", "depth", "reduced"],
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
        slug: "connectors",
        label: "Connected services",
        icon: Plug,
        status: "active",
        description: "Approved outside services OCADE may reach.",
        keywords: ["connector", "integration", "service"],
      },
      {
        slug: "images",
        label: "Images",
        icon: ImageIcon,
        status: "active",
        description: "How OCADE reads and produces images.",
        keywords: ["image", "vision", "picture", "generate"],
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
        description: "Runtime provenance, verification receipts and technical detail.",
        keywords: ["diagnostic", "debug", "receipt", "proof", "model", "runtime"],
      },
      {
        slug: "accessibility",
        label: "Accessibility",
        icon: Accessibility,
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
    const item = group.items.find((candidate) => candidate.slug === target);
    if (item) return { group, item };
  }
  return null;
}
