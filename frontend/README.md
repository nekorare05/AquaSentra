# AquaSentra React PWA — Stage 2

This is a real React 18 + Vite + Recharts frontend using the Stage 2 authenticated HTTPS API via a local-only Vite proxy. It contains no synthetic UI readings: it displays MongoDB data coming from the Python sensor simulator.

## Run on Windows

Keep MongoDB and the Stage 2 backend (`npm start`) running, then:

```powershell
cd "C:\Users\Nekorare\Documents\Capstone\prototype\AquaSentra\frontend"
npm install
npm run dev
```

Visit http://127.0.0.1:5173. Log in as `research-viewer` with the **actual** `BOOTSTRAP_VIEWER_TOKEN` from your existing local `backend/.env`. This token is held in tab memory only, never embedded in JavaScript or saved to localStorage. Refreshing requires reentry.

For PWA installation and frontend shell caching, run `npm run build` and `npm run preview`, then open http://127.0.0.1:4173. API responses and tokens are not cached. This is a research localhost design, **not** a production authentication system.

## Screens

- **Overview:** last valid live-eligible measurement, provisional rule rating, per-sensor values, live data chart, contact recency, system status and recent alerts.
- **Reading history:** valid/invalid/delayed data, parameter chart and time-range filters.
- **Alerts & events:** saved early warnings, first Critical alerts and invalid-record fault notices. No valve events in this stage.
- **Parameters:** read-only study-defined limits and parameter version (edit `backend/config/parameters.json` with deliberate review and audit outside the UI).

ML and valve statuses are explicitly `not_implemented`. The UI reports flow as `unknown`, never equates a relay acknowledgment to confirmed closure. Both dashboard and docs carry the **research prototype, not certified drinking-water safety device** disclaimer.
