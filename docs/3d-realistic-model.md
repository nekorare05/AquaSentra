# AquaSentra — Detailed Component 3D Model (Replaces Blocky Version)

This drop-in add-on upgrades the 3D explorer with *actual shaped, visually recognizable reconstructions* of the proposed ESP32 WROOM-32 board, PH-4502C interface with E201 probe/BNC, SEN0189 conditioning board and slotted optical turbidity sensor, TDS Meter V1.0 board with two-electrode probe, DS18B20 stainless probe, blue Songle-style 5V relay, buck converter, 12V perforated power module, transparent water chamber, and normally closed solenoid valve.

**The deliverables are real 3D model files, not generated 2D pictures:**

- `frontend/public/models/aquasentra-device.glb` — textured and independently named mesh objects, designed for React Three Fiber and importable/editable in Blender.
- `cad/AquaSentra_Detailed_Assembly.step` — 167 separate mechanical B-rep CAD solids for SolidCraft or FreeCAD, preserving individual components but not native sketch history.
- `cad/build_realistic_model.py` — reproducible, procedural GLB geometry and texture generator.
- `cad/build_detailed_step.py` — reproducible CAD geometry generator.
- `cad/verify_realistic_model.py` — GLB geometry and interaction contract checks.

## Upgrade instructions on Windows

1. **Keep a backup** of the working `AquaSentra` folder. Shut down its demo launcher with Ctrl+C first.
2. Extract this ZIP into `C:\Users\Nekorare\Documents\Capstone\prototype\CompleteDemo`, merging its `AquaSentra` subfolder with the existing project. Overwrite only the files included in the add-on.
3. Do not modify or replace `backend/.env`, `backend/certs`, MongoDB, the Python environment, or the firmware.
4. From the main AquaSentra directory, run `powershell -ExecutionPolicy Bypass -File .\Start-Demo.ps1` as before.
5. Sign in at `http://127.0.0.1:4173` and open **3D device explorer**. Use Ctrl+F5 to refresh cached GLB files if you still see the old blocky model.
6. Click the PCB, sensor head, relay, or valve. The selection inspector still uses authenticated backend data; the 3D view does not make control decisions.

### Blender

Import the GLB through **File > Import > glTF 2.0 (.glb/.gltf)**. Objects have names such as `esp32:rf-shield`, `ph:bnc-socket` and `valve:plunger-visual` and can be selected and edited individually. Save your own `.blend` project after import. The model has texture-based PCB silkscreen, labels, and display bezel plus actual mesh geometry for connectors, probes, pins and fasteners.

### SolidCraft CAD

Import `cad/AquaSentra_Detailed_Assembly.step`. It contains 167 separate B-rep solids for mechanical refinement. These are not exact manufacturer-measured envelopes or a validated fluid/electrical assembly. STEP does not carry Blender PBR textures, PCB silkscreen images, or React application behavior; use GLB for the visually detailed interactive webpage.

## Functional simulation

- Real sensor values are drawn onto the visible 3D display by a browser-side CanvasTexture from the existing authenticated AquaSentra dashboard state. Unknown/stale readings are shown as unavailable.
- The existing 3D inspector continues to show the backend's rule rating and ML scores separately.
- The virtual valve's `valve:plunger-visual` mesh name is preserved for the existing verified-state animation.
- Water-flow animation continues to require an independently **verified open** state with simulated supply open and device online. A command or relay acknowledgment alone is never proof of physical valve position.
- 3D elements are a read-only visualization; control remains authorized in the existing backend.

## Limits and sourcing

**These are visually informed reconstructions rather than exact OEM CAD geometry.** Some values, connectors, mounts, and dimensions are illustrative. Real sensor boards vary across suppliers and revisions. This model is *not* a validated build/wiring schematic or proof of sensor performance, leak-tightness, waterproofing, safe AC mains wiring, relay coil operation, or valve reliability. No physical components were tested. For manufacturing, replace visual parts with verified vendor STEP/PCB files and design mounting/waterproofing/electrical safety for the actual chosen hardware.

The PH-4502C BNC interface, DFRobot SEN0189 shape, and DFRobot TDS Meter form factors were referenced from public vendor documentation. This design includes no supplier-branded downloadable CAD assets.

## Validation

Run `python cad/verify_realistic_model.py` and `npm run test:3d` (from `frontend`). Regenerate with `python cad/build_realistic_model.py` (requires `trimesh`, `numpy`, `Pillow`) or `python cad/build_detailed_step.py` (requires `cadquery`). The GLB was validated as 148 named meshes and about 42,000 triangles, and the STEP was re-imported as 167 separate solids.
