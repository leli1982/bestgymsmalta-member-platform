#Requires -Version 5.1
<#
  HU20 TEST PC LOCAL READINESS - safe inventory checks only.
  Does not contact any service, scan a finger, open the reader,
  persist credentials or launch the kiosk. It cannot authorise attendance.
  Run on each Windows PC before supervised fictional TEST provisioning.
#>
[CmdletBinding()]
param([string]$InstallationDirectory = $PSScriptRoot)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$issues = New-Object 'System.Collections.Generic.List[string]'
function Add-Hu20Issue([string]$issue) {
  [void]$issues.Add($issue)
  Write-Host "FAIL: $issue"
}
function Test-Hu20File([string]$relativeName) {
  $full = Join-Path $InstallationDirectory $relativeName
  if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
    Add-Hu20Issue "Missing required local file: $relativeName"
    return $false
  }
  Write-Host "PASS: $relativeName exists"
  return $true
}

Write-Host "BestGymsMalta | HU20 fictional TEST local readiness"
Write-Host "This does NOT verify live hardware, credentials or the central TEST server."
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
  Add-Hu20Issue "Windows 11/Windows PowerShell 5.1 is required on the reception PC."
}
if (-not [Environment]::Is64BitProcess) {
  Add-Hu20Issue "Run in 64-bit Windows PowerShell."
}
if (-not (Test-Path -LiteralPath $InstallationDirectory -PathType Container)) {
  Add-Hu20Issue "Installation folder not found."
} else {
  $required = @(
    "Hu20-KIOSK-TEST.cmd",
    "Hu20-StartTestTerminal.ps1",
    "Hu20-AutoKiosk.ps1",
    "Hu20-KioskDisplay.ps1",
    "Hu20-KioskSafety.ps1",
    "Hu20-TestPunch.ps1"
  )
  foreach ($entry in $required) { [void](Test-Hu20File $entry) }

  # Parse only; the kiosk is NEVER executed by this readiness check.
  foreach ($entry in @($required | Where-Object { $_ -like "*.ps1" })) {
    $filePath = Join-Path $InstallationDirectory $entry
    if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) { continue }
    $tokens = $null
    $syntaxErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
      $filePath, [ref]$tokens, [ref]$syntaxErrors
    ) | Out-Null
    if ($syntaxErrors.Count -gt 0) {
      Add-Hu20Issue "$entry has invalid PowerShell syntax."
    } else {
      Write-Host "PASS: $entry parses"
    }
  }

  $configPath = Join-Path $InstallationDirectory "Hu20-TestTerminal.local.json"
  if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    Add-Hu20Issue "Missing non-secret Hu20-TestTerminal.local.json configuration."
  } else {
    $config = $null
    try {
      $config = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
      $allowed = @("baseUrl", "terminalId", "sdkAssembly")
      $props = @($config.PSObject.Properties.Name)
      if ($props.Count -ne 3 -or @($props | Where-Object { $allowed -cnotcontains $_ }).Count -gt 0) {
        Add-Hu20Issue "Local JSON may contain ONLY baseUrl, terminalId and sdkAssembly; never store a secret or Share token."
      }
      $url = [string]$config.baseUrl
      $uri = [Uri]::new($url)
      if ($uri.Scheme -ne "https" -or $uri.Port -ne 443 -or
          $uri.Query -ne "" -or $uri.Fragment -ne "" -or $uri.UserInfo -ne "" -or
          $uri.AbsolutePath -ne "/" -or
          $uri.Host -cnotmatch '^bestgymsmalta-member-platform-[a-z0-9-]+-leliapap-2558s-projects[.]vercel[.]app$') {
        Add-Hu20Issue "TEST Preview origin is not an approved immutable BGM Preview."
      } else {
        Write-Host "PASS: TEST Preview origin allowlisted"
      }
      if ([string]$config.terminalId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
        Add-Hu20Issue "TEST terminal ID format invalid."
      } else {
        Write-Host "PASS: TEST terminal ID format valid (server registration not checked)"
      }
      $dll = [string]$config.sdkAssembly
      if ([string]::IsNullOrWhiteSpace($dll) -or -not (Test-Path -LiteralPath $dll -PathType Leaf)) {
        Add-Hu20Issue "SecuGen SDK assembly is missing at the configured location."
      } else {
        $sdk = (Resolve-Path -LiteralPath $dll).Path
        if (-not [string]::Equals([IO.Path]::GetExtension($sdk), ".dll", [StringComparison]::OrdinalIgnoreCase)) {
          Add-Hu20Issue "SecuGen SDK path does not point to a DLL."
        } else {
          Write-Host "PASS: configured SecuGen SDK DLL exists"
        }
        if (-not (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $sdk) "sgfplib.dll") -PathType Leaf)) {
          Add-Hu20Issue "Missing sgfplib.dll beside the SecuGen SDK assembly."
        } else {
          Write-Host "PASS: SecuGen SDK native dependency exists"
        }
      }
    } catch {
      Add-Hu20Issue "Unable to validate non-secret local JSON configuration."
    } finally {
      $config = $null
    }
  }
}
if ($issues.Count -gt 0) {
  throw "HU20 TEST local readiness FAILED: $($issues.Count) issue(s). Do not run the kiosk."
}
Write-Host "PASS: Local TEST files/configuration checked. Reader, network and TEST approval still require supervised verification."
