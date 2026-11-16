#Requires -Version 5.1
<#
  BGM HU20 fictional TEST-only fingerprint punch clock (v1).
  Uses a Super Admin-authorised one-shot recognition and an independent,
  separately gated TEST-only attendance transition for fictional employees.
  Templates remain transient in RAM. This is NOT approved for real staff/payroll.
  Works with protected Vercel Preview Share links. Never paste terminal secrets
  or Share links into chat, code, screenshots or logs.
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
  [int]$Quality = 80,
  [switch]$EnableFictionalTestAttendance,
  [switch]$RepeatApprovedTests,
  [switch]$AutoKioskTest,
  [switch]$FullScreenTest,
  [switch]$UseProvisionedDevice
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

if (-not $EnableFictionalTestAttendance -or -not $AutoKioskTest -or $RepeatApprovedTests) {
  throw "Requires -EnableFictionalTestAttendance -AutoKioskTest; cannot use supervised repeat mode."
}
if ($base -cnotmatch '^https://bestgymsmalta-member-platform-[a-z0-9-]+-leliapap-2558s-projects[.]vercel[.]app$') {
  throw "Automatic TEST kiosk must use immutable BGM Vercel Preview URL."
}
# Pure, fail-closed fault policy shared by synthetic TEST-only CI drills.
$safetyPath = Join-Path $PSScriptRoot "Hu20-KioskSafety.ps1"
if (-not (Test-Path -LiteralPath $safetyPath -PathType Leaf)) { throw "Missing HU20 TEST kiosk safety policy." }
. $safetyPath

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

function Clear-Bytes([byte[]]$value) {
  if ($null -ne $value) { [Array]::Clear($value, 0, $value.Length) }
}

function Get-SdkType([System.Reflection.Assembly]$assembly, [string]$name) {
  $type = $assembly.GetType('SecuGen.FDxSDKPro.Windows.' + $name, $false)
  if ($null -eq $type) { throw "The installed SDK is missing $name." }
  return $type
}
function Check-SdkResult([string]$operation, [object]$value) {
  if ([int]$value -ne 0) { throw "KIOSK_DEVICE_ERROR: $operation failed with SecuGen vendor code $value." }
}
function Get-TransientTemplate([object]$manager, [int]$width, [int]$height, [int]$maxSize, [DateTimeOffset]$deadline) {
  $raw = [byte[]]::new($width * $height)
  $buffer = [byte[]]::new($maxSize)
  $keepBuffer = $false
  try {
    Write-Host "KIOSK TEST ready: place your fictional test finger on the HU20 sensor."
    # Short capture intervals let the full-screen display process ESC safely.
    $pollMs = if ($FullScreenTest) { [Math]::Min($CaptureTimeoutMs, 2000) } else { $CaptureTimeoutMs }
    try { $result = [int]$manager.GetImageEx($raw, $pollMs, 0, $Quality) }
    catch { throw "KIOSK_DEVICE_ERROR: SecuGen capture failed. Check the HU20 connection." }
    if ($FullScreenTest) { Assert-Hu20KioskDisplay }
    # SecuGen FDx SDK: ERROR_TIME_OUT=54 means no finger. All other errors are fatal.
    while ($result -eq 54 -and [DateTimeOffset]::UtcNow.AddMilliseconds($pollMs) -lt $deadline) {
      Clear-Bytes $raw
      try { $result = [int]$manager.GetImageEx($raw, $pollMs, 0, $Quality) }
      catch { throw "KIOSK_DEVICE_ERROR: SecuGen capture failed. Check the HU20 connection." }
      if ($FullScreenTest) { Assert-Hu20KioskDisplay }
    }
    if ($result -eq 54 -or [DateTimeOffset]::UtcNow -ge $deadline) {
      throw "KIOSK_NO_FINGER_TIMEOUT"
    }
    Check-SdkResult 'GetImageEx' $result
    Check-SdkResult 'CreateTemplate' ($manager.CreateTemplate($raw, $buffer))
    $keepBuffer = $true
    return ,$buffer
  }
  finally {
    Clear-Bytes $raw
    if (-not $keepBuffer) { Clear-Bytes $buffer }
  }
}

