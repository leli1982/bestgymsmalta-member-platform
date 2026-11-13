#Requires -Version 5.1
<#
  BGM HU20 fictional TEST kiosk screen.
  In-process Windows Forms; no local listener, browser, log file, credentials,
  biometric template, or staff record is persisted by this display.
  All fingerprint decisions remain in Hu20-AutoKiosk.ps1 and the TEST server.
#>
function New-Hu20ScreenLabel([string]$message, [float]$fontSize, [System.Drawing.Color]$colour, [bool]$bold) {
  $label = New-Object System.Windows.Forms.Label
  $label.Text = $message
  $label.Dock = [System.Windows.Forms.DockStyle]::Fill
  $label.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
  $label.ForeColor = $colour
  $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
  $label.Font = [System.Drawing.Font]::new("Segoe UI", $fontSize, $style)
  $label.AutoEllipsis = $true
  $label.Margin = [System.Windows.Forms.Padding]::new(12)
  return $label
}

function Initialize-Hu20KioskDisplay {
  if ([System.Threading.Thread]::CurrentThread.GetApartmentState() -ne [System.Threading.ApartmentState]::STA) {
    throw "Full-screen fictional HU20 TEST requires Windows PowerShell in -STA mode."
  }
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  [System.Windows.Forms.Application]::EnableVisualStyles()
  $script:Hu20DisplayClosed = $false
  $script:Hu20Display = New-Object System.Windows.Forms.Form
  $script:Hu20Display.Text = "BestGymsMalta | HU20 FICTIONAL TEST"
  $script:Hu20Display.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
  $script:Hu20Display.WindowState = [System.Windows.Forms.FormWindowState]::Maximized
  $script:Hu20Display.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
  $script:Hu20Display.BackColor = [System.Drawing.Color]::FromArgb(12,18,29)
  $script:Hu20Display.KeyPreview = $true
  $script:Hu20Display.TopMost = $true
  $script:Hu20Display.ShowInTaskbar = $true
  $script:Hu20Display.Add_KeyDown({
    param($sender, $eventArgs)
    if ($eventArgs.KeyCode -eq [System.Windows.Forms.Keys]::Escape) {
      $script:Hu20DisplayClosed = $true
      $script:Hu20Display.Close()
    }
  })
  $script:Hu20Display.Add_FormClosed({ $script:Hu20DisplayClosed = $true })

  $grid = New-Object System.Windows.Forms.TableLayoutPanel
  $grid.Dock = [System.Windows.Forms.DockStyle]::Fill
  $grid.ColumnCount = 1
  $grid.RowCount = 5
  foreach ($percent in @(13,16,36,22,13)) {
    [void]$grid.RowStyles.Add([System.Windows.Forms.RowStyle]::new([System.Windows.Forms.SizeType]::Percent, [float]$percent))
  }
  $white = [System.Drawing.Color]::FromArgb(242,245,249)
  $muted = [System.Drawing.Color]::FromArgb(161,175,194)
  $amber = [System.Drawing.Color]::FromArgb(253,179,36)
  $script:Hu20TitleLabel = New-Hu20ScreenLabel "BESTGYMSMALTA" 30 $white $true
  $script:Hu20DetailLabel = New-Hu20ScreenLabel "AUTOMATIC FINGERPRINT TERMINAL" 24 $muted $true
  $script:Hu20StateLabel = New-Hu20ScreenLabel "CONNECTING" 62 $amber $true
  $script:Hu20PersonLabel = New-Hu20ScreenLabel "FICTIONAL TEST ONLY" 30 $white $false
  $script:Hu20FooterLabel = New-Hu20ScreenLabel "HU20 TEST  |  No real employee punches  |  ESC closes the scanner" 17 $muted $false
  [void]$grid.Controls.Add($script:Hu20TitleLabel,0,0)
  [void]$grid.Controls.Add($script:Hu20DetailLabel,0,1)
  [void]$grid.Controls.Add($script:Hu20StateLabel,0,2)
  [void]$grid.Controls.Add($script:Hu20PersonLabel,0,3)
  [void]$grid.Controls.Add($script:Hu20FooterLabel,0,4)
  [void]$script:Hu20Display.Controls.Add($grid)
  $script:Hu20Display.Show()
  [System.Windows.Forms.Application]::DoEvents()
  Assert-Hu20KioskDisplay
}

