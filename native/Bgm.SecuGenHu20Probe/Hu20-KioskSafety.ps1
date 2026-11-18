#Requires -Version 5.1
<#
  Pure fail-closed decisions for the HU20 fictional TEST kiosk.
  No HTTP calls, Windows APIs, fingerprint templates or file writes.
  Keep this helper independently executable for synthetic CI fault tests.
#>
Set-StrictMode -Version Latest

function Get-Hu20KioskFailurePolicy {
  [CmdletBinding()]
  param([Parameter(Mandatory=$true)][string]$Reason)
  $mode = "halt"
  $screen = "error"
  $review = $false
  switch -Regex ($Reason) {
    '^KIOSK_WINDOW_FINISHED$' { $mode = "end"; $screen = "finished"; break }
    '^KIOSK_COOLDOWN$' { $mode = "wait"; $screen = "cooldown"; break }
    '^KIOSK_NO_FINGER_TIMEOUT$' { $mode = "retry"; $screen = "cooldown"; break }
    '^KIOSK_PUNCH_UNCERTAIN:' { $screen = "uncertain"; $review = $true; break }
    '^KIOSK_DEVICE_ERROR:' { $screen = "reader_error"; break }
    '^KIOSK_NETWORK_ERROR:' { $screen = "network_error"; break }
    '^KIOSK_DISPLAY_CLOSED:' { $screen = "closed"; break }
    default { $screen = "error"; break }
  }
  # Only Super Admin-controlled cooldown and no-finger waits can retry;
  # never retry unknown network or punch outcomes without reconciliation.
  return [pscustomobject]@{
    Mode = $mode
    Screen = $screen
    RequiresAdminReview = $review
  }
}

function Test-Hu20KioskCanPunch {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory=$true)][string]$Outcome,
    [Parameter(Mandatory=$true)][bool]$CentralConfirmed,
    [Parameter(Mandatory=$true)][bool]$DisplayReady
  )
  return ($Outcome -ceq "one_match" -and $CentralConfirmed -and $DisplayReady)
}
