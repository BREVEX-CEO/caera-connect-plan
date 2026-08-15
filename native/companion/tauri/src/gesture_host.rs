//! Supervision for the packaged, local-only MediaPipe gesture process.
//!
//! There is no network listener and no arbitrary command field. The Rust host
//! can start one of exactly two modes: visible preview, or visible preview with
//! cursor control explicitly armed. Stopping always kills and waits for the
//! child so a held drag cannot outlive the OCADE session.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

struct GestureProcess {
    child: Child,
    control_enabled: bool,
    camera_index: u8,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GestureStatus {
    pub available: bool,
    pub running: bool,
    pub control_enabled: bool,
    pub camera_index: Option<u8>,
    pub reason: Option<String>,
}

pub struct GestureHostSupervisor {
    executable: Mutex<Option<PathBuf>>,
    process: Mutex<Option<GestureProcess>>,
}

impl Default for GestureHostSupervisor {
    fn default() -> Self {
        Self {
            executable: Mutex::new(None),
            process: Mutex::new(None),
        }
    }
}

impl GestureHostSupervisor {
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

    pub fn status(&self) -> GestureStatus {
        let available = self.available();
        let Ok(mut slot) = self.process.lock() else {
            return GestureStatus {
                available,
                running: false,
                control_enabled: false,
                camera_index: None,
                reason: Some("Gesture supervisor is busy.".into()),
            };
        };
        let mut clear = false;
        let (running, control_enabled, camera_index) = if let Some(process) = slot.as_mut() {
            match process.child.try_wait() {
                Ok(None) => (true, process.control_enabled, Some(process.camera_index)),
                _ => {
                    clear = true;
                    (false, false, None)
                }
            }
        } else {
            (false, false, None)
        };
        if clear {
            *slot = None;
        }
        GestureStatus {
            available,
            running,
            control_enabled,
            camera_index,
            reason: if available {
                None
            } else {
                Some("This desktop build does not contain the gesture-control sidecar.".into())
            },
        }
    }

    pub fn start(&self, camera_index: u8, control_enabled: bool) -> Result<GestureStatus, String> {
        self.stop();
        let executable = self
            .executable
            .lock()
            .map_err(|_| "Gesture supervisor is busy.".to_string())?
            .clone()
            .ok_or_else(|| "The packaged gesture-control sidecar is unavailable.".to_string())?;

        let mut command = Command::new(executable);
        command
            .arg("--camera-index")
            .arg(camera_index.to_string())
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        if control_enabled {
            command.arg("--enable-control");
        }
        let child = command
            .spawn()
            .map_err(|_| "Gesture control could not be started.".to_string())?;
        *self
            .process
            .lock()
            .map_err(|_| "Gesture supervisor is busy.".to_string())? = Some(GestureProcess {
            child,
            control_enabled,
            camera_index,
        });

        // Catch missing camera/model/DLL failures before claiming success. The
        // process otherwise stays supervised and can be stopped at any time.
        thread::sleep(Duration::from_millis(350));
        let status = self.status();
        if !status.running {
            return Err(
                "Gesture control stopped during startup. Check camera access and try preview mode."
                    .into(),
            );
        }
        Ok(status)
    }

    pub fn stop(&self) {
        if let Ok(mut slot) = self.process.lock() {
            if let Some(mut process) = slot.take() {
                let _ = process.child.kill();
                let _ = process.child.wait();
            }
        }
    }
}

pub fn locate_sidecar() -> Option<PathBuf> {
    if let Some(path) = std::env::var_os("OCADE_GESTURE_HOST_BINARY").map(PathBuf::from) {
        if path.is_file() {
            return Some(path);
        }
    }
    let filename = if cfg!(windows) {
        "ocade-gesture-host.exe"
    } else {
        "ocade-gesture-host"
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
    let prefix = "ocade-gesture-host-";
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
