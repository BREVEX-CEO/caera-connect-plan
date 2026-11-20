/**
 * ANTI-SCAM GUARDIAN (plan 28.2.6): explainable warning signs on pages JARVIS itself opened in an
 * authorized task — never other browsing. Rules, with the exact evidence, and no claim to catch
 * every fraud: a look-alike of a well-known brand's domain, an internationalised (punycode) or
 * bare-IP address, and page text that pushes gift cards, crypto, wire transfers, urgent account
 * "verification" or changed bank details. A flagged site's form-filling, clicking and uploading
 * steps are refused until the person decides (see the planner), so injected page text cannot
 * talk JARVIS past them.
 */
const BRANDS: Readonly<Record<string, readonly string[]>> = {
  paypal: ["paypal.com"],
  microsoft: ["microsoft.com", "live.com", "office.com", "microsoftonline.com", "outlook.com"],
  apple: ["apple.com", "icloud.com"],
  google: ["google.com", "gmail.com", "youtube.com"],
  amazon: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.in", "aws.amazon.com"],
  netflix: ["netflix.com"],
  facebook: ["facebook.com", "meta.com"],
  instagram: ["instagram.com"],
  whatsapp: ["whatsapp.com"],
  dhl: ["dhl.com", "dhl.de"],
  fedex: ["fedex.com"],
  coinbase: ["coinbase.com"],
  binance: ["binance.com"],
};

const TEXT_SIGNS: readonly [RegExp, string][] = [
  [/\b(gift ?cards?|itunes cards?|google play cards?|steam cards?)\b/i, "asks for gift cards"],
  [
    /\b(bitcoin|btc|ethereum|usdt|crypto(currency)?) (wallet|address|payment)\b/i,
    "asks for a crypto payment",
  ],
  [
    /\bwire (the )?(money|funds|payment)\b|\bwestern union\b|\bmoneygram\b/i,
    "asks for a wire transfer",
  ],
  [
    /\b(verify|confirm|unlock|reactivate) your (account|identity|card)\b[\s\S]{0,120}\b(within|in) \d+ ?(hours?|minutes?|days?)\b/i,
    "urgent account verification",
  ],
  [
    /\b(new|updated|changed) (bank|account|payment|remittance) (details|information|number)\b/i,
    "changed payment details",
  ],
  [
    /\b(your account (has been|will be) (suspended|locked|closed))\b/i,
    "threatens to close the account",
  ],
];

export interface ScamSign {
  sign: string;
  evidence: string;
}

export function scamSigns(url: string | undefined, text: string | undefined): ScamSign[] {
  const signs: ScamSign[] = [];
  let host = "";
  try {
    host = url ? new URL(url).hostname.toLowerCase() : "";
  } catch {
    host = "";
  }
  if (host) {
    if (host.split(".").some((label) => label.startsWith("xn--")))
      signs.push({ sign: "an internationalised address that can imitate another", evidence: host });
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":"))
      signs.push({ sign: "a bare IP address instead of a name", evidence: host });
    const folded = host.replace(/0/g, "o").replace(/1/g, "l").replace(/rn/g, "m");
    for (const [brand, official] of Object.entries(BRANDS)) {
      const ownsIt = official.some((domain) => host === domain || host.endsWith(`.${domain}`));
      if (!ownsIt && folded.includes(brand))
        signs.push({
          sign: `looks like ${brand} but is not one of its domains`,
          evidence: `${host} (theirs: ${official.join(", ")})`,
        });
    }
  }
  for (const [pattern, sign] of TEXT_SIGNS) {
    const match = text ? pattern.exec(text) : null;
    if (match) signs.push({ sign, evidence: match[0].slice(0, 160) });
  }
  return signs;
}

/** The sites whose pages showed signs in this task: `{site: signs}`. */
export function flaggedSites(
  steps: readonly {
    intent: { operation: string; target?: { site?: string } };
    receipt?: { evidence?: Record<string, unknown> } | null;
  }[],
): Map<string, ScamSign[]> {
  const flagged = new Map<string, ScamSign[]>();
  for (const step of steps) {
    if (!["web.open", "web.read"].includes(step.intent.operation)) continue;
    const evidence = step.receipt?.evidence ?? {};
    const signs = scamSigns(
      typeof evidence.url === "string" ? evidence.url : undefined,
      typeof evidence.text === "string" ? evidence.text : undefined,
    );
    const site = step.intent.target?.site;
    if (signs.length && site)
      flagged.set(site, [...(flagged.get(site) ?? []), ...signs].slice(0, 6));
  }
  return flagged;
}
