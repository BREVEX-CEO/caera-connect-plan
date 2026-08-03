//! Bounded operating-system backend for the companion.
//!
//! Every program and script invoked here is fixed by this binary. User values
//! are passed as process arguments, never interpolated into shell source.

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Output, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use caera_companion_safety::ipc::sha256_hex;
use caera_companion_safety::{is_protected_text, CompanionAction};
use serde::{Deserialize, Serialize};

const ACTION_TIMEOUT: Duration = Duration::from_secs(30);
const CAPTURE_RETENTION: Duration = Duration::from_secs(24 * 60 * 60);
const MAX_CAPTURES: usize = 50;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum PlatformOutput {
    ScreenCapture {
        path: String,
        mime_type: String,
        sha256: String,
    },
    Windows {
        titles: Vec<String>,
    },
    Accessibility {
        nodes: Vec<AccessibilityNode>,
    },
    Text {
        value: String,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessibilityNode {
    pub role: String,
    pub name: String,
    pub enabled: bool,
}

#[derive(Clone, Debug)]
pub struct PlatformResult {
    pub detail: String,
    pub output: Option<PlatformOutput>,
}

#[derive(Clone, Debug)]
pub struct BackendStatus {
    pub available: bool,
    pub capabilities: Vec<String>,
    pub reason: Option<String>,
    pub permissions: Vec<PermissionStatus>,
    pub install_guidance: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatus {
    pub id: String,
    pub label: String,
    pub state: String,
    pub guidance: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplicationInfo {
    pub app_id: String,
    pub label: String,
    pub process_id: u32,
    pub window_title: String,
}

pub fn discover() -> BackendStatus {
    let mut capabilities = ["app.open", "clipboard.read", "clipboard.write", "file.open"]
        .map(str::to_string)
        .to_vec();

    #[cfg(target_os = "windows")]
    {
        if program_available("powershell.exe") {
            capabilities.extend(
                [
                    "screen.read",
                    "window.list",
                    "accessibility.read",
                    "window.focus",
                    "window.arrange",
                    "text.type",
                    "selection.read",
                    "selection.replace",
                ]
                .map(str::to_string),
            );
        }
    }
    #[cfg(target_os = "macos")]
    {
        if Path::new("/usr/bin/osascript").is_file() {
            capabilities.extend(
                [
                    "window.list",
                    "window.focus",
                    "window.arrange",
                    "text.type",
                    "selection.read",
                    "selection.replace",
                ]
                .map(str::to_string),
            );
        }
        if Path::new("/usr/sbin/screencapture").is_file() {
            capabilities.push("screen.read".into());
        }
    }
    #[cfg(target_os = "linux")]
    {
        if program_available("wmctrl") {
            capabilities
                .extend(["window.list", "window.focus", "window.arrange"].map(str::to_string));
        }
        if program_available("xdotool") {
            capabilities
                .extend(["text.type", "selection.read", "selection.replace"].map(str::to_string));
        }
        if screenshot_program().is_some() {
            capabilities.push("screen.read".into());
        }
    }

    capabilities.sort_unstable();
    capabilities.dedup();
    let unavailable = capabilities.len() <= 4;
    let permissions = permission_statuses();
    let install_guidance = permissions
        .iter()
        .filter(|permission| permission.state != "granted" && permission.state != "not_required")
        .map(|permission| permission.guidance.clone())
        .collect();
    BackendStatus {
        available: !unavailable,
        capabilities: if unavailable {
            Vec::new()
        } else {
            capabilities
        },
        reason: unavailable.then(|| {
            "The required operating-system control tools are unavailable on this machine.".into()
        }),
        permissions,
        install_guidance,
    }
}

fn permission(id: &str, label: &str, state: &str, guidance: &str) -> PermissionStatus {
    PermissionStatus {
        id: id.into(),
        label: label.into(),
        state: state.into(),
        guidance: guidance.into(),
    }
}

fn permission_statuses() -> Vec<PermissionStatus> {
    #[cfg(target_os = "windows")]
    {
        let powershell = program_available("powershell.exe");
        let interactive = windows_interactive();
        vec![
            permission(
                "interactive_desktop",
                "Interactive desktop session",
                if interactive { "granted" } else { "denied" },
                "Sign in to an interactive Windows desktop; the companion refuses Session 0 and service contexts.",
            ),
            permission(
                "accessibility",
                "Window and accessibility control",
                if powershell && interactive { "unknown" } else { "denied" },
                "Run the signed companion self-test in the interactive desktop to verify UI Automation before enabling actions.",
            ),
            permission(
                "screen_capture",
                "Screen capture",
                if powershell && interactive { "unknown" } else { "denied" },
                "Run the signed companion capture self-test; captures remain disabled until a non-empty private-cache image is observed.",
            ),
            permission(
                "input_control",
                "Keyboard and clipboard control",
                if powershell && interactive { "unknown" } else { "denied" },
                "Run the signed companion input self-test on temporary text. Protected fields remain blocked regardless of the result.",
            ),
            permission(
                "approved_files",
                "Approved files and folders",
                "not_required",
                "Choose explicit directories in OCADE; Windows does not require a separate global file permission.",
            ),
        ]
    }
    #[cfg(target_os = "macos")]
    {
        return vec![
            permission(
                "accessibility",
                "Accessibility",
                "unknown",
                "Open System Settings > Privacy & Security > Accessibility and enable the signed OCADE companion.",
            ),
            permission(
                "screen_capture",
                "Screen Recording",
                "unknown",
                "Open System Settings > Privacy & Security > Screen Recording and enable the signed OCADE companion.",
            ),
            permission(
                "automation",
                "Application automation",
                "unknown",
                "Approve only the applications OCADE needs when macOS displays an Automation prompt.",
            ),
        ];
    }
    #[cfg(target_os = "linux")]
    {
        let display = env::var("DISPLAY").is_ok() || env::var("WAYLAND_DISPLAY").is_ok();
        return vec![
            permission(
                "desktop_session",
                "Desktop session",
                if display { "granted" } else { "denied" },
                "Start the companion inside the signed-in graphical desktop session.",
            ),
            permission(
                "window_control",
                "Window control tools",
                if program_available("wmctrl") && program_available("xdotool") {
                    "granted"
                } else {
                    "denied"
                },
                "Install wmctrl and xdotool through the operating system package manager, then restart the companion.",
            ),
            permission(
                "screen_capture",
                "Screen capture tool",
                if screenshot_program().is_some() { "granted" } else { "denied" },
                "Install gnome-screenshot, scrot, or ImageMagick import through the operating system package manager.",
            ),
        ];
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        vec![permission(
            "unsupported_platform",
            "Operating-system integration",
            "denied",
            "This operating system has no approved OCADE companion backend.",
        )]
    }
}

#[cfg(target_os = "windows")]
fn windows_interactive() -> bool {
    Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "[Console]::Out.Write([Environment]::UserInteractive)",
        ])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()
        .is_some_and(|output| {
            output.status.success()
                && String::from_utf8_lossy(&output.stdout).eq_ignore_ascii_case("true")
        })
}

pub fn application_inventory(cancelled: Arc<AtomicBool>) -> Result<Vec<ApplicationInfo>, String> {
    ensure_not_cancelled(&cancelled)?;
    #[cfg(target_os = "windows")]
    let output = run_program(
        Command::new("powershell.exe").args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-Process|Where-Object {$_.MainWindowTitle}|Sort-Object ProcessName,Id|ForEach-Object {[Console]::Out.WriteLine(\"$($_.Id)`t$($_.ProcessName)`t$($_.MainWindowTitle)\")}",
        ]),
        cancelled,
    )?;
    #[cfg(target_os = "macos")]
    let output = run_program(
        Command::new("/usr/bin/osascript").args([
            "-e",
            "tell application \"System Events\" to get unix id & \"\\t\" & name & \"\\t\" & name of every application process whose visible is true",
        ]),
        cancelled,
    )?;
    #[cfg(target_os = "linux")]
    let output = run_program(Command::new("wmctrl").arg("-lp"), cancelled)?;
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return Err("Application inventory is unsupported on this operating system.".into());

    #[allow(unreachable_code)]
    {
        let text = text_output(output)?;
        Ok(text
            .lines()
            .filter_map(|line| {
                let mut fields = line.splitn(3, '\t');
                let process_id = fields.next()?.trim().parse::<u32>().ok()?;
                let app_id = fields.next()?.trim();
                let title = fields.next().unwrap_or("").trim();
                if app_id.is_empty() {
                    return None;
                }
                let window_title = if is_protected_text(title) {
                    "[protected window]".to_string()
                } else {
                    title.chars().take(256).collect()
                };
                Some(ApplicationInfo {
                    app_id: app_id.chars().take(128).collect(),
                    label: if window_title.is_empty() {
                        app_id.chars().take(128).collect()
                    } else {
                        window_title.clone()
                    },
                    process_id,
                    window_title,
                })
            })
            .take(100)
            .collect())
    }
}

pub fn prune_artifacts(directory: &Path) -> Result<(), String> {
    let mut captures = fs::read_dir(directory)
        .map_err(|_| "The private screenshot directory could not be inspected.".to_string())?
        .filter_map(Result::ok)
        .filter(|entry| {
            entry
                .file_name()
                .to_str()
                .is_some_and(|name| name.starts_with("screen-") && name.ends_with(".png"))
        })
        .filter_map(|entry| {
            let modified = entry.metadata().ok()?.modified().ok()?;
            Some((modified, entry.path()))
        })
        .collect::<Vec<_>>();
    captures.sort_by_key(|(modified, _)| *modified);
    let now = std::time::SystemTime::now();
    let excess = captures.len().saturating_sub(MAX_CAPTURES);
    for (index, (modified, path)) in captures.into_iter().enumerate() {
        let expired = now
            .duration_since(modified)
            .map(|age| age > CAPTURE_RETENTION)
            .unwrap_or(false);
        if expired || index < excess {
            let _ = fs::remove_file(path);
        }
    }
    Ok(())
}

pub fn perform(
    action: &CompanionAction,
    run_id: &str,
    artifact_dir: &Path,
    cancelled: Arc<AtomicBool>,
) -> Result<PlatformResult, String> {
    ensure_not_cancelled(&cancelled)?;
    match action {
        CompanionAction::ScreenRead => capture_screen(run_id, artifact_dir, cancelled),
        CompanionAction::WindowList => {
            let titles = window_titles(cancelled)?;
            Ok(PlatformResult {
                detail: format!("Read {} open window title(s).", titles.len()),
                output: Some(PlatformOutput::Windows { titles }),
            })
        }
        CompanionAction::AccessibilityRead => {
            let nodes = accessibility_tree(cancelled)?;
            Ok(PlatformResult {
                detail: format!("Read {} bounded accessibility node(s).", nodes.len()),
                output: Some(PlatformOutput::Accessibility { nodes }),
            })
        }
        CompanionAction::WindowFocus { target } => {
            focus_window(target, cancelled)?;
            Ok(receipt("Focused the approved window."))
        }
        CompanionAction::WindowArrange { layout, target } => {
            if let Some(target) = target {
                focus_window(target, cancelled.clone())?;
            }
            arrange_window(layout, cancelled)?;
            Ok(receipt("Arranged the approved window."))
        }
        CompanionAction::AppOpen { app_id } => {
            ensure_not_cancelled(&cancelled)?;
            Command::new(app_id)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .map_err(|_| "The approved application could not be started.".to_string())?;
            Ok(receipt("Started the approved application."))
        }
        CompanionAction::FileOpen { path } => {
            open_file(Path::new(path), cancelled)?;
            Ok(receipt("Opened the approved file or folder."))
        }
        CompanionAction::TextType { .. }
        | CompanionAction::ClipboardRead
        | CompanionAction::ClipboardWrite { .. }
        | CompanionAction::SelectionRead
        | CompanionAction::SelectionReplace { .. } => {
            Err("This action is handled by the host clipboard boundary.".into())
        }
    }
}

fn accessibility_tree(cancelled: Arc<AtomicBool>) -> Result<Vec<AccessibilityNode>, String> {
    #[cfg(target_os = "windows")]
    {
        let output = run_program(
            Command::new("powershell.exe").args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Add-Type -AssemblyName UIAutomationClient; $root=[System.Windows.Automation.AutomationElement]::FocusedElement; if($null -eq $root){exit 4}; $walker=[System.Windows.Automation.TreeWalker]::ControlViewWalker; $script:walk={param($node,$depth) if($null -eq $node -or $depth -gt 8){return}; $role=$node.Current.ControlType.ProgrammaticName; $name=($node.Current.Name -replace \"[`r`n`t]\",' ').Trim(); $enabled=$node.Current.IsEnabled; [Console]::Out.WriteLine(\"$role`t$name`t$enabled\"); $child=$walker.GetFirstChild($node); while($null -ne $child){& $script:walk $child ($depth+1); $child=$walker.GetNextSibling($child)}}; & $script:walk $root 0",
            ]),
            cancelled,
        )?;
        let text = text_output(output)?;
        Ok(text
            .lines()
            .filter_map(|line| {
                let mut fields = line.splitn(3, '\t');
                let role = fields.next()?.trim();
                let name = fields.next().unwrap_or("").trim();
                let enabled = fields
                    .next()
                    .is_some_and(|value| value.eq_ignore_ascii_case("true"));
                if role.is_empty() {
                    return None;
                }
                Some(AccessibilityNode {
                    role: role
                        .strip_prefix("ControlType.")
                        .unwrap_or(role)
                        .chars()
                        .take(80)
                        .collect(),
                    name: if is_protected_text(name) {
                        "[protected control]".into()
                    } else {
                        name.chars().take(200).collect()
                    },
                    enabled,
                })
            })
            .take(500)
            .collect())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = cancelled;
        Err("Accessibility-tree reading is not yet runtime-proven on this operating system.".into())
    }
}

pub fn send_copy(cancelled: Arc<AtomicBool>) -> Result<(), String> {
    send_shortcut("copy", cancelled)
}

pub fn send_paste(cancelled: Arc<AtomicBool>) -> Result<(), String> {
    send_shortcut("paste", cancelled)
}

pub fn active_window_title(cancelled: Arc<AtomicBool>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let script = "$u=Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();' -Name U -Namespace O -PassThru; $h=$u::GetForegroundWindow(); $p=Get-Process|Where-Object {$_.MainWindowHandle -eq $h}|Select-Object -First 1 -ExpandProperty MainWindowTitle; if($p){[Console]::Out.Write($p)}";
        return text_output(run_program(
            Command::new("powershell.exe").args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                script,
            ]),
            cancelled,
        )?);
    }
    #[cfg(target_os = "macos")]
    {
        return text_output(run_program(
            Command::new("/usr/bin/osascript").args([
                "-e",
                "tell application \"System Events\" to get name of first application process whose frontmost is true",
            ]),
            cancelled,
        )?);
    }
    #[cfg(target_os = "linux")]
    {
        return text_output(run_program(
            Command::new("xdotool").args(["getactivewindow", "getwindowname"]),
            cancelled,
        )?);
    }
    #[allow(unreachable_code)]
    Err("Active-window observation is unsupported on this operating system.".into())
}

