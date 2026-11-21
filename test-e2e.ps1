$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$env:MONGODB_URI = 'mongodb://127.0.0.1:27017/aquasentra_stage7_demo'
$env:PORT = '8444'
$env:ML_URL = 'http://127.0.0.1:8001'
$env:AQUASENTRA_API_TARGET = 'https://127.0.0.1:8444'

Write-Host "Seeding demo database..."
Push-Location backend
node scripts/seed.js
Pop-Location

New-Item -ItemType Directory -Force -Path logs | Out-Null
$processes = @()

try {
    Write-Host "Starting FastAPI ML service on 8001..."
    $processes += Start-Process -FilePath (Join-Path $PSScriptRoot '.venv/Scripts/python.exe') -ArgumentList '-m uvicorn ml.service:app --host 127.0.0.1 --port 8001' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput logs/ml.log -RedirectStandardError logs/ml-error.log

    Write-Host "Starting Node backend API on 8444..."
    $processes += Start-Process -FilePath 'node.exe' -ArgumentList 'src/server.js' -WorkingDirectory (Join-Path $PSScriptRoot 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput logs/backend.log -RedirectStandardError logs/backend-error.log

    Write-Host "Starting Main Dashboard preview on 4173..."
    $processes += Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules/vite/bin/vite.js preview --port 4173 --configLoader native' -WorkingDirectory (Join-Path $PSScriptRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput logs/frontend.log -RedirectStandardError logs/frontend-error.log

    Write-Host "Starting Standalone 3D Lab preview on 4174..."
    $processes += Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules/vite/bin/vite.js preview --port 4174 --configLoader native' -WorkingDirectory (Join-Path $PSScriptRoot 'device-lab') -WindowStyle Hidden -PassThru -RedirectStandardOutput logs/device-lab.log -RedirectStandardError logs/device-lab-error.log

    Write-Host "Waiting for services to become responsive..."
    Start-Sleep -Seconds 5

    Write-Host "Executing end-to-end browser test suite..."
    Push-Location frontend
    node browser-test.mjs
    $testResult = $LASTEXITCODE
    Pop-Location

    if ($testResult -ne 0) {
        throw "Browser tests failed with exit code $testResult"
    }

    Write-Host "Executing simulator demo.py suite against running backend..."
    & .\.venv\Scripts\python.exe simulator/demo.py --suite
    if ($LASTEXITCODE -ne 0) {
        throw "Simulator demo suite failed with exit code $LASTEXITCODE"
    }
    Write-Host "All end-to-end and simulation tests passed successfully!" -ForegroundColor Green
} finally {
    Write-Host "Stopping temporary test processes..."
    foreach ($proc in $processes) {
        if (!$proc.HasExited) {
            Stop-Process -Id $proc.Id -ErrorAction SilentlyContinue
        }
    }
}
