/**
 * Retired cloud-AI gateway compatibility surface.
 *
 * OCADE AI is local-only. No API key, provider SDK, public AI endpoint or
 * prompt-forwarding path is allowed here. These exports remain temporarily so
 * stale imports fail closed with an explicit error instead of accidentally
 * choosing another provider.
 */

function cloudRemoved(): never {
  throw new Error(
    "Cloud AI routing has been removed from OCADE. Start or download the on-device engine instead.",
  );
}

export function createLovableGateway(_apiKey?: string): never {
  return cloudRemoved();
}

export function createOpenAIDirectGateway(_apiKey?: string): never {
  return cloudRemoved();
}

export const OCADE_DEFAULT_MODEL = "ocade/local";
export const OCADE_MODEL_DISPLAY: Record<
  string,
  { display: string; provider: string; locality: "local"; vision: boolean }
> = {
  "ocade/local": {
    display: "OCADE Local",
    provider: "On-device engine",
    locality: "local",
    vision: false,
  },
};

export function describeModel(_id: string) {
  return OCADE_MODEL_DISPLAY[OCADE_DEFAULT_MODEL];
}
