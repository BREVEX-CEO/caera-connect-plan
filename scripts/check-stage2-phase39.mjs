import fs from 'node:fs/promises';
import path from 'node:path';

async function verifyPhase39() {
  console.log("Verifying Stage 2 Phase 39 (Final universal-control audit)...");
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
    const p39Stat = await fs.stat(path.join(process.cwd(), 'src/lib/__tests__/stage2-phase39-source.test.ts'));
    assert(p39Stat.isFile(), "Stage 2 Phase 39 final audit tests exist");
  } catch {
    assert(false, "Stage 2 Phase 39 final audit tests exist");
  }

  console.log(`\nResult: ${passed}/${total} assertions passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

verifyPhase39().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
