[CmdletBinding()]
param([switch]$Bundle)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$runtimePath = Join-Path $taskRoot '.data/translator-runtime'
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) { throw 'Build-Voraussetzung: uv installieren (https://docs.astral.sh/uv/). Endnutzer benötigen uv nicht.' }
& uv python install 3.11
if ($LASTEXITCODE -ne 0) { throw 'Python-Runtime konnte nicht geladen werden.' }
$pythonPath = (& uv python find 3.11 | Out-String).Trim()
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Python 3.11 wurde nicht gefunden.' }
[void](New-Item -ItemType Directory -Path $runtimePath -Force)
Get-ChildItem -LiteralPath (Split-Path $pythonPath) -Force | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $runtimePath -Recurse -Force }
& uv pip install --python $pythonPath --target (Join-Path $runtimePath 'companion-deps') 'ctranslate2==4.8.0' 'sentencepiece==0.2.1' 'numpy==2.4.6' 'PyYAML==6.0.3' 'setuptools==84.2.1'
if ($LASTEXITCODE -ne 0) { throw 'Übersetzungsbibliotheken konnten nicht installiert werden.' }
Copy-Item -LiteralPath (Join-Path $taskRoot 'apps/backend/runtime/translator.py') -Destination (Join-Path $runtimePath 'translator.py') -Force
Write-Output "Lokale Runtime bereit: $runtimePath"
if ($Bundle) { & node (Join-Path $PSScriptRoot 'bundle-translator.mjs'); if ($LASTEXITCODE -ne 0) { throw 'Runtime-Paketierung fehlgeschlagen.' } }
