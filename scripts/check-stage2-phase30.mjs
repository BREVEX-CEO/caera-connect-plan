import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const ledger = json("release/OCADE_STAGE_2_PHASE_30.json");
const workflow = read("src/lib/creative/creative-workflow.ts");
const tests = read("src/lib/__tests__/creative-workflow.test.ts");
const panel = read("src/components/ocade/CreativeControlPanel.tsx");
// PLAN.md §4 folded Studio into Artifacts; the creative control panel went
// with it, so the surface this gate inspects is the section rather than the
// page that used to hold it.
const studio = read("src/components/ocade/artifacts/WhatOcadeCanProduce.tsx");
const packs = read("src/lib/skills/pack-registry.ts");
const media = read("src/lib/media/inspect.ts");
const gltf = read("src/lib/vision3d/gltf.ts");
const resources = read("src/lib/skills/resource-governor.ts");
const failures = [];
let checks = 0;

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function json(path) {
  return JSON.parse(read(path));
}

function check(condition, label) {
  checks += 1;
  if (!condition) failures.push(label);
}

function includesAll(source, values, label) {
  for (const value of values) check(source.includes(value), `${label}: ${value}`);
}

check(ledger.schemaVersion === 1 && ledger.phase === 30, "ledger schema/phase");
check(ledger.classification === "VERIFIED COMPLETE", "source completion");
check(
  ledger.runtimeClassification === "SOURCE-COMPLETE BUT RUNTIME-BLOCKED",
  "runtime classification",
);
check(ledger.sourceScore === 96, "source score");
check(ledger.controlledWorkflowRuntimeScore === 94, "controlled runtime score");
check(ledger.liveCreativeApplicationScore === 0, "live creative application zero");
check(ledger.liveGpuRenderScore === 0, "live GPU render zero");
check(ledger.stage2Readiness.source === 68, "Stage 2 source");
check(ledger.stage2Readiness.sourceRemaining === 32, "Stage 2 source remaining");
check(ledger.stage2Readiness.production === 30, "production");
check(ledger.implementationPhasesRemaining === 9, "remaining phases");
check(ledger.externalValidationTracksRemaining === 8, "external tracks");
check(ledger.nextDependency.phase === 31, "next dependency");
check(
  Object.values(ledger.runtimeClaims).every((claim) => claim === false),
  "runtime claims",
);
check(ledger.verifiedSourceCapabilities.length >= 28, "source evidence");
check(ledger.controlledEvidence.length >= 16, "controlled evidence");
check(ledger.runtimeBlockers.length >= 6, "runtime blockers");

includesAll(
  workflow,
  [
    "BLENDER_ROUTE_ORDER",
    '"python_api"',
    '"cli"',
    '"plugin"',
    '"project_file"',
    '"accessibility"',
    '"vision_input"',
    "signatureVerified",
    "renderEngines",
    "validateCreativePlan",
    "selectCreativeRoute",
    "explicit bpy import",
    "Approved script SHA-256",
    "governResources",
    "checkpoint",
    "verifyCheckpoint",
    "isolated",
    "networkDenied",
    "readScopeEnforced",
    "writeScopeEnforced",
    "processTreeTerminated",
    "inspectProject",
    "missingGeometry",
    "invalidModifiers",
    "logErrors",
    "inspectMedia",
    "validateGltf",
    "changed before verification",
    "recover",
    "Restored project SHA-256 matched",
    "completed_verified",
    "CREATIVE_RUNTIME_BOUNDARY",
  ],
  "creative workflow",
);

includesAll(
  tests,
  [
    "creative plan admission and Blender routing",
    "checkpointed creative execution",
    "uses the exact API to CLI to plugin preference",
    "requires signed installed application identity and explicit bpy source",
    "verifies a complete deterministic scene, render and glTF export",
    "resource governor defers the job",
    "checkpoint bytes cannot be independently verified",
    "process isolation, exit or output acknowledgements are incomplete",
    "scene structure or application logs fail inspection",
    "render bytes change or an export is not conforming glTF",
    "host exceptions after checkpoint creation",
    "cancels before probing",
    "REAL_PNG",
    "exportGltf",
  ],
  "deterministic fixtures",
);

includesAll(
  panel,
  [
    "Creative application control",
    "Adapter required",
    "Blender route order",
    "Required evidence",
    "CREATIVE_RUNTIME_BOUNDARY",
  ],
  "honest Studio panel",
);
check(studio.includes("CreativeControlPanel"), "creative control reachable from Artifacts");
includesAll(
  packs,
  [
    "CREATIVE_CONTROL_PACK",
    "ocade.creative.control",
    "creative.checkpoint",
    "creative.script",
    "creative.render",
    "creative.export",
    "cannot claim to drive an installed Blender",
  ],
  "skill pack integration",
);
includesAll(media, ["inspectMedia", "extensionMatches"], "media validation dependency");
includesAll(gltf, ["validateGltf", "serialiseGltf"], "glTF validation dependency");
includesAll(resources, ["governResources", "checkpoint_first"], "resource admission dependency");

if (failures.length > 0) {
  console.error(`OCADE Stage 2 Phase 30 gate failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OCADE Stage 2 Phase 30 gate: ${checks}/${checks} checks passed`);
console.log(
  "PHASE 30: SOURCE 96% | CONTROLLED WORKFLOW RUNTIME 94% | LIVE CREATIVE APP 0% | LIVE GPU RENDER 0%",
);
console.log("STAGE 2: SOURCE 68% | WINDOWS 2% | BROWSER 0% | PRODUCTION 30% | VERIFIED APPS 0%");
console.log("NEXT INCOMPLETE DEPENDENCY: PHASE 31 CAD AND ENGINEERING APPLICATION CONTROL");
