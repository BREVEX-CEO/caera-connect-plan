//! CAERA Native Companion — Tauri application entry point.
//!
//! STATUS: capabilities are discovered at runtime and advertised only when the
//! corresponding packaged sidecars and operating-system facilities exist. Code
//! signing remains a release-pipeline responsibility, never a source-level claim.
//!
//! Trust model
//! -----------
//! The web app is UNTRUSTED. Every inbound request must carry an authenticated
//! session, a monotonic counter and a single-use nonce (`safety::ipc`), and is
//! then re-validated against the safety core (`safety::guard`) HOST-SIDE. The
//! UI's own checks are a convenience; these are the real ones.
//!
//! Hard boundaries that cannot be configured away:
//!   * protected input (passwords, OTPs, CAPTCHAs, payment, recovery codes) is
//!     refused outright — even when the caller claims confirmation;
//!   * apps and paths must be on the allowlist;
//!   * every action is redacted before it reaches the audit log;
//!   * emergency stop cancels everything in flight and is always available.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::{HashMap, VecDeque};
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use caera_companion_safety as safety;
use safety::ipc::{now_unix, Envelope, IpcGuard};
use safety::{
    guard, redact_for_audit, risk_of, Allowlist, CompanionAction, EmergencyStopRegistry, Refusal,
};
use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, State,
};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

mod app_host;
mod browser_host;
mod platform;

/// Everything the companion needs at runtime, guarded for cross-thread access.
struct Companion {
    ipc: Mutex<IpcGuard>,
    allow: Mutex<Allowlist>,
    audit: Mutex<VecDeque<AuditEntry>>,
    /// Atomic latch + active-token registry. One lock closes the race between
    /// admitting a run and cancelling everything during emergency stop.
    emergency: EmergencyStopRegistry,
    /// Bounded host-side idempotency ledger. A retry with the same operation id
    /// returns its prior terminal result instead of touching the machine twice.
    operations: Mutex<OperationLedger>,
    /// Private cache directory resolved by Tauri during setup.
    artifact_dir: Mutex<Option<PathBuf>>,
    allowlist_path: Mutex<Option<PathBuf>>,
    observations: Mutex<HashMap<String, ObservationExpectation>>,
    /// The only parent of the extensionless Playwright/CDP sidecar.
    browser: browser_host::BrowserHostSupervisor,
    /// The only parent of the bounded Python perception/control sidecar.
    python: browser_host::BrowserHostSupervisor,
    /// The packaged OCADE application server that the main window loads.
    /// Without it this shell has no conversation and the companion has no
    /// caller — which is precisely the gap that made PC control unreachable.
    app_server: app_host::AppHostSupervisor,
}

impl Companion {
    fn new() -> Self {
        Self {
            ipc: Mutex::new(IpcGuard::new()),
            allow: Mutex::new(Allowlist::default()),
            audit: Mutex::new(VecDeque::new()),
            emergency: EmergencyStopRegistry::default(),
            operations: Mutex::new(OperationLedger::default()),
            artifact_dir: Mutex::new(None),
            allowlist_path: Mutex::new(None),
            observations: Mutex::new(HashMap::new()),
            app_server: app_host::AppHostSupervisor::default(),
            browser: browser_host::BrowserHostSupervisor::default(),
            python: browser_host::BrowserHostSupervisor::python(),
        }
    }

    fn record(&self, run_id: &str, detail: &str, ok: bool) {
        let entry = AuditEntry {
            run_id: run_id.to_string(),
            at: now_unix(),
            // Protected content never reaches the audit trail.
            detail: redact_for_audit(detail),
            ok,
        };
        if let Ok(mut log) = self.audit.lock() {
            log.push_back(entry);
            if log.len() > MAX_AUDIT_ENTRIES {
                log.pop_front();
            }
        }
    }
}

#[derive(Clone)]
enum ObservationExpectation {
    WindowFocus(String),
    WindowArrange {
        layout: String,
        target: Option<String>,
    },
    AppOpen(String),
    FileOpen(String),
    ClipboardWrite(String),
}

fn observation_expectation(action: &CompanionAction) -> Option<ObservationExpectation> {
    match action {
        CompanionAction::WindowFocus { target } => {
            Some(ObservationExpectation::WindowFocus(target.clone()))
        }
        CompanionAction::WindowArrange { layout, target } => {
            Some(ObservationExpectation::WindowArrange {
                layout: layout.clone(),
                target: target.clone(),
            })
        }
        CompanionAction::AppOpen { app_id } => {
            Some(ObservationExpectation::AppOpen(app_id.clone()))
        }
        CompanionAction::FileOpen { path } => PathBuf::from(path)
            .canonicalize()
            .ok()
            .map(|path| ObservationExpectation::FileOpen(path.to_string_lossy().to_string())),
        CompanionAction::ClipboardWrite { text } => Some(ObservationExpectation::ClipboardWrite(
            safety::ipc::sha256_hex(text.as_bytes()),
        )),
        _ => None,
    }
}

const MAX_AUDIT_ENTRIES: usize = 500;
const MAX_OPERATION_RESULTS: usize = 1_000;

#[derive(Clone)]
enum OperationEntry {
    InFlight {
        fingerprint: String,
    },
    Finished {
        fingerprint: String,
        result: Result<ExecuteReply, String>,
    },
}

#[derive(Default)]
struct OperationLedger {
    entries: HashMap<String, OperationEntry>,
    finished_order: VecDeque<String>,
    journal_path: Option<PathBuf>,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "snake_case")]
enum OperationJournalEvent {
    Started {
        operation_id: String,
        fingerprint: String,
    },
    Finished {
        operation_id: String,
        fingerprint: String,
        result: Result<ExecuteReply, String>,
    },
}

