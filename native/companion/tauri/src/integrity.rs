//! Hardware binding and self-verification.
//!
//! WHAT THESE CONTROLS HONESTLY DO
//! -------------------------------
//! Neither of these stops a determined attacker with a debugger, and writing
//! them as though they did is how a product ends up trusting a check that a
//! cracker removed in one byte. What they do stop is COPYING: a licence file
//! carried to a second machine, and a patched binary redistributed as genuine.
//! That is most real-world piracy, and it is worth having.
//!
//! The honest boundary is signing. A signed binary that fails its own checksum
//! also fails the operating system's signature check, and the OS enforces that
//! before any of this code runs. These checks are the layer underneath.
//!
//! WHY EVERY FAILURE MODE HERE IS "UNKNOWN", NOT "TAMPERED"
//! --------------------------------------------------------
//! A self-audit that cannot read its own file, or a machine that will not yield
//! an identifier, is a machine we know nothing about -- not a machine we know is
//! hostile. Reporting the first as the second locks out honest users on hardware
//! we did not anticipate, which costs more in support than it ever recovers in
//! licence fees.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// How confident we are that this installation is the one that was licensed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Verdict {
    /// Checked, and it matched.
    Verified,
    /// Checked, and it did not match. The only state that means "refuse".
    Mismatched,
    /// Could not be checked. NOT a failure -- see the module note.
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
pub struct IntegrityReport {
    pub hardware: Verdict,
    /// Fingerprint of this machine. Safe to display: it is a hash, and it
    /// carries no serial number, user name or MAC address in recoverable form.
    pub hardware_id: String,
    pub binary: Verdict,
    /// Present only when the binary could actually be hashed.
    pub binary_sha256: Option<String>,
    /// One sentence a support agent could act on.
    pub detail: String,
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Read a Windows registry string without pulling in a registry crate.
///
/// `reg query` is used rather than a raw API binding because this runs once at
/// startup and the dependency is not worth it. The command is a fixed argument
/// list with no user input anywhere in it, so there is nothing to inject.
///
/// PARSING NOTE, LEARNED THE HARD WAY. `reg` prints one indented line shaped
/// `<name>    <TYPE>    <value>`, and the value MAY CONTAIN SPACES -- the real
/// processor string on the development machine is
/// "11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz". Taking the last
/// whitespace-separated token, the obvious way to write this, yields "2.40GHz":
/// stable, so every test still passes, but shared with millions of machines. The
/// value is therefore everything AFTER the type token, not the final word.
#[cfg(target_os = "windows")]
fn registry_value(path: &str, name: &str) -> Option<String> {
    use std::process::Command;
    let out = Command::new("reg")
        .args(["query", path, "/v", name])
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    let line = text.lines().find(|line| line.contains(name))?;
    // Split past the name and the REG_* type, keeping the remainder intact.
    let after_name = line.split_once(name)?.1.trim_start();
    let (kind, value) = after_name.split_once(char::is_whitespace)?;
    if !kind.starts_with("REG_") {
        return None;
    }
    let value = value.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_owned())
    }
}

#[cfg(not(target_os = "windows"))]
fn registry_value(_path: &str, _name: &str) -> Option<String> {
    None
}

