$ErrorActionPreference = "Continue"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
$env:NODE_OPTIONS = "--use-system-ca"
$env:NO_PROXY = "127.0.0.1,localhost"

$nodeDir = "$env:ProgramFiles\nodejs"
$npm = Join-Path $nodeDir "npm.cmd"
$npx = Join-Path $nodeDir "npx.cmd"
$git = "$env:ProgramFiles\Git\cmd\git.exe"
$project = "C:\Users\ht.tu\cursor-stock-monitor"

if (-not (Test-Path (Join-Path $nodeDir "node.exe"))) { throw "Node.js not found" }
if (-not (Test-Path $git)) { throw "Git not found" }

Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Set-Location $project
& $git fetch origin
& $git checkout cursor/google-drive-db-sync-3e87
& $git pull origin cursor/google-drive-db-sync-3e87

if (Test-Path "node_modules") {
  cmd /c "rmdir /s /q node_modules"
}

& $npm config set registry https://registry.npmmirror.com
& $npm install --registry https://registry.npmmirror.com
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

Write-Host "Open http://127.0.0.1:3456/settings"
& $npx --yes next dev -p 3456 -H 127.0.0.1