enum OperationDecision {
    Start,
    Replay(Result<ExecuteReply, String>),
    InFlight,
}

impl OperationLedger {
    fn configure(&mut self, journal_path: PathBuf) -> Result<(), String> {
        if let Some(parent) = journal_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Could not create operation journal directory: {e}"))?;
        }
        self.journal_path = Some(journal_path.clone());
        if journal_path.exists() {
            let file = fs::File::open(&journal_path)
                .map_err(|e| format!("Could not open operation journal: {e}"))?;
            for line in BufReader::new(file).lines() {
                let line = line.map_err(|e| format!("Could not read operation journal: {e}"))?;
                if line.trim().is_empty() {
                    continue;
                }
                let event: OperationJournalEvent = serde_json::from_str(&line)
                    .map_err(|e| format!("Operation journal is corrupt: {e}"))?;
                self.apply_event(event)?;
            }
        }
        // A crash can leave a durable Started record with no terminal result.
        // Replaying it would risk applying an unknown side effect twice, so
        // recover it as an explicit failure that callers can inspect.
        let interrupted: Vec<(String, String)> = self
            .entries
            .iter()
            .filter_map(|(operation_id, entry)| match entry {
                OperationEntry::InFlight { fingerprint } => {
                    Some((operation_id.clone(), fingerprint.clone()))
                }
                OperationEntry::Finished { .. } => None,
            })
            .collect();
        for (operation_id, fingerprint) in interrupted {
            self.finish(
                &operation_id,
                &fingerprint,
                Err(
                    "The companion restarted before this operation recorded a terminal result; it was not replayed."
                        .into(),
                ),
            )?;
        }
        Ok(())
    }

    fn apply_event(&mut self, event: OperationJournalEvent) -> Result<(), String> {
        match event {
            OperationJournalEvent::Started {
                operation_id,
                fingerprint,
            } => {
                if let Some(existing) = self.entries.get(&operation_id) {
                    let prior = match existing {
                        OperationEntry::InFlight { fingerprint }
                        | OperationEntry::Finished { fingerprint, .. } => fingerprint,
                    };
                    if prior != &fingerprint {
                        return Err("Operation journal contains a conflicting operation id.".into());
                    }
                    return Ok(());
                }
                self.entries
                    .insert(operation_id, OperationEntry::InFlight { fingerprint });
            }
            OperationJournalEvent::Finished {
                operation_id,
                fingerprint,
                result,
            } => {
                if let Some(existing) = self.entries.get(&operation_id) {
                    let prior = match existing {
                        OperationEntry::InFlight { fingerprint }
                        | OperationEntry::Finished { fingerprint, .. } => fingerprint,
                    };
                    if prior != &fingerprint {
                        return Err("Operation journal contains a conflicting result.".into());
                    }
                }
                self.entries.insert(
                    operation_id.clone(),
                    OperationEntry::Finished {
                        fingerprint,
                        result,
                    },
                );
                self.finished_order.push_back(operation_id);
                self.prune();
            }
        }
        Ok(())
    }

    fn append(&self, event: &OperationJournalEvent) -> Result<(), String> {
        let path = self
            .journal_path
            .as_ref()
            .ok_or_else(|| "The durable operation journal is not configured.".to_string())?;
        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .map_err(|e| format!("Could not append the operation journal: {e}"))?;
        serde_json::to_writer(&mut file, event)
            .map_err(|e| format!("Could not encode the operation journal: {e}"))?;
        file.write_all(b"\n")
            .and_then(|_| file.sync_all())
            .map_err(|e| format!("Could not durably flush the operation journal: {e}"))
    }

    fn begin(
        &mut self,
        operation_id: &str,
        fingerprint: &str,
    ) -> Result<OperationDecision, String> {
        if let Some(entry) = self.entries.get(operation_id) {
            let prior_fingerprint = match entry {
                OperationEntry::InFlight { fingerprint }
                | OperationEntry::Finished { fingerprint, .. } => fingerprint,
            };
            if prior_fingerprint != fingerprint {
                return Err(
                    "Operation id reuse was refused because the signed action does not match."
                        .into(),
                );
            }
            return Ok(match entry {
                OperationEntry::InFlight { .. } => OperationDecision::InFlight,
                OperationEntry::Finished { result, .. } => {
                    OperationDecision::Replay(result.clone())
                }
            });
        }

        let event = OperationJournalEvent::Started {
            operation_id: operation_id.to_string(),
            fingerprint: fingerprint.to_string(),
        };
        self.append(&event)?;
        self.apply_event(event)?;
        Ok(OperationDecision::Start)
    }

    fn finish(
        &mut self,
        operation_id: &str,
        fingerprint: &str,
        result: Result<ExecuteReply, String>,
    ) -> Result<(), String> {
        let event = OperationJournalEvent::Finished {
            operation_id: operation_id.to_string(),
            fingerprint: fingerprint.to_string(),
            result,
        };
        self.append(&event)?;
        self.apply_event(event)
    }

    fn prune(&mut self) {
        while self.finished_order.len() > MAX_OPERATION_RESULTS {
            if let Some(expired) = self.finished_order.pop_front() {
                if matches!(
                    self.entries.get(&expired),
                    Some(OperationEntry::Finished { .. })
                ) {
                    self.entries.remove(&expired);
                }
            }
        }
    }
}

