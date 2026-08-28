//#region node_modules/.nitro/vite/services/ssr/assets/preflight-BxhjuTtu.js
/**
* Luhn check for card numbers.
*
* Shape alone matches phone numbers, order ids and timestamps. Without this
* the scanner would flag a 16-digit invoice number as a payment card, and the
* second time that happens the user stops reading the warnings.
*/
function luhnValid(value) {
	const digits = value.replace(/[^0-9]/g, "");
	if (digits.length < 13 || digits.length > 19) return false;
	let sum = 0;
	let double = false;
	for (let i = digits.length - 1; i >= 0; i -= 1) {
		let d = Number(digits[i]);
		if (double) {
			d *= 2;
			if (d > 9) d -= 9;
		}
		sum += d;
		double = !double;
	}
	return sum % 10 === 0;
}
var RULES = [
	{
		kind: "private_key",
		severity: "critical",
		pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
		explain: "This is a private key. Anyone who has it can act as you — sending it anywhere is equivalent to handing over the account it belongs to."
	},
	{
		kind: "aws_key",
		severity: "critical",
		pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
		explain: "This looks like an AWS access key id, which usually appears next to its secret."
	},
	{
		kind: "api_key",
		severity: "critical",
		pattern: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b|\bghp_[A-Za-z0-9]{36}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
		explain: "This looks like an API key. Keys in a message tend to end up in logs and history."
	},
	{
		kind: "jwt",
		severity: "high",
		pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
		explain: "This is a signed token. It may still be valid, and it often carries your identity and permissions."
	},
	{
		kind: "connection_string",
		severity: "critical",
		pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@]+:[^\s@]+@\S+/g,
		explain: "This is a database connection string with a password in it."
	},
	{
		kind: "password_assignment",
		severity: "high",
		pattern: /\b(?:password|passwd|pwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[^\s"',;]{6,}/gi,
		explain: "This looks like a password or secret being assigned to a name."
	},
	{
		kind: "card_number",
		severity: "critical",
		pattern: /\b(?:\d[ -]?){13,19}\b/g,
		confirm: luhnValid,
		explain: "This passes the checksum used by payment cards, so it is probably a real card number."
	},
	{
		kind: "iban",
		severity: "high",
		pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
		explain: "This looks like an IBAN — a bank account number."
	},
	{
		kind: "email",
		severity: "medium",
		pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
		explain: "This is an email address. It identifies a person."
	}
];
/** Mask a match so the finding can be shown without repeating the secret. */
function mask(value) {
	const trimmed = value.trim();
	if (trimmed.length <= 8) return "•".repeat(trimmed.length);
	return `${trimmed.slice(0, 4)}${"•".repeat(Math.min(12, trimmed.length - 8))}${trimmed.slice(-4)}`;
}
/**
* Scan text for things that should not leave without a decision.
*
* Pure and synchronous: no network, no storage, no async. The whole point is
* that this completes before anything is sent.
*/
function preflight(text) {
	const findings = [];
	for (const rule of RULES) {
		rule.pattern.lastIndex = 0;
		let match;
		while ((match = rule.pattern.exec(text)) !== null) {
			if (match[0].length === 0) break;
			if (rule.confirm && !rule.confirm(match[0])) continue;
			findings.push({
				kind: rule.kind,
				severity: rule.severity,
				at: match.index,
				length: match[0].length,
				preview: mask(match[0]),
				explain: rule.explain
			});
		}
	}
	const rank = {
		critical: 3,
		high: 2,
		medium: 1
	};
	const kept = [];
	for (const finding of findings.sort((a, b) => rank[b.severity] - rank[a.severity])) if (!kept.some((k) => finding.at < k.at + k.length && k.at < finding.at + finding.length)) kept.push(finding);
	return kept.sort((a, b) => a.at - b.at);
}
/** The headline. Refuses to say "clean" — it says what was checked. */
function summarise(findings) {
	if (findings.length === 0) return "Nothing that looks like a credential or personal detail was found in this message.";
	const critical = findings.filter((f) => f.severity === "critical").length;
	if (critical > 0) return `${critical} ${critical === 1 ? "item" : "items"} in this message could give someone access to an account. Remove or redact ${critical === 1 ? "it" : "them"} before continuing.`;
	return `${findings.length} personal ${findings.length === 1 ? "detail" : "details"} found in this message.`;
}
//#endregion
export { summarise as n, preflight as t };
