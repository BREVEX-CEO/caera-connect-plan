import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

/**
 * The OCADE monochrome palette, checked as colour values rather than token names.
 *
 * This does not trust colour names in comments. It parses every
 * oklch token, converts it to sRGB the way a browser does, and computes real
 * WCAG contrast ratios — so a token nudged two steps darker fails here instead
 * of failing on somebody's screen. The figures it produces were confirmed
 * against the running application: the browser reported 17.11:1 for text on
 * background in the dark theme, and this file computes the same number from
 * the same declarations.
 *
 * It also enforces that every product token has zero chroma. State is conveyed
 * through text, iconography, contrast, shape and motion rather than hue.
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
  ["brand action on the page", "--primary", "--background"],
  ["label on a brand button", "--primary-foreground", "--primary"],
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

describe("the palette stays monochrome", () => {
  for (const [themeName, selector] of THEMES) {
    it(`${themeName} gives every token zero chroma`, () => {
      const coloured: string[] = [];
      for (const [name, colour] of tokensIn(selector)) {
        if (colour.c !== 0) {
          coloured.push(`${name}: hue ${colour.h}, chroma ${colour.c}`);
        }
      }
      expect(coloured, `coloured ${themeName} tokens: ${coloured.join("; ")}`).toEqual([]);
    });
  }

  it("keeps all module accents neutral", () => {
    const dark = tokensIn(":root {");
    for (const name of ["--accent-ocade", "--accent-ficia", "--accent-madee", "--accent-cania"]) {
      expect(dark.get(name)?.c, name).toBe(0);
    }
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
