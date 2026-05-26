param(
  [string]$UpstreamBaseUrl,
  [Nullable[int]]$Port
)

function Get-PreferredEnvValue {
  param([string]$Name)

  $processValue = [Environment]::GetEnvironmentVariable($Name, "Process")
  if (-not [string]::IsNullOrWhiteSpace($processValue)) {
    return $processValue
  }

  return [Environment]::GetEnvironmentVariable($Name, "User")
}

function Get-DiscoveredProxyKeys {
  $merged = @{}

  foreach ($scope in @("User", "Process")) {
    $variables = [Environment]::GetEnvironmentVariables($scope)
    foreach ($entry in $variables.GetEnumerator()) {
      $name = [string]$entry.Key
      $value = [string]$entry.Value
      if ($name -notmatch '^CLAUDE_PROXY_KEY_[A-Z0-9_]+$') {
        continue
      }
      if ($name -match '(_BALANCE_ID|_LIMIT)$') {
        continue
      }
      if ([string]::IsNullOrWhiteSpace($value)) {
        continue
      }
      $merged[$name] = $value
    }
  }

  return $merged.GetEnumerator() |
    Sort-Object Name |
    ForEach-Object {
      [PSCustomObject]@{
        Name = $_.Key
        Value = $_.Value
      }
    }
}

$storedUpstreamBaseUrl = [Environment]::GetEnvironmentVariable("ANTHROPIC_UPSTREAM_BASE_URL", "User")
$storedPort = [Environment]::GetEnvironmentVariable("CLAUDE_BALANCER_PORT", "User")
$storedSessionCookie = Get-PreferredEnvValue "ONEAPI_SESSION_COOKIE"
$storedNewApiUser = Get-PreferredEnvValue "ONEAPI_NEW_API_USER"
$storedForceKey = Get-PreferredEnvValue "CLAUDE_BALANCER_FORCE_KEY"

$discoveredKeys = Get-DiscoveredProxyKeys

if (-not $discoveredKeys) {
  throw "Missing CLAUDE_PROXY_KEY_<NAME> environment variables."
}

if ([string]::IsNullOrWhiteSpace($UpstreamBaseUrl)) {
  if (-not [string]::IsNullOrWhiteSpace($env:ANTHROPIC_UPSTREAM_BASE_URL)) {
    $UpstreamBaseUrl = $env:ANTHROPIC_UPSTREAM_BASE_URL
  } elseif (-not [string]::IsNullOrWhiteSpace($storedUpstreamBaseUrl)) {
    $UpstreamBaseUrl = $storedUpstreamBaseUrl
  } else {
    $UpstreamBaseUrl = "https://vip.aipro.love"
  }
}

if (-not $Port) {
  if (-not [string]::IsNullOrWhiteSpace($env:CLAUDE_BALANCER_PORT)) {
    $Port = [int]$env:CLAUDE_BALANCER_PORT
  } elseif (-not [string]::IsNullOrWhiteSpace($storedPort)) {
    $Port = [int]$storedPort
  } else {
    $Port = 8787
  }
}

$scriptPath = Join-Path $PSScriptRoot "claude-code-balancer-proxy.mjs"
$logPath = Join-Path $env:TEMP "claude-code-balancer-proxy.log"
$nodePath = (Get-Command node -ErrorAction Stop).Source

$running = Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq "node.exe" -and $_.CommandLine -like "*claude-code-balancer-proxy.mjs*" }

foreach ($process in $running) {
  try {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
  } catch {}
}

$escapedUpstream = $UpstreamBaseUrl.Replace("'", "''")
$escapedNodePath = $nodePath.Replace("'", "''")
$escapedScriptPath = $scriptPath.Replace("'", "''")
$escapedLogPath = $logPath.Replace("'", "''")
$escapedSessionCookie = $(if ($storedSessionCookie) { $storedSessionCookie.Replace("'", "''") } else { "" })
$escapedNewApiUser = $(if ($storedNewApiUser) { $storedNewApiUser.Replace("'", "''") } else { "" })
$escapedForceKey = $(if ($storedForceKey) { $storedForceKey.Replace("'", "''") } else { "" })

$envLines = @(
  "`$env:ANTHROPIC_UPSTREAM_BASE_URL = '$escapedUpstream'",
  "`$env:CLAUDE_BALANCER_PORT = '$Port'",
  "`$env:ONEAPI_SESSION_COOKIE = '$escapedSessionCookie'",
  "`$env:ONEAPI_NEW_API_USER = '$escapedNewApiUser'",
  "`$env:CLAUDE_BALANCER_FORCE_KEY = '$escapedForceKey'"
)

foreach ($item in $discoveredKeys) {
  $name = $item.Name
  $value = $item.Value.Replace("'", "''")
  $envLines += "`$env:$name = '$value'"
  $balanceName = "${name}_BALANCE_ID"
  $balanceValue = Get-PreferredEnvValue $balanceName
  if (-not [string]::IsNullOrWhiteSpace($balanceValue)) {
    $envLines += "`$env:$balanceName = '$($balanceValue.Replace("'", "''"))'"
  }
  $limitName = "${name}_LIMIT"
  $limitValue = Get-PreferredEnvValue $limitName
  if (-not [string]::IsNullOrWhiteSpace($limitValue)) {
    $envLines += "`$env:$limitName = '$($limitValue.Replace("'", "''"))'"
  }
  $fallbackName = "${name}_FALLBACK"
  $fallbackValue = Get-PreferredEnvValue $fallbackName
  if (-not [string]::IsNullOrWhiteSpace($fallbackValue)) {
    $envLines += "`$env:$fallbackName = '$($fallbackValue.Replace("'", "''"))'"
  }
}

$command = ($envLines + "& '$escapedNodePath' '$escapedScriptPath' *> '$escapedLogPath'") -join "`n"
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
$proxyProcess = Start-Process -WindowStyle Hidden powershell -ArgumentList '-NoProfile', '-EncodedCommand', $encoded -PassThru

$statusUrl = "http://127.0.0.1:$Port/_status"
$deadline = (Get-Date).AddSeconds(10)
$ready = $false

while ((Get-Date) -lt $deadline) {
  if ($proxyProcess.HasExited) {
    throw "Claude proxy exited before becoming ready. ExitCode=$($proxyProcess.ExitCode). Log: $logPath"
  }

  try {
    $null = Invoke-RestMethod -Uri $statusUrl -Method Get -TimeoutSec 2
    $ready = $true
    break
  } catch {
    Start-Sleep -Milliseconds 250
  }
}

if (-not $ready) {
  try {
    if (-not $proxyProcess.HasExited) {
      Stop-Process -Id $proxyProcess.Id -Force -ErrorAction Stop
    }
  } catch {}
  throw "Claude proxy did not become ready at $statusUrl within 10 seconds. Log: $logPath"
}

$env:ANTHROPIC_BASE_URL = "http://127.0.0.1:$Port"
$env:ANTHROPIC_API_KEY = "local-balanced"

Write-Output "Claude proxy ready: $($env:ANTHROPIC_BASE_URL)"
Write-Output "Log: $logPath"
