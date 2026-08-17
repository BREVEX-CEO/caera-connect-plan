import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function expectAll(path: string, patterns: RegExp[]) {
  const text = source(path);
  for (const pattern of patterns) expect(text, `${path} should match ${pattern}`).toMatch(pattern);
  return text;
}

describe("OCADE 77 — proof for formerly source-inspected boundaries", () => {
  it("#9 documents local-first without claiming all data stays on-device", () => {
    const readme = source("README.md");
    expect(readme).toMatch(/local-first/i);
    expect(readme).toMatch(/does not mean all data always remains on-device/i);
    expect(readme).toMatch(/cloud\/private sync/i);
  });

  it("#16 withdraws pricing and billing during free launch", () => {
    expectAll("src/routes/pricing.tsx", [/FREE_LAUNCH_MODE/, /redirect\(\{ to: "\/" \}\)/]);
    expectAll("src/routes/_authenticated/settings.billing.tsx", [
      /FREE_LAUNCH_MODE/,
      /redirect\(\{ to: "\/settings\/usage" \}\)/,
    ]);
  });

  it("#17 preserves signed historical payment webhook handling", () => {
    expectAll("src/routes/api/public/payments/webhook.ts", [
      /verifyWebhook/,
      /from\("subscriptions"\)/,
      /Invalid payment environment/,
    ]);
    expectAll("src/lib/paddle.server.ts", [/timingSafeEqual/, /createHmac/, /replay window/i]);
  });

  it("#19 prevents desktop release publishing", () => {
    const workflow = expectAll(".github/workflows/release.yml", [/workflow_dispatch:/, /if: \$\{\{ false \}\}/]);
    expect(workflow).not.toMatch(/tauri-apps\/tauri-action/);
    expect(workflow).not.toMatch(/push:\s*\n\s*tags:/);
  });

  it("#22 bounds transcript rendering and exposes earlier history deliberately", () => {
    expectAll("src/components/ocade/chat/MessageList.tsx", [
      /messages\.length - limit/,
      /messages\.slice\(hidden\)/,
      /Show earlier messages/,
      /WINDOW_STEP/,
    ]);
  });

  it("#31 searches real OCADE tables without raw .or grammar", () => {
    const search = expectAll("src/routes/_authenticated/ocade.search.tsx", [
      /from\("ocade_conversations"\)/,
      /from\("ocade_messages"\)/,
      /from\("ocade_projects"\)/,
      /from\("ocade_outputs"\)/,
      /\.ilike\(/,
    ]);
    expect(search).not.toMatch(/\n\s*\.or\(/);
  });

  it("#34 derives Inbox from automation runs through the unified adapter", () => {
    expectAll("src/routes/_authenticated/ocade.inbox.tsx", [
      /listAutomationRuns/,
      /taskFromAutomationRun/,
      /WAITING_PERMISSION/,
      /does not invent notifications/i,
    ]);
  });

  it("#35 reads the activity ledger and keeps read failure non-mutating", () => {
    expectAll("src/routes/_authenticated/ocade.activity.tsx", [
      /from\("activity_log"\)/,
      /TruthfulFailurePanel/,
      /read-only request/i,
      /did not create, delete, rewrite or acknowledge any activity record/i,
    ]);
  });

  it("#37 derives connector state from observed capability reports", () => {
    expectAll("src/routes/_authenticated/ocade.connectors.tsx", [
      /useCapabilityReports/,
      /not shown as connected until a real connector implementation and account grant exist/i,
      /No first-class Gmail, Google Drive, Slack, Notion/i,
    ]);
  });

  it("#38 derives permissions from capability reports and dedicated controls", () => {
    expectAll("src/routes/_authenticated/ocade.permissions.tsx", [
      /useCapabilityReports/,
      /Connection is not permission, and permission is not proof of execution/,
      /Review controls/,
    ]);
  });

  it("#39 centralizes health on the shared capability registry", () => {
    expectAll("src/routes/_authenticated/ocade.health.tsx", [
      /useCapabilityReports/,
      /CAPABILITY_ORDER/,
      /worstStatus/,
      /has not been verified says so rather than guessing/i,
    ]);
  });

  it("#40 exposes advanced controls through the System hub", () => {
    expectAll("src/routes/_authenticated/ocade.system.tsx", [
      /to: "\/ocade\/models"/,
      /to: "\/ocade\/devices"/,
      /to: "\/ocade\/connectors"/,
      /to: "\/ocade\/permissions"/,
      /to: "\/ocade\/health"/,
      /to: "\/ocade\/lab"/,
    ]);
  });

  it("#42 provides explicit five-destination mobile navigation", () => {
    expectAll("src/components/shell/OcadeMobileBottomNav.tsx", [
      /label: "Chat"/,
      /label: "Projects"/,
      /label: "Tasks"/,
      /label: "Devices"/,
      /label: "More"/,
      /md:hidden/,
    ]);
  });

  it("#43 keeps the primary OCADE sidebar compressed around core work", () => {
    const nav = expectAll("src/lib/shell-nav.ts", [
      /label: "Chat"/,
      /label: "Projects"/,
      /label: "Control \+ Work"/,
      /label: "Code"/,
      /to: "\/ocade\/system", label: "System"/,
    ]);
    expect(nav.match(/to: "\/ocade\/system", label: "System"/g) ?? []).toHaveLength(1);
  });

  it("#44 separates user-facing Studio from engineering/research Lab", () => {
    const studio = expectAll("src/routes/_authenticated/ocade.studio.tsx", [/CreativeControlPanel/, /Open Lab/]);
    const lab = expectAll("src/routes/_authenticated/ocade.lab.tsx", [
      /ResearchPanel/,
      /GovernedRunPanel/,
      /DiagnosticsPanel/,
      /EngineeringControlPanel/,
    ]);
    expect(studio).not.toMatch(/ResearchPanel/);
    expect(lab).not.toMatch(/CreativeControlPanel/);
  });

  it("#47 exposes templates as reusable prompts, not fake workflows", () => {
    expectAll("src/routes/_authenticated/ocade.templates.tsx", [
      /Research brief/,
      /Work plan/,
      /Build \/ debug/,
      /Decision memo/,
      /no template is presented as an autonomous workflow/i,
    ]);
  });

  it("#70 distinguishes saved monitor definitions from execution", () => {
    expectAll("src/routes/_authenticated/ocade.monitors.tsx", [
      /No background polling starts until a monitor runner is connected/,
      /configuration only/i,
      /no checks are executing/i,
    ]);
  });

  it("#76 retains CI ownership for type, DB, platform, performance and accessibility gates", () => {
    const ci = source(".github/workflows/ci.yml");
    expect(ci).toMatch(/typecheck/i);
    expect(ci).toMatch(/migration/i);
    expect(ci).toMatch(/RLS|row.level|database/i);
    expect(ci).toMatch(/performance/i);
    expect(ci).toMatch(/accessibility|a11y/i);
    expect(source(".github/workflows/platforms.yml")).toMatch(/windows|macos|ubuntu/i);
  });
});
