import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

/**
 * The black / silver / gold palette, checked as colour rather than as text.
 *
 * This does NOT search the stylesheet for the word "gold". It parses every
 * oklch token, converts it to sRGB the way a browser does, and computes real
 * WCAG contrast ratios — so a token nudged two steps darker fails here instead
 * of failing on somebody's screen. The figures it produces were confirmed
 * against the running application: the browser reported 17.11:1 for text on
 * background in the dark theme, and this file computes the same number from
 * the same declarations.
 *
 * It also enforces that the palette stayed a palette. Any hue outside the
 * gold band is a failure unless it is one of the two safety colours, which is
 * what stops the old cyan/teal/violet accents from creeping back one component
 * at a time.
 */

const CSS = readFileSync("src/styles.css", "utf8");

interface Colour {
  l: number;
  c: number;
  h: number;
  alpha: number;
}

/** Pull `--name: oklch(L C H[ / A])` declarations out of one selector block. */
function tokensIn(selector: string): Map<string, Colour> {
  const start = CSS.indexOf(selector);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const open = CSS.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < CSS.length; i += 1) {
    if (CSS[i] === "{") depth += 1;
    if (CSS[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = CSS.slice(open, end);
  const found = new Map<string, Colour>();
  const pattern =
    /(--[a-z0-9-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)%?\s*)?\)/g;
  for (const match of block.matchAll(pattern)) {
    const [, name, l, c, h, a] = match;
    found.set(name, {
      l: Number(l),
      c: Number(c),
      h: Number(h),
      alpha: a === undefined ? 1 : Number(a) / (match[0].includes("%") ? 100 : 1),
    });
  }
  return found;
}

/** oklch → sRGB, clamped and gamma-encoded exactly as a display would show it. */
function toSrgb({ l: L, c: C, h: H }: Colour): [number, number, number] {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);

  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return linear.map((v) => {
    const clamped = Math.min(1, Math.max(0, v));
    return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
  }) as [number, number, number];
}

function luminance(colour: Colour): number {
  const [r, g, b] = toSrgb(colour).map((channel) => {
    const value = Math.round(channel * 255) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Colour, b: Colour): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const THEMES: Array<[string, string]> = [
  ["dark", ":root {"],
  ["light", ".light {"],
  ["real", ".real {"],
];

/*
 * Pairs a person actually reads. `--real` inherits most of its tokens from
 * `:root`, so each pair falls back to the dark value when the theme does not
 * restate it — which is the same resolution the cascade performs.
 */
const READABLE_PAIRS: Array<[string, string, string]> = [
  ["body text", "--foreground", "--background"],
  ["secondary text", "--muted-foreground", "--background"],
  ["secondary text on a card", "--muted-foreground", "--card"],
  ["gold on the page", "--primary", "--background"],
  ["label on a gold button", "--primary-foreground", "--primary"],
  ["warning", "--state-warning", "--background"],
  ["success", "--state-success", "--background"],
  ["destructive", "--destructive", "--background"],
];

describe("every readable pair clears WCAG AA", () => {
  const dark = tokensIn(":root {");

  for (const [themeName, selector] of THEMES) {
    const theme = tokensIn(selector);
    const resolve = (name: string) => theme.get(name) ?? dark.get(name);

    for (const [label, fg, bg] of READABLE_PAIRS) {
      it(`${themeName}: ${label}`, () => {
        const foreground = resolve(fg);
        const background = resolve(bg);
        expect(foreground, `${fg} missing`).toBeDefined();
        expect(background, `${bg} missing`).toBeDefined();
        // 4.5:1 is the AA threshold for body text. Nothing here is exempt as
        // "large text": these tokens are used at 12–13px in dense panels.
        expect(contrast(foreground!, background!)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe("the palette stayed black, silver and gold", () => {
  /*
   * Gold sits around hue 88 in oklch. The band is generous enough for bronze
   * and champagne and closed well before anything green or orange.
   */
  const GOLD_BAND = [60, 110] as const;
  /** Below this, hue is meaningless — the colour is black, silver or white. */
  const NEUTRAL_CHROMA = 0.025;
  /**
   * The two hues that survive, and why they are allowed by name rather than by
   * range: "deleted" and "saved" have to differ by hue, not by shade, or the
   * only people who can tell them apart are the ones with unimpaired colour
   * vision on a well-calibrated screen.
   */
  const SAFETY = new Map([
    ["--destructive", 27],
    ["--state-success", 148],
  ]);

  for (const [themeName, selector] of THEMES) {
    it(`${themeName} contains no colour outside the palette`, () => {
      const strays: string[] = [];
      for (const [name, colour] of tokensIn(selector)) {
        if (colour.c < NEUTRAL_CHROMA) continue; // black / silver
        const safety = SAFETY.get(name);
        if (safety !== undefined) {
          expect(Math.abs(colour.h - safety), `${name} moved off its safety hue`).toBeLessThan(20);
          continue;
        }
        if (colour.h < GOLD_BAND[0] || colour.h > GOLD_BAND[1]) {
          strays.push(`${name}: hue ${colour.h}, chroma ${colour.c}`);
        }
      }
      expect(strays, `colours outside the gold band: ${strays.join("; ")}`).toEqual([]);
    });
  }

  it("keeps gold as the only accent, so it still means something", () => {
    const dark = tokensIn(":root {");
    // Module accents were four competing hues. Three of them are now silver,
    // and OCADE keeps the gold — if a second saturated hue reappears here, the
    // accent has stopped being a signal.
    const saturated = ["--accent-ocade", "--accent-ficia", "--accent-madee", "--accent-cania"]
      .map((name) => dark.get(name)!)
      .filter((colour) => colour.c >= 0.1);
    expect(saturated).toHaveLength(1);
  });
});

describe("no component hard-codes a colour outside the palette", () => {
  it("has no Tailwind palette utilities left in the application source", async () => {
    const { globSync } = await import("node:fs");
    const files = globSync("src/**/*.tsx", { exclude: (p) => p.includes("__tests__") });
    const banned =
      /\b(?:text|bg|border|from|to|via|ring|shadow|fill|stroke)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/;
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const match = banned.exec(source);
      if (match) offenders.push(`${file}: ${match[0]}`);
    }
    // A hard-coded utility is invisible to the theme: it stays the same colour
    // in Light, Dark and REAL, which is how a rebrand ends up half-applied.
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
