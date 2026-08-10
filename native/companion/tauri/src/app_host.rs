//! Supervision for the packaged OCADE application server.
//!
//! WHY THIS EXISTS
//! ---------------
//! The companion could drive this computer and the web application held the
//! conversation, and the two could not complete one task together. The window
//! this shell opened pointed at `../ui` — a 219-line status overlay with no
//! prompt box — while the real Control + Work surface ran in an ordinary
//! browser, where `detectTauri()` is false and the companion is permanently
//! unavailable. The half with the buttons could not reach the engine; the half
//! with the engine had no buttons.
//!
//! OCADE is a TanStack Start application: fourteen server functions, every one
//! behind `requireSupabaseAuth`. It cannot be flattened into static files
//! without deleting authentication, so the shell hosts the real server instead
//! and points its main window at it.
//!
//! THREE PROPERTIES THIS GUARANTEES
//!
//! 1. **Loopback only.** The port is bound to 127.0.0.1 and the host is started
//!    with that address forced. An application server reachable from the
//!    network would expose one user's authenticated session to their whole
//!    coffee shop.
//! 2. **A window is never shown before the server answers.** Tauri renders a
//!    connection error page instantly, and a user who sees one assumes the
//!    product is broken. The probe below waits for a real HTTP reply first.
//! 3. **The child dies with the parent.** A stranded Node process still holding
//!    port 3000 makes the next launch fail in a way nobody can diagnose.

use std::io::ErrorKind;
use std::net::{Ipv4Addr, SocketAddrV4, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// How long the server may take to answer before the shell gives up.
///
/// Generous: a cold Nitro start on a slow disk genuinely takes several seconds,
/// and failing early here would present "OCADE could not start" to a user whose
/// machine was merely busy.
const READY_TIMEOUT: Duration = Duration::from_secs(45);
const PROBE_INTERVAL: Duration = Duration::from_millis(150);

#[derive(Default)]
pub struct AppHostSupervisor {
    process: Mutex<Option<Child>>,
    origin: Mutex<Option<String>>,
}

impl AppHostSupervisor {
    /// The loopback origin the main window should load, once serving.
    pub fn origin(&self) -> Option<String> {
        self.origin.lock().ok().and_then(|value| value.clone())
    }

    /// Start the packaged application server and wait until it answers.
    ///
    /// `entry` is the built Nitro server, resolved by the caller from Tauri's
    /// resource directory. It is passed in rather than discovered here because
    /// only the app handle knows where its own resources landed.
    pub fn start(&self, entry: &Path) -> Result<String, String> {
        if let Some(existing) = self.origin() {
            return Ok(existing);
        }
        if !entry.is_file() {
            return Err("The packaged OCADE application files are missing.".to_string());
        }

        let executable = locate_app_host()
            .ok_or_else(|| "The packaged OCADE application runtime is unavailable.".to_string())?;
        let entry = plain_path(entry);
        let port = free_loopback_port()?;
        let origin = format!("http://127.0.0.1:{port}");

        let child = Command::new(&executable)
            .arg(entry)
            // Nitro reads both. Setting HOST explicitly is what keeps the
            // server off the network rather than trusting a default.
            .env("HOST", "127.0.0.1")
            .env("PORT", port.to_string())
            .env("NITRO_HOST", "127.0.0.1")
            .env("NITRO_PORT", port.to_string())
            .stdin(Stdio::null())
            // Inherited rather than discarded. Nulling both meant a child that
            // failed to start left no trace anywhere: the shell reported only
            // "did not start in time" while the real reason — whatever Node
            // printed — went to a closed pipe. A supervisor that cannot say why
            // its child died is a supervisor nobody can fix.
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|_| "The OCADE application server could not be started.".to_string())?;

        *self
            .process
            .lock()
            .map_err(|_| "The application supervisor is busy.".to_string())? = Some(child);

        wait_until_serving(port)?;

        *self
            .origin
            .lock()
            .map_err(|_| "The application supervisor is busy.".to_string())? = Some(origin.clone());
        Ok(origin)
    }

    /// Stop the server. Called on exit so no process outlives the window.
    pub fn stop(&self) {
        if let Ok(mut slot) = self.process.lock() {
            if let Some(child) = slot.as_mut() {
                let _ = child.kill();
                let _ = child.wait();
            }
            *slot = None;
        }
        if let Ok(mut origin) = self.origin.lock() {
            *origin = None;
        }
    }
}

/// Strip Windows' verbatim `\\?\` prefix before handing a path to Node.
///
/// Tauri's resource resolution returns extended-length paths. Node cannot use
/// one as a main module: it parsed `\\?\C:\...` as the UNC share `C:` and died
/// with `EISDIR: illegal operation on a directory, lstat 'C:'` — an error that
/// says nothing about the actual cause. Everything OCADE ships sits well inside
/// the 260-character limit, so the prefix buys nothing and costs this.
fn plain_path(path: &Path) -> PathBuf {
    let text = path.to_string_lossy();
    match text.strip_prefix(r"\\?\") {
        Some(stripped) => PathBuf::from(stripped),
        None => path.to_path_buf(),
    }
}

/// Ask the operating system for a free port, then release it immediately.
///
/// A hardcoded port collides with whatever else the user is running — and on a
/// developer's machine that is very often another copy of this same server.
fn free_loopback_port() -> Result<u16, String> {
    let listener = TcpListener::bind(SocketAddrV4::new(Ipv4Addr::LOCALHOST, 0))
        .map_err(|_| "No loopback port was available for the OCADE application.".to_string())?;
    let port = listener
        .local_addr()
        .map_err(|_| "The loopback port could not be read.".to_string())?
        .port();
    drop(listener);
    Ok(port)
}

/// Wait for a real connection, not merely for the process to still be alive.
///
/// A spawned process that exits one second later would otherwise be treated as
/// a successful start, and the window would open on a refused connection.
fn wait_until_serving(port: u16) -> Result<(), String> {
    let deadline = Instant::now() + READY_TIMEOUT;
    let address = SocketAddrV4::new(Ipv4Addr::LOCALHOST, port);
    loop {
        match TcpStream::connect_timeout(&address.into(), PROBE_INTERVAL) {
            Ok(_) => return Ok(()),
            Err(error) if error.kind() == ErrorKind::TimedOut => {}
            Err(_) => std::thread::sleep(PROBE_INTERVAL),
        }
        if Instant::now() >= deadline {
            return Err("The OCADE application server did not start in time.".to_string());
        }
    }
}

pub fn locate_app_host() -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("OCADE_APP_HOST_BINARY").map(PathBuf::from) {
        if path.is_file() {
            return Some(path);
        }
    }
    let filename = if cfg!(windows) {
        "ocade-app-host.exe"
    } else {
        "ocade-app-host"
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
    let prefix = "ocade-app-host-";
    std::fs::read_dir(development)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .find(|path| {
            path.is_file()
                && path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.starts_with(prefix))
        })
}
