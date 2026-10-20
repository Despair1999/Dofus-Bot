[CmdletBinding()]
param([ValidateSet('Web','Desktop','Backend','Discord')][string]$Mode='Web')
$ErrorActionPreference = 'Stop'
$workspacePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $workspacePath
$cargoBin = Join-Path $env:USERPROFILE '.cargo/bin'
if (Test-Path -LiteralPath $cargoBin) { $env:PATH = $cargoBin + [IO.Path]::PathSeparator + $env:PATH }
$envPath = Join-Path $workspacePath '.env'
if (Test-Path -LiteralPath $envPath) {
    foreach ($line in (Get-Content -LiteralPath $envPath)) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
            $key = $Matches[1]
            $value = $Matches[2].Trim().Trim('"').Trim("'")
            if ($value) { [Environment]::SetEnvironmentVariable($key, $value, 'Process') }
        }
    }
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw 'Zuerst setup.ps1 ausführen.' }
switch ($Mode) {
    'Web' { & pnpm dev }
    'Backend' { & pnpm --filter '@dofus/backend' start }
    'Discord' { & pnpm --filter '@dofus/discord-bot' start }
    'Desktop' {
        if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Rust fehlt. https://rustup.rs/ und C++ Build Tools installieren, oder -Mode Web verwenden.' }
        $backendProcess = $null
        try {
            try { $health = Invoke-WebRequest -Uri 'http://127.0.0.1:4310/health' -TimeoutSec 2 -UseBasicParsing; $backendRunning = $health.StatusCode -eq 200 } catch { $backendRunning = $false }
            if (-not $backendRunning) {
                $nodeCommand = (Get-Command node).Source
                $backendFile = Join-Path $workspacePath 'apps/backend/src/index.ts'
                $backendProcess = Start-Process -FilePath $nodeCommand -ArgumentList @('--import','tsx',('"' + $backendFile + '"')) -WorkingDirectory $workspacePath -WindowStyle Hidden -PassThru
            }
            & pnpm desktop
        } finally {
            if ($backendProcess -and -not $backendProcess.HasExited) { Stop-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue }
        }
    }
}
if ($LASTEXITCODE -ne 0) { throw ('Start fehlgeschlagen: Exit ' + $LASTEXITCODE) }
