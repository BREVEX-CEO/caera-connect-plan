# The three design references, line by line

OCADE's visual language comes from three specification documents and from
nothing else. This file records what each one asks for, what the product does
with it, and — where the answer is "nothing" — the reason, with the evidence.

It exists because "we read the design files" is not a claim anybody can check.
A list of decisions is.

| Reference                                         | Names OCADE?                                                               | Role here                                                                                                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OPERATIONAL AI INFRASTRUCTURE GUI.txt`           | **Yes** — "Recreate this exact single-viewport landing page for **OCADE**" | The governing document. Typography, tokens, motion and button language come from this one.                                                                                 |
| `ECHOID.txt`                                      | No — a different brand ("Your voice ID to the E network")                  | Structural donor for the signed-out shell: gutters, the one-column-pinned-to-an-edge composition, the mono eyebrow over a light display weight, the hairline legal footer. |
| `Terranova — Signals from the Deep Green GUI.txt` | No — a third brand                                                         | Technique donor: the SVG refraction filter, the chamfered outline button, the staggered slide-in menu.                                                                     |

Where two references disagree, the one that names OCADE wins. That single rule
decides most of what follows.

---

## What could not be used, and why

### Every video and poster named by all three files

Four URLs, one host:

```
https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/…
  hf_20260806_133255_956f653f-5d80-4b06-abd5-0f46c98b60fa.mp4   (ECHOID hero)
  hf_20260806_132328_5f9029c8-218f-4489-82b6-29ff2849920e.png   (ECHOID poster)
  hf_20260818_072341_50851634-bbc3-4c33-9acc-7647d4db44aa.mp4   (OCADE hero)
  hf_20260816_125506_3a597378-ec85-4ebd-bd22-03b45508ac62.mp4   (Terranova hero)
```

None of them resolve. `scripts/probe-design-assets.sh` fetches the first 64
bytes of each and prints the status code; all four return `000` — no response
at all, not a 403 or a 404. The same probe returns `200` for Google Fonts from
the same machine on the same run, so this is those hosts, not the network.

That leaves three options and rules out all three:

- **Host the files ourselves.** Requires downloading them first. See above.
- **Point at the URLs and let the browser fetch them.** They do not answer, so
  every visitor waits on a request that ends in nothing. It would also be a
  third-party request from a page whose Content-Security-Policy does not allow
  that host — the identical mistake this codebase already made once, with a CDN
  script that was refused by our own CSP on every page for every visitor while
  the fallback quietly did the work. A `<video>` that always fails is that
  again, with a poster frame that also fails.
- **Substitute a different video.** The references are exact about which asset;
  a different one is not the design, and inventing a CloudFront URL is
  something the OCADE file explicitly forbids: _"Do not invent a CloudFront
  URL."_

**What the product does instead.** The OCADE reference is the one that matters
here, and it is also the one that says: _"Do not add a video, WebGL, Three.js,
or Lottie."_ Its hero is a still photograph with a scrim. OCADE's landing hero
is a rendered scene rather than a photograph — that predates these files and is
the product's own identity — but the principle it shares is the one the file
states: the background is **one** element, unlayered, and nothing floats over
it. The signed-out shell carries no background media at all, for the reason
written into `AuthShell.tsx`: it is the first screen a person sees, on a
connection that may be the reason they are signing in from a train.

### Helvetica Neue Light (Terranova)

`https://db.onlinewebfonts.com/c/0e6de1ec911a2e267ff136bbdd384a44` — also `000`
on the same probe. It is in any case a licensing question we would have to
answer separately, and Terranova is a technique donor, not a typographic one.

### Sora (ECHOID)

Reachable — Google Fonts answers `200` — and deliberately not taken. ECHOID
uses Sora 200 for its display type; the OCADE reference uses Inter 500 with an
Instrument Serif italic accent. Two sans families in one product is not a
design, and the file that names OCADE decides. What ECHOID's display type
contributes is its _weight and scale_, which the auth heading uses: extralight,
`clamp(2rem, 4.2vw, 3.25rem)`, `line-height: 1.05`.

---

## What was taken

### Typography — from the OCADE reference, plus ECHOID's mono