#[derive(Clone, Serialize)]
struct AuditEntry {
    run_id: String,
    at: u64,
    detail: String,
    ok: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StatusReply {
    available: bool,
    version: String,
    halted: bool,
    reason: Option<String>,
    /// Action kinds this build can actually perform.
    capabilities: Vec<String>,
    permissions: Vec<platform::PermissionStatus>,
    install_guidance: Vec<String>,
}

/// camelCase so the field names match the TypeScript client exactly
/// (`src/lib/native/tauri-companion.ts` reads `runId`).
#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExecuteReply {
    ok: bool,
    run_id: String,
    detail: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    output: Option<platform::PlatformOutput>,
}

#[derive(Deserialize)]
struct SignedRequest {
    session_id: String,
    counter: u64,
    nonce: String,
    issued_at: u64,
    /// Canonical body the MAC covers: "<command>|<json args>".
    body: String,
    mac: String,
}

impl From<&SignedRequest> for Envelope {
    fn from(r: &SignedRequest) -> Self {
        Envelope {
            session_id: r.session_id.clone(),
            counter: r.counter,
            nonce: r.nonce.clone(),
            issued_at: r.issued_at,
            body: r.body.clone(),
            mac: r.mac.clone(),
        }
    }
}

fn verify_signed<T: Serialize>(
    state: &Companion,
    request: &SignedRequest,
    command: &str,
    args: &T,
) -> Result<(), String> {
    let env: Envelope = request.into();
    state
        .ipc
        .lock()
        .map_err(|_| "Companion busy".to_string())?
        .verify(&env, now_unix())
        .map_err(|e| e.message().to_string())?;

    let encoded = serde_json::to_string(args)
        .map_err(|_| "The signed command arguments could not be encoded.".to_string())?;
    let expected = format!("{command}|{encoded}");
    if request.body != expected {
        return Err("The signed request body did not match the command arguments.".into());
    }
    Ok(())
}

fn refusal_message(r: &Refusal) -> String {
    r.message().to_string()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionReply {
    session_id: String,
    /// Raw key bytes for THIS window only. Never persisted, never logged.
    key: Vec<u8>,
}

/// Open an authenticated session.
///
/// The HOST mints both the id and the key from the OS CSPRNG — the web page is
/// untrusted and must not choose its own key material, or a compromised page
/// could forge MACs for a session of its choosing. The key is returned once,
/// over the local IPC channel only, and is never written to disk or the audit
/// log.
#[tauri::command]
fn open_session(state: State<'_, Companion>) -> Result<SessionReply, String> {
    let mut key = vec![0u8; 32];
    getrandom::getrandom(&mut key).map_err(|_| "Could not generate a session key.".to_string())?;
    let mut id_bytes = [0u8; 16];
    getrandom::getrandom(&mut id_bytes)
        .map_err(|_| "Could not generate a session id.".to_string())?;
    let session_id = id_bytes
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>();

    state
        .ipc
        .lock()
        .map_err(|_| "Companion busy".to_string())?
        .open_session(&session_id, key.clone())
        .map_err(|reject| reject.message().to_string())?;
    Ok(SessionReply { session_id, key })
}

#[tauri::command]
fn close_session(
    state: State<'_, Companion>,
    request: SignedRequest,
    session_id: String,
) -> Result<bool, String> {
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct Args<'a> {
        session_id: &'a str,
    }
    verify_signed(
        &state,
        &request,
        "close_session",
        &Args {
            session_id: &session_id,
        },
    )?;
    state.browser.close_session(&session_id);
    state
        .ipc
        .lock()
        .map_err(|_| "Companion busy".to_string())?
        .close_session(&session_id);
    Ok(true)
}

#[tauri::command]
fn status(state: State<'_, Companion>) -> StatusReply {
    let backend = platform::discover();
    let mut capabilities = backend.capabilities;
    if state.browser.available() {
        capabilities.push("browser_cdp".into());
    }
    if state.python.available() {
        capabilities.extend(
            ["python_control", "gesture", "vision_ocr", "local_voice"]
                .into_iter()
                .map(String::from),
        );
    }
    StatusReply {
        // This can be true only inside a real built companion whose backend
        // discovery found the required OS facilities.
        available: backend.available,
        version: env!("CARGO_PKG_VERSION").to_string(),
        halted: state.emergency.is_halted(),
        reason: backend.reason,
        capabilities,
        permissions: backend.permissions,
        install_guidance: backend.install_guidance,
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BrowserHostArgs<'a> {
    host_request: &'a serde_json::Value,
}

/// Forward one typed request to the supervised browser sidecar.
///
/// The request is signed as a whole and checked again by the Rust supervisor
/// before it reaches the pipe. There is no arbitrary command or script field.
#[tauri::command]
async fn browser_host_request(
    app: tauri::AppHandle,
    state: State<'_, Companion>,
    request: SignedRequest,
    host_request: serde_json::Value,
) -> Result<serde_json::Value, String> {
    verify_signed(
        &state,
        &request,
        "browser_host_request",
        &BrowserHostArgs {
            host_request: &host_request,
        },
    )?;
    let command = host_request
        .get("command")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("invalid")
        .to_string();
    if state.emergency.is_halted() && !matches!(command.as_str(), "status" | "emergency_stop") {
        return Err("Emergency stop is active. Reset it before controlling a browser.".into());
    }
    let worker_app = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        worker_app
            .state::<Companion>()
            .browser
            .request(host_request)
    })
    .await
    .map_err(|_| "The managed-browser worker stopped unexpectedly.".to_string())?;
    state.record(
        "-",
        &format!("Managed-browser command {command}."),
        result.is_ok(),
    );
    result
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PythonHostArgs<'a> {
    host_request: &'a serde_json::Value,
}

