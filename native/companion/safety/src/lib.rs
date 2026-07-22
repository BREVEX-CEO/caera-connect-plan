//! Safety enforcement for the CAERA Native Companion.
//!
//! STATUS: source scaffold — not built or signed yet.
//!
//! This module is the security core. It mirrors `src/lib/native/companion-bridge.ts`
//! and is re-validated HOST-SIDE so a compromised or buggy caller can never widen
//! its own permissions. The UI's checks are a convenience; these are the real ones.

use std::path::{Component, Path, PathBuf};

/// Risk tiers, identical to the TypeScript contract.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActionRisk {
    ReadOnly,
    Low,
    Confirm,
    High,
    Prohibited,
}

/// Actions the companion can be asked to perform.
#[derive(Debug, Clone)]
pub enum CompanionAction {
    ScreenRead,
    WindowList,
    WindowFocus { target: String },
    WindowArrange { layout: String, target: Option<String> },
    AppOpen { app_id: String },
    FileOpen { path: String },
    TextType { text: String },
    ClipboardRead,
    ClipboardWrite { text: String },
}

/// Words that indicate protected information OCADE must never type or read.
const PROTECTED_WORDS: &[&str] = &[
    "password", "passcode", "passphrase", "otp", "one-time code", "one time code",
    "verification code", "2fa", "mfa", "captcha", "cvv", "cvc", "card number",
    "iban", "sort code", "routing number", "ssn", "social security", "aadhaar",
    "passport number", "recovery code", "seed phrase", "private key", "biometric",
];

/// True when text looks like a credential/OTP/payment value.
///
/// Deliberately broad: a false positive costs a pause, a false negative costs a
/// credential. Also treats any run of 4+ digits as protected.
pub fn is_protected_text(text: &str) -> bool {
    let lower = text.to_lowercase();
    if PROTECTED_WORDS.iter().any(|w| lower.contains(w)) {
        return true;
    }
    let mut digit_run = 0usize;
    for ch in text.chars() {
        if ch.is_ascii_digit() {
            digit_run += 1;
            if digit_run >= 4 {
                return true;
            }
        } else {
            digit_run = 0;
        }
    }
    false
}

/// Classify an action. `TextType` escalates to Prohibited for protected content.
pub fn risk_of(action: &CompanionAction) -> ActionRisk {
    match action {
        CompanionAction::ScreenRead
        | CompanionAction::WindowList
        | CompanionAction::ClipboardRead => ActionRisk::ReadOnly,
        CompanionAction::WindowFocus { .. } | CompanionAction::WindowArrange { .. } => ActionRisk::Low,
        CompanionAction::AppOpen { .. }
        | CompanionAction::FileOpen { .. }
        | CompanionAction::ClipboardWrite { .. } => ActionRisk::Confirm,
        CompanionAction::TextType { text } => {
            if is_protected_text(text) {
                ActionRisk::Prohibited
            } else {
                ActionRisk::Confirm
            }
        }
    }
}

/// User-approved allowlists. Empty means nothing is allowed.
#[derive(Debug, Default, Clone)]
pub struct Allowlist {
    pub apps: Vec<String>,
    pub directories: Vec<PathBuf>,
}

/// Canonicalise-and-contain check that defeats `..` traversal and symlink escapes.
pub fn path_is_allowed(allow: &Allowlist, requested: &Path) -> bool {
    // Reject any path containing parent traversal before touching the disk.
    if requested.components().any(|c| matches!(c, Component::ParentDir)) {
        return false;
    }
    let canonical = match requested.canonicalize() {
        Ok(p) => p,
        // A path that cannot be resolved is not allowed.
        Err(_) => return false,
    };
    allow.directories.iter().any(|dir| {
        dir.canonicalize()
            .map(|d| canonical.starts_with(d))
            .unwrap_or(false)
    })
}

pub fn app_is_allowed(allow: &Allowlist, app_id: &str) -> bool {
    allow.apps.iter().any(|a| a.eq_ignore_ascii_case(app_id))
}

/// Why a request was refused. Returned to the caller verbatim.
#[derive(Debug, PartialEq, Eq)]
pub enum Refusal {
    ProtectedInput,
    ConfirmationRequired,
    AppNotAllowed,
    PathNotAllowed,
}