pub fn process_running(app_id: &str, cancelled: Arc<AtomicBool>) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let output = run_program(
            Command::new("powershell.exe").args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "param([string]$id) $n=[IO.Path]::GetFileNameWithoutExtension($id); if(Get-Process -Name $n -ErrorAction SilentlyContinue){[Console]::Out.Write('true')}else{[Console]::Out.Write('false')}",
                app_id,
            ]),
            cancelled,
        )?;
        return Ok(text_output(output)? == "true");
    }
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        let name = Path::new(app_id)
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or(app_id);
        let output = run_program(Command::new("pgrep").args(["-x", name]), cancelled);
        return Ok(output.is_ok());
    }
    #[allow(unreachable_code)]
    Err("Process observation is unsupported on this operating system.".into())
}

pub fn active_window_layout(cancelled: Arc<AtomicBool>) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let output = run_program(
            Command::new("powershell.exe").args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Add-Type -AssemblyName System.Windows.Forms; $u=Add-Type -Name R -Namespace O -PassThru -MemberDefinition 'public struct RECT{public int Left;public int Top;public int Right;public int Bottom;} [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr h,out RECT r); [DllImport(\"user32.dll\")] public static extern bool IsZoomed(IntPtr h);'; $h=$u::GetForegroundWindow(); if($u::IsZoomed($h)){[Console]::Out.Write('maximize');exit}; $r=New-Object O.R+RECT; $u::GetWindowRect($h,[ref]$r)|Out-Null; $b=[System.Windows.Forms.Screen]::FromHandle($h).WorkingArea; $mid=$b.Left+[int]($b.Width/2); $tol=32; if([Math]::Abs($r.Left-$b.Left)-le $tol -and [Math]::Abs($r.Right-$mid)-le $tol){'left'}elseif([Math]::Abs($r.Left-$mid)-le $tol -and [Math]::Abs($r.Right-$b.Right)-le $tol){'right'}else{'restore'}",
            ]),
            cancelled,
        )?;
        return text_output(output);
    }
    #[cfg(target_os = "macos")]
    {
        let output = run_program(
            Command::new("/usr/bin/osascript").args([
                "-e",
                "tell application \"Finder\" to set b to bounds of window of desktop\ntell application \"System Events\" to tell first application process whose frontmost is true\nset p to position of front window\nset s to size of front window\nend tell\nset w to item 3 of b\nif item 1 of p is 0 and item 1 of s ≥ (w - 32) then return \"maximize\"\nif item 1 of p is 0 and item 1 of s ≤ (w / 2 + 32) then return \"left\"\nif item 1 of p ≥ (w / 2 - 32) and item 1 of s ≤ (w / 2 + 32) then return \"right\"\nreturn \"restore\"",
            ]),
            cancelled,
        )?;
        return text_output(output);
    }
    #[cfg(target_os = "linux")]
    {
        // wmctrl exposes the active window state but geometry classification
        // varies by desktop; return maximize only when the EWMH state proves it.
        let output = run_program(
            Command::new("xprop").args(["-root", "_NET_ACTIVE_WINDOW"]),
            cancelled,
        )?;
        let active = text_output(output)?;
        let id = active
            .split_whitespace()
            .last()
            .ok_or_else(|| "The active window could not be identified.".to_string())?;
        let state = text_output(run_program(
            Command::new("xprop").args(["-id", id, "_NET_WM_STATE"]),
            Arc::new(AtomicBool::new(false)),
        )?)?;
        return Ok(if state.contains("_NET_WM_STATE_MAXIMIZED_VERT")
            && state.contains("_NET_WM_STATE_MAXIMIZED_HORZ")
        {
            "maximize"
        } else {
            "restore"
        }
        .into());
    }
    #[allow(unreachable_code)]
    Err("Window-layout observation is unsupported on this operating system.".into())
}

