# Publish a previously built, signed DOFUS Companion v0.9.1 draft.
# GitHub's /releases/tags/{tag} endpoint may return 404 for drafts.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not $env:GH_TOKEN -or -not $env:GITHUB_REPOSITORY) {
  throw 'GitHub repository and GITHUB_TOKEN are required.'
}
$version = (Get-Content -LiteralPath 'apps/desktop/src-tauri/tauri.conf.json' -Raw | ConvertFrom-Json).version
if ($version -ne '0.9.1') {
  throw "Only the reviewed v0.9.1 release may be published by this script (found $version)."
}
$tag = "v$version"
$allReleasesJson = gh api "repos/$env:GITHUB_REPOSITORY/releases?per_page=100"
if ($LASTEXITCODE -ne 0) { throw 'Cannot query releases. No publication was performed.' }
$allReleases = @($allReleasesJson | ConvertFrom-Json)
$candidates = @($allReleases | Where-Object { $_.tag_name -eq $tag })
if ($candidates.Count -ne 1) { throw "Expected exactly one release for $tag, found $($candidates.Count)." }
$release = $candidates[0]
if (-not $release.draft) {
  Write-Host "Release $tag is already published. No changes were made."
  exit 0
}
# Exact source of the already compiled and signed NSIS installer.
$expectedSourceCommit = '12d630e595b5de46cd72c4d88a5170933227410b'
if ($release.target_commitish -ne $expectedSourceCommit) {
  throw "Draft source commit is unexpected: $($release.target_commitish). Refusing to publish."
}
$assetNames = @($release.assets | ForEach-Object { $_.name })
$needed = @(
  "DOFUS.Companion_$($version)_x64-setup.exe",
  "DOFUS.Companion_$($version)_x64-setup.exe.sig",
  "Dofus-Companion-$version-portable.zip",
  "Dofus-Companion-$version-setup.zip",
  'latest.json'
)
foreach ($name in $needed) {
  if ($assetNames -notcontains $name) { throw "Missing release asset: $name" }
  $asset = $release.assets | Where-Object { $_.name -eq $name } | Select-Object -First 1
  if ($asset.size -le 0) { throw "Empty release asset: $name" }
}
$latestAsset = $release.assets | Where-Object { $_.name -eq 'latest.json' } | Select-Object -First 1
$download = "https://api.github.com/repos/$env:GITHUB_REPOSITORY/releases/assets/$($latestAsset.id)"
New-Item -Path .data-release -ItemType Directory -Force | Out-Null
$destination = Join-Path '.data-release' 'latest.json'
$headers = @{
  Authorization = "Bearer $env:GH_TOKEN"
  Accept = 'application/octet-stream'
  'X-GitHub-Api-Version' = '2022-11-28'
  'User-Agent' = 'Dofus-Companion-Release-Verification'
}
Invoke-WebRequest -Uri $download -Headers $headers -MaximumRedirection 5 -OutFile $destination
$metadata = Get-Content -LiteralPath $destination -Raw | ConvertFrom-Json
if ($metadata.version -ne $version) { throw 'Version in latest.json does not match installer version.' }
if (-not $metadata.platforms) { throw 'Updater platforms missing in latest.json.' }
$platforms = @($metadata.platforms.PSObject.Properties)
if ($platforms.Count -eq 0) { throw 'No updater target platform present.' }
foreach ($platform in $platforms) {
  if (-not $platform.Value.signature -or $platform.Value.signature.Length -lt 50) {
    throw "Missing updater signature for platform $($platform.Name)."
  }
  if (-not $platform.Value.url -or
    -not $platform.Value.url.StartsWith("https://github.com/$env:GITHUB_REPOSITORY/releases/download/$tag/")) {
    throw "Unexpected updater URL for platform $($platform.Name)."
  }
}
Write-Host "Verified draft $tag, $($needed.Count) release assets and signed updater metadata."
# Update by release ID; GitHub cannot resolve an unpublished draft reliably by tag.
$result = gh api -X PATCH "repos/$env:GITHUB_REPOSITORY/releases/$($release.id)" -F draft=false
if ($LASTEXITCODE -ne 0) { throw 'GitHub rejected draft publication.' }
$published = $result | ConvertFrom-Json
if ($published.draft -or $published.tag_name -ne $tag) { throw 'Unexpected published release state.' }
Write-Host "Signed Windows update $tag has been published: $($published.html_url)"
