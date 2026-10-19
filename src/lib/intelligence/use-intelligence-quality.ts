import { useState } from "react";
import type { IntelligenceQuality } from "./quality";

/** Selection is tab/account-local. JARVIS supplies a conversation scope and its saved task choice. */
export function useIntelligenceQuality(scope: string) {
  const [selected, setSelected] = useState<{ scope: string; quality: IntelligenceQuality }>({
    scope,
    quality: "standard",
  });
  const quality = selected.scope === scope ? selected.quality : "standard";
  return {
    quality,
    selectQuality: (next: IntelligenceQuality) => setSelected({ scope, quality: next }),
  };
}