fn receipt(detail: &str) -> PlatformResult {
    PlatformResult {
        detail: detail.into(),
        output: None,
    }
}

fn capture_screen(
    run_id: &str,
    artifact_dir: &Path,
    cancelled: Arc<AtomicBool>,
) -> Result<PlatformResult, String> {
    fs::create_dir_all(artifact_dir)
        .map_err(|_| "The private screenshot directory could not be created.".to_string())?;
    let safe_id: String = run_id
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
        .take(64)
        .collect();
    let path = artifact_dir.join(format!(
        "screen-{}.png",
        if safe_id.is_empty() {
            "capture"
        } else {
            &safe_id
        }
    ));

    #[cfg(target_os = "windows")]
    {
        let script = "param([string]$out) Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $i=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($i); try{$g.CopyFromScreen($b.Left,$b.Top,0,0,$b.Size);$i.Save($out,[System.Drawing.Imaging.ImageFormat]::Png)}finally{$g.Dispose();$i.Dispose()}";
        run_program(
            Command::new("powershell.exe").args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                script,
                path.to_string_lossy().as_ref(),
            ]),
            cancelled,
        )?;
    }
    #[cfg(target_os = "macos")]
    {
        run_program(
            Command::new("/usr/sbin/screencapture").arg("-x").arg(&path),
            cancelled,
        )?;
    }
    #[cfg(target_os = "linux")]
    {
        match screenshot_program().as_deref() {
            Some("gnome-screenshot") => {
                run_program(
                    Command::new("gnome-screenshot").arg("-f").arg(&path),
                    cancelled,
                )?;
            }
            Some("scrot") => {
                run_program(Command::new("scrot").arg(&path), cancelled)?;
            }
            Some("import") => {
                run_program(
                    Command::new("import").arg("-window").arg("root").arg(&path),
                    cancelled,
                )?;
            }
            _ => return Err("No supported screenshot tool is installed.".into()),
        }
    }

    let bytes = fs::read(&path).map_err(|_| "The screenshot was not produced.".to_string())?;
    if bytes.is_empty() {
        let _ = fs::remove_file(&path);
        return Err("The screenshot tool returned an empty image.".into());
    }
    Ok(PlatformResult {
        detail: "Captured the visible screen to the private companion cache.".into(),
        output: Some(PlatformOutput::ScreenCapture {
            path: path.to_string_lossy().to_string(),
            mime_type: "image/png".into(),
            sha256: sha256_hex(&bytes),
        }),
    })
}

