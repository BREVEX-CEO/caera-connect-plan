//! The loopback listener the desktop companion answers on.
//!
//! WHY THIS IS HERE AND NOT IN THE TAURI CRATE. The Tauri binary cannot be
//! built without GTK and WebKit present, so anything living there is code that
//! ships untested on a machine that has neither. Everything in this file is
//! `std` only — a TCP listener, HTTP/1.1 parsing, files — so the desktop half
//! of the companion can be started for real, driven over a real socket, and
//! checked, by `cargo test`.
//!
//! The one thing `std` cannot do is HTTPS, so fetching is a TRAIT. The Tauri
//! crate implements it with a real client; the tests implement it with a fake
//! that can be made to fail on demand, which is how the source ladder gets
//! exercised without a network.
//!
//! WHY IT BINDS LOOPBACK AND NOTHING ELSE. A LAN address is reachable by every
//! other machine on the network. `127.0.0.1` is reachable only by processes on
//! this one — which is not authentication, and the website knows it: the real
//! defence is that whatever this host prepares is held to its published digest
//! before the website activates anything.

use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use crate::model_host::{
    identity_json, progress_json, route, JobRegistry, Phase, PrepareRefusal, PrepareRequest, Route,
    PORT,
};

/// How a transfer actually moves bytes. Injected so this file needs no TLS.
pub trait Fetcher: Send + Sync {
    /// Fetch `url` into `destination`, continuing from `resume_from`.
    ///
    /// Implementations MUST send a `Range` header when `resume_from` is
    /// non-zero and append rather than truncate; a fetcher that started over
    /// silently would undo the resumability the whole handoff is for.
    fn fetch(&self, url: &str, destination: &Path, resume_from: u64) -> Result<Vec<u8>, String>;
}

/// Everything the host needs that is not a rule.
pub struct ModelHost {
    pub registry: Mutex<JobRegistry>,
    pub fetcher: Arc<dyn Fetcher>,
    /// One directory, so uninstall can be complete without guessing at names.
    pub directory: PathBuf,
    pub platform: &'static str,
}

/// A reply, before it is written to a socket.
pub struct Reply {
    pub status: u16,
    pub body: String,
}

impl Reply {
    fn ok(body: impl Into<String>) -> Self {
        Reply {
            status: 200,
            body: body.into(),
        }
    }
    fn error(status: u16, message: &str) -> Self {
        Reply {
            status,
            body: format!("{{\"message\":\"{}\"}}", message),
        }
    }
}

impl ModelHost {
    pub fn new(fetcher: Arc<dyn Fetcher>, directory: PathBuf, platform: &'static str) -> Self {
        ModelHost {
            registry: Mutex::new(JobRegistry::new()),
            fetcher,
            directory,
            platform,
        }
    }

    fn artifact(&self, version: &str) -> PathBuf {
        // The version is a catalogue identifier rather than user input — but a
        // separator in it would still escape this directory, so it is
        // flattened rather than trusted.
        let safe: String = version
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || c == '-' || c == '.' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        self.directory.join(format!("{safe}.gguf"))
    }

