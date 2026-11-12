#Requires -Version 5.1
<#
.SYNOPSIS
  SecuGen HU20 TEST-ONLY portable encrypted template capability probe.
.DESCRIPTION
  Creates one locally encrypted throwaway biometric credential (enroll) or
  verifies it with a new scan (verify), using FDx SDK Pro .NET Framework x64.
  No Supabase, BGM employee, web, or network integration.

  Templates are biometric data. Never upload .bgmcred files, reveal passphrases,
  commit them to Git, or use actual employee identity details in this test.
  Vendor NORMAL is ONLY a smoke-test setting, not approved for staff attendance.
.EXAMPLE
  .\Hu20-PortableProbe.ps1 -Mode enroll -SdkAssembly '.\SecuGen.FDxSDKPro.Windows.dll' -CredentialPath 'C:\BGM-HU20\private-test.bgmcred'
.EXAMPLE
  .\Hu20-PortableProbe.ps1 -Mode verify -SdkAssembly '.\SecuGen.FDxSDKPro.Windows.dll' -CredentialPath 'C:\BGM-HU20\private-test.bgmcred'
.NOTES
  Never use these temporary credentials for employee attendance. A real BGM
  implementation needs secure key management, audited lifecycle, signed
  terminal assertions, 1:N identification, global revocation and GDPR review.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('enroll', 'verify')]
  [string]$Mode,
  [Parameter(Mandatory = $true)]
  [string]$SdkAssembly,
  [Parameter(Mandatory = $true)]
  [string]$CredentialPath,
  [ValidateRange(1000, 30000)]
  [int]$CaptureTimeoutMs = 10000,
  [ValidateRange(1, 100)]
  [int]$Quality = 80
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or -not [Environment]::Is64BitProcess) {
  throw 'Run this diagnostic in 64-bit Windows PowerShell.'
}
$iterationCount = 220000
$formatName = 'ANSI378'
$schemaName = 'BGM-HU20-PORTABLE-PROBE'
$schemaVersion = 1