| Face                        | Role                                                 | Source          | Size  |
| --------------------------- | ---------------------------------------------------- | --------------- | ----- |
| Inter 300–700               | Everything: UI, headings, body                       | OCADE reference | 48 KB |
| Instrument Serif italic 400 | One emphasised phrase per heading, in the muted grey | OCADE reference | 22 KB |
| Instrument Serif roman 400  | Serif stack fallback                                 | —               | 21 KB |
| JetBrains Mono 300–600      | Code, command output, hashes, ids                    | ECHOID          | 40 KB |

All four are self-hosted latin subsets, 131 KB total. Not because it is
cheaper — because a font fetched from a third party is a font an offline user
does not get, our CSP allows no third-party font host, and a font request is a
record of a visitor held by somebody else on every page including the legal
ones. `src/lib/__tests__/typography-assets.test.ts` holds the whole set to that
budget and to being actually used.

The reference is unusually precise about the serif: _"**Only** the H1 words
`AI agents`"_, at `1.08em`, `letter-spacing: -0.03em`, and in `#9a9a9a` rather
than white. That is the `ocade-accent` utility, and it is the only place a
serif appears in the product.

### Tokens

- `--ease-premium: cubic-bezier(0.16, 1, 0.3, 1)` — named by all three files
  and now the product's single entrance curve.
- The reference palettes are pure `#000000`/`#ffffff` with translucent white
  rules. OCADE's own palette (black, silver, aubergine, gold, in oklch) is
  older than these files and stays; what carried over is the _structure_ — a
  hairline border token, a muted text token, a ghost fill and a solid fill,
  rather than per-component colours.

### Composition — ECHOID

The signed-out shell is ECHOID's structure with OCADE's content:

| ECHOID                                                    | `AuthShell.tsx`                                    |
| --------------------------------------------------------- | -------------------------------------------------- |
| `grid-template-rows: auto 1fr auto` — navbar, body, legal | same                                               |
| `--gutter: clamp(20px, 5vw, 100px)`                       | `clamp(1.25rem, 5vw, 4.5rem)`                      |
| Body right-aligned on desktop, full-width on phone        | `lg:justify-end`, full width below                 |
| Mono chip above a large light display word                | mono `OCADE` eyebrow above an extralight heading   |
| Legal footer on a hairline, safe-area padded              | same, `pb-[max(1rem,env(safe-area-inset-bottom))]` |
| Sharp rectangles, no pills, no glow, no cards             | no card — the negative space is the container      |
| Focus-visible outline on every interactive element        | `focus-visible:ring-2 focus-visible:ring-ring`     |

Its copy, its brand, its links and its media are not used. It is a sign-in page
for a different product.

### Motion

The OCADE reference's most valuable instruction is not a keyframe, it is a
failure mode: _"`.appear` resting opacity is **1** (so the page is never blank
if animations fail)"_, with a `requestAnimationFrame` fallback that marks
everything visible if no animation is actually running.

This codebase reached the same rule independently and it is written into
`styles.css`: `.ocade-reveal` on its own only describes a transition; content
is hidden **only** by a class JavaScript adds after an IntersectionObserver has
accepted the element. If the script never runs, the page is unanimated rather
than blank. Starting at `opacity: 0` in a stylesheet holds content hostage to a
script, and every reference that ships an entrance animation gets this wrong
except this one.

`prefers-reduced-motion: reduce` is honoured across all three references and
here.

---

## Still open

- **Terranova's refraction filter.** Pure SVG — `feTurbulence`, an inverted
  blurred alpha as an edge mask, three `feDisplacementMap` passes at 65/56/47
  recombined per channel for chromatic fringing. It needs no external asset and
  would work over OCADE's own scene. It is not wired up: the technique
  duplicates the backdrop into a canvas every frame, and the backdrop here is a
  WebGL canvas rather than a `<video>`, which needs `preserveDrawingBuffer` and
  a per-frame `drawImage` off the GPU. That is a real cost on the exact devices
  that already fall back, and it has not been measured yet.
- **Terranova's chamfered button and staggered slide-in menu.** Both
  applicable, neither has a surface asking for them yet.

## Re-running the evidence

```
scripts/probe-design-assets.sh
```

Prints one line per referenced host: status code, then URL. `000` means no
response.
