!define COMPANION_HOOK_DIR "${__FILEDIR__}"

!macro NSIS_HOOK_PREINSTALL
  Push $0
  Push $1
  InitPluginsDir
  File /oname=$PLUGINSDIR\companion-service-guard.exe "${COMPANION_HOOK_DIR}\..\target\release\companion-service-guard.exe"
  nsExec::ExecToStack '"$PLUGINSDIR\companion-service-guard.exe" "$INSTDIR\service\node.exe"'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_OK|MB_ICONSTOP "Der bisherige Companion-Dienst konnte nicht übernommen werden. Ein fremder Prozess wurde nicht beendet. Bitte Port 4310 prüfen und das Setup erneut starten."
    Abort
  ${EndIf}
  Pop $1
  Pop $0
!macroend
