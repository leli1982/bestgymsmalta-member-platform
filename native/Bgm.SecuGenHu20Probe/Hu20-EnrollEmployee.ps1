#Requires -Version 5.1
<#
  BGM HU20 supervised double-scan TEST central enrollment (v1).
  Works with Vercel-protected Preview deployments using a temporary
  deployment Share link. No biometric, employee or attendance data is sent.
  Never paste your temporary Share link or terminal secret into chat.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,
  [Parameter(Mandatory = $true)]
  [string]$TerminalId,
  [Parameter(Mandatory = $true)]
  [string]$SdkAssembly,
  [ValidateRange(1000,30000)]
  [int]$CaptureTimeoutMs = 10000,
  [ValidateRange(1,100)]
  [int]$Quality = 80
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or -not [Environment]::Is64BitProcess) {
  throw 'Use 64-bit Windows PowerShell on the authorized HU20 TEST terminal.'
}
$base = $BaseUrl.TrimEnd("/")
if ($base -notmatch '^https://[a-zA-Z0-9.-]+$') {
  throw "Use the exact HTTPS origin of the BGM TEST Preview deployment."
}
if ($base -notmatch '\.vercel\.app$') {
  throw "This TEST helper only accepts the BGM Vercel Preview domain."
}
if ($TerminalId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
  throw "Invalid terminal ID."
}

function Read-PrivateText([string]$promptText) {
  $secureValue = Read-Host $promptText -AsSecureString
  $pointer = [IntPtr]::Zero
  try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    if ($pointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    $secureValue.Dispose()
  }
}

function Get-SdkType([System.Reflection.Assembly]$assembly, [string]$name) {
  $type = $assembly.GetType('SecuGen.FDxSDKPro.Windows.' + $name, $false)
  if ($null -eq $type) { throw "The installed SDK is missing $name." }
  return $type
}
function Check-SdkResult([string]$operation, [object]$value) {
  if ([int]$value -ne 0) { throw "$operation failed with vendor code $value." }
}
function Get-TransientTemplate([object]$manager, [int]$width, [int]$height, [int]$maxSize) {
  $raw = [byte[]]::new($width * $height)
  $buffer = [byte[]]::new($maxSize)
  $keepBuffer = $false
  try {
    Write-Host 'Place one test finger on the HU20 sensor...'
    Check-SdkResult 'GetImageEx' ($manager.GetImageEx($raw, $CaptureTimeoutMs, 0, $Quality))
    Check-SdkResult 'CreateTemplate' ($manager.CreateTemplate($raw, $buffer))
    # Full SDK buffer matches the already validated Hu20-Probe.ps1 behavior.
    $keepBuffer = $true
    return ,$buffer
  }
  finally {
    Clear-Bytes $raw
    if (-not $keepBuffer) { Clear-Bytes $buffer }
  }
}

$webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Write-Host "BGM HU20 supervised TEST enrollment (no attendance)."
Write-Host "If the TEST Preview is Vercel-protected, copy its temporary Share link from Vercel > Deployments > Share."
Write-Host "The link and your terminal secret are entered privately and are not saved."
$shareLink = Read-PrivateText "Paste temporary Vercel Share link, or press Enter to skip"
try {
  if ($shareLink) {
    $shareUri = $null
    try { $shareUri = [Uri]::new($shareLink) }
    catch { throw "The Vercel Share link is not a valid URL." }
    $baseUri = [Uri]::new($base)
    # Vercel Share may use an alternate alias for the same TEST deployment.
    # NEVER request the user-entered link; redeem its token only at $base.
    if ($shareUri.Scheme -ne "https" -or
        $shareUri.Host -notmatch '\.vercel\.app$' -or
        $shareUri.Port -ne 443 -or
        $shareUri.UserInfo -ne "" -or
        $shareUri.Fragment -ne "") {
      throw "Paste a Vercel deployment Share link with an HTTPS .vercel.app hostname."
    }
    if ($shareUri.Host -ne $baseUri.Host) {
      Write-Host "Share link has a different Vercel alias. Testing the token ONLY against the specified TEST deployment."
    }
    $shareMatch = [regex]::Match($shareUri.Query, '(?:^\?|&)_vercel_share=([^&#]+)', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $shareMatch.Success) {
      throw "This is not a temporary Vercel Share link. It must include _vercel_share."
    }
    $shareToken = [Uri]::UnescapeDataString($shareMatch.Groups[1].Value)
    if ($shareToken -notmatch '^[a-zA-Z0-9._-]{12,256}$') {
      throw "Invalid Vercel Share token format."
    }
    $primeUrl = "$base/?_vercel_share=$([Uri]::EscapeDataString($shareToken))"
    Write-Host "Authorising temporary TEST Preview access..."
    try {
      $prime = Invoke-WebRequest -Uri $primeUrl -Method Get -WebSession $webSession -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 5
      if ($prime.StatusCode -ne 200 -or
          $prime.BaseResponse.ResponseUri.Host -ne $baseUri.Host) {
        throw "Temporary Preview access did not complete on the expected host."
      }
    }
    catch {
      throw "Vercel Share access failed. Generate a fresh Share link for the exact TEST deployment. Details: $($_.Exception.Message)"
    }
    Write-Host "Vercel TEST Preview access established."
  }
}
finally {
  $shareLink = $null
  $shareToken = $null
  $primeUrl = $null
}