impl Refusal {
    pub fn message(&self) -> &'static str {
        match self {
            Refusal::ProtectedInput => {
                "This step involves protected information. OCADE will pause — please enter it yourself."
            }
            Refusal::ConfirmationRequired => {
                "This action needs your confirmation before OCADE can run it."
            }
            Refusal::AppNotAllowed => "That application isn't on your approved list.",
            Refusal::PathNotAllowed => "That file or folder isn't in an approved location.",
        }
    }
}

/// The single gate every request passes through before execution.
///
/// `confirmed` is what the CALLER claims; it can never unlock a prohibited
/// action.
pub fn guard(
    action: &CompanionAction,
    confirmed: bool,
    allow: &Allowlist,
) -> Result<(), Refusal> {
    let risk = risk_of(action);

    if risk == ActionRisk::Prohibited {
        return Err(Refusal::ProtectedInput);
    }
    if matches!(risk, ActionRisk::Confirm | ActionRisk::High) && !confirmed {
        return Err(Refusal::ConfirmationRequired);
    }

    match action {
        CompanionAction::AppOpen { app_id } => {
            if !app_is_allowed(allow, app_id) {
                return Err(Refusal::AppNotAllowed);
            }
        }
        CompanionAction::FileOpen { path } => {
            if !path_is_allowed(allow, Path::new(path)) {
                return Err(Refusal::PathNotAllowed);
            }
        }
        _ => {}
    }

    Ok(())
}

/// Strip protected content before anything reaches logs, audit or replay.
pub fn redact_for_audit(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut digits = String::new();

    let flush = |digits: &mut String, out: &mut String| {
        if digits.len() >= 4 {
            out.push_str("[redacted]");
        } else {
            out.push_str(digits);
        }
        digits.clear();
    };

    for ch in text.chars() {
        if ch.is_ascii_digit() {
            digits.push(ch);
        } else {
            flush(&mut digits, &mut out);
            out.push(ch);
        }
    }
    flush(&mut digits, &mut out);

    let lower = out.to_lowercase();
    for w in PROTECTED_WORDS {
        if lower.contains(w) {
            return "[redacted]".to_string();
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn protected_text_is_detected() {
        assert!(is_protected_text("my password is hunter2"));
        assert!(is_protected_text("the OTP is 483920"));
        assert!(is_protected_text("4111111111111111"));
        assert!(!is_protected_text("open my notes"));
    }

    #[test]
    fn typing_protected_content_is_prohibited() {
        let a = CompanionAction::TextType { text: "password abc".into() };
        assert_eq!(risk_of(&a), ActionRisk::Prohibited);
        // Even a caller claiming confirmation cannot unlock it.
        assert_eq!(guard(&a, true, &Allowlist::default()), Err(Refusal::ProtectedInput));
    }

    #[test]
    fn confirm_tier_requires_confirmation() {
        let allow = Allowlist { apps: vec!["notepad".into()], directories: vec![] };
        let a = CompanionAction::AppOpen { app_id: "notepad".into() };
        assert_eq!(guard(&a, false, &allow), Err(Refusal::ConfirmationRequired));
        assert!(guard(&a, true, &allow).is_ok());
    }

    #[test]
    fn unapproved_app_is_refused() {
        let allow = Allowlist { apps: vec!["notepad".into()], directories: vec![] };
        let a = CompanionAction::AppOpen { app_id: "cmd".into() };
        assert_eq!(guard(&a, true, &allow), Err(Refusal::AppNotAllowed));
    }

    #[test]
    fn parent_traversal_is_rejected() {
        let allow = Allowlist { apps: vec![], directories: vec![PathBuf::from(".")] };
        assert!(!path_is_allowed(&allow, Path::new("../secrets.txt")));
    }

    #[test]
    fn read_only_needs_no_confirmation() {
        assert!(guard(&CompanionAction::ScreenRead, false, &Allowlist::default()).is_ok());
    }

    #[test]
    fn audit_redacts_digit_runs_and_keywords() {
        assert!(!redact_for_audit("code 483920").contains("483920"));
        assert_eq!(redact_for_audit("my password here"), "[redacted]");
    }
}
