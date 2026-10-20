[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$workspacePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$nativePath = Join-Path $workspacePath 'apps/desktop/src-tauri'
$config = Get-Content -LiteralPath (Join-Path $nativePath 'tauri.conf.json') -Raw | ConvertFrom-Json
$version = [string]$config.version
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid release version' }
$artifactPath = Join-Path $workspacePath 'artifacts'
New-Item -ItemType Directory -Path $artifactPath -Force | Out-Null
$source = Join-Path $nativePath ('target/release/bundle/nsis/DOFUS Companion_' + $version + '_x64-setup.exe')
$installer = Join-Path $artifactPath ('DOFUS-Companion-' + $version + '-setup.exe')
Copy-Item -LiteralPath $source -Destination $installer -Force
if (Test-Path -LiteralPath ($source + '.sig')) {
    Copy-Item -LiteralPath ($source + '.sig') -Destination ($installer + '.sig') -Force
} else {
    Push-Location $workspacePath
    try {
        & pnpm --filter @dofus/desktop exec tauri signer sign --private-key-path .data/updater.key --password= ('../../artifacts/DOFUS-Companion-' + $version + '-setup.exe') *> (Join-Path $workspacePath '.data/release-signing.log')
        if ($LASTEXITCODE -ne 0) { throw 'Signing failed; private local log retained.' }
    } finally { Pop-Location }
}
$setupPath = Join-Path $workspacePath ('.data/setup-' + $version)
New-Item -ItemType Directory -Path $setupPath -Force | Out-Null
Copy-Item -LiteralPath $installer,($installer + '.sig') -Destination $setupPath -Force
$readmeText = "DOFUS Companion $version - Windows x64`r`n`r`nSetup-EXE starten. Bei vorhandener Installation denselben Installationsordner verwenden. Profile und Fortschritte bleiben in AppData gespeichert.`r`nDer oeffentliche Katalog, Node und Backend sind enthalten. Fuer Almanax und erstmalige OCR-Sprachmodelle wird Internet benoetigt. Die SIG-Datei ist die Tauri-Updatesignatur, kein Authenticode-Zertifikat.`r`n"
[IO.File]::WriteAllText((Join-Path $setupPath 'LIESMICH.txt'),$readmeText,[Text.UTF8Encoding]::new($false))
$zipPath = Join-Path $artifactPath ('Dofus-Companion-' + $version + '-setup.zip')
Compress-Archive -Path (Join-Path $setupPath '*') -DestinationPath $zipPath -Force
$seed = Join-Path $nativePath 'resources/catalog-seed.sqlite'
if (Test-Path -LiteralPath $seed) {
    $manifest = Get-Content -LiteralPath (Join-Path $workspacePath 'design/catalog-bundle.json') -Raw | ConvertFrom-Json
    if ((Get-FileHash -LiteralPath $seed -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.sha256) { throw 'Bundled catalog differs from reviewed snapshot.' }
    Copy-Item -LiteralPath $seed -Destination (Join-Path $artifactPath ('game-catalog-v' + $version + '.sqlite')) -Force
}
Write-Output $zipPath