function Wait-Hu20FingerRemoval([object]$manager, [int]$width, [int]$height) {
  $raw = [byte[]]::new($width * $height)
  $deadline = [DateTimeOffset]::UtcNow.AddSeconds(15)
  $absentChecks = 0
  try {
    Write-Host "Remove your finger from the HU20 sensor."
    if ($FullScreenTest) { Show-Hu20KioskStatus -State "remove" }
    while ([DateTimeOffset]::UtcNow -lt $deadline) {
      if ($FullScreenTest) { Assert-Hu20KioskDisplay }
      try { $result = [int]$manager.GetImageEx($raw, 900, 0, 40) }
      catch { throw "KIOSK_DEVICE_ERROR: Finger removal sensor check failed." }
      if ($result -eq 54) {
        $absentChecks += 1
        if ($absentChecks -ge 2) { return }
      } elseif ($result -eq 0) {
        $absentChecks = 0
      } else {
        Check-SdkResult 'Finger removal' $result
      }
      Clear-Bytes $raw
    }
    throw "Finger not removed within 15 seconds: TEST kiosk stopped."
  }
  finally { Clear-Bytes $raw }
}

$webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Write-Host "BGM HU20 fictional TEST attendance: recognition first, then one atomic punch."
$terminalSecret = $null
$vercelBypass = $null
$shareLink = ""
if ($UseProvisionedDevice) {
  . (Join-Path $PSScriptRoot "Hu20-DeviceVault.ps1")
  $vault = Get-Hu20Vault -BaseUrl $base -TerminalId $TerminalId
  $terminalSecret = [string]$vault.terminalSecret
  $vercelBypass = [string]$vault.vercelBypass
  $vault = $null
  Write-Host "Using the once-provisioned Windows DPAPI TEST credentials (no repeated prompts)."
} else {
  Write-Host "If the TEST Preview is Vercel-protected, enter its temporary Share link privately."
  $shareLink = Read-PrivateText "Paste temporary Vercel Share link, or press Enter to skip"
}
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