/// Forward one signed, allowlisted request to the bounded Python sidecar.
/// The sidecar inherits pipes only and cannot accept arbitrary shell commands.
#[tauri::command]
async fn python_host_request(
    app: tauri::AppHandle,
    state: State<'_, Companion>,
    request: SignedRequest,
    host_request: serde_json::Value,
) -> Result<serde_json::Value, String> {
    verify_signed(
        &state,
        &request,
        "python_host_request",
        &PythonHostArgs {
            host_request: &host_request,
        },
    )?;
    let command = host_request
        .get("command")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("invalid")
        .to_string();
    if state.emergency.is_halted()
        && !matches!(
            command.as_str(),
            "health" | "system.read" | "apps.discover" | "app.inspect" | "emergency.stop"
        )
    {
        return Err("Emergency stop is active. Reset it before using local control.".into());
    }
    let worker_app = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        worker_app.state::<Companion>().python.request(host_request)
    })
    .await
    .map_err(|_| "The Python-control worker stopped unexpectedly.".to_string())?;
    state.record(
        "-",
        &format!("Python-control command {command}."),
        result.is_ok(),
    );
    result
}

#[tauri::command]
fn application_inventory(
    state: State<'_, Companion>,
    request: SignedRequest,
) -> Result<Vec<platform::ApplicationInfo>, String> {
    verify_signed(
        &state,
        &request,
        "application_inventory",
        &serde_json::json!({}),
    )?;
    if state.emergency.is_halted() {
        return Err("Emergency stop is active. Reset it before reading applications.".into());
    }
    platform::application_inventory(Arc::new(AtomicBool::new(false)))
}

#[derive(Serialize)]
struct AllowlistReply {
    apps: Vec<String>,
    paths: Vec<String>,
}

#[derive(Deserialize, Serialize)]
struct AllowlistDocument {
    version: u8,
    apps: Vec<String>,
    paths: Vec<String>,
}

fn persist_allowlist(state: &Companion, allow: &Allowlist) -> Result<(), String> {
    let path = state
        .allowlist_path
        .lock()
        .map_err(|_| "Companion busy".to_string())?
        .clone()
        .ok_or_else(|| "The allowlist store is not configured.".to_string())?;
    let document = AllowlistDocument {
        version: 1,
        apps: allow.apps.clone(),
        paths: allow
            .directories
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect(),
    };
    let bytes = serde_json::to_vec_pretty(&document)
        .map_err(|_| "The allowlist could not be encoded.".to_string())?;
    let mut file = OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(path)
        .map_err(|_| "The allowlist could not be saved.".to_string())?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| "The allowlist could not be durably saved.".to_string())
}

#[derive(Serialize)]
struct SetAllowlistArgs<'a> {
    apps: &'a [String],
    paths: &'a [String],
}

/// Read the current allowlist.
///
/// Required for correctness, not convenience: `set_allowlist` REPLACES the list,
/// so an app that edits without first reading would silently drop every entry it
/// did not know about. Read-only, so it needs no signature.
#[tauri::command]
fn get_allowlist(state: State<'_, Companion>) -> Result<AllowlistReply, String> {
    let allow = state
        .allow
        .lock()
        .map_err(|_| "Companion busy".to_string())?;
    Ok(AllowlistReply {
        apps: allow.apps.clone(),
        paths: allow
            .directories
            .iter()
            .map(|p| p.to_string_lossy().to_string())
            .collect(),
    })
}

/// Replace the allowlist. Called by the app after the user edits permissions.
///
/// REQUIRES A SIGNED REQUEST. This widens what the companion may open, so an
/// unauthenticated caller must never be able to change it — otherwise any page
/// in the webview could grant itself access to arbitrary apps and directories.
#[tauri::command]
fn set_allowlist(
    state: State<'_, Companion>,
    request: SignedRequest,
    apps: Vec<String>,
    paths: Vec<String>,
) -> Result<bool, String> {
    verify_signed(
        &state,
        &request,
        "set_allowlist",
        &SetAllowlistArgs {
            apps: &apps,
            paths: &paths,
        },
    )?;

    let mut approved_apps = Vec::new();
    for app in apps {
        let app = app.trim();
        if app.is_empty() || app.len() > 512 || app.contains('\0') {
            return Err("Every approved application id must be a bounded non-empty value.".into());
        }
        if !approved_apps
            .iter()
            .any(|existing: &String| existing.eq_ignore_ascii_case(app))
        {
            approved_apps.push(app.to_string());
        }
    }
    let mut approved_paths = Vec::new();
    for path in paths {
        let canonical = PathBuf::from(path)
            .canonicalize()
            .map_err(|_| "Every approved directory must already exist.".to_string())?;
        if !canonical.is_dir() {
            return Err("Only directories can be added to the file allowlist.".into());
        }
        if !approved_paths.contains(&canonical) {
            approved_paths.push(canonical);
        }
    }
    let next = Allowlist {
        apps: approved_apps,
        directories: approved_paths,
    };
    persist_allowlist(&state, &next)?;
    *state
        .allow
        .lock()
        .map_err(|_| "Companion busy".to_string())? = next;
    state.record("-", "Allowlist updated.", true);
    Ok(true)
}

/// Execute one action after full verification. This is the only path that can
/// touch the machine.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExecuteArgs<'a> {
    action: &'a CompanionAction,
    confirmed: bool,
    run_id: &'a str,
    operation_id: &'a str,
}