function Clear-Bytes([byte[]]$value) {
  if ($null -ne $value) { [Array]::Clear($value, 0, $value.Length) }
}
function New-RandomBytes([int]$count) {
  $value = [byte[]]::new($count)
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($value); return ,$value }
  finally { $rng.Dispose() }
}
function Read-SecretBytes([string]$message) {
  $secret = Read-Host $message -AsSecureString
  if ($null -eq $secret) { throw 'Missing passphrase.' }
  $pointer = [IntPtr]::Zero
  $bytes = $null
  try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $lengthBytes = [Runtime.InteropServices.Marshal]::ReadInt32($pointer, -4)
    if ($lengthBytes -lt 24 -or $lengthBytes -gt 4096 -or ($lengthBytes % 2) -ne 0) {
      throw 'Use a long, unique test passphrase (at least 12 characters).'
    }
    $bytes = [byte[]]::new($lengthBytes)
    [Runtime.InteropServices.Marshal]::Copy($pointer, $bytes, 0, $lengthBytes)
    return ,$bytes
  }
  catch {
    Clear-Bytes $bytes
    throw
  }
  finally {
    if ($pointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
    $secret.Dispose()
  }
}
function Equals-ConstantTime([byte[]]$a, [byte[]]$b) {
  if ($null -eq $a -or $null -eq $b -or $a.Length -ne $b.Length) { return $false }
  $delta = 0
  for ($i = 0; $i -lt $a.Length; $i++) {
    $delta = $delta -bor ([int]$a[$i] -bxor [int]$b[$i])
  }
  return ($delta -eq 0)
}
function Get-Keys([byte[]]$passwordBytes, [byte[]]$salt) {
  $kdf = [System.Security.Cryptography.Rfc2898DeriveBytes]::new(
    $passwordBytes, $salt, $iterationCount, [System.Security.Cryptography.HashAlgorithmName]::SHA256)
  $combined = $null
  $enc = [byte[]]::new(32)
  $mac = [byte[]]::new(32)
  try {
    $combined = $kdf.GetBytes(64)
    [Array]::Copy($combined, 0, $enc, 0, 32)
    [Array]::Copy($combined, 32, $mac, 0, 32)
    return @{ Encryption = $enc; Authentication = $mac }
  }
  finally {
    Clear-Bytes $combined
    $kdf.Dispose()
  }
}
function Get-MacInput([object]$record) {
  # Authenticate every field affecting interpretation, in a fixed order.
  $fields = @(
    $record.schema, [string]$record.version, $record.templateFormat,
    [string]$record.iterations, $record.credentialId, $record.createdUtc,
    $record.sdkSha256, $record.nativeSha256,
    $record.salt, $record.iv, $record.ciphertext
  )
  return ,([System.Text.Encoding]::UTF8.GetBytes(($fields -join '|')))
}
function Encrypt-Credential([byte[]]$template, [byte[]]$pass, [string]$sdkHash, [string]$nativeHash) {
  $salt = New-RandomBytes 32
  $iv = New-RandomBytes 16
  $keys = $null
  $ciphertext = $null
  $macInput = $null
  $signature = $null
  $aes = $null
  $hmac = $null
  try {
    $keys = Get-Keys $pass $salt
    $aes = [System.Security.Cryptography.Aes]::Create()
    $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
    $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
    $aes.KeySize = 256
    $aes.Key = $keys.Encryption
    $aes.IV = $iv
    $encryptor = $aes.CreateEncryptor()
    try { $ciphertext = $encryptor.TransformFinalBlock($template, 0, $template.Length) }
    finally { $encryptor.Dispose() }

    $record = [ordered]@{
      schema         = $schemaName
      version        = $schemaVersion
      templateFormat = $formatName
      iterations     = $iterationCount
      credentialId   = [guid]::NewGuid().ToString('D')
      createdUtc     = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
      sdkSha256      = $sdkHash
      nativeSha256   = $nativeHash
      salt           = [Convert]::ToBase64String($salt)
      iv             = [Convert]::ToBase64String($iv)
      ciphertext     = [Convert]::ToBase64String($ciphertext)
      hmac           = ''
    }
    $macInput = Get-MacInput $record
    $hmac = [System.Security.Cryptography.HMACSHA256]::new($keys.Authentication)
    $signature = $hmac.ComputeHash($macInput)
    $record.hmac = [Convert]::ToBase64String($signature)
    return ($record | ConvertTo-Json -Depth 4)
  }
  finally {
    Clear-Bytes $salt
    Clear-Bytes $iv
    Clear-Bytes $ciphertext
    Clear-Bytes $macInput
    Clear-Bytes $signature
    if ($null -ne $keys) {
      Clear-Bytes $keys.Encryption
      Clear-Bytes $keys.Authentication
    }
    if ($null -ne $hmac) { $hmac.Dispose() }
    if ($null -ne $aes) { $aes.Dispose() }
  }
}
function Read-EncryptedCredential([string]$file, [string]$sdkHash, [string]$nativeHash) {
  $item = Get-Item -LiteralPath $file -ErrorAction Stop
  if ($item.Length -le 0 -or $item.Length -gt 200000) {
    throw 'Credential file size is invalid.'
  }
  $record = Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($record.schema -cne $schemaName -or [int]$record.version -ne $schemaVersion -or
      $record.templateFormat -cne $formatName -or [int]$record.iterations -ne $iterationCount) {
    throw 'Unsupported or invalid HU20 test credential format.'
  }
  if ($record.sdkSha256 -cne $sdkHash -or $record.nativeSha256 -cne $nativeHash) {
    throw 'SecuGen SDK/native DLL build differs from enrollment PC. Stop; do not force compatibility.'
  }
  if ($record.credentialId -notmatch '^[0-9a-fA-F-]{36}$' -or
      $record.createdUtc -notmatch '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$' -or
      $record.salt -notmatch '^[A-Za-z0-9+/=]{40,48}$' -or
      $record.iv -notmatch '^[A-Za-z0-9+/=]{20,28}$' -or
      $record.ciphertext -notmatch '^[A-Za-z0-9+/=]{20,100000}$' -or
      $record.hmac -notmatch '^[A-Za-z0-9+/=]{40,48}$') {
    throw 'HU20 credential file contains invalid fields.'
  }
  return $record
}
function Unlock-Credential([object]$record, [byte[]]$passwordBytes) {
  $salt = $null
  $iv = $null
  $ciphertext = $null
  $suppliedMac = $null
  $macInput = $null
  $computedMac = $null
  $keys = $null
  $hmac = $null
  $aes = $null
  try {
    $salt = [Convert]::FromBase64String($record.salt)
    $iv = [Convert]::FromBase64String($record.iv)
    $ciphertext = [Convert]::FromBase64String($record.ciphertext)
    $suppliedMac = [Convert]::FromBase64String($record.hmac)
    if ($salt.Length -ne 32 -or $iv.Length -ne 16 -or $suppliedMac.Length -ne 32 -or
        $ciphertext.Length -lt 16 -or ($ciphertext.Length % 16) -ne 0) {
      throw 'Invalid encrypted credential structure.'
    }
    $keys = Get-Keys $passwordBytes $salt
    $macInput = Get-MacInput $record
    $hmac = [System.Security.Cryptography.HMACSHA256]::new($keys.Authentication)
    $computedMac = $hmac.ComputeHash($macInput)
    if (-not (Equals-ConstantTime $computedMac $suppliedMac)) {
      throw 'Incorrect passphrase or corrupted credential. Fingerprint verification was NOT attempted.'
    }
    $aes = [System.Security.Cryptography.Aes]::Create()
    $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
    $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
    $aes.KeySize = 256
    $aes.Key = $keys.Encryption
    $aes.IV = $iv
    $decryptor = $aes.CreateDecryptor()
    try {
      $template = $decryptor.TransformFinalBlock($ciphertext, 0, $ciphertext.Length)
      if ($template.Length -lt 64 -or $template.Length -gt 65536) {
        Clear-Bytes $template
        throw 'Decrypted credential template length is invalid.'
      }
      return ,$template
    }
    finally { $decryptor.Dispose() }
  }
  finally {
    Clear-Bytes $salt
    Clear-Bytes $iv
    Clear-Bytes $ciphertext
    Clear-Bytes $suppliedMac
    Clear-Bytes $macInput
    Clear-Bytes $computedMac
    if ($null -ne $keys) {
      Clear-Bytes $keys.Encryption
      Clear-Bytes $keys.Authentication
    }
    if ($null -ne $hmac) { $hmac.Dispose() }
    if ($null -ne $aes) { $aes.Dispose() }
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

$sdkPath = (Resolve-Path -LiteralPath $SdkAssembly -ErrorAction Stop).Path
$nativePath = Join-Path (Split-Path -Parent $sdkPath) 'sgfplib.dll'
if (-not (Test-Path -LiteralPath $nativePath -PathType Leaf)) {
  throw 'sgfplib.dll is missing beside the .NET SDK DLL. Restore official SDK x64 files.'
}
$sdkHash = (Get-FileHash -LiteralPath $sdkPath -Algorithm SHA256).Hash.ToLowerInvariant()
$nativeHash = (Get-FileHash -LiteralPath $nativePath -Algorithm SHA256).Hash.ToLowerInvariant()
$fullCredentialPath = [System.IO.Path]::GetFullPath($CredentialPath)
if ([System.IO.Path]::GetExtension($fullCredentialPath) -cne '.bgmcred') {
  throw 'Use the .bgmcred file extension for throwaway encrypted credentials.'
}
$directory = [System.IO.Path]::GetDirectoryName($fullCredentialPath)
if (-not [System.IO.Directory]::Exists($directory)) {
  throw 'Credential directory does not exist. Create a private test folder first.'
}
if ($Mode -eq 'enroll' -and [System.IO.File]::Exists($fullCredentialPath)) {
  throw 'Test credential already exists. Refusing to overwrite it.'
}
if ($Mode -eq 'verify' -and -not [System.IO.File]::Exists($fullCredentialPath)) {
  throw 'Encrypted test credential file not found.'
}

$assembly = [System.Reflection.Assembly]::LoadFrom($sdkPath)
$managerType = Get-SdkType $assembly 'SGFingerPrintManager'
$deviceType = Get-SdkType $assembly 'SGFPMDeviceName'
$infoType = Get-SdkType $assembly 'SGFPMDeviceInfoParam'
$formatType = Get-SdkType $assembly 'SGFPMTemplateFormat'
$levelType = Get-SdkType $assembly 'SGFPMSecurityLevel'
$manager = [System.Activator]::CreateInstance($managerType)
$opened = $false
$pass = $null
$confirmPass = $null
$enrolled = $null
$live = $null
try {
  Write-Host 'BGM HU20 encrypted portability test (NO attendance or network access).'
  if ($Mode -eq 'enroll') {
    $pass = Read-SecretBytes 'Create a NEW long test passphrase (not your BGM password)'
    $confirmPass = Read-SecretBytes 'Repeat the passphrase'
    if (-not (Equals-ConstantTime $pass $confirmPass)) {
      throw 'Passphrases did not match; nothing enrolled.'
    }
  }
  else {
    $record = Read-EncryptedCredential $fullCredentialPath $sdkHash $nativeHash
    $pass = Read-SecretBytes 'Enter the test credential passphrase'
    $enrolled = Unlock-Credential $record $pass
  }

  $autoDevice = [Enum]::Parse($deviceType, 'DEV_AUTO')
  Check-SdkResult 'Init' ($manager.Init($autoDevice))
  Check-SdkResult 'OpenDevice' ($manager.OpenDevice(0x255))
  $opened = $true
  $info = [System.Activator]::CreateInstance($infoType)
  Check-SdkResult 'GetDeviceInfo' ($manager.GetDeviceInfo($info))
  $width = [int]$info.ImageWidth
  $height = [int]$info.ImageHeight
  if ($width -le 0 -or $height -le 0 -or ($width * $height) -gt 2000000) {
    throw 'Invalid HU20 image dimensions.'
  }
  Write-Host "SDK reader detected ($width x $height)."
  $format = [Enum]::Parse($formatType, 'ANSI378')
  Check-SdkResult 'SetTemplateFormat' ($manager.SetTemplateFormat($format))
  $maxSize = 0
  Check-SdkResult 'GetMaxTemplateSize' ($manager.GetMaxTemplateSize([ref]$maxSize))
  if ($maxSize -lt 64 -or $maxSize -gt 65536) { throw 'Invalid maximum template size.' }

  if ($Mode -eq 'enroll') {
    $live = Get-TransientTemplate $manager $width $height $maxSize
    Write-Host 'PASS: Transient ANSI378 fingerprint template generated.'
    $json = Encrypt-Credential $live $pass $sdkHash $nativeHash
    $jsonBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $fileCreated = $false
    try {
      $stream = [System.IO.FileStream]::new($fullCredentialPath, [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
      $fileCreated = $true
      try {
        $stream.Write($jsonBytes, 0, $jsonBytes.Length)
        $stream.Flush()
      }
      finally { $stream.Dispose() }
    }
    catch {
      # A partial credential must never be mistaken for successful enrollment.
      if ($fileCreated) {
        try { [System.IO.File]::Delete($fullCredentialPath) }
        catch { Write-Warning 'Could not delete an incomplete test credential.' }
      }
      throw
    }
    finally { Clear-Bytes $jsonBytes }
    Write-Host 'PASS: One encrypted TEST credential created locally. No raw fingerprint saved.'
    Write-Host 'Keep .bgmcred private and the passphrase separate. Do not share either in chat.'
    Write-Host 'Next: run -Mode verify on this PC with the same credential file.'
  }
  else {
    if ($enrolled.Length -ne $maxSize) {
      throw 'Template buffer differs from this SDK build. Verification stopped.'
    }
    $live = Get-TransientTemplate $manager $width $height $maxSize
    $level = [Enum]::Parse($levelType, 'NORMAL')
    $matched = $false
    Check-SdkResult 'MatchTemplate' ($manager.MatchTemplate($enrolled, $live, $level, [ref]$matched))
    if ($matched) {
      Write-Host 'MATCH: Fresh fingerprint matches the portable encrypted TEST credential.'
    }
    else {
      Write-Host 'NO MATCH: This fingerprint does not match the stored TEST credential.'
    }
    Write-Host 'Vendor NORMAL is a smoke-test level, not an approved payroll/security threshold.'
  }
}
finally {
  Clear-Bytes $pass
  Clear-Bytes $confirmPass
  Clear-Bytes $enrolled
  Clear-Bytes $live
  if ($opened) {
    try { [void]$manager.CloseDevice() }
    catch { Write-Warning 'CloseDevice failed.' }
  }
  if ($manager -is [System.IDisposable]) { $manager.Dispose() }
}
