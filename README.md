# AquaSentra — Separate Web Dashboard & Standalone 3D Laboratory

Research demonstration prototype. Physical sensors, relay, normally closed solenoid valve, and independent position feedback switch are simulated. A Normal rating does not certify water potability. No physical valve control transport exists.

---

## 1. System Architecture Overview

The AquaSentra Stages 1–7 prototype is refactored into **two independent frontend applications sharing the existing backend infrastructure**:

```
                       ┌──────────────────────────────────────────────┐
                       │           SHARED BACKEND SERVICES            │
                       ├──────────────────────────────────────────────┤
                       │  • Node.js / Express HTTPS API (Port 8444)   │
                       │  • Python FastAPI / XGBoost (Port 8001)      │
                       │  • MongoDB Database (Port 27017)             │
                       │  • Sensor Simulator & Virtual Actuators      │
                       └──────────────────────┬───────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
┌────────────────────────────────────────┐ ┌────────────────────────────────────────┐
│     MAIN AQUASENTRA WEB DASHBOARD      │ │        STANDALONE AQUASENTRA 3D LAB    │
│              (/frontend)               │ │              (/device-lab)             │
├────────────────────────────────────────┤ ├────────────────────────────────────────┤
│ • Port: http://127.0.0.1:4173 (preview)│ │ • Port: http://127.0.0.1:4174 (preview)│
│ • Port: http://127.0.0.1:5173 (dev)    │ │ • Port: http://127.0.0.1:5174 (dev)    │
│ • Professional household water monitor │ │ • React Three Fiber & Three.js 3D app  │
│ • Clean white & slate design (no glow) │ │ • Three core pages:                    │
│ • 6 Dedicated Pages:                   │ │   1. Complete Device (exploded view,   │
│   1. Overview                          │ │      wiring filters, enclosure toggle) │
│   2. Readings & History (charts/table) │ │   2. IoT Operation Simulation (10 steps│
│   3. Alerts & Events (filters/records) │ │      with 7 scenarios & 3D sync)       │
│   4. Detection (XGBoost/persistence/AI)│ │   3. Component Library (9 individual   │
│   5. Valve Control (journal/admin)     │ │      standalone 3D component models)   │
│   6. Parameters & Settings             │ │ • 33 Netlist connections documented    │
│ • Simple external link to 3D Lab       │ │ • Simple return link to Main Dashboard │
└────────────────────────────────────────┘ └────────────────────────────────────────┘
```

Both frontend applications communicate with the same backend without duplicating control logic or creating conflicting system states.

---

## 2. Local Access Endpoints

| Application / Service | Local URL | Role |
|---|---|---|
| **Main Web Dashboard** | `http://127.0.0.1:4173` | Household water-quality monitoring dashboard (6 pages) |
| **Standalone 3D Lab** | `http://127.0.0.1:4174` | Interactive 3D hardware assembly, guided IoT simulation, and 9-component gallery |
| **Node.js HTTPS API** | `https://127.0.0.1:8444/api/v1/health` | Authenticated ingestion, validation, rule evaluation, control journal |
| **FastAPI ML Service** | `http://127.0.0.1:8001/health` | Trained XGBoost supervised anomaly inference (`model.ubj`) |
| **MongoDB Service** | `mongodb://127.0.0.1:27017/aquasentra_stage7_demo` | Durable database for readings, alerts, control events |

---

## 3. Running the Applications

### Launch Everything Together (Default)
Run from the root `AquaSentra` directory in PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File .\Start-Demo.ps1
```
This launcher automatically seeds the database, builds both frontend applications, starts FastAPI, starts the Node.js HTTPS API, and opens both web applications on ports 4173 and 4174.

### Launch Applications Separately
You can launch components independently using the `-App` parameter:
```powershell
# Launch only the Main Web Dashboard + Backend:
powershell -ExecutionPolicy Bypass -File .\Start-Demo.ps1 -App frontend

# Launch only the Standalone 3D Lab + Backend:
powershell -ExecutionPolicy Bypass -File .\Start-Demo.ps1 -App device-lab