function Assert-Hu20KioskDisplay {
  if ($null -eq $script:Hu20Display -or $script:Hu20DisplayClosed -or $script:Hu20Display.IsDisposed) {
    throw "KIOSK_DISPLAY_CLOSED: automatic TEST scanning stopped safely."
  }
  [System.Windows.Forms.Application]::DoEvents()
  if ($script:Hu20DisplayClosed -or $script:Hu20Display.IsDisposed) {
    throw "KIOSK_DISPLAY_CLOSED: automatic TEST scanning stopped safely."
  }
}

function Show-Hu20KioskStatus {
  param(
    [ValidateSet("connecting","ready","reading","remove","verifying","clock_in","clock_out","cooldown","rejected","finished","error")]
    [string]$State,
    [string]$Person = ""
  )
  Assert-Hu20KioskDisplay
  $white = [System.Drawing.Color]::FromArgb(242,245,249)
  $green = [System.Drawing.Color]::FromArgb(73,216,143)
  $amber = [System.Drawing.Color]::FromArgb(253,179,36)
  $red = [System.Drawing.Color]::FromArgb(246,113,115)
  $muted = [System.Drawing.Color]::FromArgb(161,175,194)
  $main = "CONNECTING"
  $detail = "FICTIONAL TEST ONLY"
  $colour = $amber
  switch ($State) {
    "connecting" { $main = "CONNECTING"; $detail = "Checking TEST kiosk approval" }
    "ready" { $main = "PLACE FINGER"; $detail = "Touch the HU20 sensor once" }
    "reading" { $main = "READING"; $detail = "Checking fingerprint" }
    "remove" { $main = "REMOVE FINGER"; $detail = "Lift your finger from the sensor" }
    "verifying" { $main = "VERIFYING"; $detail = "Confirming central TEST recognition" }
    "clock_in" { $main = "CLOCKED IN"; $detail = $Person; $colour = $green }
    "clock_out" { $main = "CLOCKED OUT"; $detail = $Person; $colour = $green }
    "cooldown" { $main = "PLEASE WAIT"; $detail = "Preparing next permitted scan"; $colour = $muted }
    "rejected" { $main = "NOT RECOGNISED"; $detail = "No attendance recorded"; $colour = $red }
    "finished" { $main = "TEST ENDED"; $detail = "Window expired, stopped or scan budget used"; $colour = $muted }
    "error" { $main = "OUT OF SERVICE"; $detail = "Automatic TEST scanning stopped"; $colour = $red }
  }
  if ($detail.Length -gt 90) { $detail = $detail.Substring(0,90) }
  $script:Hu20StateLabel.Text = $main
  $script:Hu20StateLabel.ForeColor = $colour
  $script:Hu20PersonLabel.Text = $detail
  $script:Hu20PersonLabel.ForeColor = $white
  $script:Hu20Display.Refresh()
  Assert-Hu20KioskDisplay
}

function Wait-Hu20KioskUi([int]$Milliseconds) {
  $until = [DateTimeOffset]::UtcNow.AddMilliseconds($Milliseconds)
  while ([DateTimeOffset]::UtcNow -lt $until) {
    Assert-Hu20KioskDisplay
    Start-Sleep -Milliseconds 150
  }
  Assert-Hu20KioskDisplay
}

function Close-Hu20KioskDisplay {
  if ($null -ne $script:Hu20Display) {
    if (-not $script:Hu20Display.IsDisposed) { $script:Hu20Display.Close() }
    $script:Hu20Display.Dispose()
  }
  $script:Hu20DisplayClosed = $true
  $script:Hu20Display = $null
}
