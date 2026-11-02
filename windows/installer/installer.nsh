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

; In place of electron-builder's "DuoDesk is running, close it" check, before the old version's
; uninstaller and the file copy: a running DuoDesk (or the TwinDesk it replaces) is closed rather than
; asked about, and the old app folder goes, so every file is the new version's (none left over from earlier releases).
!macro customCheckAppRunning
  nsExec::Exec 'taskkill /f /t /im DuoDesk.exe'
  nsExec::Exec 'taskkill /f /t /im TwinDesk.exe'
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
  nsExec::Exec '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\app\windows\scripts\firewall-fix.ps1" -Exe "$INSTDIR\DuoDesk.exe"'
!macroend

!macro customUnInstall
  ; Camera › Virtual camera (vcam.js): the camera and its media source, but not on an update (the
  ; new version keeps them, so it needs no administrator prompt again).
  ${ifNot} ${isUpdated}
    nsExec::Exec '"$INSTDIR\resources\app\windows-helper\bin\twindesk-vcam.exe" remove'
    nsExec::Exec 'cmd /c for %f in ("%ProgramData%\TwinDesk\vcam\twindesk-vcam-*.dll") do "%SystemRoot%\System32\regsvr32.exe" /u /s "%f"'
    ; $APPDATA for all users: ProgramData
    SetShellVarContext all
    RMDir /r "$APPDATA\TwinDesk\vcam"
  ${endIf}
  ; Calls on this PC: its package (this user's) and its certificate.
  nsExec::Exec 'powershell -NoProfile -NonInteractive -Command "Get-AppxPackage -Name TwinDesk.Calls | Remove-AppxPackage"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="DuoDesk" program="$INSTDIR\DuoDesk.exe"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="DuoDesk (TCP 47800)"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="DuoDesk (adb)"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="TwinDesk" program="$INSTDIR\DuoDesk.exe"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="TwinDesk" program="$INSTDIR\TwinDesk.exe"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="TwinDesk (TCP 47800)"'
  nsExec::Exec 'netsh advfirewall firewall delete rule name="TwinDesk (adb)"'
  ; The pinned Mac and phone apps' Start menu folder is per user (the app makes it in Roaming), and
  ; the TwinDesk Apps of older versions.
  SetShellVarContext current
  RMDir /r "$APPDATA\Microsoft\Windows\Start Menu\Programs\DuoDesk Apps"
  RMDir /r "$APPDATA\Microsoft\Windows\Start Menu\Programs\TwinDesk Apps"
  RMDir /r "$APPDATA\Microsoft\Windows\Start Menu\Programs\MacShare Apps"
  ; Explorer › Send to › "<peer> (DuoDesk)" (sendto.js), and the TwinDesk-named ones of earlier versions.
  Delete "$APPDATA\Microsoft\Windows\SendTo\* (DuoDesk).lnk"
  Delete "$APPDATA\Microsoft\Windows\SendTo\* (TwinDesk).lnk"
  Delete "$APPDATA\Microsoft\Windows\SendTo\* (MacShare).lnk"
  ; Explorer's right-click › DuoDesk (explorer.js) and the twindesk: links (a toast's Copy)
  DeleteRegKey HKCU "Software\Classes\*\shell\TwinDesk"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\TwinDesk"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\TwinDesk"
  DeleteRegKey HKCU "Software\Classes\twindesk"
  SetShellVarContext all
!macroend
