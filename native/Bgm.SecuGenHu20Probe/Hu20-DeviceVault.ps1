#Requires -Version 5.1
<#
  TEST ONLY. DPAPI CurrentUser device credential vault for the local
  supervised HU20 bridge. Never bundle this file's encrypted output in a ZIP.
  Works only in the same Windows user profile on the provisioned PC.
#>
function Get-Hu20VaultPath {
  if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw "Windows local user profile unavailable." }
  return (Join-Path $env:LOCALAPPDATA "BGM-HU20-TEST\device-credentials.dpapi")
}
function Get-Hu20VaultEntropy([string]$TerminalId) {
  return [System.Text.Encoding]::UTF8.GetBytes("BGM-HU20-ENROLLMENT-TEST-v1|" + $TerminalId.ToLowerInvariant())
}
function Assert-Hu20VaultBinding([object]$Record, [string]$BaseUrl, [string]$TerminalId) {
  if ($null -eq $Record -or [string]$Record.version -cne "1" -or
      [string]$Record.terminalId -cne $TerminalId -or
      [string]$Record.baseUrl -cne $BaseUrl -or
      [string]$Record.terminalSecret -cnotmatch '^[0-9a-fA-F]{64}$' -or
      [string]$Record.vercelBypass -cnotmatch '^[a-zA-Z0-9]{32}$') {
    throw "The protected HU20 TEST credential record is invalid or belongs to another PC/Preview."
  }
}
function Set-Hu20Vault {
  param(
    [Parameter(Mandatory=$true)][string]$BaseUrl,
    [Parameter(Mandatory=$true)][string]$TerminalId,
    [Parameter(Mandatory=$true)][string]$TerminalSecret,
    [Parameter(Mandatory=$true)][string]$VercelBypass
  )
  $record = [pscustomobject]@{
    version=1; baseUrl=$BaseUrl; terminalId=$TerminalId;
    terminalSecret=$TerminalSecret; vercelBypass=$VercelBypass
  }
  Assert-Hu20VaultBinding $record $BaseUrl $TerminalId
  $path = Get-Hu20VaultPath
  $folder = Split-Path -Parent $path
  [void](New-Item -Path $folder -ItemType Directory -Force)
  $raw = [System.Text.Encoding]::UTF8.GetBytes(($record | ConvertTo-Json -Compress))
  $encrypted = $null
  try {
    $encrypted = [System.Security.Cryptography.ProtectedData]::Protect(
      $raw,(Get-Hu20VaultEntropy $TerminalId),
      [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $temp = $path + ".new"
    try {
      [System.IO.File]::WriteAllBytes($temp,$encrypted)
      Move-Item -LiteralPath $temp -Destination $path -Force
    } finally {
      if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force }
    }
  } finally {
    [Array]::Clear($raw,0,$raw.Length)
    if ($null -ne $encrypted) { [Array]::Clear($encrypted,0,$encrypted.Length) }
    $record = $null
  }
}
function Get-Hu20Vault {
  param([Parameter(Mandatory=$true)][string]$BaseUrl,
        [Parameter(Mandatory=$true)][string]$TerminalId)
  $path = Get-Hu20VaultPath
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "HU20 TEST device is not provisioned. Run the one-time provisioning wizard."
  }
  $encrypted = [System.IO.File]::ReadAllBytes($path)
  if ($encrypted.Length -gt 8192 -or $encrypted.Length -lt 16) { throw "Protected TEST credential file invalid." }
  $raw = $null
  try {
    $raw = [System.Security.Cryptography.ProtectedData]::Unprotect(
      $encrypted,(Get-Hu20VaultEntropy $TerminalId),
      [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    if ($raw.Length -gt 2048) { throw "Protected TEST credentials invalid." }
    $result = [System.Text.Encoding]::UTF8.GetString($raw) | ConvertFrom-Json -ErrorAction Stop
    Assert-Hu20VaultBinding $result $BaseUrl $TerminalId
    return $result
  } finally {
    if ($null -ne $raw) { [Array]::Clear($raw,0,$raw.Length) }
    [Array]::Clear($encrypted,0,$encrypted.Length)
  }
}
