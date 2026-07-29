import fs from 'node:fs/promises';
import path from 'node:path';

async function verifyPhase36() {
  console.log("Verifying Stage 2 Phase 36 (Packaging and Release Prep)...");
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

  const tauriConfStr = await fs.readFile(
    path.join(process.cwd(), 'native/companion/tauri/tauri.conf.json'),
    'utf-8'
  );
  const tauriConf = JSON.parse(tauriConfStr);

  assert(tauriConf.bundle.createUpdaterArtifacts === false, "Tauri config updater artifacts are blocked until signed");
  assert(tauriConf.plugins.updater.active === false, "Tauri updater plugin remains inactive without real keys");
  assert(tauriConf.plugins.updater.endpoints.length > 0, "Tauri updater has an endpoint configured");

  try {
    const ciStat = await fs.stat(path.join(process.cwd(), '.github/workflows/ci.yml'));
    assert(ciStat.isFile(), "GitHub Actions CI workflow exists");
  } catch {
    assert(false, "GitHub Actions CI workflow exists");
  }

  try {
    const releaseStat = await fs.stat(path.join(process.cwd(), '.github/workflows/release.yml'));
    assert(releaseStat.isFile(), "GitHub Actions Release workflow exists");
  } catch {
    assert(false, "GitHub Actions Release workflow exists");
  }

  console.log(`\nResult: ${passed}/${total} assertions passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

verifyPhase36().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
