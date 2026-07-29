import fs from 'node:fs/promises';
import path from 'node:path';

async function verifyPhase37() {
  console.log("Verifying Stage 2 Phase 37 (Universal Application Coverage Run)...");
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`\x1b[32m[PASS]\x1b[0m ${message}`);
      passed++;
    } else {
      console.error(`\x1b[31m[FAIL]\x1b[0m ${message}`);
    }
  }

  try {
    const registryStat = await fs.stat(path.join(process.cwd(), 'src/lib/providers/app-coverage-registry.ts'));
    assert(registryStat.isFile(), "App coverage registry source exists");
  } catch {
    assert(false, "App coverage registry source exists");
  }

  try {
    const testStat = await fs.stat(path.join(process.cwd(), 'src/lib/__tests__/app-coverage.test.ts'));
    assert(testStat.isFile(), "App coverage unit tests exist");
  } catch {
    assert(false, "App coverage unit tests exist");
  }

  try {
    const p37Stat = await fs.stat(path.join(process.cwd(), 'src/lib/__tests__/stage2-phase37-source.test.ts'));
    assert(p37Stat.isFile(), "Stage 2 Phase 37 integration test exists");
  } catch {
    assert(false, "Stage 2 Phase 37 integration test exists");
  }

  // The existence checks above once certified a fabrication. `runCoverageScan`
  // hardcoded Blender as detected at version 4.0.2 with FULL coverage and the
  // invented evidence "Found executable", on a machine with no Blender
  // installed, and this gate passed because the file was present. File
  // existence is not honesty, so the content is now checked as well.
  const registrySrc = await fs.readFile(
    path.join(process.cwd(), 'src/lib/providers/app-coverage-registry.ts'),
    'utf-8'
  );

  // Comments are stripped before the fabrication checks. The module documents
  // what it used to invent, and the file's own explanation of the defect must
  // not be mistaken for the defect — the risk lives in executable code.
  const registryCode = registrySrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  assert(
    !/'4\.0\.2'|"4\.0\.2"|'123\.0'|"123\.0"/.test(registryCode),
    "Coverage registry hardcodes no application version"
  );
  assert(
    !/Found executable|Verified python API script/.test(registryCode),
    "Coverage registry invents no evidence string"
  );
  assert(
    /prober\?: AppProber/.test(registrySrc),
    "Detection requires an injected prober rather than being assumed"
  );
  assert(
    /coverageLevel: "BLOCKED"/.test(registrySrc),
    "An undeterminable application is BLOCKED (unknown), never UNSUPPORTED (absent)"
  );
  assert(
    /claimed detection but supplied no evidence/.test(registrySrc),
    "Detection unsupported by evidence is refused"
  );

  console.log(`\nResult: ${passed}/${total} assertions passed.`);
  console.log("STATUS: COVERAGE SOURCE IS HONEST. NO APPLICATION WAS PROBED HERE.");
  if (passed !== total) {
    process.exit(1);
  }
}

verifyPhase37().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