    /// Answer one request. Pure apart from the filesystem, so it is testable.
    pub fn handle(&self, method: &str, path: &str, body: &str) -> Reply {
        match route(method, path) {
            Route::Identity => Reply::ok(identity_json(self.platform, true)),

            Route::Prepare => {
                let request = match parse_prepare(body) {
                    Ok(request) => request,
                    Err(message) => return Reply::error(400, message),
                };
                let mut registry = self.registry();
                match registry.prepare(request) {
                    Ok(id) => Reply::ok(format!("{{\"jobId\":\"{id}\"}}")),
                    Err(PrepareRefusal::Protocol(_)) => {
                        Reply::error(400, "this companion speaks a different protocol")
                    }
                    Err(PrepareRefusal::Incomplete(field)) => {
                        Reply::error(400, &format!("prepare is missing {field}"))
                    }
                    Err(PrepareRefusal::UnusableSource(_)) => {
                        Reply::error(400, "a source was not a usable address")
                    }
                }
            }

            Route::Progress(id) => {
                let registry = self.registry();
                match registry.get(&id) {
                    Some(job) => {
                        let url = if job.phase == Phase::Complete {
                            Some(format!("file://{}", self.artifact(&job.version).display()))
                        } else {
                            None
                        };
                        Reply::ok(progress_json(job, url.as_deref()))
                    }
                    // An unknown job is idle rather than an error: the website
                    // asks about jobs it remembers across reloads, and a 404
                    // there would read as a failure rather than as "gone".
                    None => Reply::ok(
                        "{\"phase\":\"idle\",\"version\":\"\",\"receivedBytes\":0,\"totalBytes\":null}",
                    ),
                }
            }

            Route::Cancel(id) => {
                let mut registry = self.registry();
                if registry.cancel(&id) {
                    Reply::ok("{\"ok\":true}")
                } else {
                    Reply::error(404, "no such job")
                }
            }

            Route::Uninstall => {
                let mut registry = self.registry();
                for id in registry.ids() {
                    registry.cancel(&id);
                }
                registry.clear();
                drop(registry);

                /*
                 * Only the model directory. "Remove OCADE Intelligence" and
                 * "delete my account" are different requests, so conversations
                 * and every other store this companion keeps are untouched.
                 */
                let removed = match fs::remove_dir_all(&self.directory) {
                    Ok(()) => true,
                    // Nothing to remove is a successful removal; anything else
                    // is reported honestly so the website does not claim a
                    // deletion that did not happen.
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound => true,
                    Err(_) => false,
                };
                if removed {
                    Reply::ok("{\"ok\":true}")
                } else {
                    Reply::error(500, "the model files could not be removed")
                }
            }

            Route::Unknown => Reply::error(404, "no such endpoint"),
        }
    }

    /// The registry, surviving a panic in another thread.
    ///
    /// A poisoned lock must not take the companion down: the website is waiting
    /// on it, and refusing every later request would be a worse outcome than
    /// carrying on with state that is structurally intact.
    fn registry(&self) -> std::sync::MutexGuard<'_, JobRegistry> {
        match self.registry.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        }
    }

    /// Run one job to completion, working the ladder in order.
    ///
    /// Called on a worker thread by the shell. Returns when the job reaches a
    /// terminal phase.
    pub fn run_job(&self, id: &str) {
        loop {
            let (version, source, resume_from) = {
                let registry = self.registry();
                let Some(job) = registry.get(id) else { return };
                if job.phase != Phase::Downloading {
                    return;
                }
                let Some(source) = job.current_source() else {
                    return;
                };
                (job.version.clone(), source.to_string(), job.received_bytes)
            };

            let destination = self.artifact(&version);
            if let Some(parent) = destination.parent() {
                let _ = fs::create_dir_all(parent);
            }

            match self.fetcher.fetch(&source, &destination, resume_from) {
                Ok(digest) => {
                    let bytes = fs::metadata(&destination).map(|m| m.len()).unwrap_or(0);
                    let hex: String = digest.iter().map(|b| format!("{b:02x}")).collect();
                    self.registry().complete(id, hex, bytes);
                    return;
                }
                Err(_) => {
                    let mut registry = self.registry();
                    let Some(job) = registry.get_mut(id) else {
                        return;
                    };
                    // Exhausting the ladder sets Failed and a reason; carrying
                    // on sets Downloading against the next source.
                    if !job.advance_source() {
                        return;
                    }
                }
            }
        }
    }
}

/// Bind the companion's port on loopback. Never on an interface.
pub fn bind(port: u16) -> std::io::Result<TcpListener> {
    TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, port)))
}

