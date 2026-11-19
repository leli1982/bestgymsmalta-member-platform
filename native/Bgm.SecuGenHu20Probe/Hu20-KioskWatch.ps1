#Requires -Version 5.1
<#
 BGM HU20 Windows startup watcher - ISOLATED TEST ONLY.
 Polls read-only, authenticated kiosk preflight; never scans a fingerprint.
 The kiosk may start once per distinct approved 10-minute TEST window.
 Every window is checkpointed BEFORE starting, so ESC, reboot or errors
 cannot relaunch the same window. No staff PIN, scanner code or Share link.
#>
[CmdletBinding()]
param([ValidateRange(5,60)][int]$PollSeconds=10,[ValidateRange(0,120)][int]$StartupDelaySeconds=0,[switch]$CheckOnly)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or -not [Environment]::Is64BitProcess) {
  throw 'HU20 TEST startup requires 64-bit Windows PowerShell.'
}
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath=Join-Path $root 'Hu20-TestTerminal.local.json'
$vaultScript=Join-Path $root 'Hu20-DeviceVault.ps1'
$starter=Join-Path $root 'Hu20-StartTestTerminal.ps1'
foreach($needed in @($configPath,$vaultScript,$starter)) {
  if (-not (Test-Path -LiteralPath $needed -PathType Leaf)) {
    throw 'Incomplete HU20 TEST installation. Ask the technician to repair setup.'
  }
}
$config=Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
$props=@($config.PSObject.Properties.Name)
if ($props.Count -ne 3 -or
    @($props | Where-Object { @('baseUrl','terminalId','sdkAssembly') -cnotcontains $_ }).Count -gt 0) {
  throw 'Unexpected local configuration. No scan started.'
}
$base=([string]$config.baseUrl).TrimEnd('/')
$id=[string]$config.terminalId
$uri=[Uri]::new($base)
$guidPattern='^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$'
if ($uri.Scheme -cne 'https' -or $uri.Port -ne 443 -or
    $uri.AbsolutePath -cne '/' -or $uri.Query -cne '' -or
    $uri.Fragment -cne '' -or $uri.UserInfo -cne '' -or
    $uri.Host -cnotmatch '^bestgymsmalta-member-platform-[a-z0-9-]+-leliapap-2558s-projects[.]vercel[.]app$' -or
    $id -notmatch $guidPattern) { throw 'Unapproved TEST Preview or terminal. Kiosk stopped.' }
