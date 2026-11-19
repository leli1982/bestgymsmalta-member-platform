#Requires -Version 5.1
<#
  Technician-only opt-in control for the ISOLATED TEST kiosk on this PC.
  Does not touch Windows drivers, biometric vault, terminal settings,
  staff data or the existing enrollment bridge. Per-user HKCU Run only.
  Staff and Super Admin never need to use this utility.
#>
[CmdletBinding()]
param(
  [ValidateSet('Status','Enable','Disable')][string]$Action='Status',
  [switch]$ReplaceExisting
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or -not [Environment]::Is64BitProcess) {
  throw 'This TEST utility must run in 64-bit Windows PowerShell under the kiosk Windows user.'
}
$folder=Split-Path -Parent $MyInvocation.MyCommand.Path
$watcher=Join-Path $folder 'Hu20-KioskWatch.ps1'
$runKey='HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runName='BGM_HU20_TEST_KioskWatcher'
$exe=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
function Get-Hu20StartupEntry {
  try {
    $item=Get-ItemProperty -Path $runKey -Name $runName -ErrorAction Stop
    return [string]$item.$runName
  } catch { return '' }
}
$old=Get-Hu20StartupEntry
switch ($Action) {
  'Status' {
    if (-not $old) { Write-Host 'HU20 kiosk Windows startup: NOT INSTALLED (existing reader unchanged).' }
    else { Write-Host 'HU20 TEST kiosk Windows startup: CONFIGURED for this Windows user.' }
    Write-Host 'This does not prove physical scanner connection or grant attendance permission.'
    break
  }
  'Disable' {
    if ($old) {
      Remove-ItemProperty -Path $runKey -Name $runName -ErrorAction Stop
      Write-Host 'PASS: HU20 TEST kiosk startup disabled for future sign-ins.'
    } else { Write-Host 'PASS: HU20 TEST kiosk startup was already disabled.' }
    Write-Host 'Existing HU20 local bridge, encrypted credentials and reader setup remain unchanged.'
    Write-Host 'An already running watcher is not stopped by this registry change. Sign out to stop it.'
    break
  }
  'Enable' {
    if (-not (Test-Path -LiteralPath $watcher -PathType Leaf)) {
      throw 'Missing TEST kiosk watcher. No startup changes made.'
    }
    # Technician must verify the existing registered PC, DPAPI vault,
    # allowlisted TEST origin and read-only server preflight first.
    & $watcher -CheckOnly
    if (-not $?) { throw 'HU20 TEST safe preflight failed; startup not installed.' }
    $command='"'+$exe+'" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$watcher+'" -StartupDelaySeconds 30'
    if ($old -and $old -cne $command -and -not $ReplaceExisting) {
      throw 'An existing HU20 kiosk startup entry differs. Inspect it before using -ReplaceExisting.'
    }
    New-Item -Path $runKey -Force | Out-Null
    Set-ItemProperty -Path $runKey -Name $runName -Value $command -ErrorAction Stop
    Write-Host 'PASS: HU20 TEST kiosk will start in safe standby at the next Windows sign-in.'
    Write-Host 'Only a NEW approved Super Admin TEST window can open the fingerprint kiosk.'
    Write-Host 'No terminal code, PIN, Preview Share URL or secret is entered by staff.'
    Write-Host 'Production attendance remains disabled.'
    break
  }
}
