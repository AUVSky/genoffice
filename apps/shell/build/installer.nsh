; Windows installer hooks for the offline fork: no CLI path is added (the
; genoffice CLI was removed with the AI surface), so this file only stops the
; running app and its helpers, then registers the OOXML "New" templates.
; electron-builder compiles the script twice (the second pass, with
; BUILD_UNINSTALLER, only produces the uninstaller).
!include "nsProcess.nsh"

!macro GenOfficeKillHelper NAME
  ${nsProcess::FindProcess} "${NAME}" $R0
  ${if} $R0 == 0
    ${nsProcess::KillProcess} "${NAME}" $R0
    Sleep 300
  ${endIf}
!macroend

; electron-builder's stock CHECK_APP_RUNNING runs powershell.exe via nsExec
; (CREATE_NEW_CONSOLE + SW_HIDE); Windows Terminal as default host ignores
; SW_HIDE, so every silent update flashed a PowerShell window. nsProcess does
; the same work in-process. Used by both the installer and the uninstaller.
!macro customCheckAppRunning
  ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
  ${if} $R0 == 0
    ${if} ${isUpdated}
      ; let the app finish quitting on its own
      Sleep 1000
      Goto genofficeStopApp
    ${endIf}
    MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK genofficeStopApp
    Quit

    genofficeStopApp:
    DetailPrint "$(appClosing)"
    ${nsProcess::CloseProcess} "${APP_EXECUTABLE_FILENAME}" $R0
    Sleep 300
    StrCpy $R1 0

    genofficeWaitLoop:
      IntOp $R1 $R1 + 1
      ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
      ${if} $R0 == 0
        Sleep 1000
        ${nsProcess::KillProcess} "${APP_EXECUTABLE_FILENAME}" $R0
        ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
        ${if} $R0 == 0
          DetailPrint `Waiting for "${PRODUCT_NAME}" to close.`
          Sleep 2000
        ${else}
          Goto genofficeAppClosed
        ${endIf}
      ${else}
        Goto genofficeAppClosed
      ${endIf}
      ${if} $R1 > 1
        MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY genofficeWaitLoop
        Quit
      ${else}
        Goto genofficeWaitLoop
      ${endIf}
    genofficeAppClosed:
  ${endIf}
  ; the stock macro closed every process under $INSTDIR; a killed app can
  ; orphan its helpers, which keep their binaries locked
  !insertmacro GenOfficeKillHelper "xlsx-sidecar.exe"
  !insertmacro GenOfficeKillHelper "win-ocr.exe"
  ${nsProcess::Unload}
!macroend

; Scope templates to our ProgIDs (electron-builder uses fileAssociations.name).
; A shared .ext\ShellNew would overwrite Office/WPS templates. OOXML files
; must be copied from valid packages, never created with NullFile.
!macro GenOfficeRegisterShellNew EXT PROGID
  WriteRegStr SHELL_CONTEXT "Software\Classes\.${EXT}\${PROGID}\ShellNew" "FileName" "$INSTDIR\resources\shell-new\blank.${EXT}"
!macroend

!macro GenOfficeUnregisterShellNew EXT PROGID
  ; Only remove our own registration, including when uninstalling for an update.
  ReadRegStr $0 SHELL_CONTEXT "Software\Classes\.${EXT}\${PROGID}\ShellNew" "FileName"
  ${If} $0 == "$INSTDIR\resources\shell-new\blank.${EXT}"
    DeleteRegKey SHELL_CONTEXT "Software\Classes\.${EXT}\${PROGID}\ShellNew"
    DeleteRegKey /ifempty SHELL_CONTEXT "Software\Classes\.${EXT}\${PROGID}"
  ${EndIf}
!macroend

!macro customInstall
  !insertmacro GenOfficeRegisterShellNew "docx" "Word Document"
  !insertmacro GenOfficeRegisterShellNew "xlsx" "Excel Workbook"
  !insertmacro GenOfficeRegisterShellNew "pptx" "PowerPoint Presentation"
  !insertmacro UPDATEFILEASSOC
!macroend

!macro customUnInstall
  Push $0
  !insertmacro GenOfficeUnregisterShellNew "docx" "Word Document"
  !insertmacro GenOfficeUnregisterShellNew "xlsx" "Excel Workbook"
  !insertmacro GenOfficeUnregisterShellNew "pptx" "PowerPoint Presentation"
  Pop $0
  !insertmacro UPDATEFILEASSOC
!macroend
