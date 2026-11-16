#Requires -Version 5.1
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot "Hu20-KioskSafety.ps1")
$cases = @(
  ,@("KIOSK_WINDOW_FINISHED", "end", "finished", $false)
  ,@("KIOSK_COOLDOWN", "wait", "cooldown", $false)
  ,@("KIOSK_NO_FINGER_TIMEOUT", "retry", "cooldown", $false)
  ,@("KIOSK_DEVICE_ERROR: GetImageEx vendor code 7", "halt", "reader_error", $false)
  ,@("KIOSK_NETWORK_ERROR: connection reset", "halt", "network_error", $false)
  ,@("KIOSK_PUNCH_UNCERTAIN: response missing", "halt", "uncertain", $true)
  ,@("KIOSK_DISPLAY_CLOSED: escape", "halt", "closed", $false)
  ,@("Unexpected SDK or server exception", "halt", "error", $false)
)
foreach ($case in $cases) {
  $result = Get-Hu20KioskFailurePolicy -Reason $case[0]
  if ($result.Mode -cne $case[1] -or $result.Screen -cne $case[2] -or
      $result.RequiresAdminReview -ne $case[3]) {
    throw "Unexpected fail-closed policy for $($case[0]): $($result | ConvertTo-Json -Compress)"
  }
}
foreach ($outcome in @("no_match","ambiguous","one_match","unexpected")) {
  foreach ($confirmed in @($false,$true)) {
    foreach ($display in @($false,$true)) {
      $allowed = Test-Hu20KioskCanPunch -Outcome $outcome -CentralConfirmed $confirmed -DisplayReady $display
      $expected = ($outcome -ceq "one_match" -and $confirmed -and $display)
      if ($allowed -ne $expected) {
        throw "Unsafe attendance decision: $outcome confirmed=$confirmed display=$display"
      }
    }
  }
}
Write-Host "PASS: HU20 fictional TEST failure policy and 1:N punch guard (24 synthetic cases)"
