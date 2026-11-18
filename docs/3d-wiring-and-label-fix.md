# AquaSentra 3D device — label and wiring corrections

This patch replaces the previous visually confusing 3D assembly in the **read-only** hardware explorer. It does **not** change Stage 1–7 backend control, ML inference, simulator, authentication, or the virtual fail-closed isolation logic.

## Fixed defects

1. **Mirrored/upside-down labels**: the old glTF raster/UV mapping was inverted. The GLB now displays its ESP32, PCB, valve, status-display and AquaSentra nameplate decals in the correct upright, left-to-right orientation when viewed from the front. Back-facing decal surfaces are no longer rendered, preventing mirrored lettering when orbiting around the enclosure. The browser's live status screen is also front-facing only.
2. **Arbitrary wiring**: removed the decorative lead arcs. The new `cad/visual_netlist.py` and `cad/proposed-netlist.json` define 33 connections with named sources and destinations. Colored wires terminate at geometrically modeled terminal positions. The STEP assembly is generated using the same connections.
3. **Missing signal-conditioning elements**: visible pH and turbidity analog scaling boards, an illustrative 4.7 kΩ DS18B20 pull-up, a separate 12 V valve fuse, and independent-valve-position feedback switch were added to the model.
4. **Wiring clutter**: the 3D explorer now has a Wiring selector: **GPIO signals**, **Power and grounds**, **Sensor probe cables**, **All connections**, or **Hide wiring**. A panel lists the source and destination of each displayed connection. GPIO signals is the default view.

## Proposed electrical signal allocation

| Signal or load | Proposed route | Model condition |
|---|---|---|
| pH (PH-4502C analog PO) | Sensor output → voltage scaler → ESP32 **GPIO34 / ADC1** | Scaling ratio, ground noise, sensor module voltage, calibration and suitable ADC range must be confirmed |
| Turbidity (SEN0189 analog) | Output → voltage scaler → ESP32 **GPIO35 / ADC1** | DFRobot specifies a 0–4.5 V analog output, which cannot be connected unscaled to a 3.3 V ESP32 ADC |
| TDS Meter V1.0 | Analog output → ESP32 **GPIO32 / ADC1** | Assumes the selected TDS board's output stays within its documented range; verify the exact module and ADC input |
| DS18B20 | DQ → ESP32 **GPIO4**, 4.7 kΩ pull-up to 3.3 V | No hardware test; choose a compatible probe and confirm any built-in pull-up |
| Relay module input | ESP32 **GPIO26** → **relay IN** | Relay coil supplied separately at 5 V. Input polarity and 3.3 V logic compatibility need verification |
| Independent valve position feedback | Switch output → ESP32 **GPIO27** | Concept only; GPIO27 input bias, debouncing and mechanical independence require design work |
| Normally closed solenoid | Fused +12 V → relay **COM** → relay **NO** → valve coil +12 V; coil return → supply return | External supply; no GPIO drives 12 V load; fuse/suppression/contact ratings must be checked |

**The pin locations within the 3D ESP32 DevKit are illustrative for a selected DevKit 38-pin layout.** Many ESP32-WROOM-32 development boards use different header counts and sequences. Reconcile each physical header to your *specific purchased board* and its silkscreen before wiring real hardware. Color is visual identification, not a substitute for cable testing. AC mains wiring is **not modeled** or approved.

**A safety-critical distinction:** this model is not a vetted physical wiring schematic. It is a proposed *pin-level digital twin*. Real hardware requires electrical review, calibration, isolation, fuse and suppression design, protected ADC inputs, and independently testable valve closure. Existing software virtual verification is not evidence of physical actuation.

## Grounding and sources

- Espressif ESP32 DevKitC headers: https://documentation.espressif.com/api/resource/path/docs/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html
- DFRobot SEN0189 turbidity sensor analog 0–4.5 V / 5 V power: https://wiki.dfrobot.com/sen0189
- DFRobot SEN0244/TDS V1.0 analog output 0–2.3 V, 3.3–5.5 V power: https://wiki.dfrobot.com/sen0244
- ESP32 family analog ADC1 GPIOs: https://documentation.espressif.com/esp32-wroom-32_datasheet_en.html
- Local capstone firmware's planned pin mapping: `docs/wiring-plan.md` in the recovered Stages 1–7 archive.

## Installing into the existing project

1. Stop `Start-Demo.ps1` with Ctrl+C and back up your `CompleteDemo/AquaSentra` directory.
2. Extract the contents of `AquaSentra_3D_Wiring_Fix.zip` into `C:\Users\Nekorare\Documents\Capstone\prototype\CompleteDemo` (merge the nested `AquaSentra` folder). Keep existing `.env`, TLS keys, and MongoDB data.
3. Restart `Start-Demo.ps1`. Open the dashboard at http://127.0.0.1:4173, choose **3D device explorer**, press **Ctrl+F5**.
4. Switch wiring categories in the viewer toolbar. The updated GLB can also be opened in Blender; its STEP equivalent can be imported into SolidCraft/FreeCAD.

## Verification and limitations

- `python cad/verify_realistic_model.py` checks all 33 named connections and required GLB components.
- `node --test frontend/tests/hardwareTwin.test.mjs frontend/tests/wiringNetlist.test.mjs` checks viewer state safety and netlist properties.
- Label direction was inspected in an actual offscreen GLB render. The GLB and STEP were regenerated successfully.
- The complete Vite/React production build and live Windows browser behavior have **not** been rerun in this tool environment; verify on your Windows laptop after installation.
- This is an **illustrative software simulator** with visual electrical connections; the physical prototype still requires purchased components and a separately approved wiring design.
