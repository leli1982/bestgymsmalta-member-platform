#Requires -Version 5.1
<#
  HU20 TEST-ONLY local one-to-many recognition.
  Accepts throwaway .bgmcred files from Hu20-PortableProbe.ps1.
  No staff IDs, network access, biometric upload, or attendance.
  Vendor NORMAL is only a demonstration threshold.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SdkAssembly,
  [Parameter(Mandatory = $true)]
  [string]$CredentialDirectory,
  [ValidateRange(1000, 30000)]
  [int]$CaptureTimeoutMs = 10000,
  [ValidateRange(1, 100)]
  [int]$Quality = 80
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or -not [Environment]::Is64BitProcess) {
  throw 'Use 64-bit Windows PowerShell with the HU20 connected.'
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
$sdkFolder = Split-Path -Parent $sdkPath
$nativePath = Join-Path $sdkFolder 'sgfplib.dll'
if (-not (Test-Path -LiteralPath $nativePath -PathType Leaf)) {
  throw 'Missing SecuGen native DLL (sgfplib.dll) beside the SDK assembly.'
}
$env:PATH = $sdkFolder + ';' + $env:PATH
$folder = (Resolve-Path -LiteralPath $CredentialDirectory -ErrorAction Stop).Path
if (-not (Test-Path -LiteralPath $folder -PathType Container)) {
  throw 'CredentialDirectory must be a private local folder.'
}
$files = @(Get-ChildItem -LiteralPath $folder -Filter '*.bgmcred' -File | Sort-Object Name)
if ($files.Count -lt 1 -or $files.Count -gt 16) {
  throw 'Local TEST roster must contain between 1 and 16 encrypted .bgmcred credentials.'
}
Write-Host "HU20 local 1:N TEST: $($files.Count) encrypted credential(s)."
Write-Host 'Nothing is uploaded and no employee attendance is recorded.'
$sdkHash = (Get-FileHash -LiteralPath $sdkPath -Algorithm SHA256).Hash.ToLowerInvariant()
$nativeHash = (Get-FileHash -LiteralPath $nativePath -Algorithm SHA256).Hash.ToLowerInvariant()
$assembly = [System.Reflection.Assembly]::LoadFrom($sdkPath)
$managerType = Get-SdkType $assembly 'SGFingerPrintManager'
$deviceType = Get-SdkType $assembly 'SGFPMDeviceName'
$infoType = Get-SdkType $assembly 'SGFPMDeviceInfoParam'
$formatType = Get-SdkType $assembly 'SGFPMTemplateFormat'
$levelType = Get-SdkType $assembly 'SGFPMSecurityLevel'
$manager = [System.Activator]::CreateInstance($managerType)
$templates = New-Object System.Collections.ArrayList
$seen = New-Object 'System.Collections.Generic.HashSet[string]'
$opened = $false
$live = $null
try {
  # Unlock all candidates into process memory, only for this diagnostic.
  foreach ($item in $files) {
    $record = Read-EncryptedCredential $item.FullName $sdkHash $nativeHash
    if (-not $seen.Add([string]$record.credentialId)) {
      throw 'Duplicate credential detected. Do not use two copies as separate identities.'
    }
    $pass = $null
    $candidate = $null
    try {
      $pass = Read-SecretBytes "Private TEST passphrase for $($item.Name)"
      $candidate = Unlock-Credential $record $pass
      [void]$templates.Add(@{ Label = [IO.Path]::GetFileNameWithoutExtension($item.Name); Template = $candidate })
      $candidate = $null
    }
    finally {
      Clear-Bytes $pass
      Clear-Bytes $candidate
    }
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
    throw 'Invalid fingerprint image dimensions from HU20.'
  }
  Check-SdkResult 'SetTemplateFormat' ($manager.SetTemplateFormat([Enum]::Parse($formatType, 'ANSI378')))
  $maxSize = 0
  Check-SdkResult 'GetMaxTemplateSize' ($manager.GetMaxTemplateSize([ref]$maxSize))
  if ($maxSize -lt 64 -or $maxSize -gt 65536) { throw 'Unsupported fingerprint template buffer size.' }
  foreach ($item in $templates) {
    if ($item.Template.Length -ne $maxSize) {
      throw 'One test template differs from the local SDK size. Refusing to match.'
    }
  }
  $live = Get-TransientTemplate $manager $width $height $maxSize
  $level = [Enum]::Parse($levelType, 'NORMAL')
  $matches = New-Object System.Collections.ArrayList
  foreach ($item in $templates) {
    $matched = $false
    Check-SdkResult 'MatchTemplate' ($manager.MatchTemplate($item.Template, $live, $level, [ref]$matched))
    if ($matched) { [void]$matches.Add($item.Label) }
  }
  if ($matches.Count -eq 0) {
    Write-Host 'NO_MATCH: no encrypted TEST credential matched.'
  }
  elseif ($matches.Count -eq 1) {
    Write-Host "ONE_MATCH: uniquely identified TEST credential '$($matches[0])'."
  }
  else {
    Write-Host "AMBIGUOUS: $($matches.Count) credentials matched, so identification is REJECTED."
  }
  Write-Host 'PUNCH DISABLED: no biometric was uploaded, and no attendance/payroll event was created.'
  Write-Host 'The vendor NORMAL level must be calibrated before staff use.'
}
finally {
  Clear-Bytes $live
  foreach ($item in $templates) { Clear-Bytes $item.Template }
  if ($opened) {
    try { [void]$manager.CloseDevice() }
    catch { Write-Warning 'CloseDevice failed.' }
  }
  if ($manager -is [System.IDisposable]) { $manager.Dispose() }
}
