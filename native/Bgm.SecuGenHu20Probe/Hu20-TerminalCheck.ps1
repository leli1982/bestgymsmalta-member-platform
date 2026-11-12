#Requires -Version 5.1
<#
  TEST-ONLY BGM HU20 registered terminal connection check.
  No fingerprint, payroll, employee records, or credential files are used.
  Supply the HTTPS URL of the HU20 Preview deployment and a Super Admin-issued
  terminal ID. Enter the terminal secret privately when prompted.
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
if ($TerminalId -notmatch '^[0-9a-fA-F-]{36}$') {
  throw "Invalid terminal ID."
}
$secret = Read-Host "Enter the private HU20 terminal secret" -AsSecureString
$pointer = [IntPtr]::Zero
try {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  $text = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if ($text -notmatch '^[a-fA-F0-9]{64}$') { throw "Terminal secret format is invalid." }
  $headers = @{
    "Authorization" = "Bearer $text"
    "X-BGM-HU20-Terminal-Id" = $TerminalId
  }
  Write-Host "Checking HU20 TEST terminal authentication..."
  $result = Invoke-RestMethod -Uri "$base/api/staff-hu20/health" -Method Get -Headers $headers -TimeoutSec 20
  if ($result.ok -ne $true -or $result.punchEnabled -ne $false) {
    throw "Unexpected terminal server response. No attendance was recorded."
  }
  Write-Host "PASS: TEST server authenticated terminal $($result.terminal.id) for gym $($result.terminal.gymId)."
  Write-Host "Fingerprint roster and punching remain disabled pending secure agent integration."
}
finally {
  $text = $null
  if ($pointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
  $secret.Dispose()
}
