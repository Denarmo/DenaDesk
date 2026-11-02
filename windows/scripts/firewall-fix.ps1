# TwinDesk - Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
# Repair only this app's allow rules. Preserve network classifications and blocks.
param([Parameter(Mandatory = $true)][string]$Exe)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Exe -PathType Leaf)) { throw 'The application executable was not found' }
$Exe = (Get-Item -LiteralPath $Exe).FullName
$adb = Join-Path (Split-Path -Parent $Exe) 'resources\app\windows\vendor\adb\adb.exe'
$programs = @($Exe, $Exe.Replace('\', '\\'), $adb)
$names = @('DenaDesk', 'DenaDesk (TCP 47800)', 'DenaDesk (adb)', 'DenaDesk', 'DenaDesk (TCP 47800)', 'DenaDesk (adb)')
Get-NetFirewallApplicationFilter | Where-Object { $programs -contains $_.Program } |
  Get-NetFirewallRule | Where-Object { $names -contains $_.DisplayName -and [string]$_.Action -eq 'Allow' } |
  Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'DenaDesk' -Group 'DenaDesk' -Direction Inbound -Action Allow -Program $Exe -Profile Private,Domain -RemoteAddress LocalSubnet | Out-Null
New-NetFirewallRule -DisplayName 'DenaDesk (TCP 47800)' -Group 'DenaDesk' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 47800 -Program $Exe -Profile Private,Domain -RemoteAddress LocalSubnet | Out-Null
if (Test-Path -LiteralPath $adb -PathType Leaf) {
  New-NetFirewallRule -DisplayName 'DenaDesk (adb)' -Group 'DenaDesk' -Direction Inbound -Action Allow -Program $adb -Profile Private,Domain -RemoteAddress LocalSubnet | Out-Null
}
