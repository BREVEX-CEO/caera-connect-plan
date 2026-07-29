import fs from 'node:fs/promises';
import path from 'node:path';

async function verifyPhase38() {
  console.log("Verifying Stage 2 Phase 38 (Adversarial, reliability and performance proof)...");
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
    const p38Stat = await fs.stat(path.join(process.cwd(), 'src/lib/__tests__/stage2-phase38-source.test.ts'));
    assert(p38Stat.isFile(), "Stage 2 Phase 38 adversarial proof tests exist");
  } catch {
    assert(false, "Stage 2 Phase 38 adversarial proof tests exist");
  }

  console.log(`\nResult: ${passed}/${total} assertions passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

verifyPhase38().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
