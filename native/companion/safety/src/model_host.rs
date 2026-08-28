//! The background-companion protocol, as rules rather than as plumbing.
//!
//! WHY THIS LIVES IN THE SAFETY CRATE. Everything here decides whether a model
//! transfer may start, continue, be believed, or be deleted — and those are the
//! decisions a bug in makes the website's four rules untrue. The crate is
//! dependency-free and builds without a network or a GUI toolchain, so the
//! rules can be tested on their own instead of only inside a Tauri binary that
//! needs GTK and WebKit present to link.
//!
//! WHAT IS HERE AND WHAT IS NOT. Here: parsing a loopback request, routing it,
//! the job registry, the state machine, working the website's source ladder in
//! order, and refusing to report a digest for an artifact that is not finished.
//! Not here: sockets, TLS, threads, the filesystem. `model_host.rs` in the
//! Tauri crate supplies those and calls into this.
//!
//! THE FOUR RULES, RESTATED AS CODE OBLIGATIONS
//!
//! 1. One transfer per version, ever. `prepare` for a version already in flight
//!    returns the EXISTING job, so the browser and the companion — and two
//!    calls from the same browser — can never move the same bytes twice.
//! 2. One canonical identity. A job carries the version, digest and byte count
//!    the website named; nothing here invents or substitutes any of them.
//! 3. Verification belongs to the website. `progress` reports a digest only
//!    once the artifact is complete and hashed, because a digest reported early
//!    is compared against the published one and rejected — turning a working
//!    transfer into a failed handoff.
//! 4. Uninstall must be answerable. `uninstall` reports whether removal
//!    actually happened, so the website can decline to claim one that did not.

use std::collections::BTreeMap;

/// The protocol version this host speaks. Anything else the website refuses.
pub const PROTOCOL: u32 = 1;

/// Where the companion listens. Loopback only — never a LAN address, because a
/// LAN address is reachable by every other machine on the network.
pub const PORT: u16 = 11801;

/// What a job is doing, in the vocabulary the protocol document fixes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Phase {
    Idle,
    Downloading,
    Verifying,
    Complete,
    Failed,
    Cancelled,
}

impl Phase {
    pub fn as_str(self) -> &'static str {
        match self {
            Phase::Idle => "idle",
            Phase::Downloading => "downloading",
            Phase::Verifying => "verifying",
            Phase::Complete => "complete",
            Phase::Failed => "failed",
            Phase::Cancelled => "cancelled",
        }
    }
}

/// One transfer, and everything needed to resume or fail it over.
#[derive(Debug, Clone)]
pub struct Job {
    pub id: String,
    pub version: String,
    pub sha256: String,
    pub total_bytes: Option<u64>,
    /// The website's ordered ladder, worked in order and never substituted.
    pub sources: Vec<String>,
    pub source_index: usize,
    pub received_bytes: u64,
    pub phase: Phase,
    /// Set only once the artifact is whole and has been hashed.
    pub digest: Option<String>,
    pub reason: Option<String>,
}

impl Job {
    /// The source this job should be pulling from right now.
    pub fn current_source(&self) -> Option<&str> {
        self.sources.get(self.source_index).map(String::as_str)
    }

    /// Move to the next source after a failure.
    ///
    /// Returns false once the ladder is exhausted, which is the honest end of a
    /// transfer rather than a silent stall. A caller that kept retrying the
    /// last source would leave the website waiting on a job that can never
    /// progress.
    pub fn advance_source(&mut self) -> bool {
        if self.source_index + 1 >= self.sources.len() {
            self.phase = Phase::Failed;
            self.reason = Some("every source in the ladder failed".into());
            return false;
        }
        self.source_index += 1;
        self.received_bytes = 0;
        self.phase = Phase::Downloading;
        self.reason = None;
        true
    }
}

/// What the website asked for, once it has been checked.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PrepareRequest {
    pub version: String,
    pub sha256: String,
    pub total_bytes: Option<u64>,
    pub sources: Vec<String>,
}

/// Why a `prepare` was refused. Each is a rule, not a parse failure.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PrepareRefusal {
    /// A protocol this build does not speak. Refused rather than negotiated.
    Protocol(u32),
    /// Missing version, digest or ladder — nothing that could be verified later.
    Incomplete(&'static str),
    /// A source that is not an absolute http(s) URL.
    UnusableSource(String),
}

