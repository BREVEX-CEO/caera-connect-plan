//! Safety enforcement for the OCADE Native Companion.
//!
//! STATUS: source scaffold — not built or signed yet.
//!
//! This module is the security core. It mirrors `src/lib/native/companion-bridge.ts`
//! and is re-validated HOST-SIDE so a compromised or buggy caller can never widen
//! its own permissions. The UI's checks are a convenience; these are the real ones.

/// Secure local IPC envelope: session auth, monotonic counters, single-use
/// nonces and replay rejection for every inbound companion request.
pub mod ipc;

/// The background-model-transfer protocol the website hands preparation over
/// with: routing, the job registry and the rules that keep a handoff safe.
pub mod model_host;

/// The loopback listener the desktop companion answers that protocol on.
pub mod model_server;

use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex, MutexGuard,
};

/// One atomic owner for the emergency-stop latch and every active cancellation
/// token.
///
/// The latch and token registry deliberately share a mutex. Keeping them in
/// separate locks creates a check-then-register race: a stop can land after an
/// action observes `halted = false` but before its token is visible, allowing
/// that action to escape the stop. `register` and `halt` are mutually exclusive,
/// so a run is either registered in time to be cancelled or refused because the
/// latch is already set.
#[derive(Debug, Default)]
pub struct EmergencyStopRegistry {
    state: Mutex<EmergencyStopState>,
}

#[derive(Debug, Default)]
struct EmergencyStopState {
    halted: bool,
    running: HashMap<String, Arc<AtomicBool>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmergencyStopRefusal {
    Halted,
    DuplicateRun,
}

impl EmergencyStopRefusal {
    pub fn message(self) -> &'static str {
        match self {
            Self::Halted => "Emergency stop is active. Reset it before running actions.",
            Self::DuplicateRun => "That run id is already active.",
        }
    }
}

impl EmergencyStopRegistry {
    fn lock(&self) -> MutexGuard<'_, EmergencyStopState> {
        // A panic while holding the registry must not disable the panic button.
        // Recover the state and keep the latch usable; `halt` still sets every
        // token and `is_halted` still fails safe from the recovered state.
        self.state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn is_halted(&self) -> bool {
        self.lock().halted
    }

    /// Register a run and return its cancellation token.
    ///
    /// This is the final admission gate before execution. It refuses while
    /// halted and rejects duplicate run ids under the same lock used by
    /// `halt`, closing the stop-versus-registration race.
    pub fn register(&self, run_id: &str) -> Result<Arc<AtomicBool>, EmergencyStopRefusal> {
        let mut state = self.lock();
        if state.halted {
            return Err(EmergencyStopRefusal::Halted);
        }
        if state.running.contains_key(run_id) {
            return Err(EmergencyStopRefusal::DuplicateRun);
        }
        let token = Arc::new(AtomicBool::new(false));
        state.running.insert(run_id.to_string(), Arc::clone(&token));
        Ok(token)
    }

    pub fn finish(&self, run_id: &str) {
        self.lock().running.remove(run_id);
    }

    pub fn cancel(&self, run_id: &str) -> bool {
        let token = self.lock().running.get(run_id).cloned();
        if let Some(token) = token {
            token.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }

    /// Latch the stop and cancel every run admitted before this call.
    ///
    /// Returns the number of active tokens signalled, which is useful for audit
    /// and runtime evidence without exposing action contents.
    pub fn halt(&self) -> usize {
        let mut state = self.lock();
        state.halted = true;
        for token in state.running.values() {
            token.store(true, Ordering::SeqCst);
        }
        state.running.len()
    }

    pub fn reset(&self) {
        self.lock().halted = false;
    }

    pub fn active_count(&self) -> usize {
        self.lock().running.len()
    }
}

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
///
/// The wire format matches the TypeScript `CompanionAction` union exactly
/// (`{ "kind": "window.focus", "target": "…" }`) so the contract cannot drift
/// between the app and the host.
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "serde", serde(tag = "kind"))]
pub enum CompanionAction {
    #[cfg_attr(feature = "serde", serde(rename = "screen.read"))]
    ScreenRead,
    #[cfg_attr(feature = "serde", serde(rename = "window.list"))]
    WindowList,
    #[cfg_attr(feature = "serde", serde(rename = "accessibility.read"))]
    AccessibilityRead,
    #[cfg_attr(feature = "serde", serde(rename = "window.focus"))]
    WindowFocus { target: String },
    #[cfg_attr(feature = "serde", serde(rename = "window.arrange"))]
    WindowArrange {
        layout: String,
        target: Option<String>,
    },
    #[cfg_attr(feature = "serde", serde(rename = "app.open"))]
    AppOpen {
        #[cfg_attr(feature = "serde", serde(rename = "appId"))]
        app_id: String,
    },
    #[cfg_attr(feature = "serde", serde(rename = "file.open"))]
    FileOpen { path: String },
    #[cfg_attr(feature = "serde", serde(rename = "text.type"))]
    TextType { text: String },
    #[cfg_attr(feature = "serde", serde(rename = "clipboard.read"))]
    ClipboardRead,
    #[cfg_attr(feature = "serde", serde(rename = "clipboard.write"))]
    ClipboardWrite { text: String },
    /// Read whatever the user currently has selected in the focused app.
    #[cfg_attr(feature = "serde", serde(rename = "selection.read"))]
    SelectionRead,
    /// Replace the current selection — e.g. "rewrite this paragraph".
    #[cfg_attr(feature = "serde", serde(rename = "selection.replace"))]
    SelectionReplace { text: String },
}

