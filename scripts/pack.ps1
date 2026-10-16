$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$extension = Join-Path $root 'extension'
$manifest = Get-Content (Join-Path $extension 'manifest.json') -Raw | ConvertFrom-Json
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$zip = Join-Path $dist "orib-$($manifest.version).zip"
if (Test-Path $zip) { Remove-Item $zip }

tar -a -c -f $zip -C $extension manifest.json renderer.js classic.css icons
Write-Output $zip
