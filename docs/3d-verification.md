# 3D extension verification (2026-11-18)

## Checks actually performed here

- `cad/build_assembly.py` ran with CadQuery 2.8 and trimesh, producing the STEP and GLB assets.
- STEP re-import into CadQuery succeeded: **81 solids**.
- GLB re-import into trimesh succeeded: **81 named geometries**, non-empty bounding volume.
- React `App.jsx`, `HardwareTwin.jsx`, and `ResearchPanel.jsx` were parsed with the installed TypeScript JSX parser (no syntax errors).
- `node --test frontend/tests/hardwareTwin.test.mjs` completed: **9 / 9 passed**. Tests cover no inferred flow from command or acknowledgment, verified virtual open vs closed, faults, offline handling, reading values, and model/rule separation.
- Existing simulator tests were rerun: **6 / 6 passed**. Existing ML tests were rerun: **8 / 8 passed**.
- Source comparison against uploaded Complete Prototype ZIP confirmed existing `backend/src`, `ml`, `simulator` and `firmware` source bytes are unchanged. No existing backend endpoint was edited.

## Not verified here

- **Full Vite production build and interactive browser testing.** The environment could not download npm packages for the new React Three Fiber dependencies. The Windows launcher uses `npm install` for the frontend to update the lockfile and download the new modules. Run `npm run build`, `npm run test:3d`, and browser tests on Windows.
- **Native SolidCraft editing.** The supplied STEP model was generated via CadQuery and re-imported with CadQuery; SolidCraft import has not been tested inside this runtime. STEP imports as B-rep solid geometry, not editable native sketch history.
- **Real-world hardware function, material suitability or fluid/electrical safety.** Entire prototype remains software simulation.

## Important design behavior

The new 3D viewer is a *read-only projection* of existing `/api/v1/dashboard` state. It never sends POST control commands, never estimates actual flow, and shows animated flow only after `verified === 'open'` **and** the backend's supply status equals `simulated_open` with a healthy, online device. A relay acknowledgment alone never changes the depicted water-flow state.