fn window_titles(cancelled: Arc<AtomicBool>) -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    let output = run_program(
        Command::new("powershell.exe").args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-Process|Where-Object {$_.MainWindowTitle}|Select-Object -ExpandProperty MainWindowTitle",
        ]),
        cancelled,
    )?;
    #[cfg(target_os = "macos")]
    let output = run_program(
        Command::new("/usr/bin/osascript").args([
            "-e",
            "tell application \"System Events\" to get name of every application process whose visible is true",
        ]),
        cancelled,
    )?;
    #[cfg(target_os = "linux")]
    let output = run_program(Command::new("wmctrl").arg("-l"), cancelled)?;

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return Err("Window listing is unsupported on this operating system.".into());

    #[allow(unreachable_code)]
    {
        let text = text_output(output)?;
        Ok(text
            .lines()
            .flat_map(|line| line.split(", "))
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .map(|line| {
                if is_protected_text(line) {
                    "[protected window]".to_string()
                } else {
                    line.chars().take(256).collect()
                }
            })
            .take(100)
            .collect())
    }
}

fn focus_window(target: &str, cancelled: Arc<AtomicBool>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = Command::new("powershell.exe");
    command.args([
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "param([string]$name) $w=New-Object -ComObject WScript.Shell; if(-not $w.AppActivate($name)){exit 3}",
        target,
    ]);
    #[cfg(target_os = "macos")]
    let mut command = Command::new("/usr/bin/osascript");
    command.args([
        "-e",
        "on run argv\ntell application \"System Events\" to set frontmost of first application process whose name is item 1 of argv to true\nend run",
        target,
    ]);
    #[cfg(target_os = "linux")]
    let mut command = Command::new("wmctrl");
    command.args(["-a", target]);
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return Err("Window focus is unsupported on this operating system.".into());
    #[allow(unreachable_code)]
    run_program(&mut command, cancelled).map(|_| ())
}