# Launch only Backend services (FastAPI + Node.js API):
powershell -ExecutionPolicy Bypass -File .\Start-Demo.ps1 -App backend
```

Press `Ctrl+C` in the terminal to stop services started by the launcher.

---

## 4. Application 1: Main AquaSentra Web Application (`/frontend`)

The dashboard features a clean, professional household water-quality monitoring design with white and slate gray surfaces and restrained blue/teal accents.

### Six Main Pages:
1. **Overview**:
   - Real-time telemetry cards for **pH**, **turbidity (NTU)**, **TDS (mg/L)**, and **temperature (°C)**.
   - Classification card showing the overall rule rating (**Normal**, **Risky**, **Critical**) with safety disclaimers.
   - Connected sensor device status, last contact timestamp, and parameter set version.
   - Interactive time-series trend preview chart.
   - System health summary (Telemetry Acquisition, Rules Engine, XGBoost Inference, Virtual Valve Isolation, Fluid Flow).
   - Recent alerts and data quality statistics.
   - Integrated quick simulation control panel for automated test verification.
2. **Readings and History**:
   - Full-width interactive chart with provisional reference guide overlays.
   - Time-range selector (All available, Past 24 hours, Past 7 days).
   - Metric selector (pH, Turbidity, TDS, Temperature).
   - "Warnings / faults only" filter checkbox.
   - Tabular historical records with raw sensor values, timestamps, rating pills, and record validity badges (`Valid`, `Invalid: CODES`, `Delayed`).
3. **Alerts**:
   - Severity counters for Critical alerts, Early warnings, and Sensor faults.
   - Filter dropdown (All alert types, Critical, Early warning, Sensor fault).
   - Detailed event journal with timestamps, device ID, alert title, message, and guidance.
4. **Detection**:
   - Real-time XGBoost inference details: Status, Prediction Class, Anomaly Decision Score, Threshold (0.50), format (`model.ubj`), and synthetic training disclosure.
   - Persistence & Confirmation counters: ML consecutive anomaly counter ($K$), Critical counter, and repeat confirmation status ($C$).
   - Secondary AI Explanations panel: Informational text generator with "Explain current state" (mock provider) and "Demonstrate AI fallback" buttons. Explanations cannot modify control or detection decisions.
5. **Valve Control**:
   - Virtual Valve State: Commanded state, Acknowledged state, Simulated verified state, Fault status, Virtual supply status.
   - Critical safety notices: Software simulation only; relay acknowledgment is strictly separated from verified mechanical closure.
   - Administrator simulation controls: Physical inspection checkbox, "Restore virtual supply" action, and fault injection triggers (`none`, `no_ack`, `stuck`, `no_feedback`, `power_loss`).
   - Control Event Journal: Auditable log of commands, acknowledgments, faults, and restorations.
6. **Settings**:
   - Active Parameter Set version and read-only status chip.
   - Reference limits for pH (Normal 6.5–8.5, Risky outer bounds 6.0–9.0, Critical beyond Risky).
   - Reference limits for Turbidity (Normal ≤5.0 NTU, Risky ≤10.0 NTU, Critical >10.0 NTU).
   - Reference limits for TDS (Normal ≤600 mg/L, Risky ≤900 mg/L, Critical >900 mg/L).
   - Operational parameters (Temperature range 15–35 °C, Offline timeout 30s, Sampling interval 10s).
   - Active user session details and token storage security disclaimer (in tab memory only).

### External Navigation to 3D Lab:
The embedded 3D explorer has been removed from the main dashboard navigation. Instead, a dedicated external link in the sidebar directly opens the **Standalone AquaSentra 3D Lab** in a new browser tab.

---

## 5. Application 2: Standalone AquaSentra 3D Lab (`/device-lab`)

A standalone React + Vite application utilizing **React Three Fiber** and **Three.js** to deliver interactive 3D inspection and operational simulation.

### Three Main Pages:

### Page 1: Complete Device
- **Interactive 3D Assembly**: Fully assembled AquaSentra digital twin loaded from `aquasentra-device.glb`. Orbit controls support 360° rotation, panning, and zooming.
- **Click-to-Inspect**: Clicking any mesh highlights the part and opens the inspector drawer displaying component identity, operating voltage, role, purpose, and proposed pin connections.
- **Exploded Assembly View**: Smoothly offsets components along their mechanical axes to expose internal modules.
- **Wiring Filter**:
  - `GPIO Signals & Bus`: Shows signal leads connected to ESP32 ADC and digital GPIOs.
  - `Power & DC Ground Rails`: Shows 12V supply bus, 5V regulated rail, and common DC ground.
  - `Sensor Probe Cables`: Shows shielded probe leads to conditioning modules.
  - `All 33 Net Connections`: Displays the full wiring harness.
  - `Hide All Wiring`: Hides wire leads for clean mechanical inspection.
- **Enclosure Toggle**: Shows or hides transparent acrylic guards and panels.
- **Proposed Wiring Documentation Modal**: Features the complete 33-connection netlist table from `modelConnections.json`, the ESP32 pin allocation chart, and voltage scaling disclaimers.

### Page 2: IoT Operation Simulation
A guided, interactive 10-step demonstration illustrating the end-to-end operation of AquaSentra:
1. Virtual sensors collect water-quality readings (pH, turbidity, TDS, temperature).
2. ESP32 packages telemetry into JSON and dispatches over simulated Wi-Fi (HTTPS POST).
3. Backend validates schema, checks freshness, and stores canonical records in MongoDB.
4. Rule-based classification evaluates readings against provisional reference ranges.
5. Trained XGBoost model calculates anomaly probability score.
6. Persistence counters track repeated abnormalities over consecutive cycles ($K$ counter).
7. System issues bounded repeat confirmation request ($C$) for a fresh reading.
8. If authorized under Option A logic, virtual relay de-energizes fail-safe coil.
9. Acknowledgment and independent simulated verification are shown separately.
10. Web dashboard updates live metrics, incident alarms, and auditable control journal.

**Supported Scenarios**:
- `Normal Household Operation`: Steady clean water, valve verified open, continuous flow animation.
- `Risky / Degraded Water`: Elevated turbidity (6.85 NTU), early warning logged, valve remains open.
- `Critical Anomaly & Virtual Isolation`: Severe contamination (pH 11.45, TDS 980 mg/L), persistence triggered, confirmation verified, valve verified closed, water flow halts.
- `Valve Fault: No Acknowledgment (no_ack)`: Relay fails to respond, fault logged, valve remains unverified.
- `Valve Fault: Mechanical Stuck Valve (stuck)`: Relay acknowledges command, but limit switch reports valve plunger remains stuck open. Falsely marking verified closed is strictly prevented.
- `Valve Fault: Switch Feedback Timeout (no_feedback)`: Limit switch fails to signal before timeout expires.
- `Recovery & Authorized Supply Restoration`: Telemetry returns to Normal, certified administrator signs off, virtual restore commanded, holdoff observed, clean flow resumes.

### Page 3: Component Library
Showcases all **9 hardware components individually in isolated 3D views**, rather than a combined assembly:
1. **ESP32 DevKit V1 / ESP32-WROOM-32**: Dual-core MCU, Wi-Fi/BLE, ADC1 channels, GPIO assignments.
2. **PH-4502C Sensor Module & E201 Electrode**: Combination glass bulb probe, BNC interface, analog scaling.
3. **SEN0189 Turbidity Sensor & Fork Probe**: Optical infrared transmittance sensor, inverted response curve.
4. **TDS Meter V1.0 & Titanium Probe**: AC excitation conductivity probe, dual titanium pins.
5. **DS18B20 Waterproof Stainless Probe**: Digital 1-Wire temperature capsule, mandatory 4.7 kΩ pull-up.
6. **5 V Single-Channel Relay Module**: Blue Songle SRD-05VDC-SL-C relay, optocoupler isolation.
7. **12 V Normally Closed Solenoid Valve**: Brass valve body, fail-closed spring, position limit switch.
8. **12 V Power Supply & DC-DC Buck Converter**: Ventilated aluminum PSU, LM2596 buck converter, 2A fuse.
9. **Inline Water Flow Chamber & Frame**: CNC acrylic test manifold, probe ports, tubing, clamps.

Each component detail card provides:
- Component name, category, and operating voltage.
- Component purpose and role in AquaSentra.
- Proposed wiring connections and pin assignments.
- Technical specifications table.
- Approximate model notes and unverified electrical assumptions.

---

## 6. Panel Demonstration Guide

Follow this sequence to demonstrate the separated applications:

### Step 1: Start Services
```powershell
powershell -ExecutionPolicy Bypass -File .\Start-Demo.ps1
```
Open both URLs in your browser:
- Main Dashboard: `http://127.0.0.1:4173`
- Standalone 3D Lab: `http://127.0.0.1:4174`