$terminalSecret = Read-PrivateText "Enter the private HU20 terminal secret"
try {
  if ($terminalSecret -notmatch '^[a-fA-F0-9]{64}$') {
    throw "Terminal secret format is invalid."
  }
  $headers = @{
    "Authorization" = "Bearer $terminalSecret"
    "X-BGM-HU20-Terminal-Id" = $TerminalId
    "Accept" = "application/json"
  }
  Write-Host "Checking registered terminal for a supervised TEST enrollment request..."
  $healthUrl = "$base/api/staff-hu20/enrollments/pending"
  try {
    # No cross-site redirects with an Authorization header.
    $response = Invoke-WebRequest -Uri $healthUrl -Method Get -Headers $headers -WebSession $webSession -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 20
  }
  catch {
    $code = $null
    if ($_.Exception.Response) {
      try { $code = [int]$_.Exception.Response.StatusCode } catch {}
    }
    if ($code -eq 401 -or $code -eq 403) {
      throw "Connection refused (HTTP $code): the terminal secret, terminal status or Vercel Share access needs checking. No attendance was recorded."
    }
    if ($code -eq 404) {
      throw "HU20 TEST enrollment API unavailable (HTTP 404): verify the TEST Preview URL and feature flag."
    }
    if ($code -ge 300 -and $code -lt 400) {
      throw "Vercel redirected the API request (HTTP $code). Use a valid temporary Share link first."
    }
    throw "Could not reach the HU20 TEST health endpoint. $($_.Exception.Message)"
  }
  if ([string]$response.Headers["Content-Type"] -notmatch 'application/json') {
    throw "The server returned a web/login page instead of TEST JSON. Paste a fresh Vercel Share link and retry. No attendance was recorded."
  }
  $result = $null
  try { $result = $response.Content | ConvertFrom-Json -ErrorAction Stop }
  catch { throw "The TEST server response was not valid JSON. No attendance was recorded." }
  if ($result.ok -ne $true -or $result.fingerprintCaptureEnabled -ne $false) {
    throw "Unexpected enrollment response. Stop without scanning."
  }
  if ($null -eq $result.enrollment) {
    Write-Host "No active Super Admin-authorised enrollment for this terminal."
    return
  }
  Write-Host "Supervised TEST enrollment for: $($result.enrollment.employeeName)."
  Write-Host "Expires at: $($result.enrollment.expiresAt)"
  $confirmation = Read-Host "Verify employee physically present, then type ENROLL to start"
  if ($confirmation -cne 'ENROLL') {
    Write-Host "Cancelled without capturing biometrics."
    return
  }

  $sdkPath = (Resolve-Path -LiteralPath $SdkAssembly -ErrorAction Stop).Path
  $sdkFolder = Split-Path -Parent $sdkPath
  if (-not (Test-Path -LiteralPath (Join-Path $sdkFolder 'sgfplib.dll') -PathType Leaf)) {
    throw "Official SecuGen native DLL is missing."
  }
  $env:PATH = $sdkFolder + ';' + $env:PATH
  $assembly = [System.Reflection.Assembly]::LoadFrom($sdkPath)
  $managerType = Get-SdkType $assembly 'SGFingerPrintManager'
  $deviceType = Get-SdkType $assembly 'SGFPMDeviceName'
  $infoType = Get-SdkType $assembly 'SGFPMDeviceInfoParam'
  $formatType = Get-SdkType $assembly 'SGFPMTemplateFormat'
  $levelType = Get-SdkType $assembly 'SGFPMSecurityLevel'
  $manager = [System.Activator]::CreateInstance($managerType)
  $opened = $false
  $first = $null
  $second = $null
  $bodyText = $null
  try {
    Check-SdkResult 'Init' ($manager.Init([Enum]::Parse($deviceType, 'DEV_AUTO')))
    Check-SdkResult 'OpenDevice' ($manager.OpenDevice(0x255))
    $opened = $true
    $info = [System.Activator]::CreateInstance($infoType)
    Check-SdkResult 'GetDeviceInfo' ($manager.GetDeviceInfo($info))
    $width = [int]$info.ImageWidth
    $height = [int]$info.ImageHeight
    if ($width -le 0 -or $height -le 0 -or ($width * $height) -gt 2000000) {
      throw "HU20 image dimensions invalid."
    }
    Check-SdkResult 'SetTemplateFormat' ($manager.SetTemplateFormat([Enum]::Parse($formatType, 'ANSI378')))
    $maxSize = 0
    Check-SdkResult 'GetMaxTemplateSize' ($manager.GetMaxTemplateSize([ref]$maxSize))
    if ($maxSize -lt 64 -or $maxSize -gt 65536) { throw "Invalid ANSI378 template buffer size." }

    Write-Host "First test fingerprint capture..."
    $first = Get-TransientTemplate $manager $width $height $maxSize
    [void](Read-Host "Lift your finger; press Enter for the second scan")
    Write-Host "Second test fingerprint capture..."
    $second = Get-TransientTemplate $manager $width $height $maxSize
    $matched = $false
    Check-SdkResult 'MatchTemplate' ($manager.MatchTemplate(
      $first, $second, [Enum]::Parse($levelType, 'NORMAL'), [ref]$matched))
    if (-not $matched) {
      throw "The two captures do not match. No biometric data was uploaded."
    }
    Write-Host "PASS: Two captures matched. Uploading the template to TEST..."
    $bodyText = @{
      requestId = [string]$result.enrollment.id
      templateFormat = 'ANSI378'
      templateBase64 = [Convert]::ToBase64String($first)
    } | ConvertTo-Json -Compress
    $posted = Invoke-WebRequest -Uri "$base/api/staff-hu20/enrollments/complete" -Method Post -Headers $headers -WebSession $webSession -UseBasicParsing -TimeoutSec 30 -MaximumRedirection 0 -ContentType 'application/json' -Body $bodyText
    if ([string]$posted.Headers['Content-Type'] -notmatch 'application/json') {
      throw "TEST server did not return JSON. Enrollment is unconfirmed."
    }
    $resultSaved = $posted.Content | ConvertFrom-Json -ErrorAction Stop
    if ($posted.StatusCode -ne 201 -or $resultSaved.ok -ne $true -or $resultSaved.attendanceEnabled -ne $false) {
      throw "TEST server did not confirm secure fingerprint enrollment."
    }
    Write-Host "PASS: Fingerprint enrolled once in TEST and encrypted on server."
    Write-Host "No biometric file saved to the PC, and no attendance/payroll event was recorded."
  }
  finally {
    Clear-Bytes $first
    Clear-Bytes $second
    $bodyText = $null
    if ($opened) {
      try { [void]$manager.CloseDevice() }
      catch { Write-Warning "CloseDevice failed." }
    }
    if ($manager -is [System.IDisposable]) { $manager.Dispose() }
  }
}
finally {
  $terminalSecret = $null
  $headers = $null
}