/// The jobs this companion is running. One owner, so rule 1 is structural.
#[derive(Debug, Default)]
pub struct JobRegistry {
    jobs: BTreeMap<String, Job>,
    next: u64,
}

impl JobRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get(&self, id: &str) -> Option<&Job> {
        self.jobs.get(id)
    }

    pub fn get_mut(&mut self, id: &str) -> Option<&mut Job> {
        self.jobs.get_mut(id)
    }

    pub fn len(&self) -> usize {
        self.jobs.len()
    }

    pub fn is_empty(&self) -> bool {
        self.jobs.is_empty()
    }

    /// Every job, for a shell that needs to cancel them all.
    pub fn ids(&self) -> Vec<String> {
        self.jobs.keys().cloned().collect()
    }

    /// The live job for a version, if there is one.
    ///
    /// A job that has failed or been cancelled is deliberately NOT live: the
    /// website is entitled to ask again after a failure, and answering with the
    /// dead job's id would strand it watching something that will never move.
    pub fn live_for_version(&self, version: &str) -> Option<&Job> {
        self.jobs.values().find(|job| {
            job.version == version && !matches!(job.phase, Phase::Failed | Phase::Cancelled)
        })
    }

    /// Start a transfer, or hand back the one already running for this version.
    ///
    /// RULE 1 LIVES HERE. Returning a fresh id for a version already in flight
    /// is exactly the two-downloads defect the protocol forbids, and it is the
    /// easiest one to introduce by accident — a browser that reloads mid-
    /// transfer asks again, and a registry that answered honestly each time
    /// would double the bytes on the wire.
    pub fn prepare(&mut self, request: PrepareRequest) -> Result<String, PrepareRefusal> {
        if request.version.is_empty() {
            return Err(PrepareRefusal::Incomplete("version"));
        }
        if request.sha256.len() != 64 || !request.sha256.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(PrepareRefusal::Incomplete("sha256"));
        }
        if request.sources.is_empty() {
            return Err(PrepareRefusal::Incomplete("sources"));
        }
        for source in &request.sources {
            if !(source.starts_with("https://") || source.starts_with("http://")) {
                return Err(PrepareRefusal::UnusableSource(source.clone()));
            }
        }

        if let Some(existing) = self.live_for_version(&request.version) {
            return Ok(existing.id.clone());
        }

        self.next += 1;
        let id = format!("{}:{}", request.version, self.next);
        self.jobs.insert(
            id.clone(),
            Job {
                id: id.clone(),
                version: request.version,
                sha256: request.sha256.to_ascii_lowercase(),
                total_bytes: request.total_bytes,
                sources: request.sources,
                source_index: 0,
                received_bytes: 0,
                phase: Phase::Downloading,
                digest: None,
                reason: None,
            },
        );
        Ok(id)
    }

    /// Stop a job, keeping whatever is on disk resumable.
    pub fn cancel(&mut self, id: &str) -> bool {
        match self.jobs.get_mut(id) {
            Some(job) => {
                job.phase = Phase::Cancelled;
                true
            }
            None => false,
        }
    }

    /// Forget everything. The caller deletes the bytes; this forgets the jobs.
    pub fn clear(&mut self) {
        self.jobs.clear();
    }

    /// Record that an artifact finished and was hashed.
    ///
    /// RULE 3 LIVES HERE. The digest is stored only alongside `Complete`, so
    /// there is no state in which `progress` can report one for a transfer that
    /// is still moving. The website compares it with the published digest; a
    /// mismatch is its refusal to make, not this host's to hide.
    pub fn complete(&mut self, id: &str, digest: String, bytes: u64) -> bool {
        match self.jobs.get_mut(id) {
            Some(job) => {
                job.phase = Phase::Complete;
                job.digest = Some(digest.to_ascii_lowercase());
                job.received_bytes = bytes;
                true
            }
            None => false,
        }
    }

    pub fn fail(&mut self, id: &str, reason: impl Into<String>) -> bool {
        match self.jobs.get_mut(id) {
            Some(job) => {
                job.phase = Phase::Failed;
                job.reason = Some(reason.into());
                true
            }
            None => false,
        }
    }
}

/// The endpoints, as the protocol document names them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Route {
    Identity,
    Prepare,
    Progress(String),
    Cancel(String),
    Uninstall,
    /// Anything else. Answered 404 rather than guessed at.
    Unknown,
}

