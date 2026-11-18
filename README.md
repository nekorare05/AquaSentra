# AquaSentra — Stages 1–7 software prototype

Research demonstration only. Sensors, relay, NC valve and independent position feedback are
simulated. A Normal rating does not certify potability. No physical valve control transport exists.

## Run the completed demo

The tested working copy is in this project directory. The original Capstone project and Stage 1
backup were left intact. Existing .env and certificates were copied unchanged for local use; they
are excluded from the distributable ZIP.

Services for this demonstration use:

| Component | Address |
|---|---|
| Built React PWA | http://127.0.0.1:4173 |
| HTTPS API | https://127.0.0.1:8444/api/v1/health |
| FastAPI | http://127.0.0.1:8001/health |
| Isolated demo MongoDB database | mongodb://127.0.0.1:27017/aquasentra_stage7_demo |

Docker Desktop was launched but no usable engine pipe became available. The existing native
MongoDB service was reachable, so the demo uses a new database; it does not move or overwrite
Stage 1 data. Docker repair requiring broader Windows access remains unresolved. The original
Docker Compose configuration and .env connection string remain unchanged.

After stopping any already-running demo instances, run in PowerShell from this directory:

```powershell
powershell -ExecutionPolicy Bypass -File .\Start-Demo.ps1
```

Keep that terminal open. The launcher installs locked dependencies, preserves existing TLS files,
seeds only the selected demo DB, builds the dashboard, starts services hidden, and stops its own
services on Ctrl+C. To use Docker MongoDB when available, pass
`-MongoUri mongodb://127.0.0.1:27018/aquasentra_stage7_demo`.
Do not run the launcher twice concurrently. Source changes require restarting services.

Sign in with `research-viewer` or `research-admin` and the corresponding token in `backend/.env`.
Never paste those tokens into documentation or commit them. In another terminal:

```powershell
python simulator/demo.py
python simulator/demo.py --fault no_ack
python simulator/demo.py --fault stuck
python simulator/demo.py --fault no_feedback
python simulator/demo.py --restore
```

Each scenario restores the virtual supply after a Normal reading and inspection acknowledgment,
waits for holdoff, then demonstrates confirmation and virtual isolation. The launcher uses built
preview because this sandbox denies esbuild development pre-bundling in ancestor directories.
On an unrestricted local machine the original Vite development workflow is also available.

## Implemented stages

| Stage | Implemented behavior |
|---|---|
| 1 | Preserved schema, authenticated HTTPS ingestion, invalid/duplicate handling and MongoDB storage |
| 2 | React PWA, configurable rule ratings, history charts, contact status and alerts; five-second polling |
| 3 | Trained XGBoost, FastAPI inference, stored scores/classes/versions; reproducible synthetic evaluation |
| 4 | Option A default / configurable B, persistence, bounded repeat confirmation, recovery, ordering and expiry |
| 5 | Durable virtual command journal, distinct acknowledgment/position states, restoration, holdoff and faults |
| 6 | Stored mock explanations and unavailable fallback; no connection from text to control |
| 7 | Automated unit/integration/browser checks, virtual-only ESP32 firmware, diagrams and panel script |

The firmware is a future transport starting point with synthetic readings, not calibrated physical
sensor drivers or a physical actuator implementation. No hardware was flashed or tested.

## Configuration and research validity

`backend/config/parameters.json` contains provisional Normal/Risky/Critical bands.
`backend/config/control.json` contains provisional counts, timings and option A/B.
Restart after edits and increment the configuration version. Prior readings retain their versions.
The original paper leaves several decisions open; the chosen defaults are documented in
[the architecture and decision table](docs/stage7-architecture.md).

Train/reproduce using `.venv\Scripts\python.exe ml/train.py`.
The generated CSV has 4,800 labeled synthetic rows, grouped into 300 episodes. Chronological
train/validation/test partitions contain 180/60/60 complete episodes. The final 960 test rows
are excluded from model and threshold selection. Current-only features use window length 1.
See [actual metrics](ml/artifacts/metrics.json) and [observed results](docs/observed-results.md).
Perfect synthetic scores are evidence of generator separability, not real-world validity.

## Tests

```powershell
cd backend
npm test
$env:PORT='8444'
npm run test:smoke
npm run test:stage2-smoke
cd ..
.venv\Scripts\python.exe -m unittest ml.test_ml -v
python -m unittest discover -s simulator -p 'test_*.py' -v
python simulator/demo.py --suite
cd frontend
npm run build
npx playwright install chromium
node browser-test.mjs
```

Run live suites sequentially because they use the same demo device. Browser tests use the built
preview at port 4173 and check desktop/mobile rendering, login, history, explanations, permissions,
credential storage and refresh behavior. If using a custom Playwright browser cache, set
`PLAYWRIGHT_BROWSERS_PATH` consistently for installation and execution.

Firmware compile: install PlatformIO, then `python -m platformio run -d firmware`.
Use `firmware/include/config.example.h` as the private configuration template. Virtual-only mode
is enforced at compile time and no GPIO output is enabled.

## Documentation

- [Observed test results and limitations](docs/observed-results.md)
- [Architecture and decision-flow diagrams](docs/stage7-architecture.md)
- [Proposed wiring diagram and firmware scope](docs/wiring-plan.md)
- [Panel demonstration script](docs/panel-demonstration.md)
- [Model report](ml/artifacts/metrics.json)

Earlier stage documents are historical records, not the current implementation status.
The ZIP contains no .env, credentials, certificates, database data, dependencies or Stage 1 backup.
When merging source into an existing installation, preserve those local items and select the
intended MongoDB database explicitly. This is a single-process localhost demonstration, not a
production deployment; no multi-instance transaction guarantees, calibrated hardware, laboratory
validation, real-world ML validation, household user evaluation or certified safety claim is made.
