#Requires -Version 5.1
<#
  TEST ONLY. Per-user, loopback-only Windows bridge for Super Admin's
  single-click fictional fingerprint enrollment. NOT a network service.
  No device secrets or biometric records are exposed through GET /status.
  POST /enroll requires a nonce and a pending server-authorised request.
#>
[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or
    -not [Environment]::Is64BitProcess) { throw "64-bit Windows PowerShell is required." }
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath=Join-Path $root "Hu20-TestTerminal.local.json"
$scanner=Join-Path $root "Hu20-EnrollEmployee.ps1"
$vaultScript=Join-Path $root "Hu20-DeviceVault.ps1"
foreach ($path in @($configPath,$scanner,$vaultScript)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Incomplete HU20 TEST bridge installation." }
}
$config=Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
$props=@($config.PSObject.Properties.Name)
if ($props.Count -ne 3 -or @($props | Where-Object { @("baseUrl","terminalId","sdkAssembly") -cnotcontains $_ }).Count -gt 0) {
  throw "Local HU20 TEST configuration must contain only three non-secret fields."
}
$baseUrl=([string]$config.baseUrl).Trim().TrimEnd("/")
$terminalId=([string]$config.terminalId).Trim()
$sdkAssembly=[string]$config.sdkAssembly
$preview=[Uri]::new($baseUrl)
if ($preview.Scheme -ne "https" -or $preview.Port -ne 443 -or
    $preview.AbsolutePath -ne "/" -or $preview.Query -ne "" -or $preview.Fragment -ne "" -or
    $preview.UserInfo -ne "" -or
    $preview.Host -cnotmatch '^bestgymsmalta-member-platform-[a-z0-9-]+-leliapap-2558s-projects[.]vercel[.]app$' -or
    $terminalId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$') {
  throw "Untrusted TEST Preview or terminal configuration."
}
$sdkPath=(Resolve-Path -LiteralPath $sdkAssembly -ErrorAction Stop).Path
if (-not (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $sdkPath) "sgfplib.dll") -PathType Leaf)) {
  throw "Official SecuGen SDK native dependency is missing."
}
. $vaultScript
$verified=Get-Hu20Vault -BaseUrl $baseUrl -TerminalId $terminalId
$verified=$null

