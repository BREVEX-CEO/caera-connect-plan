//! Supervision for the self-contained Playwright/CDP sidecar.
//!
//! The sidecar has no listener. This module is its only parent and speaks
//! bounded NDJSON over inherited stdin/stdout pipes.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;

const MAX_REQUEST_BYTES: usize = 256 * 1024;
const MAX_REPLY_BYTES: usize = 4 * 1024 * 1024;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(45);
const PYTHON_REQUEST_TIMEOUT: Duration = Duration::from_secs(300);
const PYTHON_GESTURE_TIMEOUT: Duration = Duration::from_secs(3_600);
const STOP_TIMEOUT: Duration = Duration::from_secs(5);

struct BrowserProcess {
    child: Arc<Mutex<Child>>,
    stdin: Arc<Mutex<ChildStdin>>,
}

type PendingReply = Result<Value, String>;

#[derive(Clone, Copy, PartialEq, Eq)]
enum HostKind {
    Browser,
    Python,
}

pub struct BrowserHostSupervisor {
    kind: HostKind,
    executable: Mutex<Option<PathBuf>>,
    process: Mutex<Option<BrowserProcess>>,
    pending: Arc<Mutex<HashMap<u64, mpsc::Sender<PendingReply>>>>,
    next_id: AtomicU64,
}

impl Default for BrowserHostSupervisor {
    fn default() -> Self {
        Self {
            kind: HostKind::Browser,
            executable: Mutex::new(None),
            process: Mutex::new(None),
            pending: Arc::new(Mutex::new(HashMap::new())),
            next_id: AtomicU64::new(1),
        }
    }
}

impl BrowserHostSupervisor {
    pub fn python() -> Self {
        Self {
            kind: HostKind::Python,
            ..Self::default()
        }
    }

    pub fn configure(&self, executable: Option<PathBuf>) {
        if let Ok(mut configured) = self.executable.lock() {
            *configured = executable.filter(|path| path.is_file());
        }
    }

    pub fn available(&self) -> bool {
        self.executable
            .lock()
            .ok()
            .and_then(|path| path.clone())
            .is_some_and(|path| path.is_file())
    }

    fn ensure_started(&self) -> Result<Arc<Mutex<ChildStdin>>, String> {
        let mut slot = self
            .process
            .lock()
            .map_err(|_| "The managed browser supervisor is busy.".to_string())?;
        if let Some(process) = slot.as_mut() {
            let running = process
                .child
                .lock()
                .map_err(|_| "The managed browser process is busy.".to_string())?
                .try_wait()
                .map_err(|_| "The managed browser process could not be inspected.".to_string())?
                .is_none();
            if running {
                return Ok(process.stdin.clone());
            }
            *slot = None;
        }

        let executable = self
            .executable
            .lock()
            .map_err(|_| "The managed browser supervisor is busy.".to_string())?
            .clone()
            .ok_or_else(|| "The packaged managed-browser sidecar is unavailable.".to_string())?;
        let mut child = Command::new(&executable)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| "The managed-browser sidecar could not be started.".to_string())?;
        let stdin =
            Arc::new(Mutex::new(child.stdin.take().ok_or_else(|| {
                "The browser sidecar exposed no input pipe.".to_string()
            })?));
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "The browser sidecar exposed no output pipe.".to_string())?;
        let child = Arc::new(Mutex::new(child));
        let pending = self.pending.clone();
        thread::Builder::new()
            .name("ocade-browser-host-reader".into())
            .spawn(move || {
                for line in BufReader::new(stdout).lines() {
                    let reply = match line {
                        Ok(line) if line.len() <= MAX_REPLY_BYTES => {
                            serde_json::from_str::<Value>(&line).map_err(|_| {
                                "The browser sidecar returned invalid JSON.".to_string()
                            })
                        }
                        Ok(_) => {
                            Err("The browser sidecar returned an oversized reply.".to_string())
                        }
                        Err(_) => Err("The browser sidecar output pipe failed.".to_string()),
                    };
                    match reply {
                        Ok(value) => {
                            if value.get("event").is_some() {
                                continue;
                            }
                            let id = value.get("id").and_then(Value::as_u64);
                            if let Some(sender) = id.and_then(|id| {
                                pending.lock().ok().and_then(|mut map| map.remove(&id))
                            }) {
                                let _ = sender.send(Ok(value));
                            }
                        }
                        Err(error) => fail_pending(&pending, &error),
                    }
                }
                fail_pending(&pending, "The managed-browser sidecar stopped.");
            })
            .map_err(|_| "The browser sidecar reader could not be started.".to_string())?;

        *slot = Some(BrowserProcess {
            child,
            stdin: stdin.clone(),
        });
        Ok(stdin)
    }

    pub fn request(&self, mut request: Value) -> Result<Value, String> {
        let command = validate_request(self.kind, &request)?.to_string();
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        request
            .as_object_mut()
            .ok_or_else(|| "The browser host request must be an object.".to_string())?
            .insert("id".into(), id.into());
        let mut encoded = serde_json::to_vec(&request)
            .map_err(|_| "The browser host request could not be encoded.".to_string())?;
        if encoded.len() > MAX_REQUEST_BYTES {
            return Err("The browser host request is too large.".into());
        }
        encoded.push(b'\n');

        let stdin = self.ensure_started()?;
        let (sender, receiver) = mpsc::channel();
        self.pending
            .lock()
            .map_err(|_| "The browser reply registry is busy.".to_string())?
            .insert(id, sender);
        let write_result = match stdin.lock() {
            Ok(mut pipe) => pipe.write_all(&encoded).and_then(|_| pipe.flush()),
            Err(_) => Err(std::io::Error::other(
                "The browser sidecar input pipe is busy.",
            )),
        };
        if write_result.is_err() {
            if let Ok(mut pending) = self.pending.lock() {
                pending.remove(&id);
            }
            return Err("The browser sidecar input pipe failed.".into());
        }

        let timeout = if matches!(command.as_str(), "emergency_stop" | "emergency.stop") {
            STOP_TIMEOUT
        } else if self.kind == HostKind::Python && command == "gesture.run" {
            PYTHON_GESTURE_TIMEOUT
        } else if self.kind == HostKind::Python {
            PYTHON_REQUEST_TIMEOUT
        } else {
            REQUEST_TIMEOUT
        };
        match receiver.recv_timeout(timeout) {
            Ok(Ok(reply)) => Ok(reply),
            Ok(Err(error)) => Err(error),
            Err(_) => {
                if let Ok(mut pending) = self.pending.lock() {
                    pending.remove(&id);
                }
                Err(format!(
                    "The browser host timed out while running {command}."
                ))
            }
        }
    }

    pub fn close_session(&self, session_id: &str) {
        if !self.available() || session_id.is_empty() {
            return;
        }
        let _ = self.request(json!({
            "version": 1,
            "command": "close",
            "sessionId": session_id,
        }));
    }

    pub fn emergency_stop(&self) {
        if self
            .process
            .lock()
            .map(|slot| slot.is_none())
            .unwrap_or(true)
        {
            return;
        }
        let command = match self.kind {
            HostKind::Browser => "emergency_stop",
            HostKind::Python => "emergency.stop",
        };
        if self
            .request(json!({ "version": 1, "command": command }))
            .is_err()
        {
            self.kill();
        }
    }

    pub fn kill(&self) {
        if let Ok(mut slot) = self.process.lock() {
            if let Some(process) = slot.take() {
                if let Ok(mut child) = process.child.lock() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        }
        fail_pending(&self.pending, "The managed-browser sidecar was stopped.");
    }
}