/// The default port, for a shell that has no reason to choose another.
pub fn bind_default() -> std::io::Result<TcpListener> {
    bind(PORT)
}

/// Serve until the listener is closed. One connection at a time is enough: the
/// website makes a handful of short requests and polls progress.
pub fn serve(listener: &TcpListener, host: &ModelHost) {
    for stream in listener.incoming() {
        match stream {
            Ok(stream) => {
                let _ = answer(stream, host);
            }
            Err(_) => return,
        }
    }
}

/// Read one request, answer it, close.
pub fn answer(mut stream: TcpStream, host: &ModelHost) -> std::io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);

    let mut request_line = String::new();
    if reader.read_line(&mut request_line)? == 0 {
        return Ok(());
    }
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let path = parts.next().unwrap_or("").to_string();

    let mut length = 0usize;
    loop {
        let mut header = String::new();
        if reader.read_line(&mut header)? == 0 {
            break;
        }
        let header = header.trim_end();
        if header.is_empty() {
            break;
        }
        if let Some(value) = header.to_ascii_lowercase().strip_prefix("content-length:") {
            length = value.trim().parse().unwrap_or(0);
        }
    }

    /*
     * A bounded read. An unbounded one would let any local process hold this
     * companion open with an endless body — and the browser is waiting on a
     * probe that sits in front of first paint.
     */
    const MAX_BODY: usize = 64 * 1024;
    let mut body = vec![0u8; length.min(MAX_BODY)];
    if !body.is_empty() {
        reader.read_exact(&mut body)?;
    }
    let body = String::from_utf8_lossy(&body).into_owned();

    let reply = if method == "OPTIONS" {
        Reply {
            status: 204,
            body: String::new(),
        }
    } else {
        host.handle(&method, &path, &body)
    };

    let response = format!(
        "HTTP/1.1 {} {}\r\n\
         content-type: application/json\r\n\
         content-length: {}\r\n\
         cache-control: no-store\r\n\
         access-control-allow-origin: *\r\n\
         access-control-allow-headers: content-type, x-ocade-client, x-ocade-protocol, x-ocade-pairing\r\n\
         access-control-allow-methods: GET, POST, OPTIONS\r\n\
         connection: close\r\n\r\n{}",
        reply.status,
        reason_phrase(reply.status),
        reply.body.len(),
        reply.body
    );
    stream.write_all(response.as_bytes())?;
    stream.flush()
}

fn reason_phrase(status: u16) -> &'static str {
    match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        404 => "Not Found",
        500 => "Internal Server Error",
        _ => "OK",
    }
}

/// Read the fields `prepare` needs out of a JSON body.
///
/// Hand-written because this crate is dependency-free by design and the shape
/// is fixed by the protocol document: four fields, no nesting beyond one array
/// of strings.
fn parse_prepare(body: &str) -> Result<PrepareRequest, &'static str> {
    let version = json_string(body, "version").ok_or("prepare is missing version")?;
    let sha256 = json_string(body, "sha256").ok_or("prepare is missing sha256")?;
    let total_bytes = json_number(body, "totalBytes");
    let sources = json_string_array(body, "sources").ok_or("prepare is missing sources")?;
    Ok(PrepareRequest {
        version,
        sha256,
        total_bytes,
        sources,
    })
}

fn field_start(body: &str, key: &str) -> Option<usize> {
    let needle = format!("\"{key}\"");
    let at = body.find(&needle)? + needle.len();
    let rest = &body[at..];
    let colon = rest.find(':')? + 1;
    Some(at + colon)
}

fn json_string(body: &str, key: &str) -> Option<String> {
    let start = field_start(body, key)?;
    let rest = body[start..].trim_start();
    let rest = rest.strip_prefix('"')?;
    let mut out = String::new();
    let mut characters = rest.chars();
    while let Some(character) = characters.next() {
        match character {
            '"' => return Some(out),
            '\\' => match characters.next()? {
                'n' => out.push('\n'),
                't' => out.push('\t'),
                'r' => out.push('\r'),
                other => out.push(other),
            },
            other => out.push(other),
        }
    }
    None
}