### Step 2: Sign in to Main Dashboard
1. Log in with `research-viewer` and the viewer access token from `backend/.env`.
2. Observe the Overview page: pH, turbidity, TDS, temperature, and Normal classification.
3. Note the sidebar navigation: Verify that the 3D explorer is no longer embedded in the menu. Click the **AquaSentra 3D Lab ↗** external link card to open the 3D Lab.
4. Browse through **Readings & History**, **Alerts**, **Detection**, **Valve Control**, and **Settings**.

### Step 3: Explore Standalone 3D Lab
1. Go to **1. Complete Device**:
   - Orbit around the 3D model (left-click + drag), pan (right-click), and zoom (scroll).
   - Click the **Exploded View** button to separate internal modules.
   - Switch wiring filters: `GPIO Signals`, `Power Rails`, `Probe Leads`, `All Wires`, `Hide Wiring`.
   - Click the **Wiring Netlist Docs** button to review the 33 mapped connections.
   - Click components in 3D (e.g. the blue relay or brass valve) to view details in the inspector drawer.
2. Go to **2. IoT Operation Simulation**:
   - Select the `Critical Anomaly & Virtual Isolation` scenario.
   - Click **Next** through steps 1 to 10 to demonstrate the full sequence from sensing, Wi-Fi dispatch, rule evaluation, XGBoost inference, persistence counting, confirmation request, relay actuation, to verified closure.
   - Switch to the `Valve Fault: Mechanical Stuck Valve (stuck)` scenario to demonstrate that an acknowledged electrical command is **never** falsely depicted as verified closure.
