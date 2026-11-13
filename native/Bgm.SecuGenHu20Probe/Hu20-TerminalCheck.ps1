#Requires -Version 5.1
<#
  BGM HU20 TEST terminal connection check (v2).
  Works with Vercel-protected Preview deployments using a temporary
  deployment Share link. No biometric, employee or attendance data is sent.
  Never paste your temporary Share link or terminal secret into chat.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl,
  [Parameter(Mandatory = $true)]
  [string]$TerminalId
)

$ErrorActionPreference = "Stop"
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

$webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Write-Host "BGM HU20 protected TEST Preview terminal connection (no attendance)."
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
  Write-Host "Checking HU20 TEST terminal authentication..."
  $healthUrl = "$base/api/staff-hu20/health"
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
      throw "HU20 TEST API unavailable (HTTP 404): verify the TEST Preview URL and feature flag."
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
  if ($result.ok -ne $true -or $result.punchEnabled -ne $false -or $result.biometricRosterEnabled -ne $false -or
      $result.terminal.id -ne $TerminalId) {
    throw "Unexpected HU20 TEST response. No attendance was recorded."
  }
  Write-Host "PASS: TEST server authenticated terminal $($result.terminal.id) for gym $($result.terminal.gymId)."
  Write-Host "Fingerprint roster and punching remain disabled pending secure agent integration."
}
finally {
  $terminalSecret = $null
  $headers = $null
}