fn arrange_window(layout: &str, cancelled: Arc<AtomicBool>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let mut command = Command::new("powershell.exe");
    command.args([
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "param([string]$layout) Add-Type -AssemblyName System.Windows.Forms; $u=Add-Type -Name U -Namespace O -PassThru -MemberDefinition '[DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr h,int n); [DllImport(\"user32.dll\")] public static extern bool SetWindowPos(IntPtr h,IntPtr a,int x,int y,int w,int z,uint f);'; $h=$u::GetForegroundWindow(); if($h -eq [IntPtr]::Zero){exit 4}; if($layout -eq 'maximize'){$u::ShowWindow($h,3)|Out-Null;exit}; $u::ShowWindow($h,9)|Out-Null; if($layout -eq 'restore'){exit}; $b=[System.Windows.Forms.Screen]::FromHandle($h).WorkingArea; $w=[int]($b.Width/2); $x=if($layout -eq 'right'){$b.Left+$w}else{$b.Left}; $u::SetWindowPos($h,[IntPtr]::Zero,$x,$b.Top,$w,$b.Height,0x14)|Out-Null",
        layout,
    ]);
    #[cfg(target_os = "macos")]
    let mut command = Command::new("/usr/bin/osascript");
    command.args([
        "-e",
        "on run argv\nset mode to item 1 of argv\ntell application \"Finder\" to set b to bounds of window of desktop\nset w to item 3 of b\nset h to item 4 of b\ntell application \"System Events\" to tell first application process whose frontmost is true\nif mode is \"left\" then set position of front window to {0, 25}\nif mode is \"left\" then set size of front window to {w / 2, h - 25}\nif mode is \"right\" then set position of front window to {w / 2, 25}\nif mode is \"right\" then set size of front window to {w / 2, h - 25}\nif mode is \"maximize\" then set position of front window to {0, 25}\nif mode is \"maximize\" then set size of front window to {w, h - 25}\nend tell\nend run",
        layout,
    ]);
    #[cfg(target_os = "linux")]
    let mut command = Command::new("wmctrl");
    if layout == "maximize" {
        command.args(["-r", ":ACTIVE:", "-b", "add,maximized_vert,maximized_horz"]);
    } else {
        command.args([
            "-r",
            ":ACTIVE:",
            "-b",
            "remove,maximized_vert,maximized_horz",
        ]);
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return Err("Window arrangement is unsupported on this operating system.".into());
    #[allow(unreachable_code)]
    run_program(&mut command, cancelled).map(|_| ())
}

fn open_file(path: &Path, cancelled: Arc<AtomicBool>) -> Result<(), String> {
    ensure_not_cancelled(&cancelled)?;
    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer.exe");
    #[cfg(target_os = "macos")]
    let mut command = Command::new("/usr/bin/open");
    #[cfg(target_os = "linux")]
    let mut command = Command::new("xdg-open");
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return Err("Opening files is unsupported on this operating system.".into());
    #[allow(unreachable_code)]
    command
        .arg(path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|_| "The approved file or folder could not be opened.".into())
}

fn send_shortcut(kind: &str, cancelled: Arc<AtomicBool>) -> Result<(), String> {
    let paste = kind == "paste";
    #[cfg(target_os = "windows")]
    let mut command = Command::new("powershell.exe");
    command.args([
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "param([string]$keys) Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait($keys)",
        if paste { "^v" } else { "^c" },
    ]);
    #[cfg(target_os = "macos")]
    let mut command = Command::new("/usr/bin/osascript");
    command.args([
        "-e",
        if paste {
            "tell application \"System Events\" to keystroke \"v\" using command down"
        } else {
            "tell application \"System Events\" to keystroke \"c\" using command down"
        },
    ]);
    #[cfg(target_os = "linux")]
    let mut command = Command::new("xdotool");
    command.args(["key", if paste { "ctrl+v" } else { "ctrl+c" }]);
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return Err("Synthetic input is unsupported on this operating system.".into());
    #[allow(unreachable_code)]
    run_program(&mut command, cancelled).map(|_| ())
}

fn run_program(command: &mut Command, cancelled: Arc<AtomicBool>) -> Result<Output, String> {
    ensure_not_cancelled(&cancelled)?;
    let child = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| "The operating-system action backend could not start.".to_string())?;
    wait_child(child, cancelled)
}

