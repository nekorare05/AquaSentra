param([string]$MongoUri='mongodb://127.0.0.1:27017/aquasentra_stage7_demo')
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
# New React Three Fiber / Drei dependencies require an updated frontend lockfile.
# npm install resolves the added packages and updates the lockfile on this machine.
Push-Location frontend
npm install --cache ../../npm-cache --no-audit --no-fund
if($LASTEXITCODE){throw 'Frontend dependency setup failed'}
npm run build
if($LASTEXITCODE){throw 'Dashboard build failed'}
Pop-Location
if(!(Test-Path 'ml/artifacts/model.ubj')){& ./.venv/Scripts/python.exe ml/train.py;if($LASTEXITCODE){throw 'Model training failed'}}
New-Item -ItemType Directory -Force -Path logs | Out-Null
$processes=@()
try{
  $processes+=Start-Process -FilePath (Join-Path $PSScriptRoot '.venv/Scripts/python.exe') -ArgumentList '-m uvicorn ml.service:app --host 127.0.0.1 --port 8001' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput logs/ml.log -RedirectStandardError logs/ml-error.log
  $processes+=Start-Process -FilePath 'node.exe' -ArgumentList 'src/server.js' -WorkingDirectory (Join-Path $PSScriptRoot 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput logs/backend.log -RedirectStandardError logs/backend-error.log
  $processes+=Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules/vite/bin/vite.js preview --configLoader native' -WorkingDirectory (Join-Path $PSScriptRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput logs/frontend.log -RedirectStandardError logs/frontend-error.log
  $processes.Id | ConvertTo-Json | Set-Content logs/demo-processes.json
  Write-Host 'Dashboard: http://127.0.0.1:4173. Credentials remain in backend/.env.'
  Write-Host 'Run python simulator/demo.py in another terminal for the virtual isolation demo.'
  Write-Host 'Press Ctrl+C to stop services started by this launcher.'
  while($true){foreach($proc in $processes){if($proc.HasExited){throw "Demo service exited: $($proc.Id). Inspect logs."}};Start-Sleep -Seconds 1}
}finally{foreach($proc in $processes){if(!$proc.HasExited){Stop-Process -Id $proc.Id -ErrorAction SilentlyContinue}}}
