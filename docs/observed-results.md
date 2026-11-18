# Observed software results — 17 November 2026

This records actual execution on the local Windows environment, not proposed results.
No ESP32, physical sensors, relay, valve, water samples or household users were tested.

| Check | Observed result |
|---|---|
| Backend unit suite, including original Stage 1/2 | 73 passed, 0 failed |
| FastAPI/model tests | 8 passed |
| Original Python sensor simulator | 6 passed |
| Stage 1 HTTPS/MongoDB smoke | 5 passed |
| Stage 2 HTTPS/MongoDB smoke, stage metadata updated | 10 passed |
| Live integrated virtual-control suite | 12 passed |
| Live ML service outage | Explicit unavailable status; no new command; restoration denied |
| Production frontend build | Passed; bundle-size advisory remains |
| Browser checks | Passed; see stage7-browser-results.json for current count |
| Firmware build | See stage7-firmware-build.txt; compilation is separate from hardware validation |

The live suite used actual HTTPS, Express, FastAPI and native MongoDB. It exercised Normal to
Critical readings, K persistence, a fresh repeat, virtual commanded/acknowledged/verified states,
three actuator-fault modes, power loss, invalid/delayed/duplicate records, role enforcement,
explanation fallback and restoration. Backend pure tests additionally exercise all six decision
table combinations, Option B, simultaneous pathways, timeout, retry exhaustion, ordering,
stale confirmation, recovery, invalid pauses, missing intervals and re-arm holdoff.

Browser tests used headless Chromium against the built app and real backend: login, stored history,
parameter rendering, explanations, viewer control denial, mobile width, no JavaScript exceptions,
no localStorage credentials, and session clearing on reload. This is automated functional evidence,
not a human usability/SUS/UAT study. PWA offline shell behavior is not a guarantee of live data.

## Actual ML evaluation

| Metric | XGBoost | Reference-threshold baseline |
|---|---:|---:|
| Precision | 1.0000 | 0.9972 |
| Recall | 1.0000 | 1.0000 |
| F1 | 1.0000 | 0.9986 |
| Average precision (PR summary) | 1.0000 | 0.9972 |

Test partition: 960 samples; 608 Normal, 352 injected-anomaly labels. XGBoost confusion matrix
is [[608,0],[0,352]], with rows true and columns predicted, order Normal/Anomalous.
Validation-selected threshold is 0.3 and depth 2. The full report includes the dataset hash,
seed, features and split episode ranges. No GECCO or household data was used.

The generator makes cases easy to separate. These perfect scores do not validate sensor accuracy,
potability, real-world anomaly detection, temporal prediction or generalization. Current-only
features and window length 1 are an explicit prototype assumption. Real labeled data, independent
external validation, calibration and adviser review are needed before making research claims.

## Preserved items and setup constraints

The working copy is under the writable Codex project directory. The original requested Capstone
directory is outside this session's writable roots, so it was not upgraded in place. Original .env
and HTTPS certificate bytes match the copied local files; Stage 1 backup remains present.
Existing database data and Docker volumes were not removed. A new `aquasentra_stage7_demo`
database on the existing Windows MongoDB service isolates test writes from the Stage 1 database.

Docker's default and Linux-engine pipes were unavailable even after a Desktop launch attempt.
Docker connection repair remains unresolved; the working demo does not require it. Vite dev-mode
prebundling encountered sandbox ancestor-directory access errors. Native config loading and the
successful production build/preview provide a working demonstration path.

## Remaining limits

- All hardware behavior is virtual. The firmware uses synthetic acquisition and no output GPIO;
  calibrated hardware drivers, actuator transport and physical verification remain future work.
- Option A and numeric timings are demo assumptions from unresolved choices in Chapter 3.
  Thresholds and control configuration are provisional and editable, not adopted safety limits.
- AI mock is a template; no paid provider or real LLM accuracy evaluation is included.
- One backend process serializes state changes. The command journal and state snapshot are not
  a cross-collection transaction; crash reconciliation and multi-instance ownership remain gaps.
- Loopback deployment, manually supplied access tokens and local development certificates are
  not a production identity/network security design. No load, penetration or disaster-recovery
  assessment is claimed. Run one demo backend at a time.
- Contact status is based on receipt times. A historical model result is not proof the ML service
  remains available, and a virtual position result is never physical water-flow verification.
- No laboratory, physical closure-time, clinical, household field, user acceptance or SUS results
  were fabricated. Historical stage reports are retained as historical context only.