/// Route a request, method included.
///
/// The method is part of the match on purpose: answering `GET /prepare` would
/// let a page on any origin start a gigabyte transfer with an image tag, and no
/// preflight would ever be sent to stop it.
pub fn route(method: &str, path: &str) -> Route {
    let path = path.split('?').next().unwrap_or(path);
    match (method, path) {
        ("GET", "/ocade/companion/identity") => Route::Identity,
        ("POST", "/ocade/companion/prepare") => Route::Prepare,
        ("POST", "/ocade/companion/uninstall") => Route::Uninstall,
        _ => {
            if let Some(rest) = path.strip_prefix("/ocade/companion/progress/") {
                if method == "GET" && !rest.is_empty() {
                    return Route::Progress(decode(rest));
                }
            }
            if let Some(rest) = path.strip_prefix("/ocade/companion/cancel/") {
                if method == "POST" && !rest.is_empty() {
                    return Route::Cancel(decode(rest));
                }
            }
            Route::Unknown
        }
    }
}

/// Percent-decoding, because a job id contains a colon.
fn decode(raw: &str) -> String {
    let bytes = raw.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[index + 1..index + 3]).unwrap_or("");
            if let Ok(value) = u8::from_str_radix(hex, 16) {
                out.push(value);
                index += 3;
                continue;
            }
        }
        out.push(bytes[index]);
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// The JSON this host answers `identity` with.
pub fn identity_json(platform: &str, background_transfer: bool) -> String {
    format!(
        "{{\"product\":\"ocade-companion\",\"protocol\":{},\"platform\":\"{}\",\"backgroundTransfer\":{}}}",
        PROTOCOL,
        escape(platform),
        background_transfer
    )
}

/// The JSON this host answers `progress` with.
///
/// `sha256` and `artifactUrl` appear only for a complete job — see rule 3.
pub fn progress_json(job: &Job, artifact_url: Option<&str>) -> String {
    let mut out = format!(
        "{{\"phase\":\"{}\",\"version\":\"{}\",\"receivedBytes\":{}",
        job.phase.as_str(),
        escape(&job.version),
        job.received_bytes
    );
    match job.total_bytes {
        Some(total) => out.push_str(&format!(",\"totalBytes\":{}", total)),
        None => out.push_str(",\"totalBytes\":null"),
    }
    if job.phase == Phase::Complete {
        if let Some(digest) = &job.digest {
            out.push_str(&format!(",\"sha256\":\"{}\"", escape(digest)));
        }
        if let Some(url) = artifact_url {
            out.push_str(&format!(",\"artifactUrl\":\"{}\"", escape(url)));
        }
    }
    if let Some(reason) = &job.reason {
        out.push_str(&format!(",\"reason\":\"{}\"", escape(reason)));
    }
    out.push('}');
    out
}

