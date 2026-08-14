//! Offline licence verification and a tamper-evident usage record.
//!
//! THE DESIGN, AND WHY IT NEEDS NO SERVER
//! --------------------------------------
//! CAREA CADANE holds an Ed25519 SECRET key offline; it never ships and never
//! touches a network. A licence is a small JSON document -- who it is for, which
//! machine it is bound to, when it expires -- signed with that key. The matching
//! PUBLIC key is compiled into this binary. Verification is a signature check
//! against a public key, so it works on a machine that has never been online and
//! never will be.
//!
//! That is the whole point. A licence server would make a local-first product
//! phone home to be allowed to run, which is the opposite of what OCADE is, and
//! it would fail exactly when the customer is offline -- the case the product
//! exists to serve.
//!
//! WHAT AN ATTACKER CAN AND CANNOT DO
//! ----------------------------------
//! Cannot: forge a licence. Ed25519 signatures need the secret key, and it is
//! not in the binary -- only the public half is, and the public half verifies.
//! Can: patch this code out. A local check runs on the attacker's own CPU, and
//! nothing written here changes that. Code signing is what makes a patched
//! binary detectable, and that is the layer above this one.
//!
//! So this stops licence SHARING -- one file mailed to a friend, or lifted from
//! a forum -- which is the ordinary case. It does not stop cracking, and this
//! module does not pretend to.
//!
//! ON "ENCRYPTED" USAGE RECORDS
//! ---------------------------
//! The usage record below is authenticated, not encrypted, and that is a
//! deliberate correction rather than a shortcut. Encrypting a local file against
//! the person who owns the machine requires a key on that machine, which they
//! can extract; it produces the FEELING of secrecy and none of it. The real
//! threat to a usage counter is not reading it -- it is rewinding it. So the
//! record is signed with a key derived from the installation, which makes
//! editing it detectable, which is the property actually wanted.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::integrity::{hardware_id, Verdict};

/// The licence document, as signed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Licence {
    /// Who bought it. Shown in the About screen.
    pub licensee: String,
    /// Opaque order reference, for support.
    pub reference: String,
    /// Hardware fingerprint this licence is bound to.
    ///
    /// `None` means an unbound (site or transferable) licence -- deliberately
    /// representable, because a company buying fifty seats should not need
    /// fifty machine fingerprints before anybody can start work.
    #[serde(default)]
    pub hardware_id: Option<String>,
    /// Unix seconds after which it stops being valid. `None` is perpetual.
    #[serde(default)]
    pub expires_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LicenceStatus {
    pub verdict: Verdict,
    pub licensee: Option<String>,
    /// A sentence a support agent can act on.
    pub detail: String,
}

/// The public half of the signing key, compiled in at build time.
///
/// Absent means `Unknown`, never `Verified` -- a build that forgot to stamp its
/// key must not silently decide every licence is fine. This is the same rule the
/// integrity module keeps, and for the same reason.
fn signing_public_key() -> Option<&'static str> {
    option_env!("OCADE_LICENCE_PUBLIC_KEY")
}

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Check a signed licence document.
///
/// `document` is the exact bytes that were signed; `signature` is a minisign
/// signature over them. Both come from the licence file the customer was sent.
pub fn verify_licence(document: &[u8], signature: &str) -> LicenceStatus {
    let Some(public_key) = signing_public_key() else {
        return LicenceStatus {
            verdict: Verdict::Unknown,
            licensee: None,
            detail: "This build carries no licence key, so licences cannot be checked.".to_owned(),
        };
    };

    let key = match minisign_verify::PublicKey::from_base64(public_key) {
        Ok(key) => key,
        Err(_) => {
            return LicenceStatus {
                verdict: Verdict::Unknown,
                licensee: None,
                detail: "This build's licence key is malformed.".to_owned(),
            }
        }
    };

    let parsed = match minisign_verify::Signature::decode(signature) {
        Ok(sig) => sig,
        Err(_) => return refused("This licence file is not readable."),
    };

    // THE SIGNATURE IS CHECKED BEFORE THE CONTENTS ARE TRUSTED.
    //
    // Parsing first and verifying afterwards would mean deciding who somebody is
    // from a document nobody has authenticated. The order is the security
    // property, not a style preference.
    if key.verify(document, &parsed, false).is_err() {
        return refused("This licence file has been altered, or was not issued by CAREA CADANE.");
    }

    let licence: Licence = match serde_json::from_slice(document) {
        Ok(licence) => licence,
        Err(_) => return refused("This licence file is signed but its contents are unreadable."),
    };

    if let Some(expires_at) = licence.expires_at {
        if now_seconds() > expires_at {
            return LicenceStatus {
                verdict: Verdict::Mismatched,
                licensee: Some(licence.licensee),
                detail: "This licence has expired. Renew it to keep using OCADE.".to_owned(),
            };
        }
    }

    if let Some(bound) = &licence.hardware_id {
        match hardware_id() {
            // Bound elsewhere: the ordinary "mailed it to a friend" case.
            Some(actual) if !actual.eq_ignore_ascii_case(bound) => {
                return LicenceStatus {
                    verdict: Verdict::Mismatched,
                    licensee: Some(licence.licensee),
                    detail: "This licence belongs to a different computer. Contact support to \
                             move it."
                        .to_owned(),
                }
            }
            // This machine will not say who it is. NOT treated as a violation:
            // see the integrity module on why unknown is not hostile.
            None => {
                return LicenceStatus {
                    verdict: Verdict::Unknown,
                    licensee: Some(licence.licensee),
                    detail: "This licence could not be matched to this computer.".to_owned(),
                }
            }
            Some(_) => {}
        }
    }

    LicenceStatus {
        verdict: Verdict::Verified,
        licensee: Some(licence.licensee),
        detail: "Licence verified.".to_owned(),
    }
}