fn fail_pending(pending: &Arc<Mutex<HashMap<u64, mpsc::Sender<PendingReply>>>>, message: &str) {
    if let Ok(mut pending) = pending.lock() {
        for (_, sender) in pending.drain() {
            let _ = sender.send(Err(message.to_string()));
        }
    }
}

fn validate_request(kind: HostKind, request: &Value) -> Result<&str, String> {
    let object = request
        .as_object()
        .ok_or_else(|| "The browser host request must be an object.".to_string())?;
    if object.get("version").and_then(Value::as_u64) != Some(1) {
        return Err("The browser host protocol version is unsupported.".into());
    }
    let command = object
        .get("command")
        .and_then(Value::as_str)
        .ok_or_else(|| "The browser host command is missing.".to_string())?;
    let allowed = match kind {
        HostKind::Browser => matches!(
            command,
            "launch" | "connect" | "status" | "perform" | "cancel" | "close" | "emergency_stop"
        ),
        HostKind::Python => matches!(
            command,
            "health"
                | "system.read"
                | "windows.list"
                | "window.read"
                | "window.focus"
                | "app.launch"
                | "text.type"
                | "pointer.move"
                | "pointer.click"
                | "key.press"
                | "capture.frame"
                | "ocr.window"
                | "vision.som"
                | "gesture.probe"
                | "gesture.run"
                | "voice.devices"
                | "voice.capture"
                | "voice.transcribe"
                | "voice.speak"
                | "adb.devices"
                | "emergency.stop"
        ),
    };
    if !allowed {
        return Err("The browser host command is not allowed.".into());
    }
    Ok(command)
}

pub fn locate_sidecar() -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("OCADE_BROWSER_HOST_BINARY").map(PathBuf::from) {
        if path.is_file() {
            return Some(path);
        }
    }
    let filename = if cfg!(windows) {
        "ocade-browser-host.exe"
    } else {
        "ocade-browser-host"
    };
    if let Ok(current) = std::env::current_exe() {
        if let Some(parent) = current.parent() {
            let packaged = parent.join(filename);
            if packaged.is_file() {
                return Some(packaged);
            }
        }
    }
    let development = Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries");
    let prefix = "ocade-browser-host-";
    std::fs::read_dir(development)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .find(|path| {
            path.is_file()
                && path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| {
                        name.starts_with(prefix)
                            && name.ends_with(if cfg!(windows) { ".exe" } else { "" })
                    })
        })
}