#[tauri::command]
async fn execute(
    app: tauri::AppHandle,
    state: State<'_, Companion>,
    request: SignedRequest,
    action: CompanionAction,
    confirmed: bool,
    run_id: String,
    operation_id: String,
) -> Result<ExecuteReply, String> {
    if state.emergency.is_halted() {
        return Err("Emergency stop is active. Reset it before running actions.".into());
    }

    if run_id.trim().is_empty() || operation_id.trim().is_empty() {
        return Err("Run and operation ids are required.".into());
    }
    verify_signed(
        &state,
        &request,
        "execute",
        &ExecuteArgs {
            action: &action,
            confirmed,
            run_id: &run_id,
            operation_id: &operation_id,
        },
    )?;

    // 2) Re-validate the action host-side. A caller cannot widen its own rights.
    let allow = state
        .allow
        .lock()
        .map_err(|_| "Companion busy".to_string())?
        .clone();
    if let Err(refusal) = guard(&action, confirmed, &allow) {
        let msg = refusal_message(&refusal);
        state.record("-", &msg, false);
        return Err(msg);
    }
    // Execute the same canonical path the allowlist checked, closing the
    // symlink/relative-path gap between permission validation and OS dispatch.
    let action = match action {
        CompanionAction::FileOpen { path } => CompanionAction::FileOpen {
            path: PathBuf::from(path)
                .canonicalize()
                .map_err(|_| Refusal::PathNotAllowed.message().to_string())?
                .to_string_lossy()
                .to_string(),
        },
        other => other,
    };
    let artifact_dir = state
        .artifact_dir
        .lock()
        .map_err(|_| "Companion busy".to_string())?
        .clone()
        .ok_or_else(|| "The companion cache is not configured.".to_string())?;
    // Final host-side admission is atomic with emergency stop. A stop can no
    // longer land between the old latch check and token registration.
    let cancel_token = state
        .emergency
        .register(&run_id)
        .map_err(|refusal| refusal.message().to_string())?;

    // Persist only a collision-resistant local fingerprint, never the signed
    // action body, which may contain private user text.
    let fingerprint = safety::ipc::compute_mac(b"ocade-operation-fingerprint-v1", &request.body);
    let decision = match state.operations.lock() {
        Ok(mut operations) => operations.begin(&operation_id, &fingerprint),
        Err(_) => Err("Companion busy".to_string()),
    };
    let decision = match decision {
        Ok(decision) => decision,
        Err(error) => {
            state.emergency.finish(&run_id);
            return Err(error);
        }
    };
    match decision {
        OperationDecision::Replay(result) => {
            state.emergency.finish(&run_id);
            state.record(&run_id, "Returned cached operation result.", result.is_ok());
            return result;
        }
        OperationDecision::InFlight => {
            state.emergency.finish(&run_id);
            return Err("This operation is already in progress; it was not executed again.".into());
        }
        OperationDecision::Start => {}
    }

    let risk = risk_of(&action);
    let _ = app.emit("ocade://action-started", &run_id);

    // 3) Perform it on a blocking worker. This keeps cancel/emergency-stop IPC
    // responsive while the bounded OS process is running.
    let worker_app = app.clone();
    let worker_run_id = run_id.clone();
    let expectation = observation_expectation(&action);
    let outcome = match tauri::async_runtime::spawn_blocking(move || {
        let worker_state = worker_app.state::<Companion>();
        perform(
            &worker_app,
            &worker_state,
            &worker_run_id,
            &action,
            &artifact_dir,
            cancel_token,
        )
    })
    .await
    {
        Ok(outcome) => outcome,
        Err(_) => Err("The native action worker stopped unexpectedly.".to_string()),
    };
    state.emergency.finish(&run_id);
    if outcome.is_ok() {
        if let Some(expectation) = expectation {
            if let Ok(mut observations) = state.observations.lock() {
                if observations.len() >= MAX_OPERATION_RESULTS {
                    if let Some(expired) = observations.keys().next().cloned() {
                        observations.remove(&expired);
                    }
                }
                observations.insert(operation_id.clone(), expectation);
            }
        }
    }

    let detail = match &outcome {
        Ok(result) => result.detail.clone(),
        Err(e) => e.clone(),
    };
    state.record(&run_id, &detail, outcome.is_ok());
    let _ = app.emit("ocade://action-finished", &run_id);

    let result = match outcome {
        Ok(result) => Ok(ExecuteReply {
            ok: true,
            run_id,
            detail: result.detail,
            output: result.output,
        }),
        Err(e) => Err(format!("{e} (risk: {risk:?})")),
    };
    state
        .operations
        .lock()
        .map_err(|_| "Companion busy".to_string())?
        .finish(&operation_id, &fingerprint, result.clone())?;
    result
}

