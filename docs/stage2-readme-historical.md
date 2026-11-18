# AquaSentra — Stage 2 Research Prototype

> **RESEARCH PROTOTYPE — NOT A CERTIFIED DRINKING-WATER SAFETY DEVICE.** All sensors and classification thresholds are provisional study-defined placeholders. A Normal result **does not establish potability**, and a Critical result is **not a laboratory determination that water is unsafe**. **No automated valve isolation or restore endpoint exists in Stage 2.** Do not connect this system to household valve hardware or depend on it for safety decisions.

## What Stage 2 adds

This project **extends the complete Stage 1 monorepo**, rather than replacing the sensor pipeline:

- **Python virtual ESP32** sends simulated pH, turbidity, TDS and temperature readings.
- **HTTPS Express.js API** authenticates the device, validates and stores every parseable reading in MongoDB; duplicate/invalid/delayed logic is retained from Stage 1.
- **Provisional rule-rating engine** runs **only after storage and only for valid readings**; stores overall and per-indicator `Normal` / `Risky` / `Critical`, and `rule_parameter_set_version`.
- **Alert journal** logs Risky/Critical alerts for valid **live-eligible** readings and sensor/record-fault notices for invalid records. Invalid and delayed records never create live rating alerts. Duplicate-only records are flagged, not mislabeled as sensor faults.
- **React PWA** has login, responsive overview, device contact status, data-quality indicators, history chart, event log, and read-only research parameter register. It distinguishes rule rating from future ML status and displays valve/flow as not implemented/unknown.
- **Historic Stage 1 readings** can be rated with a safe, idempotent backfill script that **does not issue retrospective live alerts**.

## Repository

```text
AquaSentra/
├── backend/
│   ├── config/              # JSON record schema and provisional parameter set
│   ├── src/                 # HTTPS API, Mongoose models, services, device/user auth
│   ├── scripts/             # Seed, certificates, Stage 1/2 smoke tests, backfill
│   ├── tests/               # 42 pure Node unit tests
│   └── .env.example         # Fake placeholders; your real .env stays LOCAL
├── frontend/
│   ├── src/                 # React components, charts, live API integration
│   ├── public/              # PWA manifest, install icons, offline shell service worker
│   └── vite.config.js       # Loopback-only development HTTPS API proxy
├── simulator/               # Original Python virtual ESP32, scenarios and tests
├── firmware/                # Stage 7 reserved
├── ml/                      # Stage 3 reserved
├── docs/                    # Architecture and acceptance criteria
└── docker-compose.yml       # MongoDB 7 on Windows port 27018 (avoids user's 27017 conflict)
```

## 1. Upgrade the existing Stage 1 installation on Windows

**Keep your existing `backend/.env`, `backend/certs/`, Docker volumes and MongoDB data.** The distributed ZIP contains **no** secret .env or local certificates and does not contain database data. Do **not** run `docker compose down -v` (that removes the database volume).

1. Stop your current Stage 1 Node.js server using `Ctrl+C` in the PowerShell window running `npm start`.
2. Back up your existing `AquaSentra` folder if you want rollback. Keep Docker Desktop running.
3. Extract the `AquaSentra` folder from `AquaSentra_Stage2_Prototype.zip` into:
   `C:\Users\Nekorare\Documents\Capstone\prototype\`
   and **merge / overwrite matching source files** in your existing `AquaSentra` directory. Avoid creating `AquaSentra\AquaSentra`.
4. Your original `backend/.env` retains `MONGODB_URI=mongodb://127.0.0.1:27018/aquasentra`. **Do not replace it with the placeholder `.env.example`**. Keep your existing local HTTPS certificate files. The included `docker-compose.yml` already maps `127.0.0.1:27018:27017` to avoid the installed Windows MongoDB service's port 27017.
5. If you used the demo credentials previously posted in chat, rotate to fresh random secrets for each account and run `npm run seed` again after updating `.env`. **Never paste secret tokens into chat or commit `.env`**.

### Terminal A — MongoDB (from AquaSentra root)

```powershell
cd "C:\Users\Nekorare\Documents\Capstone\prototype\AquaSentra"
docker compose up -d
docker compose ps
```

### Terminal B — backend API (keep running)

```powershell
cd "C:\Users\Nekorare\Documents\Capstone\prototype\AquaSentra\backend"
npm install
npm run backfill:ratings
npm test
npm start
```

The **backfill runs before starting the new API**, rates existing Stage 1 **valid** rows using the Stage 2 parameter version and does not alter originals' `measured_at` or create alerts for historical rows. Run once initially; it is safe to repeat because it ignores already rated rows. **Do not rerun it after changing thresholds without an explicit research reclassification plan.**

HTTPS health check (separate terminal):

```powershell
curl.exe -k https://127.0.0.1:8443/api/v1/health
```

Expected `"stage":2`, `"valve_automation_enabled":false`. `-k` skips self-signed certificate checks for **localhost development only**.

### Terminal C — React dashboard (keep running)

```powershell
cd "C:\Users\Nekorare\Documents\Capstone\prototype\AquaSentra\frontend"
npm install
npm run dev
```

Open **http://127.0.0.1:5173/** in Chrome or Edge. Sign in with:

