# Execute the real repair script against mocks; never change the host firewall.
$ErrorActionPreference = 'Stop'
$global:DuodeskTestRemoved = @()
$global:DuodeskTestCreated = @()
$exe = (Get-Process -Id $PID).Path
function Get-NetFirewallApplicationFilter {
  [pscustomobject]@{ Program = $exe; Rules = @(
    [pscustomobject]@{ DisplayName = 'DuoDesk'; Action = 'Allow' },
    [pscustomobject]@{ DisplayName = 'DuoDesk'; Action = 'Block' },
    [pscustomobject]@{ DisplayName = 'Other app'; Action = 'Allow' }
  ) }
}
function Get-NetFirewallRule {
  param([Parameter(ValueFromPipeline = $true)]$Filter)
  process { $Filter.Rules }
}
function Remove-NetFirewallRule {
  param([Parameter(ValueFromPipeline = $true)]$Rule)
  process { $global:DuodeskTestRemoved += $Rule }
}
function New-NetFirewallRule {
  param($DisplayName, $Group, $Direction, $Action, $Program, $Profile, $RemoteAddress, $Protocol, $LocalPort)
  $global:DuodeskTestCreated += [pscustomobject]@{ Name = $DisplayName; Profile = $Profile; RemoteAddress = $RemoteAddress; Program = $Program }
}
function Set-NetConnectionProfile { throw 'Repair attempted to change network trust' }
& (Join-Path $PSScriptRoot '..\scripts\firewall-fix.ps1') -Exe $exe
if ($global:DuodeskTestRemoved.Count -ne 1 -or $global:DuodeskTestRemoved[0].Action -ne 'Allow') { throw 'Repair removed a block or unrelated rule' }
if ($global:DuodeskTestCreated.Count -ne 2) { throw 'Unexpected allow rules' }
foreach ($rule in $global:DuodeskTestCreated) {
  if (($rule.Profile -join ',') -ne 'Private,Domain' -or $rule.RemoteAddress -ne 'LocalSubnet') { throw 'Rule is too broad' }
}
'firewall policy: passed; blocks and unrelated rules preserved'
