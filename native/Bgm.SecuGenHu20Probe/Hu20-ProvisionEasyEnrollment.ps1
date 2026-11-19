#Requires -Version 5.1
<#
  ONE-TIME supervised fictional TEST onboarding on the Windows reader PC.
  Runs as the Windows user who will operate the local HU20 bridge. Private
  device secret and Vercel Automation Bypass are DPAPI-sealed locally, NEVER
  printed, sent to GitHub, logged, stored in plain JSON or shared in a ZIP.
#>
[CmdletBinding()]
param([switch]$ReplaceExisting,[switch]$EnableKioskStartup)
$ErrorActionPreference="Stop"
Set-StrictMode -Version Latest
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or
    -not [Environment]::Is64BitProcess) { throw "64-bit Windows PowerShell required." }
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $root "Hu20-TestTerminal.local.json"
$vaultPath = Join-Path $root "Hu20-DeviceVault.ps1"
$bridgePath = Join-Path $root "Hu20-LocalBridge.ps1"
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf) -or
    -not (Test-Path -LiteralPath $vaultPath -PathType Leaf) -or
    -not (Test-Path -LiteralPath $bridgePath -PathType Leaf)) {
  throw "Incomplete HU20 TEST installation. The existing non-secret configuration and device scripts are required."
}
. $vaultPath
$config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
$props = @($config.PSObject.Properties.Name)
if ($props.Count -ne 3 -or @($props | Where-Object { @("baseUrl","terminalId","sdkAssembly") -cnotcontains $_ }).Count -gt 0) {
  throw "Local configuration must contain exactly baseUrl, terminalId, sdkAssembly."
}
$baseUrl = ([string]$config.baseUrl).TrimEnd("/")
$terminalId = [string]$config.terminalId
$uri = [Uri]::new($baseUrl)
if ($uri.Scheme -ne "https" -or $uri.Port -ne 443 -or
    $uri.UserInfo -ne "" -or $uri.Query -ne "" -or $uri.Fragment -ne "" -or
    $uri.AbsolutePath -ne "/" -or
    $uri.Host -cnotmatch '^bestgymsmalta-member-platform-[a-z0-9-]+-leliapap-2558s-projects[.]vercel[.]app$' -or
    $terminalId -notmatch '^[0-9a-fA-F-]{36}$') { throw "Unexpected BGM TEST Preview or terminal." }
$existing = Get-Hu20VaultPath
if ((Test-Path -LiteralPath $existing) -and -not $ReplaceExisting) {
  $existingVault = Get-Hu20Vault -BaseUrl $baseUrl -TerminalId $terminalId
  $existingVault = $null
  Write-Host "PASS: Existing encrypted device credentials are valid for this TEST terminal. No prompts."
} else {
  if ((Test-Path -LiteralPath $existing) -and $ReplaceExisting) {
    if ((Read-Host "Type REPLACE to update this PC's TEST protected credentials") -cne "REPLACE") {
      throw "Cancelled without changes."
    }
  }
  function Read-PrivateText([string]$message) {
    $secure = Read-Host $message -AsSecureString
    $handle = [IntPtr]::Zero
    try {
      $handle = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
      return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($handle)
    } finally {
      if ($handle -ne [IntPtr]::Zero) { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($handle) }
      $secure.Dispose()
    }
  }
  Write-Host "ONE-TIME HU20 TEST provisioning. Enter these secrets privately on THIS PC."
  Write-Host "Use a dedicated Vercel Automation Bypass for this TEST terminal (NOT a temporary Share link)."
  $terminalSecret = Read-PrivateText "Existing registered HU20 terminal secret"
  $vercelBypass = Read-PrivateText "Dedicated Vercel Automation Bypass (32 letters/digits)"
  try {
    if ($terminalSecret -cnotmatch '^[0-9a-fA-F]{64}$' -or $vercelBypass -cnotmatch '^[a-zA-Z0-9]{32}$') {
      throw "Invalid terminal secret or automation bypass format. No vault saved."
    }
    Set-Hu20Vault -BaseUrl $baseUrl -TerminalId $terminalId -TerminalSecret $terminalSecret -VercelBypass $vercelBypass
    Write-Host "PASS: Local secrets encrypted to this Windows user with DPAPI."
  } finally {
    $terminalSecret=$null
    $vercelBypass=$null
  }
}
# Per-user automatic startup (no installer-level shared secret; no admin account).
$exe=Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$command='"'+$exe+'" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$bridgePath+'"'
$runKey="HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
New-Item -Path $runKey -Force | Out-Null
Set-ItemProperty -Path $runKey -Name "BGM_HU20_TEST_LocalBridge" -Value $command
Write-Host "PASS: HU20 TEST local bridge registered for this Windows user's sign-in."
Write-Host "Only the active Windows user with these DPAPI credentials can run it."
# Start the protected local bridge immediately on this PC, once. The
# HKCU Run registration restarts it on subsequent Windows sign-ins.
$bridgeArgs = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $bridgePath + '"'
try {
  $probe = New-Object System.Net.Sockets.TcpClient
  $probe.Connect([System.Net.IPAddress]::Loopback,8765)
  $probe.Close()
  Write-Host "A local service is already listening on port 8765. Verify the HU20 reader status in Super Admin."
} catch {
  Start-Process -FilePath $exe -ArgumentList $bridgeArgs -WindowStyle Hidden
  Write-Host "PASS: Local TEST reader bridge launched for this Windows user."
}
if ($EnableKioskStartup) {
  # Separate, opt-in TEST kiosk startup. Never enable automatically for an
  # existing working installation merely because enrollment bridge is installed.
  $manager=Join-Path $root "Hu20-ManageKioskStartup.ps1"
  if (-not (Test-Path -LiteralPath $manager -PathType Leaf)) {
    throw "Optional HU20 kiosk startup manager is missing. Existing setup preserved."
  }
  & $manager -Action Enable
  if (-not $?) { throw "Optional TEST kiosk startup was not confirmed." }
}
Write-Host "Open a fictional TEST employee in Super Admin and use Enrol Fingerprint."