$sdk=[string]$config.sdkAssembly
if (-not (Test-Path -LiteralPath $sdk -PathType Leaf) -or
    -not (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $sdk) 'sgfplib.dll') -PathType Leaf)) {
  throw 'SecuGen SDK is incomplete. Kiosk stopped.'
}
. $vaultScript
$vault=Get-Hu20Vault -BaseUrl $base -TerminalId $id
$terminalSecret=[string]$vault.terminalSecret
$vercelBypass=[string]$vault.vercelBypass
$vault=$null
$headers=@{
  'Authorization'='Bearer ' + $terminalSecret
  'X-BGM-HU20-Terminal-Id'=$id
  'X-BGM-HU20-Kiosk-Test'='1'
  'x-vercel-protection-bypass'=$vercelBypass
  'Accept'='application/json'
  'Cache-Control'='no-store'
}
$terminalSecret=$null
$vercelBypass=$null
# Mutex prevents multiple watchers in one Windows session.
$mutex=[System.Threading.Mutex]::new($false,'Local\BGM_HU20_TEST_KIOSK_WATCHER')
$acquired=$false
if (-not $CheckOnly) {
  try { $acquired=$mutex.WaitOne(0) }
  catch [System.Threading.AbandonedMutexException] { $acquired=$true }
  if (-not $acquired) { throw 'HU20 TEST kiosk watcher is already running.' }
}
$folder=Join-Path $env:LOCALAPPDATA 'BGM-HU20-TEST'
$lastPath=Join-Path $folder 'last-approved-kiosk-window.json'
$lastId=''
try {
  if (Test-Path -LiteralPath $lastPath -PathType Leaf) {
    $last=Get-Content -LiteralPath $lastPath -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
    if ([string]$last.version -cne '1' -or [string]$last.terminalId -cne $id -or
        [string]$last.windowId -notmatch $guidPattern) {
      throw 'Invalid TEST kiosk checkpoint. Ask technician to investigate.'
    }
    $lastId=[string]$last.windowId
    $last=$null
  }
  Write-Host 'HU20 TEST watcher ready. Waiting for a NEW Super Admin kiosk approval.'
  if (-not $CheckOnly -and $StartupDelaySeconds -gt 0) {
    # Give the Windows network and user session time to initialise at logon.
    Start-Sleep -Seconds $StartupDelaySeconds
  }
  while ($true) {
    $result=$null
    try {
      # Reject redirects to avoid sending sealed terminal credentials elsewhere.
      $response=Invoke-WebRequest -Uri "$base/api/staff-hu20/kiosk/preflight" -Method Get -Headers $headers -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 15
      if ($response.StatusCode -ne 200 -or
          [string]$response.Headers['Content-Type'] -notmatch '^application/json') {
        throw 'Unexpected TEST preflight response. No scan launched.'
      }
      $result=$response.Content | ConvertFrom-Json -ErrorAction Stop
    } catch {
      $status=$null
      if ($_.Exception.Response) { try { $status=[int]$_.Exception.Response.StatusCode } catch {} }
      if ($status -eq 409) {
        # No window or gym off: safe standby.
        if ($CheckOnly) { Write-Host 'PASS: TEST kiosk is waiting for approval.'; return }
        Start-Sleep -Seconds $PollSeconds
        continue
      }
      # 401/403/404, network loss and 5xx fail closed, no auto reconnect.
      throw 'Kiosk network/authentication error. No unattended retries. Ask technician to check the TEST connection.'
    }
    $newId=[string]$result.window.id
    $modeValid=(($result.fictionalTestOnly -eq $true -and $result.realStaffPilot -eq $false) -or
      ($result.fictionalTestOnly -eq $false -and $result.realStaffPilot -eq $true))
    if ($result.ok -ne $true -or -not $modeValid -or
        $result.recognitionAuthorisationConsumed -ne $false -or
        $result.attendanceRecorded -ne $false -or
        $result.restartRequiresManualApproval -ne $true -or
        [string]$result.terminal.id -cne $id -or
        [string]$result.terminal.gymId -notmatch '^[A-Za-z0-9_-]{2,120}$' -or
        [string]::IsNullOrWhiteSpace([string]$result.terminal.gymName) -or
        $newId -notmatch $guidPattern -or
        [int]$result.window.scansRemaining -lt 1 -or
        [DateTimeOffset]::Parse([string]$result.window.expiresAt) -le [DateTimeOffset]::UtcNow) {
      throw 'Invalid Super Admin TEST window/terminal preflight. No kiosk started.'
    }
    if ($CheckOnly) { Write-Host 'PASS: TEST preflight verified without scanning.'; return }
    if ([string]::Equals($newId,$lastId,[StringComparison]::OrdinalIgnoreCase)) {
      Start-Sleep -Seconds $PollSeconds
      continue
    }
    # Persist window ID BEFORE launch, preventing duplicate launch after
    # uncertain attendance, reader error, ESC or reboot.
    if (-not (Test-Path -LiteralPath $folder -PathType Container)) {
      [void](New-Item -Path $folder -ItemType Directory -Force)
    }
    $tmp=$lastPath+'.new'
    try {
      $json=([pscustomobject]@{version=1;terminalId=$id;windowId=$newId}|ConvertTo-Json -Compress)
      [IO.File]::WriteAllText($tmp,$json,[Text.UTF8Encoding]::new($false))
      Move-Item -LiteralPath $tmp -Destination $lastPath -Force
    } finally {
      if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
    }
    $lastId=$newId
    $exe=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $args='-NoProfile -NonInteractive -STA -ExecutionPolicy Bypass -File "'+$starter+'" -AutoKioskTest -FullScreenTest -RequireProvisionedDevice'
    Write-Host 'Super Admin window approved. Opening the TEST fingerprint kiosk.'
    $child=Start-Process -FilePath $exe -ArgumentList $args -Wait -PassThru
    if ($null -eq $child -or $child.ExitCode -ne 0) {
      throw 'Kiosk closed after an error. STOP in Super Admin, review attendance and restart manually.'
    }
    Write-Host 'TEST window finished. Waiting for a different Super Admin-approved window.'
  }
} finally {
  $headers=$null
  if ($acquired) { $mutex.ReleaseMutex() }
  if ($null -ne $mutex) { $mutex.Dispose() }
}