/// Bounded action dispatch. Anything not listed here is unsupported — the
/// companion never falls back to generic, unrestricted control.
fn perform(
    app: &tauri::AppHandle,
    _state: &Companion,
    run_id: &str,
    action: &CompanionAction,
    artifact_dir: &std::path::Path,
    cancelled: Arc<AtomicBool>,
) -> Result<platform::PlatformResult, String> {
    let _ = app.emit(
        "ocade://action-progress",
        serde_json::json!({ "runId": run_id, "stage": "executing", "percent": 20 }),
    );
    let original_clipboard = || app.clipboard().read_text().ok();
    let restore = |value: Option<String>| {
        if let Some(value) = value {
            let _ = app.clipboard().write_text(value);
        }
    };

    let result = match action {
        CompanionAction::ClipboardRead => {
            let value = app
                .clipboard()
                .read_text()
                .map_err(|_| "The clipboard could not be read.".to_string())?;
            if safety::is_protected_text(&value) {
                Err(Refusal::ProtectedInput.message().to_string())
            } else {
                Ok(platform::PlatformResult {
                    detail: "Read approved clipboard text.".into(),
                    output: Some(platform::PlatformOutput::Text { value }),
                })
            }
        }
        CompanionAction::ClipboardWrite { text } => {
            app.clipboard()
                .write_text(text.clone())
                .map_err(|_| "The clipboard could not be written.".to_string())?;
            Ok(platform::PlatformResult {
                detail: "Wrote approved text to the clipboard.".into(),
                output: None,
            })
        }
        CompanionAction::TextType { text } | CompanionAction::SelectionReplace { text } => {
            let previous = original_clipboard();
            app.clipboard()
                .write_text(text.clone())
                .map_err(|_| "The temporary typing clipboard could not be prepared.".to_string())?;
            let sent = platform::send_paste(cancelled.clone());
            thread::sleep(Duration::from_millis(120));
            restore(previous);
            sent.map(|_| platform::PlatformResult {
                detail: if matches!(action, CompanionAction::SelectionReplace { .. }) {
                    "Replaced the approved selection."
                } else {
                    "Typed approved text into the focused application."
                }
                .into(),
                output: None,
            })
        }
        CompanionAction::SelectionRead => {
            let previous = original_clipboard();
            app.clipboard()
                .write_text("")
                .map_err(|_| "The selection clipboard could not be prepared.".to_string())?;
            platform::send_copy(cancelled.clone())?;
            thread::sleep(Duration::from_millis(150));
            let value = app
                .clipboard()
                .read_text()
                .map_err(|_| "The selected text could not be read.".to_string());
            restore(previous);
            let value = value?;
            if safety::is_protected_text(&value) {
                Err(Refusal::ProtectedInput.message().to_string())
            } else {
                Ok(platform::PlatformResult {
                    detail: "Read the approved selection.".into(),
                    output: Some(platform::PlatformOutput::Text { value }),
                })
            }
        }
        _ => platform::perform(action, run_id, artifact_dir, cancelled),
    };
    let _ = app.emit(
        "ocade://action-progress",
        serde_json::json!({ "runId": run_id, "stage": "finished", "percent": 100 }),
    );
    result
}

/// Separate post-action observation channel.
///
/// This build has no OS backend, so it authenticates the request and then
/// refuses. Future backends must return only structured hashes/bounded enums;
/// never plaintext screen, file, clipboard, or selection content.
#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ObservationRequest {
    kind: String,
    run_id: String,
    operation_id: String,
}

#[derive(Serialize)]
struct ObservationArgs<'a> {
    observation: &'a ObservationRequest,
}

fn iso8601_now() -> String {
    let seconds = now_unix() as i64;
    let days = seconds.div_euclid(86_400);
    let day_seconds = seconds.rem_euclid(86_400);
    // Howard Hinnant's civil-from-days algorithm, avoiding a runtime date
    // dependency in the native security boundary.
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let mut year = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    year += i64::from(month <= 2);
    let hour = day_seconds / 3_600;
    let minute = (day_seconds % 3_600) / 60;
    let second = day_seconds % 60;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.000Z")
}

#[tauri::command]
fn observe(
    app: tauri::AppHandle,
    state: State<'_, Companion>,
    request: SignedRequest,
    observation: ObservationRequest,
) -> Result<serde_json::Value, String> {
    verify_signed(
        &state,
        &request,
        "observe",
        &ObservationArgs {
            observation: &observation,
        },
    )?;
    let expected = state
        .observations
        .lock()
        .map_err(|_| "Companion busy".to_string())?
        .get(&observation.operation_id)
        .cloned()
        .ok_or_else(|| {
            "No matching native observation is available for this operation.".to_string()
        })?;
    let cancelled = Arc::new(AtomicBool::new(false));
    let digest = |value: &str| safety::ipc::sha256_hex(value.trim().as_bytes());
    let mut value = serde_json::json!({
        "source": "native-os-observer-v1",
        "kind": &observation.kind,
        "runId": &observation.run_id,
        "operationId": &observation.operation_id,
        "observedAt": iso8601_now(),
    });
    let object = value
        .as_object_mut()
        .ok_or_else(|| "The native observation could not be encoded.".to_string())?;
    match expected {
        ObservationExpectation::WindowFocus(target) => {
            if observation.kind != "window.focus" {
                return Err("The observation kind did not match the executed action.".into());
            }
            let active = platform::active_window_title(cancelled)?;
            let observed = if active.to_lowercase().contains(&target.to_lowercase()) {
                target
            } else {
                active
            };
            object.insert("activeTargetDigest".into(), digest(&observed).into());
        }
        ObservationExpectation::WindowArrange { layout, target } => {
            if observation.kind != "window.arrange" {
                return Err("The observation kind did not match the executed action.".into());
            }
            object.insert(
                "layout".into(),
                platform::active_window_layout(cancelled.clone())?.into(),
            );
            if let Some(target) = target {
                let active = platform::active_window_title(cancelled)?;
                let observed = if active.to_lowercase().contains(&target.to_lowercase()) {
                    target
                } else {
                    active
                };
                object.insert("targetDigest".into(), digest(&observed).into());
            }
            let _ = layout; // expected layout is checked by the independent caller.
        }
        ObservationExpectation::AppOpen(app_id) => {
            if observation.kind != "app.open" {
                return Err("The observation kind did not match the executed action.".into());
            }
            let observed = if platform::process_running(&app_id, cancelled)? {
                app_id
            } else {
                "not-running".into()
            };
            object.insert("runningAppDigest".into(), digest(&observed).into());
        }
        ObservationExpectation::FileOpen(path) => {
            if observation.kind != "file.open" {
                return Err("The observation kind did not match the executed action.".into());
            }
            let title = platform::active_window_title(cancelled)?;
            let path_buf = PathBuf::from(&path);
            let file_name = path_buf
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("");
            let observed = if !file_name.is_empty()
                && title.to_lowercase().contains(&file_name.to_lowercase())
            {
                path
            } else {
                title
            };
            object.insert("activeFileDigest".into(), digest(&observed).into());
        }
        ObservationExpectation::ClipboardWrite(expected_digest) => {
            if observation.kind != "clipboard.write" {
                return Err("The observation kind did not match the executed action.".into());
            }
            let current = app
                .clipboard()
                .read_text()
                .map_err(|_| "The clipboard observation could not be read.".to_string())?;
            let observed = safety::ipc::sha256_hex(current.as_bytes());
            object.insert(
                "clipboardDigest".into(),
                if observed == expected_digest {
                    expected_digest
                } else {
                    observed
                }
                .into(),
            );
        }
    }
    Ok(value)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RunArgs<'a> {
    run_id: &'a str,
}