fn refused(detail: &str) -> LicenceStatus {
    LicenceStatus {
        verdict: Verdict::Mismatched,
        licensee: None,
        detail: detail.to_owned(),
    }
}

// ---------------------------------------------------------------- usage record

/// A tamper-evident record of how much the installation has been used.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Usage {
    pub launches: u64,
    pub first_seen: u64,
    pub last_seen: u64,
}

/// The key the record is authenticated with.
///
/// Derived from this machine, so a record copied from another installation does
/// not authenticate here. Not a secret -- see the module note. It makes edits
/// DETECTABLE, which is the property a usage counter actually needs.
fn record_key() -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"ocade-usage-v1");
    hasher.update(hardware_id().unwrap_or_default().as_bytes());
    hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

fn tag_for(body: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(record_key().as_bytes());
    hasher.update(body.as_bytes());
    hasher
        .finalize()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

/// Read the usage record, or `None` when it is missing or has been edited.
///
/// A rewritten counter reads as absent rather than as its written value, so
/// rolling a trial back to zero does not silently succeed.
pub fn read_usage(path: &Path) -> Option<Usage> {
    let raw = fs::read_to_string(path).ok()?;
    let (body, tag) = raw.rsplit_once('\n')?;
    if tag_for(body) != tag.trim() {
        return None;
    }
    serde_json::from_str(body).ok()
}

/// Record one launch. Returns the updated record.
pub fn note_launch(path: &Path) -> std::io::Result<Usage> {
    let now = now_seconds();
    let mut usage = read_usage(path).unwrap_or(Usage {
        launches: 0,
        first_seen: now,
        last_seen: now,
    });
    usage.launches += 1;
    usage.last_seen = now;

    let body = serde_json::to_string(&usage).map_err(std::io::Error::other)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, format!("{body}\n{}", tag_for(&body)))?;
    Ok(usage)
}

/// Where the record lives, given the app's data directory.
pub fn usage_path(data_dir: &Path) -> PathBuf {
    data_dir.join("usage-v1.record")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_file(name: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!("ocade-{name}-{}.record", now_seconds()));
        let _ = fs::remove_file(&path);
        path
    }

    #[test]
    fn an_unstamped_build_cannot_verify_a_licence() {
        // THE DEFAULT THAT MATTERS. No key means "cannot check", never "fine".
        if signing_public_key().is_none() {
            let status = verify_licence(b"{}", "whatever");
            assert_eq!(status.verdict, Verdict::Unknown);
            assert!(!status.detail.contains("verified"));
        }
    }

    #[test]
    fn a_licence_is_never_verified_without_a_signature_check() {
        // Even a well-formed document is refused when the signature cannot be
        // decoded. Reading the contents first would mean trusting unauthenticated
        // JSON to say who the user is.
        let document = br#"{"licensee":"Someone","reference":"X"}"#;
        let status = verify_licence(document, "not-a-signature");
        assert_ne!(status.verdict, Verdict::Verified);
    }

    #[test]
    fn usage_starts_absent_and_counts_up() {
        let path = temp_file("count");
        assert!(read_usage(&path).is_none());

        let first = note_launch(&path).expect("write");
        assert_eq!(first.launches, 1);
        let second = note_launch(&path).expect("write");
        assert_eq!(second.launches, 2);

        assert_eq!(read_usage(&path).map(|u| u.launches), Some(2));
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn an_edited_record_does_not_authenticate() {
        // The threat to a usage counter is rewinding it, not reading it.
        let path = temp_file("tamper");
        note_launch(&path).expect("write");
        note_launch(&path).expect("write");

        let raw = fs::read_to_string(&path).expect("read");
        let (body, tag) = raw.rsplit_once('\n').expect("shape");
        let rewound = body.replace("\"launches\":2", "\"launches\":0");
        assert_ne!(rewound, body, "the fixture must actually change something");
        fs::write(&path, format!("{rewound}\n{tag}")).expect("write");

        assert!(
            read_usage(&path).is_none(),
            "a rewound counter must not read back as valid"
        );
        let _ = fs::remove_file(&path);
    }

    #[test]
    fn a_truncated_record_is_rejected_rather_than_panicking() {
        let path = temp_file("truncated");
        fs::write(&path, "not-json-and-no-newline").expect("write");
        assert!(read_usage(&path).is_none());
        let _ = fs::remove_file(&path);
    }
}
