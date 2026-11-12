#Requires -Version 5.1
<#
.SYNOPSIS
  TEST-ONLY: probe a SecuGen HU20 with the official FDx SDK Pro .NET assembly.
.DESCRIPTION
  Reports reader connection, captures a transient template, and optionally
  compares two captures. No templates, raw images or employee data are saved,
  uploaded, printed or sent to BGM/Supabase. Do NOT use for staff attendance.
.EXAMPLE
  .\Hu20-Probe.ps1 -SdkAssembly "C:\Program Files\SecuGen\FDx SDK Pro\Bin\DotNet\SecuGen.FDxSDKPro.Windows.dll" -Mode health
.EXAMPLE
  .\Hu20-Probe.ps1 -SdkAssembly "C:\path\SecuGen.FDxSDKPro.Windows.dll" -Mode match
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [string]$SdkAssembly,
  [ValidateSet('health','capture','match')]
  [string]$Mode = 'health',
  [ValidateRange(1000,30000)]
  [int]$CaptureTimeoutMs = 10000,
  [ValidateRange(1,100)]
  [int]$Quality = 80
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
  throw 'This diagnostic requires Windows.'
}
if (-not [Environment]::Is64BitProcess) {
  throw 'Run this test in 64-bit Windows PowerShell.'
}

$path = (Resolve-Path -LiteralPath $SdkAssembly -ErrorAction Stop).Path
$assembly = [System.Reflection.Assembly]::LoadFrom($path)
$namespace = 'SecuGen.FDxSDKPro.Windows'

function Get-SdkType([string]$name) {
  $type = $assembly.GetType("$namespace.$name", $false)
  if ($null -eq $type) { throw "Missing SDK type $name. Confirm the installed FDx SDK Pro version." }
  return $type
}

function Check-SdkResult([string]$operation, [object]$result) {
  if ([int]$result -ne 0) {
    throw "$operation failed with vendor error code $result. Check the SDK version, driver binding and reader."
  }
}

$managerType = Get-SdkType 'SGFingerPrintManager'
$deviceType = Get-SdkType 'SGFPMDeviceName'
$infoType = Get-SdkType 'SGFPMDeviceInfoParam'
$formatType = Get-SdkType 'SGFPMTemplateFormat'
$levelType = Get-SdkType 'SGFPMSecurityLevel'

$manager = [System.Activator]::CreateInstance($managerType)
$deviceOpened = $false
$first = $null
$second = $null

function Get-TransientTemplate([object]$manager, [int]$width, [int]$height, [int]$maxTemplateSize) {
  $raw = [byte[]]::new($width * $height)
  $buffer = [byte[]]::new($maxTemplateSize)
  try {
    Write-Host 'Place your test finger on the HU20 sensor...'
    Check-SdkResult 'GetImageEx' ($manager.GetImageEx($raw, $CaptureTimeoutMs, 0, $Quality))
    Check-SdkResult 'CreateTemplate' ($manager.CreateTemplate($raw, $buffer))

    $actualSize = 0
    Check-SdkResult 'GetTemplateSize' ($manager.GetTemplateSize($buffer, [ref]$actualSize))
    if ($actualSize -le 0 -or $actualSize -gt $maxTemplateSize) {
      throw "Invalid vendor template size $actualSize."
    }

    $template = [byte[]]::new($actualSize)
    [Array]::Copy($buffer, $template, $actualSize)
    return ,$template
  }
  finally {
    [Array]::Clear($raw, 0, $raw.Length)
    [Array]::Clear($buffer, 0, $buffer.Length)
  }
}

try {
  Write-Host "FDx SDK: $($assembly.GetName().Name) v$($assembly.GetName().Version)"
  $autoDevice = [Enum]::Parse($deviceType, 'DEV_AUTO')
  Check-SdkResult 'Init' ($manager.Init($autoDevice))
  # SecuGen USB_AUTO_DETECT is 0x255 in the FDx SDK Pro Windows API.
  Check-SdkResult 'OpenDevice' ($manager.OpenDevice(0x255))
  $deviceOpened = $true

  $info = [System.Activator]::CreateInstance($infoType)
  Check-SdkResult 'GetDeviceInfo' ($manager.GetDeviceInfo($info))
  $width = [int]$info.ImageWidth
  $height = [int]$info.ImageHeight
  if ($width -le 0 -or $height -le 0 -or ($width * $height) -gt 2000000) {
    throw 'The SDK returned unsupported fingerprint image dimensions.'
  }
  Write-Host "Reader detected. Image dimensions: $width x $height."

  if ($Mode -eq 'health') {
    Write-Host 'PASS: Native FDx SDK reader connection.'
  }
  else {
    # ANSI378 is vendor-supported and is suitable for a later portability test.
    # This diagnostic does not store it or assert that cross-terminal recognition works.
    $ansi = [Enum]::Parse($formatType, 'ANSI378')
    Check-SdkResult 'SetTemplateFormat' ($manager.SetTemplateFormat($ansi))
    $maxTemplateSize = 0
    Check-SdkResult 'GetMaxTemplateSize' ($manager.GetMaxTemplateSize([ref]$maxTemplateSize))
    if ($maxTemplateSize -lt 64 -or $maxTemplateSize -gt 65536) {
      throw "Unsupported maximum template size $maxTemplateSize."
    }
    $first = Get-TransientTemplate $manager $width $height $maxTemplateSize
    Write-Host 'PASS: Native SDK captured and extracted a fingerprint template (not saved).'

    if ($Mode -eq 'match') {
      Read-Host 'Remove your finger, then press Enter for the second scan' | Out-Null
      $second = Get-TransientTemplate $manager $width $height $maxTemplateSize
      $normal = [Enum]::Parse($levelType, 'Normal')
      $matched = $false
      Check-SdkResult 'MatchTemplate' ($manager.MatchTemplate($first, $second, $normal, [ref]$matched))
      if ($matched) {
        Write-Host 'MATCH: the SDK considers both temporary captures a match at Normal security level.'
      }
      else {
        Write-Host 'NO MATCH: the SDK considers the captures different at Normal security level.'
      }
      Write-Host 'Note: Normal is vendor example level, not an approved BGM attendance threshold.'
    }
  }
}
finally {
  if ($null -ne $first) { [Array]::Clear($first, 0, $first.Length) }
  if ($null -ne $second) { [Array]::Clear($second, 0, $second.Length) }
  if ($deviceOpened) {
    try { [void]$manager.CloseDevice() } catch { Write-Warning 'SDK CloseDevice returned an error.' }
  }
  if ($manager -is [System.IDisposable]) { $manager.Dispose() }
}