/// Words that indicate protected information OCADE must never type or read.
const PROTECTED_WORDS: &[&str] = &[
    "password",
    "passcode",
    "passphrase",
    "otp",
    "one-time code",
    "one time code",
    "verification code",
    "2fa",
    "mfa",
    "captcha",
    "cvv",
    "cvc",
    "card number",
    "iban",
    "sort code",
    "routing number",
    "ssn",
    "social security",
    "aadhaar",
    "passport number",
    "pin",
    "recovery code",
    "seed phrase",
    "private key",
    "biometric",
];

fn contains_protected_word(lower: &str) -> bool {
    PROTECTED_WORDS.iter().any(|word| {
        if word.len() <= 3 {
            lower
                .split(|ch: char| !ch.is_ascii_alphanumeric())
                .any(|token| token == *word)
        } else {
            lower.contains(word)
        }
    })
}

/// True when text looks like a credential/OTP/payment value.
///
/// Deliberately broad: a false positive costs a pause, a false negative costs a
/// credential. Also treats any run of 4+ digits as protected.
pub fn is_protected_text(text: &str) -> bool {
    let lower = text.to_lowercase();
    if contains_protected_word(&lower) {
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
        | CompanionAction::AccessibilityRead
        | CompanionAction::ClipboardRead
        | CompanionAction::SelectionRead => ActionRisk::ReadOnly,
        CompanionAction::WindowFocus { .. } | CompanionAction::WindowArrange { .. } => {
            ActionRisk::Low
        }
        CompanionAction::AppOpen { .. }
        | CompanionAction::FileOpen { .. }
        | CompanionAction::ClipboardWrite { .. } => ActionRisk::Confirm,
        // Writing over the user's selection is destructive, so it needs the same
        // protected-content check and confirmation as typing.
        CompanionAction::TextType { text } | CompanionAction::SelectionReplace { text } => {
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
    if requested
        .components()
        .any(|c| matches!(c, Component::ParentDir))
    {
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
pub fn guard(action: &CompanionAction, confirmed: bool, allow: &Allowlist) -> Result<(), Refusal> {
    let risk = risk_of(action);

    if risk == ActionRisk::Prohibited {
        return Err(Refusal::ProtectedInput);
    }
    if matches!(risk, ActionRisk::Confirm | ActionRisk::High) && !confirmed {
        return Err(Refusal::ConfirmationRequired);
    }

    // Refusal is expressed as a match GUARD: an arm is taken only when the
    // action is NOT allowed. An allowed action falls through to `_` and returns
    // Ok, exactly as it did when the check was a nested `if`.
    match action {
        CompanionAction::AppOpen { app_id } if !app_is_allowed(allow, app_id) => {
            return Err(Refusal::AppNotAllowed);
        }
        CompanionAction::FileOpen { path } if !path_is_allowed(allow, Path::new(path)) => {
            return Err(Refusal::PathNotAllowed);
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
    if contains_protected_word(&lower) {
        return "[redacted]".to_string();
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Barrier;
    use std::thread;
    use std::time::{Duration, Instant};

    #[test]
    fn emergency_stop_cancels_every_active_run_under_load() {
        let stop = EmergencyStopRegistry::default();
        let tokens = (0..512)
            .map(|index| stop.register(&format!("run-{index}")).unwrap())
            .collect::<Vec<_>>();

        let started = Instant::now();
        assert_eq!(stop.halt(), 512);
        assert!(
            started.elapsed() < Duration::from_millis(250),
            "the host stop exceeded its declared 250 ms in-process bound"
        );
        assert!(tokens.iter().all(|token| token.load(Ordering::SeqCst)));
        assert!(stop.is_halted());
    }

    #[test]
    fn registration_cannot_race_past_the_emergency_stop() {
        const RUNS: usize = 64;
        let stop = Arc::new(EmergencyStopRegistry::default());
        let barrier = Arc::new(Barrier::new(RUNS + 1));
        let workers = (0..RUNS)
            .map(|index| {
                let stop = Arc::clone(&stop);
                let barrier = Arc::clone(&barrier);
                thread::spawn(move || {
                    barrier.wait();
                    stop.register(&format!("race-{index}"))
                })
            })
            .collect::<Vec<_>>();

        barrier.wait();
        stop.halt();
        for worker in workers {
            match worker.join().unwrap() {
                Ok(token) => assert!(
                    token.load(Ordering::SeqCst),
                    "a run admitted before halt escaped cancellation"
                ),
                Err(refusal) => assert_eq!(refusal, EmergencyStopRefusal::Halted),
            }
        }
        assert!(stop.is_halted());
    }

    #[test]
    fn emergency_stop_refuses_new_and_duplicate_runs_until_explicit_reset() {
        let stop = EmergencyStopRegistry::default();
        let first = stop.register("run-1").unwrap();
        assert!(matches!(
            stop.register("run-1"),
            Err(EmergencyStopRefusal::DuplicateRun)
        ));

        stop.halt();
        assert!(first.load(Ordering::SeqCst));
        assert!(matches!(
            stop.register("run-2"),
            Err(EmergencyStopRefusal::Halted)
        ));

        stop.finish("run-1");
        stop.reset();
        assert!(!stop.is_halted());
        assert!(stop.register("run-2").is_ok());
    }

    #[test]
    fn cancellation_and_cleanup_have_honest_outcomes() {
        let stop = EmergencyStopRegistry::default();
        let token = stop.register("run-1").unwrap();
        assert!(stop.cancel("run-1"));
        assert!(token.load(Ordering::SeqCst));
        assert!(!stop.cancel("missing"));

        stop.finish("run-1");
        assert_eq!(stop.active_count(), 0);
        assert!(!stop.cancel("run-1"));
    }

    #[test]
    fn a_poisoned_registry_cannot_disable_the_emergency_stop() {
        let stop = Arc::new(EmergencyStopRegistry::default());
        let token = stop.register("run-1").unwrap();
        let poison_target = Arc::clone(&stop);
        let poisoned = thread::spawn(move || {
            let _guard = poison_target.state.lock().unwrap();
            panic!("planted registry failure");
        });
        assert!(poisoned.join().is_err());

        assert_eq!(stop.halt(), 1);
        assert!(stop.is_halted());
        assert!(token.load(Ordering::SeqCst));
        stop.reset();
        assert!(stop.register("recovered").is_ok());
    }

    #[test]
    fn protected_text_is_detected() {
        assert!(is_protected_text("my password is hunter2"));
        assert!(is_protected_text("the OTP is 483920"));
        assert!(is_protected_text("4111111111111111"));
        assert!(is_protected_text("enter pin now"));
        assert!(!is_protected_text("a spinning wheel"));
        assert!(!is_protected_text("open my notes"));
    }

    #[test]
    fn typing_protected_content_is_prohibited() {
        let a = CompanionAction::TextType {
            text: "password abc".into(),
        };
        assert_eq!(risk_of(&a), ActionRisk::Prohibited);
        // Even a caller claiming confirmation cannot unlock it.
        assert_eq!(
            guard(&a, true, &Allowlist::default()),
            Err(Refusal::ProtectedInput)
        );
    }

    #[test]
    fn reading_the_selection_is_read_only() {
        assert_eq!(
            risk_of(&CompanionAction::SelectionRead),
            ActionRisk::ReadOnly
        );
        assert!(guard(
            &CompanionAction::SelectionRead,
            false,
            &Allowlist::default()
        )
        .is_ok());
    }

    #[test]
    fn replacing_the_selection_needs_confirmation() {
        let a = CompanionAction::SelectionReplace {
            text: "a tidier sentence".into(),
        };
        assert_eq!(risk_of(&a), ActionRisk::Confirm);
        assert_eq!(
            guard(&a, false, &Allowlist::default()),
            Err(Refusal::ConfirmationRequired)
        );
        assert!(guard(&a, true, &Allowlist::default()).is_ok());
    }

    #[test]
    fn replacing_a_selection_with_protected_content_is_prohibited() {
        // Overwriting a selection is a write path, so it must be gated exactly
        // like typing — a caller claiming confirmation cannot unlock it.
        let a = CompanionAction::SelectionReplace {
            text: "cvv 123456".into(),
        };
        assert_eq!(risk_of(&a), ActionRisk::Prohibited);
        assert_eq!(
            guard(&a, true, &Allowlist::default()),
            Err(Refusal::ProtectedInput)
        );
    }

    #[test]
    fn confirm_tier_requires_confirmation() {
        let allow = Allowlist {
            apps: vec!["notepad".into()],
            directories: vec![],
        };
        let a = CompanionAction::AppOpen {
            app_id: "notepad".into(),
        };
        assert_eq!(guard(&a, false, &allow), Err(Refusal::ConfirmationRequired));
        assert!(guard(&a, true, &allow).is_ok());
    }

    #[test]
    fn unapproved_app_is_refused() {
        let allow = Allowlist {
            apps: vec!["notepad".into()],
            directories: vec![],
        };
        let a = CompanionAction::AppOpen {
            app_id: "cmd".into(),
        };
        assert_eq!(guard(&a, true, &allow), Err(Refusal::AppNotAllowed));
    }

    #[test]
    fn parent_traversal_is_rejected() {
        let allow = Allowlist {
            apps: vec![],
            directories: vec![PathBuf::from(".")],
        };
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