#[tauri::command]
fn cancel(
    state: State<'_, Companion>,
    request: SignedRequest,
    run_id: String,
) -> Result<bool, String> {
    verify_signed(&state, &request, "cancel", &RunArgs { run_id: &run_id })?;
    if state.emergency.cancel(&run_id) {
        state.record(
            &run_id,
            "Cancellation requested for active native action.",
            true,
        );
        Ok(true)
    } else {
        state.record(
            &run_id,
            "Cancellation refused: that run is not active.",
            false,
        );
        Err("That native run is not active.".into())
    }
}

/// Emergency stop: halt everything immediately. Always available, never gated.
#[tauri::command]
fn emergency_stop(app: tauri::AppHandle, state: State<'_, Companion>) -> Result<bool, String> {
    state.emergency.halt();
    state.browser.emergency_stop();
    state.python.emergency_stop();
    state.record("-", "EMERGENCY STOP — all companion actions halted.", true);
    let _ = app.emit("ocade://emergency-stop", true);
    Ok(true)
}

/// Clear a latched emergency stop.
///
/// REQUIRES A SIGNED REQUEST: re-enabling computer control is privileged.
/// Note the deliberate asymmetry with `emergency_stop`, which is intentionally
/// unauthenticated — halting is never the dangerous direction, and it must work
/// even if the session is broken.
#[tauri::command]
fn reset_emergency_stop(
    state: State<'_, Companion>,
    request: SignedRequest,
) -> Result<bool, String> {
    verify_signed(
        &state,
        &request,
        "reset_emergency_stop",
        &serde_json::json!({}),
    )?;

    state.emergency.reset();
    state.record("-", "Emergency stop reset.", true);
    Ok(true)
}

#[tauri::command]
fn audit_log(state: State<'_, Companion>) -> Vec<AuditEntry> {
    state
        .audit
        .lock()
        .map(|log| log.iter().cloned().collect())
        .unwrap_or_default()
}

