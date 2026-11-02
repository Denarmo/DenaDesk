; TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
; NSIS hooks for electron-builder (installer/build.js). The installer runs elevated (per-machine),
; so it adds the same Private/Domain LocalSubnet allow rules as the app's Fix button.
; Public networks, administrator blocks and certificate stores are not changed.
; A helper left running would lock its .exe, so it is stopped first.
; Stopped while it drove another computer, its pointer would stay blank (HideCursor.cs): the
; user's cursors are reloaded after it (SPI_SETCURSORS, SPIF_SENDCHANGE).

!macro customInit
  nsExec::Exec 'taskkill /f /im macshare-winhelper.exe'
  nsExec::Exec 'taskkill /f /im macshare-winhelper-multi.exe'
  nsExec::Exec 'taskkill /f /im macshare-calls.exe'
  System::Call 'user32::SystemParametersInfoW(i 0x57, i 0, i 0, i 2)'
  nsExec::Exec '"$INSTDIR\resources\app\windows\vendor\adb\adb.exe" kill-server'
!macroend

!macro customUnInit
  nsExec::Exec 'taskkill /f /im macshare-winhelper.exe'
  nsExec::Exec 'taskkill /f /im macshare-winhelper-multi.exe'
  nsExec::Exec 'taskkill /f /im macshare-calls.exe'
  System::Call 'user32::SystemParametersInfoW(i 0x57, i 0, i 0, i 2)'
  nsExec::Exec '"$INSTDIR\resources\app\windows\vendor\adb\adb.exe" kill-server'
!macroend

; In place of electron-builder's "DenaDesk is running, close it" check, before the old version's
; uninstaller and the file copy: a running DenaDesk is closed rather than
; asked about, and the old app folder goes, so every file is the new version's (none left over from earlier releases).
!macro customCheckAppRunning
  nsExec::Exec 'taskkill /f /t /im DenaDesk.exe'
  nsExec::Exec 'taskkill /f /im macshare-winhelper.exe'
  nsExec::Exec 'taskkill /f /im macshare-winhelper-multi.exe'
  nsExec::Exec 'taskkill /f /im macshare-calls.exe'
  System::Call 'user32::SystemParametersInfoW(i 0x57, i 0, i 0, i 2)'
  Sleep 500
  RMDir /r "$INSTDIR\resources\app"
!macroend

!macro customInstall
  ; Limit inbound app/adb access to the local subnet on Private/Domain profiles.
  ; Preserve network classifications, block rules, WebDAV limits and certificate stores.
  nsExec::Exec '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\app\windows\scripts\firewall-fix.ps1" -Exe "$INSTDIR\DenaDesk.exe"'
!macroend

!macro customUnInstall
  ; Camera › Virtual camera (vcam.js): the camera and its media source, but not on an update (the
  ; new version keeps them, so it needs no administrator prompt again).
  ${ifNot} ${isUpdated}
    nsExec::Exec '"$INSTDIR\resources\app\windows-helper\bin\twindesk-vcam.exe" remove'
    nsExec::Exec 'cmd /c for %f in ("%ProgramData%\DenaDesk\vcam\twindesk-vcam-*.dll") do "%SystemRoot%\System32\regsvr32.exe" /u /s "%f"'
    ; $APPDATA for all users: ProgramData
    SetShellVarContext all
    RMDir /r "$APPDATA\DenaDesk\vcam"
  ${endIf}
  ; Calls on this PC: its package (this user's) and its certificate.
  nsExec::Exec 'powershell -NoProfile -NonInteractive -Command "Get-AppxPackage -Name DenaDesk.Calls | Remove-AppxPackage"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="DenaDesk" program="$INSTDIR\DenaDesk.exe"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="DenaDesk (TCP 47800)"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="DenaDesk (adb)"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="DenaDesk" program="$INSTDIR\DenaDesk.exe"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="DenaDesk (TCP 47800)"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="DenaDesk (adb)"'
  ; The pinned Mac and phone apps' Start menu folder is per user (the app makes it in Roaming), and
  ; the DenaDesk Apps of older versions.
  SetShellVarContext current
  RMDir /r "$APPDATA\Microsoft\Windows\Start Menu\Programs\DenaDesk Apps"
  ; Explorer › Send to › "<peer> (DenaDesk)" (sendto.js), and the DenaDesk-named ones of earlier versions.
  Delete "$APPDATA\Microsoft\Windows\SendTo\* (DenaDesk).lnk"
  ; Explorer's right-click › DenaDesk (explorer.js) and the denadesk: links (a toast's Copy)
  DeleteRegKey HKCU "Software\Classes\*\shell\DenaDesk"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\DenaDesk"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\DenaDesk"
  DeleteRegKey HKCU "Software\Classes\denadesk"
  SetShellVarContext all
!macroend
