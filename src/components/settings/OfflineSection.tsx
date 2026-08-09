import { OfflineStoragePanel } from "./OfflineStoragePanel";
import { EngineImportPanel } from "./EngineImportPanel";

/**
 * Settings → Offline Storage.
 *
 * The two panels belong on one screen: this is where someone lands when
 * offline does not work, and the second panel is the answer for the device
 * that can never complete a download. Splitting them across sections would put
 * the diagnosis and its only remedy in different places.
 *
 * A named component rather than a fragment in the section map on purpose —
 * `settings-sections-reachable.test.ts` resolves each section to a real
 * component file, and that guard is worth keeping intact.
 */
export function OfflineSection() {
  return (
    <div className="flex flex-col gap-4">
      <OfflineStoragePanel />
      <EngineImportPanel />
    </div>
  );
}
