import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MODULE_CONTEXT } from "@/lib/shell-nav";

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
    /*
     * Asserted as the PROPERTY rather than as one sentence. The README used to
     * say "'Local-first' does not mean all data always remains on-device" next
     * to a "Cloud/private sync" row that also mentioned optional AI gateways.
     * The gateways are gone, so that row would now be describing something the
     * product does not have — but the caveat it carried is still true and must
     * still be present, because synchronised data does leave the device.
     */
    const readme = source("README.md");
    expect(readme).toMatch(/local-first/i);
    // The honest caveat survives, in whatever words it is currently written.
    expect(readme).toMatch(/does not mean .{0,60}(never leaves|remains on-device)/i);
    expect(readme).toMatch(/private sync/i);
    // And the claim that replaced the gateway row has to be the true one.
    expect(readme).toMatch(/generation .{0,40}on-device|runs on the user's own device/i);
    expect(readme).toMatch(/Browser Only data never leaves/i);
  });

  it("#16 keeps pricing visible but withdraws billing until checkout is configured", () => {
    expectAll("src/routes/pricing.tsx", [
      /createFileRoute\("\/pricing"\)/,
      /deploymentDetails=\{false\}/,
    ]);
    expect(source("src/routes/pricing.tsx")).not.toMatch(/beforeLoad/);
    expectAll("src/routes/_authenticated/settings.billing.tsx", [
      /!isCheckoutConfigured\(\)/,
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
    const workflow = expectAll(".github/workflows/release.yml", [
      /workflow_dispatch:/,
      /if: \$\{\{ false \}\}/,
    ]);
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

  it("keeps browser sampling deterministic enough for the recorded answer receipt", () => {
    /*
     * One authority supplies these to the adapters AND to the pin, so a
     * receipt cannot claim conditions the runtime never applied. A literal
     * reappearing in an adapter is the defect this guards.
     */
    expectAll("src/lib/brain/sampler-settings.ts", [/temperature: 0\.2/, /topP: 0\.9/]);
    for (const path of [
      "src/lib/brain/adapters/browser-webgpu.ts",
      "src/lib/brain/adapters/browser-wasm.ts",
    ]) {
      expectAll(path, [
        /temperature: BROWSER_SAMPLER\.temperature/,
        /top_p: BROWSER_SAMPLER\.topP/,
      ]);
      expect(source(path), path).not.toMatch(/temperature: 0\.\d/);
    }
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
    /*
     * §4 folded the Inbox into Tasks, so the requirement moved file: the same
     * runs, through the same adapter, with the same refusal to invent an
     * approval that no run is waiting on. It now reads the rows the Tasks
     * screen already fetched rather than fetching a second copy.
     */
    expectAll("src/components/ocade/tasks/NeedsAttentionSection.tsx", [
      /taskFromAutomationRun/,
      /WAITING_PERMISSION/,
      /Nothing is waiting for you right now/,
    ]);
    expectAll("src/components/ocade/TasksWorkspace.tsx", [
      /listAutomationRuns/,
      /NeedsAttentionSection/,
    ]);
  });

  it("#35 reads the activity ledger and keeps read failure non-mutating", () => {
    // §4: "activity into Settings." Settings › Activity is the fuller record.
    expectAll("src/routes/_authenticated/settings.activity.tsx", [
      /from\("activity_log"\)/,
      /compliance_audit_log/,
    ]);
  });

  it("#37 derives connector state from observed capability reports", () => {
    // §4: "connectors into Settings." The panel owns what a person can change.
    expectAll("src/components/settings/ConnectorsPanel.tsx", [
      /subscribeCompanionAdapter/,
      /Setup required/,
    ]);
  });

  it("#38 derives permissions from capability reports and dedicated controls", () => {
    // §4: "permissions into Settings." The statuses are in Diagnostics, from
    // the same registry; the rule and the policy editor are here.
    expectAll("src/components/settings/PermissionsPanel.tsx", [
      /Connection is not permission, and permission is not proof of execution/,
      /PermissionRules/,
    ]);
  });

  it("#39 centralizes health on the shared capability registry", () => {
    // §4: "health into Settings." Capability health sits beside the routing
    // receipt and the error journal, from the same shared registry.
    expectAll("src/components/settings/DiagnosticsSettingsPanel.tsx", [
      /useCapabilityReports/,
      /CAPABILITY_ORDER/,
      /worstStatus/,
      /Not available here/,
    ]);
  });

  it("#40 exposes advanced controls without a directory of the whole product", () => {
    /*
     * THIS ASSERTION USED TO REQUIRE THE "MORE" PAGE.
     *
     * It listed six routes that had to appear on `/ocade/customize`, which was
     * the System hub renamed. §4 then folded all six into Settings, and §17
     * asks outright to "remove old More" — so requiring the directory would be
     * requiring the thing the plan removed.
     *
     * What has to stay true is that the advanced controls are reachable and
     * that the Lab is one of them. Customize points at the settings sections
     * that own them; the Lab opens from Customize on request.
     */
    expectAll("src/routes/_authenticated/ocade.customize.tsx", [
      /to: "\/settings\/appearance"/,
      /section: "chat"/,
      /to: "\/settings\/skills"/,
      /EngineeringLab/,
      /lazy\(/,
    ]);
    expectAll("src/components/shell/command-entries.ts", [/to: "\/settings"/]);
  });

  it("#42 provides explicit five-destination mobile navigation", () => {
    /*
     * Devices left the phone rail and Search took its place. Pairing a computer
     * is something a person does once, from the machine being paired; searching
     * their own work is something they do from wherever they are standing.
     * Devices is still one tap away under More.
     */
    expectAll("src/components/shell/OcadeMobileBottomNav.tsx", [
      /label: "Chat"/,
      /label: "Projects"/,
      /label: "Search"/,
      /label: "Tasks"/,
      /label: "More"/,
      /md:hidden/,
    ]);
  });

  it("#43 keeps the primary OCADE sidebar compressed around core work", () => {
    /*
     * "Compressed" got a number. The rail held twelve destinations, which is a
     * sitemap rather than a place to work; it holds seven, ending in the door
     * to everything else.
     *
     * WHICH seven changed with PLAN.md §4. The three primary modes it names —
     * Chat, Cowork, Code — now lead, and two of them were absent: Cowork was
     * here under an old name and Code was only in More, so a person who never
     * opened More never learned that OCADE writes code. Search left the rail
     * because §4 makes it a global overlay, which Cmd/Ctrl+K already opens
     * from every screen.
     */
    const nav = expectAll("src/lib/shell-nav.ts", [
      /label: "Chat"/,
      /label: "Cowork"/,
      /label: "Code"/,
      /label: "Projects"/,
      /label: "Tasks"/,
      /label: "Artifacts"/,
      /to: "\/ocade\/customize", label: "Customize"/,
    ]);
    expect(nav.match(/to: "\/ocade\/customize", label: "Customize"/g) ?? []).toHaveLength(1);
    expect(MODULE_CONTEXT.ocade).toHaveLength(7);
  });

  it("#44 keeps creative work and engineering diagnostics apart", () => {
    /*
     * The separation survived §4's consolidation; the two surfaces did not.
     * Studio became a section of Artifacts, and the Lab became a section of
     * Customize that loads when it is opened. The requirement is unchanged:
     * a person making something must not be handed twelve diagnostic panels,
     * and a person debugging must not have to scroll past a render control.
     */
    const creative = expectAll("src/components/ocade/artifacts/WhatOcadeCanProduce.tsx", [
      /CreativeControlPanel/,
    ]);
    const lab = expectAll("src/components/ocade/customize/EngineeringLab.tsx", [
      /ResearchPanel/,
      /GovernedRunPanel/,
      /DiagnosticsPanel/,
      /EngineeringControlPanel/,
    ]);
    expect(creative).not.toMatch(/ResearchPanel/);
    expect(lab).not.toMatch(/CreativeControlPanel/);
  });

  it("#47 exposes templates as reusable prompts, not fake workflows", () => {
    // §4: "templates into Artifacts." Same four, same refusal to dress a
    // starting prompt up as a workflow.
    expectAll("src/components/ocade/artifacts/TemplatesSection.tsx", [
      /Research brief/,
      /Work plan/,
      /Build \/ debug/,
      /Decision memo/,
      /Nothing here runs on its own/,
    ]);
  });

  it("#70 distinguishes saved monitor definitions from execution", () => {
    // §4: "monitors into Tasks." The distinction is the point of the screen.
    expectAll("src/components/ocade/tasks/MonitorsSection.tsx", [
      /No background polling starts until a monitor runner is connected/,
      /configuration only/i,
      /no checks are executing/i,
    ]);
  });

  it("#76 retains CI ownership for type, DB, platform, performance and accessibility gates", () => {
    const ci = source(".github/workflows/ci.yml");
    const parity = source("scripts/verify-full.mjs");
    expect(ci).toMatch(/verify:full/i);
    expect(parity).toMatch(/typecheck/i);
    expect(parity).toMatch(/supabase:types-check/i);
    expect(parity).toMatch(/performance/i);
    expect(parity).toMatch(/a11y/i);
    expect(source(".github/workflows/platforms.yml")).toMatch(/windows|macos|ubuntu/i);
  });
});
