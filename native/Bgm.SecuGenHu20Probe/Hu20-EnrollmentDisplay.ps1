#Requires -Version 5.1
<#
  HU20 fictional TEST enrollment progress screen. Runs in the already
  provisioned local Windows user session; no network, secrets, biometrics,
  templates, employees or private data are displayed or saved.
  This modal-style window remains visible while the hidden local bridge
  captures the three separate placements.
#>
$script:Hu20EnrollForm=$null
$script:Hu20EnrollTitle=$null
$script:Hu20EnrollInstruction=$null
$script:Hu20EnrollAccent=$null

function Initialize-Hu20EnrollmentScreen {
  if ([System.Threading.Thread]::CurrentThread.GetApartmentState() -ne
      [System.Threading.ApartmentState]::STA) {
    throw "HU20 TEST enrollment display requires Windows PowerShell -STA."
  }
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  [System.Windows.Forms.Application]::EnableVisualStyles()
  $form = New-Object System.Windows.Forms.Form
  $form.Text = "BestGymsMalta | Fingerprint enrollment TEST"
  $form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
  $form.Size = [System.Drawing.Size]::new(640, 360)
  $form.MinimumSize = [System.Drawing.Size]::new(640,360)
  $form.MaximumSize = [System.Drawing.Size]::new(640,360)
  $form.BackColor = [System.Drawing.Color]::FromArgb(16,25,40)
  $form.TopMost = $true
  $form.ShowInTaskbar = $true
  $form.ControlBox = $false
  $form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
  $form.KeyPreview = $true

  $brand = New-Object System.Windows.Forms.Label
  $brand.Dock = [System.Windows.Forms.DockStyle]::Top
  $brand.Height = 70
  $brand.Text = "BESTGYMSMALTA   |   FINGERPRINT ENROLMENT"
  $brand.Font = [System.Drawing.Font]::new("Segoe UI",15,[System.Drawing.FontStyle]::Bold)
  $brand.ForeColor = [System.Drawing.Color]::FromArgb(232,240,249)
  $brand.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter

  $title = New-Object System.Windows.Forms.Label
  $title.Dock = [System.Windows.Forms.DockStyle]::Top
  $title.Height = 115
  $title.Text = "PREPARING READER"
  $title.Font = [System.Drawing.Font]::new("Segoe UI",30,[System.Drawing.FontStyle]::Bold)
  $title.ForeColor = [System.Drawing.Color]::FromArgb(255,185,57)
  $title.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter

  $instruction = New-Object System.Windows.Forms.Label
  $instruction.Dock = [System.Windows.Forms.DockStyle]::Fill
  $instruction.Text = "TEST only | No attendance recorded"
  $instruction.Font = [System.Drawing.Font]::new("Segoe UI",17,[System.Drawing.FontStyle]::Regular)
  $instruction.ForeColor = [System.Drawing.Color]::FromArgb(220,230,242)
  $instruction.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter

  $footer = New-Object System.Windows.Forms.Label
  $footer.Dock = [System.Windows.Forms.DockStyle]::Bottom
  $footer.Height = 51
  $footer.Text = "Follow this window. Do not touch the reader until instructed."
  $footer.Font = [System.Drawing.Font]::new("Segoe UI",10,[System.Drawing.FontStyle]::Regular)
  $footer.ForeColor = [System.Drawing.Color]::FromArgb(169,183,204)
  $footer.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
  [void]$form.Controls.Add($instruction)
  [void]$form.Controls.Add($title)
  [void]$form.Controls.Add($brand)
  [void]$form.Controls.Add($footer)

  $script:Hu20EnrollForm=$form
  $script:Hu20EnrollTitle=$title
  $script:Hu20EnrollInstruction=$instruction
  $script:Hu20EnrollAccent=[System.Drawing.Color]::FromArgb(255,185,57)
  $form.Show()
  $form.BringToFront()
  [System.Windows.Forms.Application]::DoEvents()
}

function Set-Hu20EnrollmentScreen {
  [CmdletBinding()]
  param([Parameter(Mandatory=$true)]
    [ValidateSet("scan1","remove1","scan2","remove2","scan3","saving","success","failure")]
    [string]$Stage)
  if ($null -eq $script:Hu20EnrollForm -or $script:Hu20EnrollForm.IsDisposed) {
    throw "The TEST enrollment progress screen has been closed."
  }
  $green=[System.Drawing.Color]::FromArgb(80,222,145)
  $amber=[System.Drawing.Color]::FromArgb(255,185,57)
  $red=[System.Drawing.Color]::FromArgb(251,113,120)
  $title="";$detail="";$colour=$amber
  switch ($Stage) {
    "scan1" { $title="PLACE FINGER"; $detail="SCAN 1 OF 3  |  Hold your chosen finger flat on the sensor" }
    "remove1" { $title="REMOVE FINGER"; $detail="Scan 1 complete. Lift your finger COMPLETELY." }
    "scan2" { $title="PLACE FINGER"; $detail="SCAN 2 OF 3  |  Place the SAME finger again" }
    "remove2" { $title="REMOVE FINGER"; $detail="Scan 2 complete. Lift your finger COMPLETELY." }
    "scan3" { $title="PLACE FINGER"; $detail="SCAN 3 OF 3  |  Final independent verification" }
    "saving" { $title="VERIFYING"; $detail="Matching all three scans, then securely saving in TEST" }
    "success" { $title="ENROLLED"; $detail="All three scans matched. TEST fingerprint saved."; $colour=$green }
    "failure" { $title="NOT ENROLLED"; $detail="Verification failed or was interrupted. Check Super Admin."; $colour=$red }
  }
  $script:Hu20EnrollTitle.Text=$title
  $script:Hu20EnrollTitle.ForeColor=$colour
  $script:Hu20EnrollInstruction.Text=$detail
  $script:Hu20EnrollForm.Refresh()
  $script:Hu20EnrollForm.BringToFront()
  [System.Windows.Forms.Application]::DoEvents()
}

function Wait-Hu20EnrollmentScreen {
  param([ValidateRange(0,10000)][int]$Milliseconds=1000)
  if ($null -eq $script:Hu20EnrollForm -or $script:Hu20EnrollForm.IsDisposed) { return }
  $end=[DateTimeOffset]::UtcNow.AddMilliseconds($Milliseconds)
  while ([DateTimeOffset]::UtcNow -lt $end) {
    [System.Windows.Forms.Application]::DoEvents()
    Start-Sleep -Milliseconds 100
  }
}

function Close-Hu20EnrollmentScreen {
  if ($null -ne $script:Hu20EnrollForm) {
    try {
      if (-not $script:Hu20EnrollForm.IsDisposed) {
        $script:Hu20EnrollForm.Close()
        $script:Hu20EnrollForm.Dispose()
      }
    } finally {
      $script:Hu20EnrollForm=$null
      $script:Hu20EnrollTitle=$null
      $script:Hu20EnrollInstruction=$null
    }
  }
}