fn main() {
    tauri::Builder::default()
        // The global-shortcut plugin is installed in `setup` instead, so it can
        // carry the handler. Registering it here as well would panic.
        .plugin(tauri_plugin_clipboard_manager::init())
        // Signed updates. Verification is enforced by the updater itself against
        // the public key in tauri.conf.json; an unsigned or mis-signed bundle is
        // rejected, so a compromised update endpoint cannot push a payload.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Companion::new())
        .setup(|app| {
            app.state::<Companion>()
                .browser
                .configure(browser_host::locate_sidecar());
            app.state::<Companion>()
                .python
                .configure(browser_host::locate_python_sidecar());

            /*
             * THE MAIN WINDOW: the real OCADE Control + Work conversation.
             *
             * This is the link the product was missing. Until now this shell
             * opened only the status overlay, so the conversation lived in an
             * ordinary browser where `detectTauri()` is false and the companion
             * is permanently unavailable — which is why `liveRuntime.ready()`
             * could never be true and PC control was unreachable from the GUI.
             *
             * Failure is deliberately NOT fatal. The overlay, the audit log and
             * emergency stop must survive an application server that will not
             * start; a shell that refuses to launch takes the stop button with
             * it, which is the one control that must always be reachable.
             */
            /*
             * Resolution is by EXISTENCE, not by whether the call succeeded.
             *
             * `resolve` returns Ok for a path that was never created, which is
             * exactly what a plain `cargo build` produces: resources are only
             * copied by `tauri build`. Trusting Ok meant the fallback never ran,
             * the entry did not exist, and the shell came up with a tray icon
             * and no conversation — silently, because the refusal went to the
             * audit log rather than to a console nobody was reading.
             */
            let bundled = app
                .path()
                .resolve(
                    "app-host/server/index.mjs",
                    tauri::path::BaseDirectory::Resource,
                )
                .ok()
                .filter(|path| path.is_file());
            let app_entry = bundled.unwrap_or_else(|| {
                // Development: the built server sits in the worktree rather
                // than in a bundle's resource directory.
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join("resources/app-host/server/index.mjs")
            });
            match app.state::<Companion>().app_server.start(&app_entry) {
                Ok(origin) => {
                    /*
                     * The window opens at the application root, unless a local
                     * start path is named.
                     *
                     * `OCADE_START_PATH` exists so a specific surface can be
                     * opened directly during local testing and acceptance runs
                     * — reaching Demo Control + Work otherwise means clicking
                     * through the landing page every launch.
                     *
                     * It is a PATH, never a URL: the origin is always the
                     * loopback server this shell just started, so this can move
                     * the window within OCADE and can never point it at
                     * somewhere else.
                     */
                    let mut url = tauri::Url::parse(&origin)
                        .map_err(|_| std::io::Error::other("Invalid application origin."))?;
                    if let Ok(path) = std::env::var("OCADE_START_PATH") {
                        if path.starts_with('/') && !path.starts_with("//") {
                            url.set_path(&path);
                        }
                    }
                    tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::External(url))
                        .title("OCADE")
                        .inner_size(1280.0, 860.0)
                        .min_inner_size(880.0, 600.0)
                        .resizable(true)
                        .visible(true)
                        .center()
                        .build()?;
                }
                Err(reason) => {
                    // Recorded rather than swallowed: the overlay reads this
                    // log, so the user is told why the conversation is missing
                    // instead of meeting an empty window. Also written to
                    // stderr, because a shell that starts without its
                    // conversation and explains itself only inside an invisible
                    // window is indistinguishable from one that silently broke.
                    eprintln!("OCADE application server did not start: {reason}");
                    app.state::<Companion>().record("-", &reason, false);
                }
            }
            let data_dir = app.path().app_data_dir()?;
            let journal_path = data_dir.join("operation-journal-v1.jsonl");
            app.state::<Companion>()
                .operations
                .lock()
                .map_err(|_| std::io::Error::other("Companion busy"))?
                .configure(journal_path)
                .map_err(std::io::Error::other)?;
            let allowlist_path = data_dir.join("allowlist-v1.json");
            let loaded_allowlist = if allowlist_path.exists() {
                let bytes = fs::read(&allowlist_path)?;
                let document: AllowlistDocument = serde_json::from_slice(&bytes)
                    .map_err(|_| std::io::Error::other("The companion allowlist is corrupt."))?;
                if document.version != 1 {
                    return Err(std::io::Error::other(
                        "The companion allowlist version is unsupported.",
                    )
                    .into());
                }
                Allowlist {
                    apps: document.apps,
                    directories: document
                        .paths
                        .into_iter()
                        .filter_map(|path| PathBuf::from(path).canonicalize().ok())
                        .filter(|path| path.is_dir())
                        .collect(),
                }
            } else {
                Allowlist::default()
            };
            *app.state::<Companion>()
                .allow
                .lock()
                .map_err(|_| std::io::Error::other("Companion busy"))? = loaded_allowlist;
            *app.state::<Companion>()
                .allowlist_path
                .lock()
                .map_err(|_| std::io::Error::other("Companion busy"))? = Some(allowlist_path);
            let artifact_dir = app.path().app_cache_dir()?.join("captures");
            fs::create_dir_all(&artifact_dir)?;
            platform::prune_artifacts(&artifact_dir).map_err(std::io::Error::other)?;
            *app.state::<Companion>()
                .artifact_dir
                .lock()
                .map_err(|_| std::io::Error::other("Companion busy"))? = Some(artifact_dir);

            // Tray: quick access to the overlay and an always-present stop.
            let show = MenuItem::with_id(app, "show", "Show OCADE", true, None::<&str>)?;
            let stop = MenuItem::with_id(app, "stop", "Emergency stop", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &stop, &quit])?;

            TrayIconBuilder::with_id("caera-tray")
                .menu(&menu)
                .tooltip("OCADE — CAERA Companion")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("overlay") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "stop" => {
                        if let Some(state) = app.try_state::<Companion>() {
                            state.emergency.halt();
                            state.browser.emergency_stop();
                            state.python.emergency_stop();
                            state.record("-", "EMERGENCY STOP from tray.", true);
                        }
                        let _ = app.emit("ocade://emergency-stop", true);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // Global hotkeys. Emergency stop MUST work even when OCADE has no
            // focus — that is the whole point of a panic key.
            {
                use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

                // Ctrl/Cmd+Shift+Escape-style panic key, and a show/hide toggle.
                let stop_key =
                    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::F12);
                let toggle_key =
                    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);

                let handle = app.handle().clone();
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |_app, shortcut, event| {
                            // Fire on press only, so a held key cannot repeat.
                            if event.state() != ShortcutState::Pressed {
                                return;
                            }
                            if shortcut == &stop_key {
                                if let Some(state) = handle.try_state::<Companion>() {
                                    state.emergency.halt();
                                    state.browser.emergency_stop();
                                    state.python.emergency_stop();
                                    state.record("-", "EMERGENCY STOP from global hotkey.", true);
                                }
                                let _ = handle.emit("ocade://emergency-stop", true);
                            } else if shortcut == &toggle_key {
                                if let Some(w) = handle.get_webview_window("overlay") {
                                    // Toggle, so the same key dismisses it.
                                    match w.is_visible() {
                                        Ok(true) => {
                                            let _ = w.hide();
                                        }
                                        _ => {
                                            let _ = w.show();
                                            let _ = w.set_focus();
                                        }
                                    }
                                }
                            }
                        })
                        .build(),
                )?;

                app.global_shortcut().register(stop_key)?;
                app.global_shortcut().register(toggle_key)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_session,
            close_session,
            status,
            application_inventory,
            get_allowlist,
            set_allowlist,
            browser_host_request,
            python_host_request,
            execute,
            observe,
            cancel,
            emergency_stop,
            reset_emergency_stop,
            audit_log
        ])
        .build(tauri::generate_context!())
        .expect("failed to start the CAERA Companion")
        .run(|app, event| {
            /*
             * The application server must not outlive the shell.
             *
             * A stranded Node process keeps its loopback port, and the next
             * launch then fails to bind in a way nobody can diagnose from the
             * outside — the window simply never appears. Killing it on exit is
             * what makes a second launch behave like the first.
             */
            if matches!(
                event,
                tauri::RunEvent::Exit | tauri::RunEvent::ExitRequested { .. }
            ) {
                app.state::<Companion>().app_server.stop();
            }
        });
}
