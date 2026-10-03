; OCADE Device Agent installer for Windows 10/11 (Inno Setup 6).
;
;   iscc /DVersion=0.2.0 /DSource=..\..\dist\ocade-agent packaging\windows\ocade-agent.iss
;
; Per-user install, no administrator prompt. Files go to versions\<Version>
; so the signed updater (ocade_update.py) can stage the next build beside this
; one and roll back. Public builds MUST be signed: configure a SignTool named
; "ocadesign" in the Inno Setup IDE (Tools > Configure Sign Tools) with the
; owner's code-signing certificate, then build with /DSign=1. Unsigned output
; is a private test artifact only.

#ifndef Version
  #error Pass /DVersion=x.y.z
#endif

[Setup]
AppId={{6F0C4E2B-8D1A-4C57-9F3E-0CADE0A6E171}
AppName=OCADE Device Agent
AppVersion={#Version}
AppPublisher=CARCC
AppPublisherURL=https://ocade.in
DefaultDirName={localappdata}\OCADE\Device Agent
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputBaseFilename=OCADE-Device-Agent-{#Version}-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=OCADE Device Agent
#ifdef Sign
SignTool=ocadesign
SignedUninstaller=yes
#endif

[Files]
Source: "{#Source}\*"; DestDir: "{app}\versions\{#Version}"; Flags: recursesubdirs ignoreversion

[Run]
; A running agent (an older build) is asked to exit first: started beside it, the new build
; found it running and left, and that counted as a failed start of the new build.
Filename: "{app}\versions\{#Version}\ocade-agent.exe"; Parameters: "--stop"; Flags: runhidden
; Start with Windows (one dormant supervisor, one tray icon), then start now.
Filename: "{app}\versions\{#Version}\ocade-agent.exe"; Parameters: "--install-autostart"; Flags: runhidden
Filename: "{app}\versions\{#Version}\ocade-agent.exe"; Description: "Start OCADE Device Agent"; Flags: nowait postinstall

[UninstallRun]
; Stops the agent's work, removes autostart, this computer's key and the cache.
Filename: "{app}\versions\{#Version}\ocade-agent.exe"; Parameters: "--uninstall"; Flags: runhidden; RunOnceId: "OcadeUninstall"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\versions"
Type: files; Name: "{app}\current.json"