fn json_number(body: &str, key: &str) -> Option<u64> {
    let start = field_start(body, key)?;
    let rest = body[start..].trim_start();
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse().ok()
}

fn json_string_array(body: &str, key: &str) -> Option<Vec<String>> {
    let start = field_start(body, key)?;
    let rest = body[start..].trim_start();
    let rest = rest.strip_prefix('[')?;
    let end = rest.find(']')?;
    let inside = &rest[..end];
    let mut out = Vec::new();
    let mut remaining = inside;
    while let Some(open) = remaining.find('"') {
        let after = &remaining[open + 1..];
        let close = after.find('"')?;
        out.push(after[..close].to_string());
        remaining = &after[close + 1..];
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// A fetcher with no network: it writes bytes, or fails on demand.
    struct FakeFetcher {
        fail_first: usize,
        attempts: AtomicUsize,
        payload: Vec<u8>,
    }

    impl Fetcher for FakeFetcher {
        fn fetch(&self, _url: &str, destination: &Path, _resume: u64) -> Result<Vec<u8>, String> {
            let attempt = self.attempts.fetch_add(1, Ordering::SeqCst);
            if attempt < self.fail_first {
                return Err("that source refused".into());
            }
            let mut file = fs::File::create(destination).map_err(|e| e.to_string())?;
            file.write_all(&self.payload).map_err(|e| e.to_string())?;
            // A stand-in digest: what matters to these tests is that a digest
            // appears only once the artifact is whole, not what it hashes to.
            Ok(vec![0xab, 0xcd])
        }
    }

    fn host(tag: &str, fail_first: usize) -> (ModelHost, PathBuf) {
        let directory =
            std::env::temp_dir().join(format!("ocade-host-{}-{tag}", std::process::id()));
        let _ = fs::remove_dir_all(&directory);
        let fetcher = Arc::new(FakeFetcher {
            fail_first,
            attempts: AtomicUsize::new(0),
            payload: b"weights".to_vec(),
        });
        (
            ModelHost::new(fetcher, directory.clone(), "linux"),
            directory,
        )
    }

    const PREPARE: &str = r#"{"protocol":1,"version":"engine-v1","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","totalBytes":7,"sources":["https://one.example/a.gguf","https://two.example/a.gguf"]}"#;

    #[test]
    fn a_prepare_body_is_read_the_way_the_protocol_writes_it() {
        let request = parse_prepare(PREPARE).unwrap();
        assert_eq!(request.version, "engine-v1");
        assert_eq!(request.total_bytes, Some(7));
        assert_eq!(request.sources.len(), 2);
        assert_eq!(request.sources[1], "https://two.example/a.gguf");
    }

    #[test]
    fn the_whole_journey_runs_over_a_real_socket() {
        let (host_value, directory) = host("socket", 0);
        let host_value = Arc::new(host_value);
        let listener = bind(0).expect("loopback must be bindable");
        let port = listener.local_addr().unwrap().port();

        let serving = Arc::clone(&host_value);
        std::thread::spawn(move || {
            for _ in 0..6 {
                match listener.accept() {
                    Ok((stream, _)) => {
                        let _ = answer(stream, &serving);
                    }
                    Err(_) => return,
                }
            }
        });

        let call = |method: &str, path: &str, body: &str| -> String {
            let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
            let request = format!(
                "{method} {path} HTTP/1.1\r\nhost: 127.0.0.1\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(request.as_bytes()).unwrap();
            let mut response = String::new();
            stream.read_to_string(&mut response).unwrap();
            response
        };

        let identity = call("GET", "/ocade/companion/identity", "");
        assert!(
            identity.contains("\"product\":\"ocade-companion\""),
            "{identity}"
        );

        let prepared = call("POST", "/ocade/companion/prepare", PREPARE);
        assert!(prepared.contains("jobId"), "{prepared}");

        // Rule 1, over the wire: asking twice must not start a second transfer.
        let again = call("POST", "/ocade/companion/prepare", PREPARE);
        let id_of = |response: &str| json_string(response, "jobId").unwrap();
        assert_eq!(id_of(&prepared), id_of(&again));

        let id = id_of(&prepared);
        let encoded = id.replace(':', "%3A");
        let progress = call("GET", &format!("/ocade/companion/progress/{encoded}"), "");
        assert!(progress.contains("\"phase\":\"downloading\""), "{progress}");
        assert!(
            !progress.contains("sha256"),
            "no digest before it is whole: {progress}"
        );

        host_value.run_job(&id);
        let done = call("GET", &format!("/ocade/companion/progress/{encoded}"), "");
        assert!(done.contains("\"phase\":\"complete\""), "{done}");
        assert!(done.contains("\"sha256\":\"abcd\""), "{done}");
        assert!(done.contains("artifactUrl"), "{done}");

        let _ = fs::remove_dir_all(&directory);
    }

    #[test]
    fn a_failing_source_falls_over_to_the_next_one() {
        let (host_value, directory) = host("failover", 1);
        let reply = host_value.handle("POST", "/ocade/companion/prepare", PREPARE);
        let id = json_string(&reply.body, "jobId").unwrap();

        host_value.run_job(&id);

        let registry = host_value.registry();
        let job = registry.get(&id).unwrap();
        assert_eq!(
            job.phase,
            Phase::Complete,
            "the second source must be tried"
        );
        assert_eq!(job.source_index, 1, "and it must be the website's next one");
        drop(registry);
        let _ = fs::remove_dir_all(&directory);
    }

    #[test]
    fn an_exhausted_ladder_fails_rather_than_looping() {
        let (host_value, directory) = host("exhausted", 99);
        let reply = host_value.handle("POST", "/ocade/companion/prepare", PREPARE);
        let id = json_string(&reply.body, "jobId").unwrap();

        host_value.run_job(&id);

        let registry = host_value.registry();
        let job = registry.get(&id).unwrap();
        assert_eq!(job.phase, Phase::Failed);
        assert!(job.reason.is_some());
        drop(registry);
        let _ = fs::remove_dir_all(&directory);
    }

    #[test]
    fn uninstall_removes_the_model_directory_and_says_so() {
        let (host_value, directory) = host("uninstall", 0);
        let reply = host_value.handle("POST", "/ocade/companion/prepare", PREPARE);
        let id = json_string(&reply.body, "jobId").unwrap();
        host_value.run_job(&id);
        assert!(directory.exists(), "the artifact must have been written");

        let removed = host_value.handle("POST", "/ocade/companion/uninstall", "");
        assert_eq!(removed.status, 200);
        assert!(removed.body.contains("\"ok\":true"));
        assert!(!directory.exists(), "the bytes must actually be gone");
        assert!(host_value.registry().is_empty());

        // Removing again is still a successful removal: there is nothing left.
        let twice = host_value.handle("POST", "/ocade/companion/uninstall", "");
        assert_eq!(twice.status, 200);
    }

    #[test]
    fn a_version_cannot_escape_the_model_directory() {
        let (host_value, directory) = host("escape", 0);
        let escaping = host_value.artifact("../../etc/passwd");
        assert!(
            escaping.starts_with(&directory),
            "a separator in a version must not reach outside: {escaping:?}"
        );
    }

    #[test]
    fn an_unknown_endpoint_is_refused_rather_than_guessed_at() {
        let (host_value, _directory) = host("unknown", 0);
        assert_eq!(host_value.handle("GET", "/", "").status, 404);
        assert_eq!(
            host_value
                .handle("GET", "/ocade/companion/prepare", "")
                .status,
            404
        );
    }
}
