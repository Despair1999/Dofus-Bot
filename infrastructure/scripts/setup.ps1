[CmdletBinding()]
param([switch]$SkipChecks)
$ErrorActionPreference = 'Stop'
$workspacePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $workspacePath
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 22.15 oder neuer installieren: https://nodejs.org/' }
$nodeVersion = [version]((& node --version).TrimStart('v'))
if ($nodeVersion -lt [version]'22.15.0') { throw 'Node.js 22.15 oder neuer erforderlich.' }
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    & npm install -g pnpm@11.25.0
    if ($LASTEXITCODE -ne 0) { throw 'pnpm konnte nicht installiert werden.' }
}
$envPath = Join-Path $workspacePath '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
    $configuration = Get-Content -LiteralPath (Join-Path $workspacePath '.env.example') -Raw
    $tokenBytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($tokenBytes) } finally { $generator.Dispose() }
    $localToken = [BitConverter]::ToString($tokenBytes).Replace('-', '').ToLowerInvariant()
    $configuration = $configuration.Replace('COMPANION_TOKEN=', ('COMPANION_TOKEN=' + $localToken))
    [IO.File]::WriteAllText($envPath, $configuration, [Text.UTF8Encoding]::new($false))
    Write-Host '.env mit zufälligem lokalem Schlüssel angelegt. Nicht veröffentlichen.'
}
& pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw 'Abhängigkeiten konnten nicht installiert werden.' }
if (-not $SkipChecks) {
    & pnpm typecheck
    if ($LASTEXITCODE -ne 0) { throw 'TypeScript-Prüfung fehlgeschlagen.' }
    & pnpm test
    if ($LASTEXITCODE -ne 0) { throw 'Tests fehlgeschlagen.' }
}
Write-Host 'Setup abgeschlossen. Start: .\infrastructure\scripts\start.ps1 -Mode Web'
Write-Host 'Windows-Desktop-Entwicklung benötigt zusätzlich Rust und Visual Studio C++ Build Tools.'
