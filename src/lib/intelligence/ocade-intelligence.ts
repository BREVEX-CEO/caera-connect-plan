/**
 * THE ONE ASSEMBLY POINT. Everything that generates goes through this object.
 *
 * The router decides between the two backends; the transports carry the
 * request; neither knows about the other. What matters is that there is
 * exactly ONE construction of it in the whole application — a second would be
 * a second answer to "may this run online?", and the first thing to disagree
 * would be the thing nobody was watching.
 *
 * Built lazily and then kept, because building it probes nothing: the
 * transports are cheap objects and the first probe happens when something
 * actually asks.
 */
import { createOcadeIntelligence } from "./router";
import { createOnlineIntelligenceTransport } from "./online-client";
import { createOfflineIntelligenceTransport } from "./offline-transport";
import type { OcadeIntelligence } from "./contract";

let instance: OcadeIntelligence | null = null;

export function ocadeIntelligence(): OcadeIntelligence {
  instance ??= createOcadeIntelligence({
    online: createOnlineIntelligenceTransport(),
    local: createOfflineIntelligenceTransport(),
  });
  return instance;
}

/** For tests, and for a deliberate teardown in a diagnostic surface. */
export function resetOcadeIntelligenceForTests(): void {
  instance = null;
}
