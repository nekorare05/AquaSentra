# AquaSentra 3D hardware explorer — interactive demonstration

## What is delivered

- `frontend/src/HardwareTwin.jsx`, `hardwareTwinState.js`, `hardwareTwin.css`: a new React Three Fiber **3D device explorer** page, linked from the existing dashboard.
- `frontend/public/models/aquasentra-device.glb`: 81 named CAD-derived solids (compressed GLB; component-picking names).
- `cad/AquaSentra_Concept_Assembly.step`: SolidCraft-compatible STEP B-rep conceptual mechanical assembly.
- `cad/build_assembly.py`: the parametric source used to generate both the STEP and GLB with CadQuery + trimesh.
- `cad/assembly-parts.json`: node and part registry.
- `frontend/tests/hardwareTwin.test.mjs`: read-only state, valve verification and component routing tests.

## Hardware reference concept (not measured component fit)

Approximate external base: **400 × 240 × 12 mm**, clear back enclosure height ~230 mm, water chamber external **252 × 77 × 81 mm**. These are **study-defined drawing dimensions**, not verified OEM sensor dimensions. Solenoid valve, relay, power protection, probe sealing, materials, current ratings and electronics clearances **must be specified and checked** before fabrication. No physical water is monitored.

Part groups: base, acrylic frame, 12 V supply / buck converter, ESP32, pH, turbidity, TDS, temperature, clear flow chamber and inlet/outlet tubes, miniature display, relay module, normally closed solenoid valve, LEDs and conceptual wiring. The 81 solids are separately named.

## Open in SolidCraft

1. Download or open SolidCraft from https://solidcraft.io/.
2. Use **File → Import** to load `cad/AquaSentra_Concept_Assembly.step` (STEP).
3. Inspect solids and their positions; measure the assembly in millimetres.
4. To modify the design with **native** sketches and feature-history, reconstruct the desired bodies in SolidCraft using the STEP as a geometric reference; the STEP import alone does **not** reconstruct the original parametric CAD history.
5. For future iteration, the source of this concept model is `cad/build_assembly.py`, which defines parts in millimetres and exports the same geometry to the browser as GLB. Run it with `cadquery`, `trimesh` and `numpy` installed, if desired.

This deliverable is a STEP CAD assembly intended for SolidCraft import, **not a native SolidCraft `.sc` document**. Browser GLB cannot be substituted for editable parametric features.

## Run in your existing AquaSentra demo

- Stop the current `Start-Demo.ps1` with Ctrl+C.
- Make a **backup** of your current complete prototype; extract the enhanced monorepo into a separate directory (do not overwrite `.env` or real key files).
- Copy your existing `backend/.env` and `backend/certs/` directory into the new copy.
- Run `powershell -ExecutionPolicy Bypass -File .\Start-Demo.ps1` from the new root. It uses the same MongoDB and XGBoost services and installs the new frontend 3D dependencies with `npm install`.
- Log in with the existing viewer token. Select **3D device explorer** in the sidebar.
- Run `python simulator/demo.py` from another terminal to exercise sensor and virtual valve state.
- Click a probe or its button to inspect live *simulated* values, use mouse drag / wheel to orbit / zoom, press Explode or Guided tour to explain components.
- Verify `npm run test:3d` in `frontend`.

## Functional behavior and safety boundaries

This page reads the pre-existing authenticated `/api/v1/dashboard` response that the Overview page already fetches (five-second polling). It **does not create or call valve action endpoints**. The `HardwareTwin` component receives `summary` as a prop; no additional device credentials or tokens are stored. It never writes to MongoDB.

- pH / turbidity / TDS / temperature cards show the last valid live-eligible reading. Offline or stale values are labeled.
- Rule rating and ML class are displayed **separately**. Turbidity adds an illustrative water haze, not a physical cloudiness measurement.
- The ESP32 beacon reflects last device contact. Relay beacon reflects virtual acknowledgment only.
- Water-flow particles animate **only** when `valve.verified === 'open'` AND `valve.supply_status === 'simulated_open'`, no fault and device online. Commands and relay acknowledgments **never** imply proven flow.
- Independently simulated verified closure is displayed as *verified isolated (simulated)*; no actual independent physical indicator exists.
- Faults, pending confirmations and isolation status come from the unchanged Stage 1–7 backend state.
- Valve plunger animation occurs only from **verified simulated position**, not from command or acknowledgment.

**Do not infer potability, physical device safety, actual water flow, waterproofing, electrical conformity, or reliable physical fail-closed behavior from this visualization.**

## CAD versus live UI

The solid bodies are imported from STEP-compatible generated CAD. The screen widgets, glowing status indicators, turbidity haze, and flow animation are React Three Fiber presentation overlays: they are *not* fabricated circuits, instruments or measured water behavior.