if (-not $UseProvisionedDevice) {
  $terminalSecret = Read-PrivateText "Enter the private HU20 terminal secret"
}
$headers = $null
$templates = New-Object System.Collections.ArrayList
$live = $null
$manager = $null
$opened = $false
$rosterJson = $null
$displayStarted = $false
try {
  if ($terminalSecret -notmatch '^[a-fA-F0-9]{64}$') { throw "Terminal secret invalid." }
  if ($FullScreenTest) {
    if ([System.Threading.Thread]::CurrentThread.GetApartmentState() -ne [System.Threading.ApartmentState]::STA) {
      throw "TEST full screen requires Windows PowerShell -STA."
    }
    $screenScript = Join-Path $PSScriptRoot "Hu20-KioskDisplay.ps1"
    if (-not (Test-Path -LiteralPath $screenScript -PathType Leaf)) {
      throw "Missing Hu20-KioskDisplay.ps1; automatic TEST scanning cannot run invisibly."
    }
    . $screenScript
    Initialize-Hu20KioskDisplay
    $displayStarted = $true
  }
  $headers = @{
    "Authorization" = "Bearer $terminalSecret"
    "X-BGM-HU20-Terminal-Id" = $TerminalId
    "Accept" = "application/json"
    "Cache-Control" = "no-store"
  }
  if ($UseProvisionedDevice) {
    $headers["x-vercel-protection-bypass"] = $vercelBypass
  }
  if ($RepeatApprovedTests) {
    Write-Host "Supervised TEST terminal mode. One authorisation is needed for EVERY scan."
    Write-Host "Preview Share access and the terminal secret stay only in this running PowerShell session."
  }
  $headers["X-BGM-HU20-Kiosk-Test"] = "1"
  Write-Host "Fictional TEST automatic scanner: start a 10-minute Super Admin kiosk window first."
  Write-Host "Stop via Ctrl+C or the Super Admin STOP button. No real employees allowed."
  while ($true) {
    $stopKiosk = $false
    # Never carry fingerprint templates or SDK handles across scan attempts.
    $templates = New-Object System.Collections.ArrayList
    $live = $null
    $manager = $null
    $opened = $false
    $rosterJson = $null
    try {
      if ($FullScreenTest) { Show-Hu20KioskStatus -State "connecting" }
      # Read-only terminal/gym preflight. Never consumes a recognition claim.
      Write-Host "Checking registered TEST gym and Super Admin kiosk window..."
      try {
        $preflightResponse = Invoke-WebRequest -Uri "$base/api/staff-hu20/kiosk/preflight" -Method Get -Headers $headers -WebSession $webSession -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 15
      }
      catch {
        $preflightStatus = $null
        if ($_.Exception.Response) {
          try { $preflightStatus = [int]$_.Exception.Response.StatusCode } catch {}
        }
        if ($preflightStatus -eq 409) { throw "KIOSK_WINDOW_FINISHED" }
        if ($preflightStatus -eq 401 -or $preflightStatus -eq 403 -or $preflightStatus -eq 404) {
          throw "KIOSK_AUTH_ERROR: terminal disabled, unauthorised or wrong TEST Preview."
        }
        throw "KIOSK_NETWORK_ERROR: TEST terminal and registered gym could not be verified."
      }
      if ([string]$preflightResponse.Headers["Content-Type"] -notmatch 'application/json') {
        throw "KIOSK_AUTH_ERROR: TEST preflight returned unexpected content."
      }
      $preflight = $preflightResponse.Content | ConvertFrom-Json -ErrorAction Stop
      if ($preflightResponse.StatusCode -ne 200 -or $preflight.ok -ne $true -or
          $preflight.fictionalTestOnly -ne $true -or $preflight.attendanceRecorded -ne $false -or
          $preflight.recognitionAuthorisationConsumed -ne $false -or
          $preflight.restartRequiresManualApproval -ne $true -or
          -not ([string]::Equals([string]$preflight.terminal.id, $TerminalId, [StringComparison]::OrdinalIgnoreCase)) -or
          [string]$preflight.terminal.gymId -notmatch '^[A-Za-z0-9_-]{2,120}$' -or
          [string]::IsNullOrWhiteSpace([string]$preflight.terminal.gymName) -or
          [int]$preflight.window.scansRemaining -lt 1 -or
          [DateTimeOffset]::Parse([string]$preflight.window.expiresAt) -le [DateTimeOffset]::UtcNow) {
        throw "KIOSK_AUTH_ERROR: terminal, gym or kiosk authorisation failed TEST preflight."
      }
      $registeredGym = [string]$preflight.terminal.gymName
      Write-Host "PASS: TEST terminal registered at $registeredGym."
      if ($FullScreenTest) { Set-Hu20KioskLocation -GymName $registeredGym }
      $preflight = $null
      $preflightResponse = $null
      Write-Host "Requesting Super Admin-authorised TEST recognition session..."
  try {
    $response = Invoke-WebRequest -Uri "$base/api/staff-hu20/recognition/begin" -Method Post -Headers $headers -WebSession $webSession -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30 -ContentType "application/json" -Body '{}'
  }
  catch {
    $status = $null
    if ($_.Exception.Response) {
      try { $status = [int]$_.Exception.Response.StatusCode } catch {}
    }
    if ($status -eq 409) { throw "KIOSK_WINDOW_FINISHED" }
    if ($status -eq 429) { throw "KIOSK_COOLDOWN" }
    if ($status -eq 401 -or $status -eq 403) { throw "KIOSK_AUTH_ERROR: terminal secret or Vercel access rejected." }
    if ($status -eq 404) { throw "KIOSK_AUTH_ERROR: recognition API unavailable on selected TEST Preview." }
    throw "KIOSK_NETWORK_ERROR: recognition request failed. Do not scan while the TEST server is unavailable."
  }
  if ([string]$response.Headers["Content-Type"] -notmatch 'application/json') {
    throw "Expected JSON but got HTML. Check protected Vercel Preview access."
  }
  $rosterJson = $response.Content
  $body = $rosterJson | ConvertFrom-Json -ErrorAction Stop
  if ($response.StatusCode -ne 200 -or $body.ok -ne $true -or
      $body.attendanceEnabled -ne $false -or
      $body.fingerprintMatchingOnTerminal -ne $true -or
      $body.vendorSecurityLevel -cne "NORMAL_TEST_ONLY" -or
      $body.kioskTestOnly -ne $true) {
    throw "Unexpected TEST roster; recognition aborted."
  }
  $testId = [string]$body.testId
  if ($testId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
    throw "Invalid recognition test identifier."
  }
  $expiry = [DateTimeOffset]::Parse([string]$body.expiresAt)
  if ($expiry -le [DateTimeOffset]::UtcNow) { throw "Recognition authorisation expired." }

  $entries = @($body.roster | Where-Object { $null -ne $_ })
  if ($entries.Count -gt 8) { throw "Too many TEST fingerprints." }
  $seen = New-Object 'System.Collections.Generic.HashSet[string]'
  foreach ($entry in $entries) {
    $template = $null
    try {
      $credentialId = [string]$entry.credentialId
      $encoded = [string]$entry.templateBase64
      if ($credentialId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' -or
          $entry.templateFormat -cne 'ANSI378' -or
          $encoded -notmatch '^[A-Za-z0-9+/]+={0,2}$' -or
          -not $seen.Add($credentialId)) {
        throw "Invalid or duplicate TEST template metadata."
      }
      $template = [Convert]::FromBase64String($encoded)
      if ($template.Length -lt 64 -or $template.Length -gt 65536 -or
          [Convert]::ToBase64String($template) -cne $encoded) {
        throw "Invalid central fingerprint template buffer."
      }
      [void]$templates.Add(@{
        Id = $credentialId
        Name = [string]$entry.employeeName
        Template = $template
      })
      $template = $null
    }
    finally { Clear-Bytes $template }
  }
  # Drop JSON references after extracting in-memory buffers; no file is created.
  $body = $null
  $response = $null
  $rosterJson = $null
  Write-Host "PASS: Central TEST roster loaded: $($templates.Count) active fingerprint(s)."

  $outcome = "no_match"
  $matchedId = $null
  $matchedName = $null
  if ($templates.Count -eq 0) {
    Write-Host "NO_MATCH: Central TEST roster empty (enrolled fingers revoked or inactive)."
  }
  else {
    $sdkPath = (Resolve-Path -LiteralPath $SdkAssembly -ErrorAction Stop).Path
    $sdkFolder = Split-Path -Parent $sdkPath
    if (-not (Test-Path -LiteralPath (Join-Path $sdkFolder "sgfplib.dll") -PathType Leaf)) {
      throw "Missing native SecuGen DLL next to official SDK assembly."
    }
    $env:PATH = $sdkFolder + ";" + $env:PATH
    $assembly = [System.Reflection.Assembly]::LoadFrom($sdkPath)
    $managerType = Get-SdkType $assembly "SGFingerPrintManager"
    $deviceType = Get-SdkType $assembly "SGFPMDeviceName"
    $infoType = Get-SdkType $assembly "SGFPMDeviceInfoParam"
    $formatType = Get-SdkType $assembly "SGFPMTemplateFormat"
    $levelType = Get-SdkType $assembly "SGFPMSecurityLevel"
    $manager = [System.Activator]::CreateInstance($managerType)
    Check-SdkResult "Init" ($manager.Init([Enum]::Parse($deviceType, "DEV_AUTO")))
    Check-SdkResult "OpenDevice" ($manager.OpenDevice(0x255))
    $opened = $true
    $info = [System.Activator]::CreateInstance($infoType)
    Check-SdkResult "GetDeviceInfo" ($manager.GetDeviceInfo($info))
    $width = [int]$info.ImageWidth
    $height = [int]$info.ImageHeight
    if ($width -le 0 -or $height -le 0 -or ($width * $height) -gt 2000000) { throw "Invalid HU20 capture dimensions." }
    Check-SdkResult "SetTemplateFormat" ($manager.SetTemplateFormat([Enum]::Parse($formatType, "ANSI378")))
    $maxSize = 0
    Check-SdkResult "GetMaxTemplateSize" ($manager.GetMaxTemplateSize([ref]$maxSize))
    if ($maxSize -lt 64 -or $maxSize -gt 65536) { throw "Unsupported HU20 ANSI378 template buffer." }
    foreach ($item in $templates) {
      if ($item.Template.Length -ne $maxSize) { throw "Server TEST template incompatible with the local SDK." }
    }

    Write-Host "Scan a test finger on the HU20 now (no fingerprint passphrase)."
    if ($FullScreenTest) { Show-Hu20KioskStatus -State "ready" }
    $live = Get-TransientTemplate $manager $width $height $maxSize $expiry
    Wait-Hu20FingerRemoval $manager $width $height
    $matches = New-Object System.Collections.ArrayList
    foreach ($item in $templates) {
      $matched = $false
      Check-SdkResult "MatchTemplate" ($manager.MatchTemplate($item.Template, $live, [Enum]::Parse($levelType, "NORMAL"), [ref]$matched))
      if ($matched) { [void]$matches.Add($item) }
    }
    if ($matches.Count -eq 1) {
      $outcome = "one_match"
      $matchedId = [string]$matches[0].Id
      $matchedName = [string]$matches[0].Name
      Write-Host "LOCAL_ONE_MATCH: $matchedName. Confirming central revocation status..."
    }
    elseif ($matches.Count -eq 0) {
      Write-Host "NO_MATCH: Unknown finger rejected."
    }
    else {
      $outcome = "ambiguous"
      Write-Host "AMBIGUOUS: Multiple templates matched. Identification REJECTED."
    }
  }
  if ($FullScreenTest) { Show-Hu20KioskStatus -State "verifying" }
  if ($expiry -le [DateTimeOffset]::UtcNow) { throw "Recognition window expired. No result accepted." }
  $resultBody = @{ testId = $testId; result = $outcome; credentialId = $matchedId } | ConvertTo-Json -Compress
  try {
    $confirmation = Invoke-WebRequest -Uri "$base/api/staff-hu20/recognition/finish" -Method Post -Headers $headers -WebSession $webSession -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30 -ContentType "application/json" -Body $resultBody
  }
  catch {
    throw "KIOSK_NETWORK_ERROR: central recognition not confirmed; no attendance was requested."
  }
  if ([string]$confirmation.Headers["Content-Type"] -notmatch 'application/json') {
    throw "KIOSK_NETWORK_ERROR: central recognition did not return JSON; no attendance was requested."
  }
  $accepted = $confirmation.Content | ConvertFrom-Json -ErrorAction Stop
  if ($confirmation.StatusCode -ne 200 -or $accepted.ok -ne $true -or
      $accepted.result -cne $outcome -or $accepted.attendanceEnabled -ne $false -or
      $accepted.noAttendanceWasRecorded -ne $true) { throw "Server did not confirm TEST recognition." }
  if ($outcome -eq "one_match") {
    Write-Host "PASS: CENTRAL_ONE_MATCH '$matchedName' confirmed in TEST."
    # Only after the backend verified the matching biometric and marked its
    # one-time recognition as complete may this optional TEST route be called.
    $testPunchJson = @{ testId = $testId } | ConvertTo-Json -Compress
    if ($FullScreenTest) { Assert-Hu20KioskDisplay }
    if (-not (Test-Hu20KioskCanPunch -Outcome $outcome -CentralConfirmed ($accepted.result -ceq "one_match" -and $accepted.noAttendanceWasRecorded -eq $true) -DisplayReady $true)) {
      throw "KIOSK_AUTH_ERROR: no centrally confirmed unique fingerprint match; refusing punch."
    }
    try {
      $testPunchResponse = Invoke-WebRequest -Uri "$base/api/staff-hu20/attendance" -Method Post -Headers $headers -WebSession $webSession -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30 -ContentType "application/json" -Body $testPunchJson
    }
    catch {
      throw "KIOSK_PUNCH_UNCERTAIN: attendance response was not confirmed. STOP the TEST kiosk and inspect its attendance log before any retry."
    }
    if ([string]$testPunchResponse.Headers["Content-Type"] -notmatch 'application/json') {
      throw "KIOSK_PUNCH_UNCERTAIN: attendance returned a non-JSON response. STOP kiosk and check TEST attendance log."
    }
    try { $testPunch = $testPunchResponse.Content | ConvertFrom-Json -ErrorAction Stop }
    catch { throw "KIOSK_PUNCH_UNCERTAIN: attendance response was unreadable. Check TEST attendance log." }
    if ($testPunchResponse.StatusCode -ne 200 -or $testPunch.ok -ne $true -or
        $testPunch.fictionalTestOnly -ne $true -or
        @("clocked_in","clocked_out","duplicate_ignored") -cnotcontains [string]$testPunch.outcome) {
      throw "KIOSK_PUNCH_UNCERTAIN: attendance confirmation invalid. STOP kiosk and check TEST attendance log."
    }
    Write-Host "FICTIONAL TEST PUNCH: $($testPunch.outcome) at gym $($testPunch.gymId) (event $($testPunch.punchEventId))."
    if ($FullScreenTest) {
      switch ([string]$testPunch.outcome) {
        "clocked_in" { Show-Hu20KioskStatus -State "clock_in" -Person $matchedName }
        "clocked_out" { Show-Hu20KioskStatus -State "clock_out" -Person $matchedName }
        default { Show-Hu20KioskStatus -State "cooldown" }
      }
      Wait-Hu20KioskUi -Milliseconds 3000
    }

  }
  elseif ($outcome -eq "no_match") {
    Write-Host "PASS: CENTRAL_NO_MATCH; unknown or revoked fingerprint rejected."
    if ($FullScreenTest) { Show-Hu20KioskStatus -State "rejected"; Wait-Hu20KioskUi -Milliseconds 2000 }
  }
  else {
    Write-Host "PASS: CENTRAL_AMBIGUOUS rejected safely."
    if ($FullScreenTest) { Show-Hu20KioskStatus -State "rejected"; Wait-Hu20KioskUi -Milliseconds 2000 }
  }
  Write-Host "Only a confirmed one-match can create a fictional TEST clock event; NO_MATCH and AMBIGUOUS never punch."
  Write-Host "Security level NORMAL is only for a smoke test, not production."
    }
    catch {
      $reason = $_.Exception.Message
      $decision = Get-Hu20KioskFailurePolicy -Reason $reason
      if ($decision.Mode -eq "end") {
        Write-Host "No active TEST kiosk window or scans remaining. Stopping."
        if ($FullScreenTest) {
          Show-Hu20KioskStatus -State "finished"
          Wait-Hu20KioskUi -Milliseconds 2500
        }
        $stopKiosk = $true
      }
      elseif ($decision.Mode -eq "wait") {
        Write-Host "Waiting for server-side kiosk cooldown..."
        if ($FullScreenTest) {
          Show-Hu20KioskStatus -State "cooldown"
          Wait-Hu20KioskUi -Milliseconds 10000
        } else { Start-Sleep -Seconds 10 }
      }
      elseif ($decision.Mode -eq "retry") {
        Write-Host "No finger before single-use recognition expired. No attendance."
        if ($FullScreenTest) { Show-Hu20KioskStatus -State "cooldown" }
      }
      else {
        # Unknown SDK/network outcomes always stop. In particular, a lost
        # attendance response must NEVER auto-retry or toggle a new punch.
        if ($decision.RequiresAdminReview) {
          Write-Warning "TEST attendance MAY have been recorded. STOP kiosk in Super Admin, inspect attendance log, and reconcile before a new scan."
        }
        elseif ($decision.Screen -eq "reader_error") {
          Write-Warning "HU20 reader/SDK error: disconnect or driver failure. Stop and check reader before a manually authorised restart."
        }
        elseif ($decision.Screen -eq "network_error") {
          Write-Warning "TEST server/network unavailable. Automatic kiosk stopped; no unattended reconnect."
        }
        elseif ($decision.Screen -eq "closed") {
          Write-Host "ESC closed the TEST kiosk. No further recognition attempts."
        }
        else { Write-Warning "Unexpected TEST kiosk error; stopped without automatic restart." }
        if ($FullScreenTest -and $displayStarted -and $decision.Screen -ne "closed") {
          try {
            Show-Hu20KioskStatus -State $decision.Screen
            Wait-Hu20KioskUi -Milliseconds 3000
          } catch {}
        }
        throw
      }
    }
    finally {
      Clear-Bytes $live
      foreach ($item in $templates) { Clear-Bytes $item.Template }
      if ($opened -and $null -ne $manager) {
        try { [void]$manager.CloseDevice() } catch { Write-Warning "SecuGen reader close failed; no automatic restart." }
      }
      if ($null -ne $manager -and $manager -is [System.IDisposable]) {
        try { $manager.Dispose() } catch { Write-Warning "SecuGen cleanup failed; no automatic restart." }
      }
      # Best-effort cleanup of plaintext roster references before the next scan.
      $live = $null
      $templates.Clear()
      $body = $null
      $entries = $null
      $entry = $null
      $template = $null
      $encoded = $null
      $rosterJson = $null
      $response = $null
      $confirmation = $null
      $accepted = $null
      $matches = $null
      $testPunchResponse = $null
      $testPunch = $null
      $manager = $null
    }
    if ($stopKiosk) { break }
    continue
  }
}
finally {
  # The terminal secret and Preview Share token are never written to disk.
  $rosterJson = $null
  $terminalSecret = $null
  $vercelBypass = $null
  $headers = $null
  $webSession = $null
  if ($FullScreenTest -and $displayStarted) { Close-Hu20KioskDisplay }
}