pub fn locate_python_sidecar() -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("OCADE_PYTHON_HOST_BINARY").map(PathBuf::from) {
        if path.is_file() {
            return Some(path);
        }
    }
    let filename = if cfg!(windows) {
        "ocade-python-host.exe"
    } else {
        "ocade-python-host"
    };
    if let Ok(current) = std::env::current_exe() {
        if let Some(parent) = current.parent() {
            let packaged = parent.join(filename);
            if packaged.is_file() {
                return Some(packaged);
            }
        }
    }
    let development = Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries");
    let prefix = "ocade-python-host-";
    std::fs::read_dir(development)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .find(|path| {
            path.is_file()
                && path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| {
                        name.starts_with(prefix)
                            && name.ends_with(if cfg!(windows) { ".exe" } else { "" })
                    })
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn protocol_refuses_unknown_commands() {
        let error = validate_request(
            HostKind::Browser,
            &json!({ "version": 1, "command": "evaluate" }),
        )
        .expect_err("unrestricted evaluation must be refused");
        assert!(error.contains("not allowed"));
    }

    #[test]
    fn protocol_requires_the_exact_version() {
        assert!(validate_request(
            HostKind::Browser,
            &json!({ "version": 2, "command": "status" })
        )
        .is_err());
    }

    #[test]
    fn python_protocol_refuses_shells_and_accepts_bounded_perception() {
        assert!(validate_request(
            HostKind::Python,
            &json!({ "version": 1, "command": "shell.exec" })
        )
        .is_err());
        assert_eq!(
            validate_request(
                HostKind::Python,
                &json!({ "version": 1, "command": "gesture.probe" })
            ),
            Ok("gesture.probe")
        );
    }

    #[test]
    fn real_sidecar_supervision_covers_chrome_edge_and_emergency_stop() {
        if std::env::var("OCADE_REQUIRE_BROWSER_SIDECAR_TEST").as_deref() != Ok("1") {
            return;
        }
        let executable = locate_sidecar().expect("the compiled browser sidecar must exist");
        let supervisor = BrowserHostSupervisor::default();
        supervisor.configure(Some(executable));
        let unique_run = format!(
            "{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system clock must be after the Unix epoch")
                .as_nanos()
        );
        for browser in ["chrome", "edge"] {
            // A new managed profile is part of the production session model.
            // Reusing a fixed test profile can inherit a stale browser lock
            // after an interrupted prior run and creates a false host failure.
            let session_id = format!("rust-supervisor-{unique_run}-{browser}");
            let reply = supervisor
                .request(json!({
                    "version": 1,
                    "command": "launch",
                    "sessionId": session_id,
                    "browser": browser,
                    "headless": true,
                }))
                .expect("the signed companion supervisor must reach the sidecar");
            assert_eq!(
                reply.get("ok").and_then(Value::as_bool),
                Some(true),
                "managed {browser} launch failed: {reply}"
            );
            assert_eq!(
                reply.pointer("/data/browser").and_then(Value::as_str),
                Some(browser)
            );
        }
        let stopped = supervisor
            .request(json!({ "version": 1, "command": "emergency_stop" }))
            .expect("emergency stop must reach the sidecar");
        assert_eq!(stopped.get("ok").and_then(Value::as_bool), Some(true));
        assert_eq!(
            stopped
                .pointer("/data/acknowledged")
                .and_then(Value::as_bool),
            Some(true)
        );
        supervisor.kill();
    }

    #[test]
    fn real_python_sidecar_supervision_covers_health_system_and_emergency_stop() {
        if std::env::var("OCADE_REQUIRE_PYTHON_SIDECAR_TEST").as_deref() != Ok("1") {
            return;
        }
        let executable = locate_python_sidecar().expect("the compiled Python sidecar must exist");
        let supervisor = BrowserHostSupervisor::python();
        supervisor.configure(Some(executable));
        for command in ["health", "system.read"] {
            let reply = supervisor
                .request(json!({ "version": 1, "command": command, "params": {} }))
                .expect("the signed companion supervisor must reach the Python sidecar");
            assert_eq!(
                reply.get("ok").and_then(Value::as_bool),
                Some(true),
                "Python command failed: {reply}"
            );
        }
        let stopped = supervisor
            .request(json!({ "version": 1, "command": "emergency.stop", "params": {} }))
            .expect("emergency stop must reach the Python sidecar");
        assert_eq!(stopped.get("ok").and_then(Value::as_bool), Some(true));
        assert_eq!(
            stopped.pointer("/result/stopped").and_then(Value::as_bool),
            Some(true)
        );
        supervisor.kill();
    }
}
