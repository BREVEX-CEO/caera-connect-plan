/**
 * The error every companion-gated surface throws when the companion is absent.
 *
 * NO SILENT FALLBACK. A control that needs the Native Companion and quietly
 * does something else instead is worse than one that refuses: the person
 * believes the machine did what they asked. This carries the reason so each
 * surface can say which capability is missing rather than repeating one
 * sentence about storage that stopped being true.
 *
 * IT MOVED OUT OF `lib/storage/types.ts`. That file described a storage
 * adapter contract with three modes, and `PLAN.md` Phase 2 left one authority
 * and no adapters. The error outlived it because the companion is a real,
 * separate boundary — computer control and local engines still need it.
 */
export class NativeCompanionRequiredError extends Error {
  constructor(message?: string) {
    super(message ?? "This needs the OCADE Native Companion, which is not running.");
    this.name = "NativeCompanionRequiredError";
  }
}
