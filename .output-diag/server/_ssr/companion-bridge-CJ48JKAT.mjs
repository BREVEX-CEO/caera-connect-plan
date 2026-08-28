//#region node_modules/.nitro/vite/services/ssr/assets/companion-bridge-CJ48JKAT.js
/**
* Every kind of data this product can create.
*
* "resumes", "company", "timesheets" and "accounting" were removed with the
* products that produced them. A privacy control for a data class nothing can
* write is a switch with no wire behind it — worse than useless, because it
* invites someone to believe they have configured where their company records
* are stored when no company record can exist.
*
* The `data_class_privacy` rows for those classes are left untouched in the
* database. Deleting a user's stated privacy preference is not a cleanup, and
* if those products are ever built the preference should still be theirs.
*/
var DATA_CLASSES = [
	"chats",
	"images",
	"files",
	"recordings",
	"copilot",
	"learning_replays"
];
var StorageLockedError = class extends Error {
	constructor() {
		super("Browser Only vault is locked. Unlock it in Settings → Vault.");
		this.name = "StorageLockedError";
	}
};
var NativeCompanionRequiredError = class extends Error {
	/**
	* `message` is optional so other companion-gated surfaces (computer control,
	* local engines) can give their own honest reason. Existing callers pass
	* nothing and keep the original vault wording unchanged.
	*/
	constructor(message) {
		super(message ?? "PC Device Vault requires the OCADE Native Companion. Not available in the browser yet.");
		this.name = "NativeCompanionRequiredError";
	}
};
/**
* OCADE Native Companion bridge contract (Plan §23–§25, §29).
*
* This is the TYPED CONTRACT ONLY. Nothing here executes OS actions: the web
* app cannot control a computer. A signed Tauri + Rust companion implements
* `NativeCompanionAdapter` over secure local IPC; until that binary is built,
* signed and runtime-proven, `UnavailableCompanion` is the active adapter and
* every action throws NativeCompanionRequiredError. No silent fallback, no
* simulated success.
*
* Safety rules encoded here (decisions #7, #29, #32):
*  - every action carries a risk tier;
*  - protected input (passwords, OTPs, CAPTCHAs, payment/biometric/recovery
*    data) is PROHIBITED — OCADE pauses and the user completes it personally;
*  - high-risk actions require explicit confirmation;
*  - cancellation and emergency stop are first-class.
*/
/**
* Patterns that indicate protected content OCADE must never type or read.
* Deliberately broad — a false positive costs a pause, a false negative costs a
* credential.
*/
var PROTECTED_HINTS = /(password|passcode|passphrase|\botp\b|one[- ]time code|verification code|2fa|mfa|captcha|cvv|cvc|card number|iban|sort code|routing number|ssn|social security|aadhaar|passport number|pin\b|recovery code|seed phrase|private key|biometric)/i;
/** Long digit runs (card/OTP-like) are treated as protected. */
var DIGIT_RUN = /\b\d{4,}\b/;
function isProtectedText(text) {
	return PROTECTED_HINTS.test(text) || DIGIT_RUN.test(text);
}
/**
* Risk tier for an action. `text.type` escalates to `prohibited` when the
* content looks like a credential/OTP/payment value.
*/
function riskOf(action) {
	switch (action.kind) {
		case "screen.read":
		case "window.list":
		case "accessibility.read":
		case "clipboard.read":
		case "selection.read": return "read_only";
		case "window.focus":
		case "window.arrange": return "low";
		case "app.open":
		case "file.open":
		case "clipboard.write": return "confirm";
		case "text.type":
		case "selection.replace": return isProtectedText(action.text) ? "prohibited" : "confirm";
		default: return "confirm";
	}
}
/**
* Translate an executor acknowledgement into the canonical completion states.
*
* `ExecuteResult.ok` proves only that the executor accepted and returned from
* the action. It cannot promote itself to verified completion. Callers must
* supply evidence from a separate observer to reach `completed_verified`.
*/
function classifyCompanionCompletion(execution, verification) {
	if (!execution.ok) return {
		status: "failed",
		evidence: execution.detail || "The companion reported that the action failed."
	};
	if (verification?.verified) return {
		status: "completed_verified",
		evidence: verification.evidence
	};
	return {
		status: "completed_unverified",
		evidence: verification?.evidence || "The companion acknowledged execution, but no independent observer verified the result."
	};
}
var COMPANION_UNAVAILABLE_REASON = "The OCADE Native Companion isn't connected. Computer control requires the signed companion app.";
/**
* Active adapter until a signed companion exists. Every action fails loudly.
*/
var UnavailableCompanion = class {
	reason;
	constructor(reason = COMPANION_UNAVAILABLE_REASON) {
		this.reason = reason;
	}
	async status() {
		return {
			available: false,
			reason: this.reason
		};
	}
	async execute() {
		throw new NativeCompanionRequiredError(this.reason);
	}
	async cancel() {
		throw new NativeCompanionRequiredError(this.reason);
	}
	async emergencyStop() {
		throw new NativeCompanionRequiredError(this.reason);
	}
	async gestureStatus() {
		return {
			available: false,
			running: false,
			controlEnabled: false,
			cameraIndex: null,
			reason: this.reason
		};
	}
	async startGestureControl() {
		throw new NativeCompanionRequiredError(this.reason);
	}
	async stopGestureControl() {
		throw new NativeCompanionRequiredError(this.reason);
	}
};
/**
* Guard every action before it reaches an adapter. Returns the reason a request
* must be refused or paused, or null when it may proceed.
*/
function guardAction(action, opts) {
	const risk = riskOf(action);
	if (risk === "prohibited") return "This step involves protected information. OCADE will pause — please enter it yourself.";
	if ((risk === "confirm" || risk === "high") && !opts.confirmed) return "This action needs your confirmation before OCADE can run it.";
	return null;
}
/** Redact protected content from any string before it reaches logs/audit/replay. */
function redactForAudit(text) {
	if (!text) return text;
	return text.replace(/\b\d{4,}\b/g, "[redacted]").replace(PROTECTED_HINTS, "[redacted]");
}
var activeAdapter = new UnavailableCompanion();
var adapterListeners = /* @__PURE__ */ new Set();
function getCompanion() {
	return activeAdapter;
}
/** Installed by the desktop build once a signed companion is verified. */
function setCompanionAdapter(adapter) {
	if (activeAdapter === adapter) return;
	activeAdapter = adapter;
	for (const listener of adapterListeners) try {
		listener(adapter);
	} catch {}
}
/**
* Observe validated in-memory adapter replacement. No session key or serialized
* adapter state crosses this boundary; consumers receive only the live object.
*/
function subscribeCompanionAdapter(listener) {
	adapterListeners.add(listener);
	return () => adapterListeners.delete(listener);
}
//#endregion
export { UnavailableCompanion as a, guardAction as c, riskOf as d, setCompanionAdapter as f, StorageLockedError as i, isProtectedText as l, DATA_CLASSES as n, classifyCompanionCompletion as o, subscribeCompanionAdapter as p, NativeCompanionRequiredError as r, getCompanion as s, COMPANION_UNAVAILABLE_REASON as t, redactForAudit as u };