3. Go to **3. Component Library**:
   - Click through all 9 individual components in the sidebar.
   - Observe each standalone 3D model rendered in isolation with orbit controls.
   - Review the required voltages (3.3V, 5V, 12V), proposed pin routes, and unverified assumptions.

### Step 4: Run Live Isolation Simulator
In a separate terminal, trigger live virtual isolation and fault scenarios against the running backend:
```powershell
# Standard isolation & restoration walkthrough:
python simulator/demo.py

# Relay fails to acknowledge:
python simulator/demo.py --fault no_ack

# Relay acknowledges, but valve plunger sticks open:
python simulator/demo.py --fault stuck

# Switch feedback fails to report before timeout:
python simulator/demo.py --fault no_feedback

# Authorized administrator restoration:
python simulator/demo.py --restore
```
Watch the state synchronize across both frontend applications in real time.

---

## 7. Verification & Automated Test Results

Run all test suites to verify system integrity:

```powershell
# 1. Backend tests (73 unit & integration tests)
cd backend
npm test

# 2. Python ML tests (8 test cases)
cd ..
.\.venv\Scripts\python.exe -m unittest ml.test_ml -v

# 3. Simulator tests (6 test cases)
.\.venv\Scripts\python.exe -m unittest discover -s simulator -p "test_*.py" -v

# 4. Frontend tests (9 3D state tests + 5 netlist tests)
cd frontend
npm run test:3d
node --test tests/wiringNetlist.test.mjs

# 5. Device Lab tests (7 component library & scenario tests)
cd ../device-lab
npm test

# 6. Complete End-to-End Playwright Browser & Simulation Suite
cd ..
powershell -ExecutionPolicy Bypass -File .\test-e2e.ps1
```

### Verified Test Summary:
- **Backend Tests**: 73 / 73 passed (0 failures).
- **ML Inference Tests**: 8 / 8 passed (0 failures).
- **Simulator Tests**: 6 / 6 passed (0 failures).
- **Frontend 3D State Tests**: 9 / 9 passed (0 failures).
- **Wiring Netlist Tests**: 5 / 5 passed (0 failures).
- **Device Lab Component & Simulation Tests**: 7 / 7 passed (0 failures).
- **End-to-End Browser Checks**: 29 / 29 checks passed (Main Dashboard desktop/mobile, permissions, AI explanations, navigation, 3D Lab assembly, IoT simulation, and 9 component library cards).
- **Live Simulator Integration Suite**: 12 / 12 checks passed (Virtual closure, invalid handling, fault injection, authorization barriers).

---

## 8. Research Prototype Limitations & Safety Disclaimers

1. **Software Simulation Only**: Physical sensors, relay coil contacts, 12 V solenoid valve, and limit switches are entirely simulated. No physical actuator is connected to mains water.
2. **Potability Disclaimer**: A Normal rule rating indicates only that simulated pH, turbidity, and TDS readings fall within provisional study reference bands. It does not certify drinking water potability.
3. **Electrical Wiring Caution**: The 3D wiring netlist represents proposed pin assignments for selected DevKit board layouts. Always verify voltage scaling (0–5V sensor outputs must not connect directly to 3.3V ESP32 ADC inputs) and pinouts on actual purchased hardware.
4. **Credential Security**: Access tokens are held exclusively in browser tab memory and cleared upon page reload. Never commit or share secrets from `backend/.env`.