fn wait_child(mut child: Child, cancelled: Arc<AtomicBool>) -> Result<Output, String> {
    let started = Instant::now();
    loop {
        if cancelled.load(Ordering::SeqCst) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Cancelled while the operating-system action was running.".into());
        }
        match child.try_wait() {
            Ok(Some(_)) => {
                let output = child.wait_with_output().map_err(|_| {
                    "The operating-system action did not return a result.".to_string()
                })?;
                return if output.status.success() {
                    Ok(output)
                } else {
                    Err("The operating-system action was refused or failed.".into())
                };
            }
            Ok(None) if started.elapsed() < ACTION_TIMEOUT => {
                thread::sleep(Duration::from_millis(20))
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("The operating-system action timed out and was stopped.".into());
            }
            Err(_) => return Err("The operating-system action could not be monitored.".into()),
        }
    }
}

fn text_output(output: Output) -> Result<String, String> {
    String::from_utf8(output.stdout)
        .map(|text| text.trim().to_string())
        .map_err(|_| "The operating-system action returned invalid text.".into())
}

fn ensure_not_cancelled(cancelled: &AtomicBool) -> Result<(), String> {
    if cancelled.load(Ordering::SeqCst) {
        Err("Cancelled before the operating-system action started.".into())
    } else {
        Ok(())
    }
}

fn program_available(program: &str) -> bool {
    let candidate = PathBuf::from(program);
    if candidate.components().count() > 1 {
        return candidate.is_file();
    }
    env::var_os("PATH")
        .into_iter()
        .flat_map(|paths| env::split_paths(&paths).collect::<Vec<_>>())
        .any(|directory| {
            let plain = directory.join(program);
            plain.is_file()
                || cfg!(target_os = "windows") && directory.join(format!("{program}.exe")).is_file()
        })
}

#[cfg(target_os = "linux")]
fn screenshot_program() -> Option<String> {
    ["gnome-screenshot", "scrot", "import"]
        .into_iter()
        .find(|program| program_available(program))
        .map(str::to_string)
}
