/**
 * WHAT A FILE IS, DECIDED BY ITS OWN FIRST BYTES.
 *
 * A declared media type is a guess the operating system made from an extension,
 * and anybody can rename anything. Two places need to disbelieve it — the
 * composer, before sending a picture to a vision model, and the Library, before
 * storing bytes under a content type a browser will later act on — and they had
 * one copy between them, in the composer, which the server could not reach.
 *
 * So the four signatures live here, once. These are the image formats OCADE
 * accepts; anything else is a file, whatever it says it is.
 */

/** The media type these bytes actually are, or null if they are not an image. */
export function imageMediaType(head: Uint8Array): string | null {
  const starts = (...bytes: number[]) => bytes.every((byte, at) => head[at] === byte);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  // WEBP is "RIFF" ....  "WEBP".
  if (
    starts(0x52, 0x49, 0x46, 0x46) &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Whether a string is shaped like a media type at all.
 *
 * Not an allow-list: the value is recorded for a person to read and never acted
 * on. What this refuses is the free-form string a caller could otherwise put in
 * a column that says "media type".
 */
export function isMediaType(value: string): boolean {
  return /^[a-z0-9][a-z0-9!#$&^_.+-]{0,100}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,100}$/i.test(value);
}
