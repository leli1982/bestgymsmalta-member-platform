#Requires -Version 5.1
<#
  TEST ONLY: opens Super Admin's HU20 enrolment page with the terminal ID
  installed on THIS Windows PC, but only after a real local HU20 SDK health
  check. No biometric scan, credentials, HTTP request or attendance action.
  The URL parameter is a convenience hint, NOT terminal authentication.
#>
[CmdletBinding()]
param([string]$InstallationDirectory = "")

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or
    -not [Environment]::Is64BitProcess) {
  throw "Run from 64-bit Windows PowerShell on the HU20 TEST Windows PC."
}
# PowerShell 5.1 may evaluate $PSScriptRoot as empty during parameter defaults.
# Read the script's own absolute path once invocation is fully initialised.
if ([string]::IsNullOrWhiteSpace($InstallationDirectory)) {
  $InstallationDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if ([string]::IsNullOrWhiteSpace($InstallationDirectory)) {
  throw "Cannot resolve the installed BGM-HU20 folder. No enrolment page was opened."
}
$root = (Resolve-Path -LiteralPath $InstallationDirectory -ErrorAction Stop).Path
$configPath = Join-Path $root "Hu20-TestTerminal.local.json"
$probePath = Join-Path $root "Hu20-Probe.ps1"
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
  throw "The TEST terminal has not been configured on this PC. The local JSON configuration is missing."
}
if (-not (Test-Path -LiteralPath $probePath -PathType Leaf)) {
  throw "Hu20-Probe.ps1 is missing from the installed TEST folder. No enrolment page was opened."
}
$config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
$properties = @($config.PSObject.Properties.Name)
$expected = @("baseUrl", "terminalId", "sdkAssembly")
if ($properties.Count -ne 3 -or @($properties | Where-Object { $expected -cnotcontains $_ }).Count -gt 0) {
  throw "Invalid local TEST configuration. Only baseUrl, terminalId and sdkAssembly are permitted."
}

$baseUrl = ([string]$config.baseUrl).Trim().TrimEnd("/")
$uri = $null
try { $uri = [Uri]::new($baseUrl) }
catch { throw "Invalid configured TEST Preview origin." }
if ($uri.Scheme -ne "https" -or $uri.Port -ne 443 -or
    $uri.UserInfo -ne "" -or $uri.Query -ne "" -or $uri.Fragment -ne "" -or
    $uri.AbsolutePath -ne "/" -or
    $uri.Host -cnotmatch '^bestgymsmalta-member-platform-[a-z0-9-]+-leliapap-2558s-projects[.]vercel[.]app$') {
  throw "Only the configured immutable BGM TEST Preview origin is allowed. Do not use a Share link here."
}
$terminalId = ([string]$config.terminalId).Trim()
if ($terminalId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
  throw "The PC's registered TEST Terminal ID is invalid."
}
$sdkPath = (Resolve-Path -LiteralPath ([string]$config.sdkAssembly) -ErrorAction Stop).Path
if (-not [string]::Equals([IO.Path]::GetExtension($sdkPath), ".dll", [StringComparison]::OrdinalIgnoreCase) -or
    -not (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $sdkPath) "sgfplib.dll") -PathType Leaf)) {
  throw "The configured official SecuGen x64 SDK DLLs are missing."
}

Write-Host "BGM HU20 fictional TEST enrolment: checking the reader attached to this PC..."
# The previously tested diagnostic checks actual SDK Init/OpenDevice/GetDeviceInfo.
# Mode=health does not capture images or templates, and closes the device.
try {
  & $probePath -SdkAssembly $sdkPath -Mode health
  if (-not $?) { throw "Native SDK health check failed." }
} catch {
  throw "No usable HU20 was verified on this PC. Connect the reader and close any active kiosk before retrying. No enrolment was opened. $($_.Exception.Message)"
}

$enrollmentUrl = "$baseUrl/staff/admin/staff/terminals/enrollment?localTerminalId=$([Uri]::EscapeDataString($terminalId))"
Write-Host "PASS: local HU20 reader opened and closed successfully."
Write-Host "Opening the protected Super Admin TEST enrolment page with this PC's registered terminal preselected."
Write-Host "You must still be logged in as Super Admin. The server will independently check terminal registration and scanner authentication."
Start-Process -FilePath $enrollmentUrl