/// Stable identifiers for this machine, most durable first.
///
/// DELIBERATELY NOT THE MAC ADDRESS. It changes with a docking station, a VPN,
/// or a USB adapter, and every one of those is an ordinary Tuesday for a laptop
/// user. Binding to it produces support tickets, not security.
fn machine_signals() -> Vec<String> {
    let mut signals = Vec::new();

    #[cfg(target_os = "windows")]
    {
        // Survives disk cloning and OS updates; regenerated only by a Windows
        // reinstall, which is the boundary a person would call "a new machine".
        if let Some(guid) =
            registry_value(r"HKLM\SOFTWARE\Microsoft\Cryptography", "MachineGuid")
        {
            signals.push(format!("guid:{guid}"));
        }
        if let Some(cpu) = registry_value(
            r"HKLM\HARDWARE\DESCRIPTION\System\CentralProcessor\0",
            "ProcessorNameString",
        ) {
            signals.push(format!("cpu:{cpu}"));
        }
    }

    #[cfg(target_os = "linux")]
    {
        for path in ["/etc/machine-id", "/var/lib/dbus/machine-id"] {
            if let Ok(id) = fs::read_to_string(path) {
                signals.push(format!("machine-id:{}", id.trim()));
                break;
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        if let Ok(out) = Command::new("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
        {
            let text = String::from_utf8_lossy(&out.stdout);
            if let Some(line) = text.lines().find(|l| l.contains("IOPlatformUUID")) {
                signals.push(format!("uuid:{}", line.trim()));
            }
        }
    }

    signals
}

/// A stable, non-reversible fingerprint of this machine.
///
/// Returns `None` when the platform yielded nothing. A random value would be
/// worse than nothing: it would look like a valid identifier and change on every
/// launch, so every honest user would read as a licence violation.
pub fn hardware_id() -> Option<String> {
    let signals = machine_signals();
    if signals.is_empty() {
        return None;
    }
    let mut hasher = Sha256::new();
    // Namespaced, so the same machine produces a different id for a different
    // product. An identifier that is global across vendors is a tracking id.
    hasher.update(b"ocade-hardware-v1");
    for signal in &signals {
        hasher.update(signal.as_bytes());
    }
    Some(hex(&hasher.finalize()))
}

/// SHA-256 of the executable that is currently running.
pub fn binary_sha256() -> Option<(String, PathBuf)> {
    let path = std::env::current_exe().ok()?;
    let bytes = fs::read(&path).ok()?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    Some((hex(&hasher.finalize()), path))
}

/// The expected values, baked in at build time.
///
/// WHY THE BINARY HASH CANNOT SIMPLY BE COMPILED IN. Writing a file's own hash
/// into that file changes the file, which changes the hash. So the build
/// pipeline computes it AFTER linking and supplies it out of band -- an
/// environment variable at compile time here, and in a signed release the
/// signature itself carries the same guarantee more strongly.
///
/// Absent means `Unknown`, never `Verified`. A build that forgot to stamp the
/// hash must not silently claim to have verified it.
fn expected_binary() -> Option<&'static str> {
    option_env!("OCADE_BINARY_SHA256")
}

fn expected_hardware() -> Option<&'static str> {
    option_env!("OCADE_LICENSED_HARDWARE_ID")
}

/// Check both bindings and report. Never panics, never blocks on its own.
///
/// The decision to refuse belongs to the caller, and it should refuse only on
/// `Mismatched`. See the module note on why `Unknown` is not a failure.
pub fn verify() -> IntegrityReport {
    let id = hardware_id();
    let hardware = match (&id, expected_hardware()) {
        (Some(actual), Some(expected)) if actual.eq_ignore_ascii_case(expected) => Verdict::Verified,
        (Some(_), Some(_)) => Verdict::Mismatched,
        _ => Verdict::Unknown,
    };

    let hashed = binary_sha256();
    let binary = match (&hashed, expected_binary()) {
        (Some((actual, _)), Some(expected)) if actual.eq_ignore_ascii_case(expected) => {
            Verdict::Verified
        }
        (Some(_), Some(_)) => Verdict::Mismatched,
        _ => Verdict::Unknown,
    };

    let detail = match (hardware, binary) {
        (Verdict::Mismatched, _) => {
            "This licence was activated on a different computer. Contact support to move it."
                .to_owned()
        }
        (_, Verdict::Mismatched) => {
            "This copy of OCADE does not match the version that was published. Reinstall it from \
             the official installer."
                .to_owned()
        }
        (Verdict::Verified, Verdict::Verified) => "Installation verified.".to_owned(),
        _ => "Installation could not be fully verified on this system.".to_owned(),
    };

    IntegrityReport {
        hardware,
        hardware_id: id.unwrap_or_else(|| "unavailable".to_owned()),
        binary,
        binary_sha256: hashed.map(|(digest, _)| digest),
        detail,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// THE TEST THAT STOPS THE OTHERS BEING VACUOUS.
    ///
    /// Every assertion below is written `if let Some(id)`, so on a machine that
    /// yields no signals they all pass while proving nothing. This one fails
    /// instead. Windows is the shipping target and always has a MachineGuid, so
    /// there is no excuse for an empty result here.
    #[cfg(target_os = "windows")]
    #[test]
    fn windows_actually_produces_an_id() {
        let signals = machine_signals();
        assert!(
            signals.iter().any(|s| s.starts_with("guid:")),
            "no MachineGuid: {signals:?}"
        );
        // Asserted too, so `processor_signal_keeps_its_whole_name` cannot quietly
        // become a test of nothing: both keys are present on every Windows install.
        assert!(
            signals.iter().any(|s| s.starts_with("cpu:")),
            "no processor name: {signals:?}"
        );
        assert!(hardware_id().is_some());
    }

    /// The processor signal must survive the spaces in a real CPU name.
    ///
    /// Guards the exact bug this parser shipped with once: taking the last
    /// whitespace token reduced "11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz"
    /// to "2.40GHz", which is stable enough to pass every other test and far too
    /// common to identify anything.
    #[cfg(target_os = "windows")]
    #[test]
    fn processor_signal_keeps_its_whole_name() {
        let signals = machine_signals();
        if let Some(cpu) = signals.iter().find(|s| s.starts_with("cpu:")) {
            let value = cpu.trim_start_matches("cpu:");
            assert!(
                value.split_whitespace().count() > 1,
                "processor string was truncated to a single token: {value:?}"
            );
        }
    }

    #[test]
    fn hardware_id_is_stable_across_calls() {
        // An identifier that changes between calls would make every honest user
        // look like a licence violation on their second launch.
        if let Some(first) = hardware_id() {
            assert_eq!(Some(first), hardware_id());
        }
    }

    #[test]
    fn hardware_id_is_a_hash_not_a_serial() {
        // 64 hex characters, and nothing recoverable. A raw serial number here
        // would turn a licence check into a tracking identifier.
        if let Some(id) = hardware_id() {
            assert_eq!(id.len(), 64);
            assert!(id.chars().all(|c| c.is_ascii_hexdigit()));
        }
    }

    #[test]
    fn binary_hashes_to_something() {
        let hashed = binary_sha256().expect("the running test binary must be readable");
        assert_eq!(hashed.0.len(), 64);
    }

    #[test]
    fn an_unstamped_build_reports_unknown_not_verified() {
        // THE DEFAULT THAT MATTERS. A build that forgot to stamp its hash must
        // never claim to have checked it.
        let report = verify();
        if expected_binary().is_none() {
            assert_eq!(report.binary, Verdict::Unknown);
        }
        if expected_hardware().is_none() {
            assert_eq!(report.hardware, Verdict::Unknown);
        }
    }

    #[test]
    fn unknown_never_reads_as_tampered() {
        let report = verify();
        assert!(!report.detail.contains("does not match") || report.binary == Verdict::Mismatched);
    }
}
