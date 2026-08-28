//! Wiring the background-companion protocol into the desktop app.
//!
//! WHY THIS FILE IS THIN. Every rule the protocol depends on — one transfer per
//! version, the website's source ladder worked in order, a digest reported only
//! for a finished artifact, an uninstall that answers honestly — lives in
//! `caera-companion-safety::model_server`, which is `std`-only and therefore
//! testable without GTK, WebKit or a network. What is left here is the part
//! that genuinely needs this crate: HTTPS, and a thread to run it on.
//!
//! WHAT CHANGES ABOUT THIS APPLICATION. It gains a listener, and the module
//! that said "the sidecar has no listener" is still right about the sidecar.
//! This one binds `127.0.0.1` only, answers five endpoints, and is reachable by
//! any process on this machine — which is why the website never treats it as
//! authenticated and holds whatever it prepares to the published digest before
//! activating anything.

use std::fs::{self, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use caera_companion_safety::model_server::{bind_default, serve, Fetcher, ModelHost};
use sha2::{Digest, Sha256};

/// A resumable HTTPS fetch, which is the one thing the safety crate cannot do.
struct HttpsFetcher;

impl Fetcher for HttpsFetcher {
    fn fetch(&self, url: &str, destination: &Path, resume_from: u64) -> Result<Vec<u8>, String> {
        /*
         * RANGE, AND APPEND RATHER THAN TRUNCATE.
         *
         * A fetcher that quietly restarted would undo the only thing a
         * companion is for: finishing what a tab could not. `resume_from` comes
         * from bytes already on disk, so the request asks for the remainder and
         * the handle seeks to the end before writing.
         */
        let mut request = ureq::get(url);
        if resume_from > 0 {
            request = request.set("range", &format!("bytes={resume_from}-"));
        }
        let response = request.call().map_err(|error| error.to_string())?;

        let mut file = OpenOptions::new()
            .create(true)
            .write(true)
            .read(true)
            .open(destination)
            .map_err(|error| error.to_string())?;
        if resume_from > 0 {
            file.seek(SeekFrom::Start(resume_from))
                .map_err(|error| error.to_string())?;
        } else {
            file.set_len(0).map_err(|error| error.to_string())?;
        }

        let mut reader = response.into_reader();
        let mut buffer = vec![0u8; 1 << 16];
        loop {
            let read = reader.read(&mut buffer).map_err(|error| error.to_string())?;
            if read == 0 {
                break;
            }
            file.write_all(&buffer[..read])
                .map_err(|error| error.to_string())?;
        }
        file.flush().map_err(|error| error.to_string())?;

        /*
         * Hashed from the file rather than from what was just written, because
         * a resumed transfer only ever saw the tail. Streamed, so a gigabyte
         * never sits in memory.
         */
        file.seek(SeekFrom::Start(0)).map_err(|error| error.to_string())?;
        let mut hasher = Sha256::new();
        loop {
            let read = file.read(&mut buffer).map_err(|error| error.to_string())?;
            if read == 0 {
                break;
            }
            hasher.update(&buffer[..read]);
        }
        Ok(hasher.finalize().to_vec())
    }
}

/// Where this platform keeps prepared models. One directory, so uninstall can
/// be complete without guessing at names.
fn model_directory() -> PathBuf {
    let base = dirs_next_data_dir().unwrap_or_else(std::env::temp_dir);
    base.join("OCADE").join("intelligence")
}

fn dirs_next_data_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("LOCALAPPDATA").map(PathBuf::from)
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var_os("HOME").map(|home| PathBuf::from(home).join("Library/Application Support"))
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::env::var_os("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share")))
    }
}

fn platform() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

/// Start the companion's model host.
///
/// Returns without a listener rather than failing the application: a desktop
/// OCADE whose port is already taken is still a working desktop OCADE, and the
/// website falls through to its own transfer exactly as it does on a machine
/// with no companion at all.
pub fn start() {
    let directory = model_directory();
    let _ = fs::create_dir_all(&directory);

    let host = Arc::new(ModelHost::new(
        Arc::new(HttpsFetcher),
        directory,
        platform(),
    ));

    let listener = match bind_default() {
        Ok(listener) => listener,
        Err(_) => return,
    };

    // The jobs run on their own threads so a gigabyte never blocks the probe
    // the browser makes in front of first paint.
    let serving = Arc::clone(&host);
    std::thread::spawn(move || {
        let worker = Arc::clone(&serving);
        std::thread::spawn(move || loop {
            let pending: Vec<String> = {
                let registry = worker.registry.lock().unwrap_or_else(|e| e.into_inner());
                registry
                    .ids()
                    .into_iter()
                    .filter(|id| {
                        registry.get(id).map(|job| {
                            job.phase == caera_companion_safety::model_host::Phase::Downloading
                        }) == Some(true)
                    })
                    .collect()
            };
            for id in pending {
                worker.run_job(&id);
            }
            std::thread::sleep(std::time::Duration::from_millis(400));
        });
        serve(&listener, &serving);
    });
}
