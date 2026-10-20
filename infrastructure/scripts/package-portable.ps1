[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$workspacePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$nativePath = Join-Path $workspacePath 'apps/desktop/src-tauri'
$executablePath = Join-Path $nativePath 'target/release/dofus-companion.exe'
$servicePath = Join-Path $nativePath 'resources'
if (-not (Test-Path -LiteralPath $executablePath)) { throw 'Native Release-EXE fehlt. Zuerst Tauri bauen.' }
if (-not (Test-Path -LiteralPath (Join-Path $servicePath 'node.exe'))) { throw 'Gebündelte Service-Ressourcen fehlen.' }
$config = Get-Content -LiteralPath (Join-Path $nativePath 'tauri.conf.json') -Raw | ConvertFrom-Json
$version = [string]$config.version
if ($version -notmatch '^\d+\.\d+\.\d+([-.][A-Za-z0-9.-]+)?$') { throw 'Ungültige Release-Version.' }
$portablePath = Join-Path $workspacePath ('.data/portable-' + $version)
$serviceTarget = Join-Path $portablePath 'service'
$artifactPath = Join-Path $workspacePath 'artifacts'
[void](New-Item -ItemType Directory -Path $portablePath,$serviceTarget,$artifactPath -Force)
Copy-Item -LiteralPath $executablePath -Destination (Join-Path $portablePath 'dofus-companion.exe') -Force
Get-ChildItem -LiteralPath $servicePath -File | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $serviceTarget -Force }
$readmeText = "DOFUS Companion $version portable`r`n`r`nDas gesamte ZIP entpacken und dofus-companion.exe starten. Den service-Ordner mitliefern.`r`nMicrosoft Edge WebView2 Runtime wird benötigt. Persönliche Daten werden im Windows-AppData-Verzeichnis gespeichert.`r`n"
[IO.File]::WriteAllText((Join-Path $portablePath 'LIESMICH.txt'),$readmeText,[Text.UTF8Encoding]::new($false))
$zipPath = Join-Path $artifactPath ('Dofus-Companion-' + $version + '-portable.zip')
Compress-Archive -Path (Join-Path $portablePath '*') -DestinationPath $zipPath -Force
Write-Output $zipPath
