# TwinDesk - Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
# Optional calls package: never create a certificate or change certificate trust.
param([Parameter(Mandatory = $true)][string]$Bin)
$ErrorActionPreference = 'Stop'
$Bin = (Get-Item -LiteralPath $Bin).FullName
$msix = Join-Path $Bin 'twindesk-calls.msix'
if (-not $env:DUODESK_CALLS_CERT_SHA1) {
  if (Test-Path -LiteralPath $msix) { Remove-Item -LiteralPath $msix -Force }
  Write-Output 'note: no trusted calls signing certificate configured; Bluetooth call audio package omitted'
  exit 0
}
if ($env:DUODESK_CALLS_CERT_SHA1 -notmatch '^[0-9a-fA-F]{40}$') { throw 'Invalid calls certificate thumbprint' }
$cert = Get-Item -LiteralPath ('Cert:\CurrentUser\My\' + $env:DUODESK_CALLS_CERT_SHA1)
if (-not $cert.HasPrivateKey -or $cert.NotAfter -le (Get-Date) -or $cert.Subject -ne 'CN=TwinDesk') {
  throw 'Calls signing needs a valid existing certificate matching the package publisher CN=TwinDesk'
}
$chain = New-Object Security.Cryptography.X509Certificates.X509Chain
try { if (-not $chain.Build($cert)) { throw 'Calls signing certificate is not already trusted' } } finally { $chain.Dispose() }
$kits = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
$vers = @(Get-ChildItem $kits -Directory | Where-Object { $_.Name -like '10.*' } | Sort-Object { [version]$_.Name } -Descending)
function Tool($name) {
  foreach ($v in $vers) { foreach ($a in 'x64', 'arm64', 'x86') {
    $p = Join-Path $v.FullName "$a\$name"
    if (Test-Path -LiteralPath $p) { return $p }
  } }
  throw "$name not found: install the Windows 10/11 SDK"
}
$makeappx = Tool 'makeappx.exe'
$signtool = Tool 'signtool.exe'
$stage = Join-Path $Bin ('calls-stage-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
try {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'AppxManifest.xml') -Destination $stage
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot '..\..\windows\installer\icon.png') -Destination (Join-Path $stage 'logo.png')
  & $makeappx pack /o /nv /d $stage /p $msix | Out-Null
  if ($LASTEXITCODE) { throw 'makeappx failed' }
  & $signtool sign /q /fd SHA256 /sha1 $cert.Thumbprint $msix
  if ($LASTEXITCODE) { throw 'signtool failed' }
  & $signtool verify /pa $msix | Out-Null
  if ($LASTEXITCODE) { throw 'Signed calls package did not pass trust verification' }
} finally {
  $resolved = [IO.Path]::GetFullPath($stage)
  if (-not $resolved.StartsWith($Bin.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing cleanup outside build directory' }
  Remove-Item -LiteralPath $resolved -Recurse -Force
}
Write-Output "built $msix"
