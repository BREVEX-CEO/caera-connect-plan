; Per-user installer for the OCADE JARVIS companion (plan.md §26, P04).
; No administrator rights, no service, no inbound port. Starts at sign-in for this
; Windows user only; the person pairs it from the Start Menu and can STOP it there.
; STATUS: CODED, UNTESTED. Build with packaging/build.ps1.
#define Version "0.1.0"
#define Server "https://ocade.in"
#ifndef Dist
  #define Dist "..\dist"
#endif

[Setup]
AppId={{C7C66684-E9C6-4651-9943-4685C78C52FA}
AppName=OCADE JARVIS
AppVersion={#Version}
AppPublisher=CARCC
DefaultDirName={localappdata}\Programs\OCADE JARVIS
DefaultGroupName=OCADE JARVIS
PrivilegesRequired=lowest
; Windows x64 only (requirement 104). The bundle is x64; 32-bit Windows cannot run it, and
; Windows on ARM is not a supported target yet (no native build of every dependency), so
; Setup refuses both with Windows' own message instead of installing something untested.
ArchitecturesAllowed=x64os
ArchitecturesInstallIn64BitMode=x64os
AppMutex=OCADE.Jarvis.Active
CloseApplications=no
RestartApplications=no
DisableProgramGroupPage=yes
OutputBaseFilename=OCADE-JARVIS-Setup-{#Version}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; Reproducible installer: file times come from the commit, not from the build machine's clock.
TimeStampsInUTC=yes
UninstallDisplayName=OCADE JARVIS

[Files]
Source: "{#Dist}\OCADE JARVIS\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion

[Dirs]
Name: "{userdocs}\OCADE JARVIS"

[Icons]
Name: "{group}\Pair with OCADE"; Filename: "{cmd}"; Parameters: "/k """"{app}\ocade-agent.exe"" enroll --server {#Server} --workspace ""{userdocs}\OCADE JARVIS"""""
Name: "{group}\Stop OCADE JARVIS"; Filename: "{app}\ocade-agent.exe"; Parameters: "stop"
Name: "{group}\Start OCADE JARVIS"; Filename: "{app}\ocade-agent-bg.exe"; Parameters: "run"
Name: "{group}\Open JARVIS folder"; Filename: "{userdocs}\OCADE JARVIS"

[Registry]
; Starts the background agent when this user signs in; removed on uninstall.
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "OCADE JARVIS"; ValueData: """{app}\ocade-agent-bg.exe"" run"; Flags: uninsdeletevalue

[UninstallRun]
Filename: "{app}\ocade-agent.exe"; Parameters: "stop"; Flags: runhidden; RunOnceId: "StopAgent"