/// Minimal JSON string escaping. The values here are ids, versions and short
/// diagnostics, never arbitrary user text — but a version with a quote in it
/// must still produce valid JSON rather than a broken response.
fn escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> PrepareRequest {
        PrepareRequest {
            version: "engine-v1".into(),
            sha256: "a".repeat(64),
            total_bytes: Some(1000),
            sources: vec!["https://models.ocade.in/a.gguf".into()],
        }
    }

    #[test]
    fn rule_1_a_version_already_in_flight_returns_the_same_job() {
        let mut registry = JobRegistry::new();
        let first = registry.prepare(request()).unwrap();
        let second = registry.prepare(request()).unwrap();
        assert_eq!(
            first, second,
            "a second prepare must not start a second transfer"
        );
        assert_eq!(registry.len(), 1);
    }

    #[test]
    fn rule_1_a_failed_job_does_not_block_a_fresh_attempt() {
        // The website is entitled to ask again after a failure. Handing back a
        // dead job's id would strand it watching something that cannot move.
        let mut registry = JobRegistry::new();
        let first = registry.prepare(request()).unwrap();
        registry.fail(&first, "the source went away");
        let second = registry.prepare(request()).unwrap();
        assert_ne!(first, second);
    }

    #[test]
    fn rule_2_a_job_without_a_verifiable_identity_is_refused() {
        let mut registry = JobRegistry::new();
        for (broken, field) in [
            (
                PrepareRequest {
                    version: String::new(),
                    ..request()
                },
                "version",
            ),
            (
                PrepareRequest {
                    sha256: "short".into(),
                    ..request()
                },
                "sha256",
            ),
            (
                PrepareRequest {
                    sha256: "z".repeat(64),
                    ..request()
                },
                "sha256",
            ),
            (
                PrepareRequest {
                    sources: vec![],
                    ..request()
                },
                "sources",
            ),
        ] {
            assert_eq!(
                registry.prepare(broken),
                Err(PrepareRefusal::Incomplete(field)),
                "a job that could never be verified must not start"
            );
        }
    }

    #[test]
    fn rule_2_a_source_that_is_not_a_url_is_refused() {
        let mut registry = JobRegistry::new();
        let broken = PrepareRequest {
            sources: vec!["file:///etc/passwd".into()],
            ..request()
        };
        assert!(matches!(
            registry.prepare(broken),
            Err(PrepareRefusal::UnusableSource(_))
        ));
    }

    #[test]
    fn rule_3_no_digest_is_reported_until_the_artifact_is_whole() {
        let mut registry = JobRegistry::new();
        let id = registry.prepare(request()).unwrap();

        let downloading = progress_json(registry.get(&id).unwrap(), None);
        assert!(!downloading.contains("sha256"), "{downloading}");

        registry.complete(&id, "B".repeat(64), 1000);
        let done = progress_json(registry.get(&id).unwrap(), Some("file:///tmp/a.gguf"));
        assert!(
            done.contains(&"b".repeat(64)),
            "the digest is normalised and reported once whole"
        );
        assert!(done.contains("artifactUrl"));
    }

    #[test]
    fn the_ladder_is_worked_in_order_and_ends_honestly() {
        let mut registry = JobRegistry::new();
        let id = registry
            .prepare(PrepareRequest {
                sources: vec![
                    "https://one.example/a.gguf".into(),
                    "https://two.example/a.gguf".into(),
                ],
                ..request()
            })
            .unwrap();

        let job = registry.get_mut(&id).unwrap();
        assert_eq!(job.current_source(), Some("https://one.example/a.gguf"));
        assert!(job.advance_source());
        assert_eq!(job.current_source(), Some("https://two.example/a.gguf"));
        assert!(!job.advance_source(), "the ladder ends rather than looping");
        assert_eq!(job.phase, Phase::Failed);
        assert!(job.reason.is_some(), "a stalled job must say why");
    }

    #[test]
    fn routing_requires_the_right_method() {
        assert_eq!(route("GET", "/ocade/companion/identity"), Route::Identity);
        assert_eq!(route("POST", "/ocade/companion/prepare"), Route::Prepare);
        // A GET that started a transfer could be triggered by an image tag on
        // any page, with no preflight to stop it.
        assert_eq!(route("GET", "/ocade/companion/prepare"), Route::Unknown);
        assert_eq!(route("GET", "/ocade/companion/cancel/a:1"), Route::Unknown);
        assert_eq!(
            route("GET", "/ocade/companion/progress/engine-v1%3A1"),
            Route::Progress("engine-v1:1".into())
        );
        assert_eq!(
            route("POST", "/ocade/companion/cancel/engine-v1%3A1?x=1"),
            Route::Cancel("engine-v1:1".into())
        );
        assert_eq!(route("GET", "/"), Route::Unknown);
        assert_eq!(route("POST", "/ocade/companion/progress/"), Route::Unknown);
    }

    #[test]
    fn identity_names_the_protocol_this_build_speaks() {
        let json = identity_json("linux", true);
        assert!(json.contains("\"product\":\"ocade-companion\""));
        assert!(json.contains(&format!("\"protocol\":{PROTOCOL}")));
        assert!(json.contains("\"backgroundTransfer\":true"));
    }

    #[test]
    fn a_version_with_a_quote_in_it_still_produces_valid_json() {
        let mut registry = JobRegistry::new();
        let id = registry
            .prepare(PrepareRequest {
                version: "a\"b".into(),
                ..request()
            })
            .unwrap();
        let json = progress_json(registry.get(&id).unwrap(), None);
        assert!(json.contains("a\\\"b"), "{json}");
    }

    #[test]
    fn cancelling_frees_the_version_for_a_later_attempt() {
        let mut registry = JobRegistry::new();
        let first = registry.prepare(request()).unwrap();
        assert!(registry.cancel(&first));
        assert_eq!(registry.get(&first).unwrap().phase, Phase::Cancelled);
        let second = registry.prepare(request()).unwrap();
        assert_ne!(first, second);
    }
}
