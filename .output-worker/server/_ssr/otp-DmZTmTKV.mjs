//#region node_modules/.nitro/vite/services/ssr/assets/otp-DmZTmTKV.js
/**
* Seconds still to wait, or 0 when a resend is allowed.
*
* A `lastSentAt` in the future — a clock that moved backwards, a restored tab —
* is clamped rather than trusted, so a bad timestamp cannot lock the button
* out for hours.
*/
function secondsUntilResend(lastSentAt, now, cooldownSeconds = 60) {
	if (lastSentAt === null) return 0;
	const elapsed = (now - lastSentAt) / 1e3;
	if (!Number.isFinite(elapsed) || elapsed < 0) return cooldownSeconds;
	return Math.max(0, Math.ceil(cooldownSeconds - elapsed));
}
/** The label on the resend control, read aloud as well as shown. */
function describeResend(seconds) {
	if (seconds <= 0) return "Didn't get it? Send another code";
	if (seconds === 1) return "You can request another code in 1 second";
	return `You can request another code in ${seconds} seconds`;
}
/**
* A provider error, said in OCADE's own words.
*
* TWO RULES, AND BOTH MATTER.
*
* Never render the provider's text: it names the provider, sometimes names
* internal endpoints, and is written for whoever operates the service rather
* than for the person who mistyped a digit.
*
* Never confirm whether an account exists. "No user found" and "wrong code"
* both become the same sentence, because the difference between them is
* precisely what somebody probing a list of email addresses is trying to
* learn.
*/
function friendlyOtpError(raw) {
	const text = raw.toLowerCase();
	if (/rate|too many|429|only request|security purposes/.test(text)) return "Too many requests just now. Wait a minute, then ask for another code.";
	if (/expired|expire/.test(text)) return "That code has expired. Ask for a new one and enter it within a few minutes.";
	if (/invalid|incorrect|not found|no user|token/.test(text)) return "That code did not match. Check the digits, or ask for a new one.";
	if (/network|fetch|timeout|offline/.test(text)) return "OCADE could not reach the sign-in service. Check your connection and try again.";
	return "That did not work. Ask for a new code and try again.";
}
/**
* What to say after asking for a code, whatever actually happened.
*
* Deliberately identical for "sent" and "there is no such account", for the
* reason above. The screen that follows asks for a code either way; a person
* with no account learns that from the offer to create one, not from a message
* that answers the attacker's question for them.
*/
var OTP_SENT_NOTICE = "If that address can receive one, a one-time code is on its way. It expires shortly.";
//#endregion
export { secondsUntilResend as i, describeResend as n, friendlyOtpError as r, OTP_SENT_NOTICE as t };