$script:nonce=""
$script:nonceExpires=[DateTimeOffset]::MinValue
$port=8765
$server=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,$port)
$server.Start()
Write-Host "BGM HU20 TEST bridge READY on loopback. No secrets are logged."
try {
  while ($true) {
    $client=$server.AcceptTcpClient()
    $client.ReceiveTimeout=120000
    $client.SendTimeout=120000
    $stream=$null;$reader=$null
    try {
      $stream=$client.GetStream()
      $reader=[System.IO.StreamReader]::new($stream,[System.Text.Encoding]::ASCII,$false,4096,$true)
      $line=$reader.ReadLine()
      if ($null -eq $line -or $line.Length -gt 256) { continue }
      $parts=$line.Split(" ")
      if ($parts.Length -ne 3 -or $parts[2] -cne "HTTP/1.1") { continue }
      $method=$parts[0];$path=$parts[1]
      $headers=@{}
      $headerBytes=0
      for ($i=0;$i -lt 35;$i++) {
        $h=$reader.ReadLine()
        if ($null -eq $h) { throw "Incomplete HTTP request." }
        if ($h -eq "") { break }
        $headerBytes += $h.Length
        if ($headerBytes -gt 8192 -or $h.Length -gt 2048 -or $i -eq 34) { throw "Oversized headers." }
        $j=$h.IndexOf(":")
        if ($j -le 0) { throw "Malformed HTTP header." }
        $name=$h.Substring(0,$j).Trim().ToLowerInvariant()
        if ($headers.ContainsKey($name)) { throw "Duplicate HTTP header." }
        $headers[$name]=$h.Substring($j+1).Trim()
      }
      if ($headers["host"] -cne "127.0.0.1:$port" -or $headers["origin"] -cne $baseUrl -or
          $headers.ContainsKey("transfer-encoding") -or
          ($method -cnotin @("GET","POST","OPTIONS"))) { continue }
      $responseCode=200
      $result=@{ok=$false;error="Unsupported local TEST request."}
      if ($method -ceq "OPTIONS" -and $path -cin @("/status","/enroll")) {
        $responseCode=204;$result=$null
      } elseif ($headers["x-bgm-hu20-bridge"] -cne "v1") {
        $responseCode=403
      } elseif ($method -ceq "GET" -and $path -ceq "/status") {
        $script:nonce=[Guid]::NewGuid().ToString("N")
        $script:nonceExpires=[DateTimeOffset]::UtcNow.AddMinutes(3)
        $result=@{ok=$true;testOnly=$true;terminalId=$terminalId;nonce=$script:nonce}
      } elseif ($method -ceq "POST" -and $path -ceq "/enroll" -and
                [string]$headers["content-type"] -match '^application/json(?:;|$)') {
        $len=0
        if (-not [int]::TryParse([string]$headers["content-length"],[ref]$len) -or
            $len -lt 2 -or $len -gt 1024) {
          $responseCode=400;$result=@{ok=$false;error="Invalid TEST request size."}
        } else {
          $chars=[char[]]::new($len)
          $offset=0
          while ($offset -lt $len) {
            $got=$reader.Read($chars,$offset,$len-$offset)
            if ($got -le 0) { throw "Incomplete local TEST request." }
            $offset+=$got
          }
          $payload=(-join $chars) | ConvertFrom-Json -ErrorAction Stop
          $keys=@($payload.PSObject.Properties.Name)
          $requestId=[string]$payload.requestId
          $employeeId=[string]$payload.employeeId
          $nonceValue=[string]$payload.nonce
          $guid='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          if ($keys.Count -ne 3 -or
              @($keys | Where-Object { @("requestId","employeeId","nonce") -cnotcontains $_ }).Count -gt 0 -or
              $requestId -notmatch $guid -or $employeeId -notmatch $guid -or
              $nonceValue -cne $script:nonce -or [DateTimeOffset]::UtcNow -ge $script:nonceExpires) {
            $responseCode=403
            $result=@{ok=$false;error="Expired or invalid local enrollment request."}
          } else {
            $script:nonce=""
            $script:nonceExpires=[DateTimeOffset]::MinValue
            try {
              & $scanner -BaseUrl $baseUrl -TerminalId $terminalId -SdkAssembly $sdkPath -UseProvisionedBridge -ExpectedRequestId $requestId -ExpectedEmployeeId $employeeId
              if (-not $?) { throw "Native TEST enrollment failed." }
              $result=@{ok=$true;testOnly=$true;requestId=$requestId}
            } catch {
              Write-Warning "Supervised TEST enrollment was not confirmed."
              $responseCode=409
              $result=@{ok=$false;error="Enrollment unconfirmed. Check Super Admin request status before retrying."}
            }
          }
        }
      } else { $responseCode=404 }
      # Respond to this exact authenticated Preview origin only. Never
      # return fingerprints, bypass tokens, terminal secrets or templates.
      $body=if ($null -eq $result) { "" } else { $result | ConvertTo-Json -Compress }
      $bodyBytes=[System.Text.Encoding]::UTF8.GetBytes($body)
      $status=if ($responseCode -eq 200) {"OK"} elseif ($responseCode -eq 204) {"No Content"} elseif ($responseCode -eq 403) {"Forbidden"} elseif ($responseCode -eq 409) {"Conflict"} elseif ($responseCode -eq 400) {"Bad Request"} else {"Not Found"}
      $nl=([string][char]13)+([string][char]10)
      $http=("HTTP/1.1 $responseCode $status"+$nl+
        "Content-Type: application/json; charset=utf-8"+$nl+
        "Content-Length: $($bodyBytes.Length)"+$nl+
        "Connection: close"+$nl+
        "Cache-Control: no-store, private"+$nl+
        "X-Content-Type-Options: nosniff"+$nl+
        "Access-Control-Allow-Origin: $baseUrl"+$nl+
        "Access-Control-Allow-Methods: GET, POST, OPTIONS"+$nl+
        "Access-Control-Allow-Headers: content-type, x-bgm-hu20-bridge"+$nl+
        "Access-Control-Allow-Private-Network: true"+$nl+
        "Vary: Origin"+$nl+$nl)
      $headerOut=[System.Text.Encoding]::ASCII.GetBytes($http)
      $stream.Write($headerOut,0,$headerOut.Length)
      if ($bodyBytes.Length -gt 0) { $stream.Write($bodyBytes,0,$bodyBytes.Length) }
      $stream.Flush()
    } catch { Write-Warning "Rejected malformed or failed local TEST request." }
    finally {
      if ($null -ne $reader) { $reader.Dispose() }
      if ($null -ne $stream) { $stream.Dispose() }
      $client.Close()
    }
  }
} finally { $server.Stop() }
