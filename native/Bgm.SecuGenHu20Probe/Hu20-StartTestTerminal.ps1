#Requires -Version 5.1
<#
  HU20 TEST one-click launcher: stores only non-secret local settings.
  Share tokens, terminal secrets, fingerprint templates and employee data
  remain transient in the PowerShell session and are never written to disk.
  Use -Configure to update the Preview after a deployment.
#>
[CmdletBinding()]
param(
  [switch]$Configure,
  [string]$BaseUrl,
  [string]$TerminalId,
  [string]$SdkAssembly
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or -not [Environment]::Is64BitProcess) {
  throw "Only 64-bit Windows PowerShell on the authorised HU20 TEST PC is supported."
}
$directory = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $directory "Hu20-TestTerminal.local.json"
$punchPath = Join-Path $directory "Hu20-TestPunch.ps1"
if (-not (Test-Path -LiteralPath $punchPath -PathType Leaf)) {
  throw "Place Hu20-TestPunch.ps1 in the same folder as this TEST launcher."
}
$config = $null
if (-not $Configure -and (Test-Path -LiteralPath $configPath -PathType Leaf)) {
  $loaded = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
  if ($loaded -and $loaded.PSObject.Properties.Name -contains "baseUrl" -and
      $loaded.PSObject.Properties.Name -contains "terminalId" -and
      $loaded.PSObject.Properties.Name -contains "sdkAssembly") {
    $config = $loaded
  }
}
if (-not $BaseUrl -and $config) { $BaseUrl = [string]$config.baseUrl }
if (-not $TerminalId -and $config) { $TerminalId = [string]$config.terminalId }
if (-not $SdkAssembly -and $config) { $SdkAssembly = [string]$config.sdkAssembly }
if (-not $BaseUrl) { $BaseUrl = Read-Host "Exact BGM HU20 TEST Preview origin (no Share token)" }
if (-not $TerminalId) { $TerminalId = Read-Host "Existing registered TEST Terminal ID" }
if (-not $SdkAssembly) {
  $defaultSdk = Join-Path $directory "SecuGen.FDxSDKPro.Windows.dll"
  $SdkAssembly = Read-Host "Official SDK assembly DLL path [$defaultSdk]"
  if (-not $SdkAssembly) { $SdkAssembly = $defaultSdk }
}

# Reject an arbitrary Vercel hostname that could receive the private secret.
$BaseUrl = $BaseUrl.Trim().TrimEnd("/")
$uri = $null
try { $uri = [Uri]::new($BaseUrl) } catch { throw "Invalid TEST Preview origin." }
if ($uri.Scheme -ne "https" -or $uri.Port -ne 443 -or
    $uri.UserInfo -ne "" -or $uri.Query -ne "" -or $uri.Fragment -ne "" -or
    $uri.AbsolutePath -ne "/" -or
    $uri.Host -cnotmatch '^bestgymsmalta-member-platform-[a-z0-9-]+-leliapap-2558s-projects[.]vercel[.]app$') {
  throw "Only the immutable BGM HU20 TEST Preview origin is allowed. Never enter a Share URL here."
}
if ($TerminalId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
  throw "Invalid registered TEST Terminal ID."
}
$sdkPath = (Resolve-Path -LiteralPath $SdkAssembly -ErrorAction Stop).Path
if (-not [string]::Equals([IO.Path]::GetExtension($sdkPath), ".dll", [StringComparison]::OrdinalIgnoreCase)) {
  throw "The SDK assembly must be a .dll file."
}
if (-not (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $sdkPath) "sgfplib.dll") -PathType Leaf)) {
  throw "Official SDK dependency sgfplib.dll is missing next to the assembly."
}
if ($Configure -or -not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
  # Explicit allowlist: these are the ONLY settings persisted locally.
  [pscustomobject]@{
    baseUrl = $BaseUrl
    terminalId = $TerminalId
    sdkAssembly = $sdkPath
  } | ConvertTo-Json -Compress | Set-Content -LiteralPath $configPath -Encoding UTF8 -NoNewline
  Write-Host "Saved non-secret TEST terminal settings."
}
Write-Host ""
Write-Host "============================================================"
Write-Host " BESTGYMSMALTA | FICTIONAL HU20 TEST TERMINAL (NOT LIVE)"
Write-Host "============================================================"
Write-Host "Terminal: $TerminalId"
Write-Host "TEST Preview: $BaseUrl"
Write-Host "A fresh five-minute Super Admin authorisation is required for EACH scan."
Write-Host "Enter the private Share link and terminal secret only when prompted."
Write-Host ""
& $punchPath -BaseUrl $BaseUrl -TerminalId $TerminalId -SdkAssembly $sdkPath -EnableFictionalTestAttendance -RepeatApprovedTests
if (-not $?) { throw "Fictional HU20 TEST terminal exited with an error." }
