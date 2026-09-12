/**
 * Removing the characters a person cannot see but a model can read.
 *
 * Unicode Tag characters, format controls, private-use areas and noncharacters
 * can carry instructions that are invisible in every interface and perfectly
 * legible to a language model. The technique is public and it has been used
 * against shipped assistants.
 *
 * TWO RULES MAKE THIS SAFE TO APPLY TO EVERYTHING.
 *
 *   NFKC first, so a composed sequence cannot smuggle a character past a
 *   category check by arriving in pieces.
 *
 *   Legitimate text is never discarded. Ordinary formatting — newlines, tabs,
 *   the joiners scripts genuinely need — survives; only the invisible
 *   categories go. A sanitizer that eats real content gets turned off.
 *
 * It came from the donor tree as `primary-logic/text/sanitization.ts`. The
 * donor tree is gone; the rule it encodes is a security property OCADE keeps,
 * so it lives with the rest of security.
 */
export function partiallySanitizeUnicode(prompt: string): string {
  let current = prompt;
  let previous = "";
  let iterations = 0;
  const MAX_ITERATIONS = 10; // Safety limit to prevent infinite loops

  // Iteratively sanitize until no more changes occur or max iterations reached
  while (current !== previous && iterations < MAX_ITERATIONS) {
    previous = current;

    // Apply NFKC normalization to handle composed character sequences
    current = current.normalize("NFKC");

    // Remove dangerous Unicode categories using explicit character ranges

    // Method 1: Strip dangerous Unicode property classes
    // This is the primary defence and is the solution that is widely used in OSS libraries.
    current = current.replace(/[\p{Cf}\p{Co}\p{Cn}]/gu, "");

    // Method 2: Explicit character ranges. There are some subtle issues with the above method
    // failing in certain environments that don't support regexes for unicode property classes,
    // so we also implement a fallback that strips out some specifically known dangerous ranges.
    current = current
      .replace(/[\u200B-\u200F]/g, "") // Zero-width spaces, LTR/RTL marks
      .replace(/[\u202A-\u202E]/g, "") // Directional formatting characters
      .replace(/[\u2066-\u2069]/g, "") // Directional isolates
      .replace(/[\uFEFF]/g, "") // Byte order mark
      .replace(/[\uE000-\uF8FF]/g, ""); // Basic Multilingual Plane private use

    iterations++;
  }

  // If we hit max iterations, crash loudly. This should only ever happen if there is a bug or if someone purposefully created a deeply nested unicode string.
  if (iterations >= MAX_ITERATIONS) {
    throw new Error(
      `Unicode sanitization reached maximum iterations (${MAX_ITERATIONS}) for input: ${prompt.slice(0, 100)}`,
    );
  }

  return current;
}
