#Requires -Version 5.1
<#
  SAFE, READ-ONLY: Parse the new TEST kiosk startup scripts on Windows
  PowerShell 5.1. Does not install, register startup, connect to any server,
  open the reader, ask for credentials, create a fingerprint or record punches.
#>
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$files=@(
  'Hu20-KioskWatch.ps1',
  'Hu20-ManageKioskStartup.ps1',
  'Hu20-StartTestTerminal.ps1',
  'Hu20-ProvisionEasyEnrollment.ps1',
  'Hu20-DeviceVault.ps1',
  'Hu20-AutoKiosk.ps1'
)
foreach ($name in $files) {
  $path=Join-Path $root $name
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "MISSING: $name" }
  $tokens=$null
  $errors=$null
  [System.Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors) | Out-Null
  if ($errors.Count -gt 0) { throw "PowerShell syntax invalid: $name" }
  Write-Host "PASS: $name parses under this Windows PowerShell."
}
Write-Host 'STARTUP SCRIPT PARSE CHECK PASS - no installations, enrollment, or attendance.'
