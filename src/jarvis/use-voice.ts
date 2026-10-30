/*
 * JARVIS'S OWN VOICE: natural and female-presenting where the device has one (owner, 21 Oct).
 * Browsers do not say a voice's gender, so it is told by the device voices' published names
 * (Windows, macOS/iOS, Android/Chrome); a natural/online voice of the page's language comes
 * first. A device with none of them uses its own default. The person's choice always wins.
 */
const FEMALE_VOICE =
  /female|\b(aria|jenny|sonia|libby|natasha|clara|emma|ava|michelle|samantha|karen|moira|tessa|fiona|victoria|allison|susan|serena|zira|hazel|catherine|heera|neerja|swara)\b/i;
const NATURAL_VOICE = /natural|online|neural|enhanced|premium/i;

export function pickVoice(
  voices: readonly SpeechSynthesisVoice[],
  chosen: string | null,
  lang: string,
): SpeechSynthesisVoice | null {
  const own = chosen ? voices.find((voice) => voice.voiceURI === chosen) : undefined;
  if (own) return own;
  const language = lang.toLowerCase().split("-")[0]!;
  const score = (voice: SpeechSynthesisVoice) =>
    (voice.lang.toLowerCase().startsWith(language) ? 4 : 0) +
    (FEMALE_VOICE.test(voice.name) ? 2 : 0) +
    (NATURAL_VOICE.test(voice.name) ? 1 : 0);
  const best = [...voices].sort((a, b) => score(b) - score(a))[0];
  return best && FEMALE_VOICE.test(best.name) ? best : null;
}
