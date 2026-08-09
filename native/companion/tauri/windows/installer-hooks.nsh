; User-created work and downloaded models live outside the application folder.
; Preserve them by default. The uninstaller removes them only after an explicit
; confirmation, which makes an upgrade/reinstall safe and a full removal clear.
!macro NSIS_HOOK_PREUNINSTALL
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 \
    "Keep OCADE models, managed browser profiles, settings, and work data for a future reinstall?$\r$\n$\r$\nChoose Yes to preserve data (recommended). Choose No to permanently delete %LOCALAPPDATA%\OCADE." \
    IDYES ocade_keep_data IDNO ocade_remove_data
  ocade_remove_data:
    RMDir /r "$LOCALAPPDATA\OCADE"
    Goto ocade_data_choice_done
  ocade_keep_data:
  ocade_data_choice_done:
!macroend