- **User ID:** `research-viewer` (or your seeded viewer's ID)
- **Access token:** the real value of `BOOTSTRAP_VIEWER_TOKEN` in `backend/.env` (not the literal setting name)

The app stores credentials **in React memory for this tab session only**, not in browser localStorage, cookies or cached API responses. Refreshing the page requires signing in again. Vite's loopback-only proxy forwards `/api/v1/...` to the existing locally self-signed HTTPS backend. **Do not expose this prototype on a public network.** The browser-to-local-Vite portion is HTTP for localhost development, not a production security design.

### Terminal D — generate readings (keep C and B running)

```powershell
cd "C:\Users\Nekorare\Documents\Capstone\prototype\AquaSentra"
python simulator/simulator.py --scenario normal --count 5 --insecure-local
python simulator/simulator.py --scenario ph-spike --count 1 --insecure-local
python simulator/simulator.py --scenario high-tds --count 1 --insecure-local
python simulator/simulator.py --scenario out-of-range --count 1 --insecure-local
```

Refreshes occur every ~5 seconds when the tab is visible. An accelerated simulator sample does **not** represent one real minute of measured environment time. Older data can display in history; an out-of-tolerance delayed record cannot raise new live alerts.

## 2. Research classification — all values editable in one file

Edit `backend/config/parameters.json` and change `parameter_set_version` when revising any study-defined parameter. Restart the backend for changes to take effect. The rule engine rejects reversed/ambiguous ranges. Previously rated rows retain their original parameter-set version; **they are not silently reclassified**.

**These are demonstration values, not an endorsed drinking-water standard:**

| Measurement | Normal | Risky | Critical | Notes |
|---|---|---|---|---|
| pH | **6.5 to 8.5 inclusive** | **6.0 to <6.5** or **>8.5 to 9.0** | **<6.0** or **>9.0** | Normal range specified in research prompt; outer bounds provisional |
| Turbidity | **≤5 NTU** | **>5 to ≤10 NTU** | **>10 NTU** | Outer threshold provisional |
| TDS | **≤600 mg/L** | **>600 to ≤900 mg/L** | **>900 mg/L** | Outer threshold provisional |
| Temperature | *Not rated* | *Not rated* | *Not rated* | Provisional **15–35°C** operational reference only; excluded from overall rating |

The **overall rating is the most severe** of pH, turbidity and TDS. Sensor validity is separate: an invalid record cannot be given a rating, even if its numeric value looks Normal or Critical. A delayed-but-valid record receives a **historical rating** but cannot generate a live warning. Critical is immediate upon first valid live-eligible Critical reading; **no confirmation, model, valve, or control command occurs in Stage 2.**

Dashboard contact status uses `dashboard_offline_after_seconds:180` **only for the UI**. Stage 4's communication-fault counters/thresholds are still unset and not implemented; `offline` in the dashboard is not a valve authorization. Actual water-flow status is explicitly **unknown**.

## 3. Live API endpoints

| Path | Method | Authentication | Result |
|---|---|---|---|
| `/api/v1/health` | GET | Public | API stage/status; no water safety claim |
| `/api/v1/readings` | POST | Device ID and token headers | Store valid/invalid record, then rate/alert if eligible |
| `/api/v1/readings?limit=500&device_id=...&from=<ISO>&to=<ISO>` | GET | Viewer or admin | Historical records with ratings, validity, original timestamp |
| `/api/v1/devices` | GET | Viewer or admin | Only public device ID and last-seen timestamp |
| `/api/v1/dashboard?device_id=...` | GET | Viewer or admin | Latest valid live-eligible data, device recent-contact state, disabled future stages |
| `/api/v1/alerts?limit=500&device_id=...` | GET | Viewer or admin | Stored notices and critical/early warnings |
| `/api/v1/parameters` | GET | Viewer or admin | Read-only provisional configuration |

User authentication headers: `x-user-id` and `x-user-token`; simulator device headers: `x-device-id` and `x-device-token`. No secret tokens are returned. Backend uses salted scrypt hashes and records denied requests. UI has no valve command button and backend defines **no valve-control route**. Model class/score are returned as `null` with `not_implemented` status, never fabricated.

## 4. Run tests

```powershell
cd "C:\Users\Nekorare\Documents\Capstone\prototype\AquaSentra\backend"
npm test
npm run test:smoke
npm run test:stage2-smoke
```

Requires backend and MongoDB running for the two smoke commands. Stage 1 smoke checks remain supported. New Stage 2 smoke checks create a few local test records, including a Risky, Critical and invalid sample; they are **not** a calibrated device test.

The new test suite verifies inclusive boundaries, severity precedence, temperature exclusion, configurable thresholds, invalid/delayed exclusions, early warnings, first Critical notices and zero valve behavior. See `docs/stage2-acceptance.md`.

Python simulator unit tests (from root):

```powershell
python -m unittest discover -s simulator -p "test_*.py" -v
```

### Installable PWA build (optional)

In `frontend/`:

```powershell
npm run build
npm run preview
```

Visit **http://127.0.0.1:4173/**. The PWA manifest/icons and service worker can cache the frontend shell/assets after installation. **API data, credentials and water measurements are never cached by the service worker**; offline mode does not claim fresh sensor status. The built UI still requires the local Node.js backend and MongoDB. Vite preview's localhost proxy is for evaluation only, not public deployment.

## 5. Project stage boundaries

| Stage | Status |
|---|---|
| 1 — Sensor schema, simulator, HTTPS device auth and MongoDB ingest | **Preserved and tested** |
| 2 — Configurable provisional rule ratings, alert journal, React PWA | **Implemented in this ZIP** |
| 3 — XGBoost and FastAPI inference | **Not implemented** |
| 4 — Counters and repeat confirmation | **Not implemented** |
| 5 — Authorized isolation, relay acknowledgment and independent closure verification | **Not implemented** |
| 6 — AI explanation provider and fallback | **Not implemented** |
| 7 — Full safety tests, firmware, wiring and final documentation | **Not implemented** |

The result is a **research dashboard**, not a certified water safety solution. Nothing in Stage 2 energizes or de-energizes a real relay or solenoid valve.
