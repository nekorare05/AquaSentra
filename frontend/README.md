# AquaSentra React PWA — Stage 2

This is a React 18 + Vite + Recharts + React Three Fiber frontend using the existing Stages 1–7 authenticated HTTPS API via a local-only Vite proxy. It contains no synthetic UI readings: it displays MongoDB data coming from the Python sensor simulator.

## Run on Windows

Keep MongoDB and the Stage 2 backend (`npm start`) running, then:

```powershell
cd "C:\Users\Nekorare\Documents\Capstone\prototype\AquaSentra\frontend"
npm install
npm run dev
```

Visit http://127.0.0.1:5173. Log in as `research-viewer` with the **actual** `BOOTSTRAP_VIEWER_TOKEN` from your existing local `backend/.env`. This token is held in tab memory only, never embedded in JavaScript or saved to localStorage. Refreshing requires reentry.

For PWA installation and frontend shell caching, run `npm run build` and `npm run preview`, then open http://127.0.0.1:4173. API responses and tokens are not cached. This is a research localhost design, **not** a production authentication system.

## Interactive 3D digital twin (Stage 8 demonstration extension)

Select **3D device explorer** in the sidebar to see the SolidCraft-compatible CAD assembly imported as a GLB. The interface lets users orbit, zoom, inspect every sensor, show an exploded view, and use a guided tour. It only reads the existing `GET /api/v1/dashboard` response. It does **not** call any control API or change existing Stage 1–7 code.

The model responds to: latest valid pH/turbidity/TDS/temperature, online/offline state, ML status, persistence/confirmation, virtual valve command/acknowledgment/**independent simulated verification** and faults. Animated flow appears only after a virtual **verified open**, never after mere command or acknowledgment.

Install/refresh frontend dependencies with `npm install`, then run `npm run dev` or `npm run build && npm run preview`. Run `npm run test:3d` for digital-twin state tests. The source CAD (Python) and STEP assembly are under `../cad/`; see `../docs/3d-device.md`. No physical hardware has been tested.

## Screens

- **Overview:** last valid live-eligible measurement, provisional rule rating, per-sensor values, live data chart, contact recency, system status and recent alerts.
- **Reading history:** valid/invalid/delayed data, parameter chart and time-range filters.
- **Alerts & events:** saved early warnings, first Critical alerts and invalid-record fault notices. No valve events in this stage.
- **Parameters:** read-only study-defined limits and parameter version (edit `backend/config/parameters.json` with deliberate review and audit outside the UI).

The Stages 1–7 code provides simulated ML and valve statuses. The UI never equates a relay acknowledgment to confirmed closure. Both dashboard and docs carry the **research prototype, not certified drinking-water safety device** disclaimer.
