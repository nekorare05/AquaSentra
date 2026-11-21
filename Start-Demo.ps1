param(
  [string]$MongoUri='mongodb://127.0.0.1:27017/aquasentra_stage7_demo',
  [ValidateSet('all','frontend','device-lab','backend')][string]$App='all'
)
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
$env:MONGODB_URI=$MongoUri
$env:PORT='8444'
$env:ML_URL='http://127.0.0.1:8001'
$env:AQUASENTRA_API_TARGET='https://127.0.0.1:8444'

if(!(Test-Path 'backend/.env')){throw 'Configure backend/.env using .env.example first. Preserve existing credentials.'}
if(!(Test-Path '.venv/Scripts/python.exe')){python -m venv .venv; if($LASTEXITCODE){throw 'Python environment creation failed'}}
& ./.venv/Scripts/python.exe -m pip install -r ml/requirements.txt
if($LASTEXITCODE){throw 'Python dependency setup failed'}

Push-Location backend
npm ci --cache ../../npm-cache --no-audit --no-fund
if($LASTEXITCODE){throw 'Backend dependency setup failed'}
npm run dev:cert
if($LASTEXITCODE){throw 'HTTPS certificate setup failed'}
npm run seed
if($LASTEXITCODE){throw 'MongoDB setup failed; start MongoDB or supply -MongoUri'}
Pop-Location

# Build Main Dashboard (frontend)
if($App -eq 'all' -or $App -eq 'frontend'){
  Push-Location frontend
  npm install --cache ../../npm-cache --no-audit --no-fund
  if($LASTEXITCODE){throw 'Frontend dependency setup failed'}
  npm run build
  if($LASTEXITCODE){throw 'Dashboard build failed'}
  Pop-Location
}

# Build Standalone 3D Lab (device-lab)
if($App -eq 'all' -or $App -eq 'device-lab'){
  Push-Location device-lab
  if(!(Test-Path 'node_modules')){
    New-Item -ItemType Junction -Path 'node_modules' -Target '../frontend/node_modules' | Out-Null
  }
  npm run build
  if($LASTEXITCODE){throw '3D Device Lab build failed'}
  Pop-Location
}

if(!(Test-Path 'ml/artifacts/model.ubj')){& ./.venv/Scripts/python.exe ml/train.py;if($LASTEXITCODE){throw 'Model training failed'}}
New-Item -ItemType Directory -Force -Path logs | Out-Null
$processes=@()

try{
  # 1. FastAPI Machine Learning Service (Port 8001)
  $processes+=Start-Process -FilePath (Join-Path $PSScriptRoot '.venv/Scripts/python.exe') -ArgumentList '-m uvicorn ml.service:app --host 127.0.0.1 --port 8001' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput logs/ml.log -RedirectStandardError logs/ml-error.log

  # 2. Node.js Express HTTPS Backend (Port 8444)
  $processes+=Start-Process -FilePath 'node.exe' -ArgumentList 'src/server.js' -WorkingDirectory (Join-Path $PSScriptRoot 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput logs/backend.log -RedirectStandardError logs/backend-error.log

  # 3. Main AquaSentra Web Application (Port 4173)
  if($App -eq 'all' -or $App -eq 'frontend'){
    $processes+=Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules/vite/bin/vite.js preview --port 4173 --configLoader native' -WorkingDirectory (Join-Path $PSScriptRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput logs/frontend.log -RedirectStandardError logs/frontend-error.log
  }

  # 4. Standalone AquaSentra 3D Lab (Port 4174)
  if($App -eq 'all' -or $App -eq 'device-lab'){
    $processes+=Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules/vite/bin/vite.js preview --port 4174 --configLoader native' -WorkingDirectory (Join-Path $PSScriptRoot 'device-lab') -WindowStyle Hidden -PassThru -RedirectStandardOutput logs/device-lab.log -RedirectStandardError logs/device-lab-error.log
  }

  $processes.Id | ConvertTo-Json | Set-Content logs/demo-processes.json

  Write-Host '========================================================================' -ForegroundColor Cyan
  Write-Host '  AquaSentra Stages 1–7 System Running' -ForegroundColor Green
  Write-Host '========================================================================' -ForegroundColor Cyan
  if($App -eq 'all' -or $App -eq 'frontend'){
    Write-Host '  • Main Web Dashboard:    http://127.0.0.1:4173' -ForegroundColor White
  }
  if($App -eq 'all' -or $App -eq 'device-lab'){
    Write-Host '  • Standalone 3D Lab:     http://127.0.0.1:4174' -ForegroundColor White
  }
  Write-Host '  • HTTPS Ingestion API:   https://127.0.0.1:8444/api/v1/health' -ForegroundColor Gray
  Write-Host '  • Python ML Service:     http://127.0.0.1:8001/health' -ForegroundColor Gray
  Write-Host '  • Credentials stored in: backend/.env (User: research-viewer / research-admin)' -ForegroundColor Gray
  Write-Host ''
  Write-Host '  Virtual Isolation Demo: python simulator/demo.py' -ForegroundColor Yellow
  Write-Host '  Press Ctrl+C to stop all services started by this launcher.' -ForegroundColor Gray
  Write-Host '========================================================================' -ForegroundColor Cyan

  while($true){
    foreach($proc in $processes){
      if($proc.HasExited){
        throw "Demo service exited unexpectedly: Process ID $($proc.Id). Inspect logs/ directory."
      }
    }
    Start-Sleep -Seconds 1
  }
}finally{
  foreach($proc in $processes){
    if(!$proc.HasExited){
      Stop-Process -Id $proc.Id -ErrorAction SilentlyContinue
    }
  }
}
