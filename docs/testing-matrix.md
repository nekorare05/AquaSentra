# Test traceability and expected/observed results

Run local pure tests with `cd backend && npm test` and Python tests with `python -m unittest discover -s simulator -p "test_*.py" -v`. The following records the test cases and results **observed in the code execution environment**, not an actual live HTTPS/MongoDB integration run.

| ID | Precondition | Input | Expected | Observed |
|---|---|---|---|---|
| ST1-01 | Well-formed record | Plausible values & current timestamp | Valid/live-eligible | PASS |
| ST1-02 | Normal record baseline | Missing pH | Invalid MISSING_pH | PASS |
| ST1-03 | Normal record baseline | Wrong unit + extra key | Invalid codes | PASS |
| ST1-04 | Normal record baseline | pH 18 | OUT_OF_RANGE_pH | PASS |
| ST1-05 | Normal record baseline | Stuck pH status | SENSOR_FAULT_ph | PASS |
| ST1-06 | Normal record baseline | Unsynced clock | Invalid, not live | PASS |
| ST1-07 | Fixed received timestamp | Older by 5 min | Valid historical, not live | PASS |
| ST1-08 | Fixed received timestamp | Older by 48h | TIMESTAMP_TOO_OLD | PASS |
| ST1-09 | Fixed received timestamp | Future by 10m | TIMESTAMP_IN_FUTURE | PASS |
| ST1-10 | Authenticated as device A | Payload device B | DEVICE_ID_MISMATCH | PASS |
| ST1-11 | Strict time parser | UTC+8 + impossible Feb 30 | UTC equivalent + reject bad calendar | PASS |
| ST1-12 | Normal validation function | Null record | Invalid, not live | PASS |
| ST1-13 | Normal record baseline | Missing temperature status | Invalid | PASS |
| ST1-14 | Valid physical measurement | pH 10.4 | Valid data; no safety judgment | PASS |
| ST1-15 | In-memory repository | First valid record | Stored; rating unset | PASS |
| ST1-16 | In-memory repository + canonical record | Same device/time twice | Duplicate stored flagged invalid | PASS |
| ST1-17 | In-memory repository | Invalid pH | Stored, not live eligible | PASS |
| ST1-18 | Invalid canonical key already stored | Same timestamp, now valid payload | Second flagged duplicate | PASS |
| ST1-19 | In-memory repository | Malformed date | Invalid stored without canonical key | PASS |
| ST1-20 | Hashing utility | Correct and incorrect tokens | Correct verified, bad denied, no plaintext | PASS |
| ST1-21 | In-memory repository | Eight concurrent writes of same key | One canonical; eight saved | PASS |
| PY-01 | Calibration fixture | Mock slope changed | Calibrated physical value changes | PASS |
| PY-02 | Wi-Fi buffer scenario | Two generated records | Original times unique | PASS |
| PY-03 | Duplicate scenario | Two source records | Exact duplicated payload | PASS |
| PY-04 | Status/boot scenarios | stuck / power-loss | Fault status / boot flag | PASS |
| PY-05 | Simulator output | Normal record | Mandatory keys and units present | PASS |
| PY-06 | Clock-sync scenario | Clock unsynced | Flag present | PASS |

**Execution summary:** 21/21 pure Node tests and 6/6 Python tests passed (2026-11-15). The test doubles for MongoDB do **not** prove an actual Mongoose/MongoDB HTTPS deployment. Real integration test `npm run test:smoke` is supplied with 5 cases, but **not executed in this environment** because MongoDB and npm dependencies are not installed.

**Deferred cases, not falsely marked PASS:** Normal/Risky/Critical ratings (Stage 2); XGBoost inference (Stage 3); persistence K/Kc, M/Tmax, repeat confirmation, dual pathway, disagreement, re-arm holdoff (Stage 4); valve actuation, verified closure, no-ack, access checks on control routes, offline/offline counter reset (Stage 5); AI fallback and no-control link (Stage 6); hardware reset/Wi-Fi queues and integration fault injection (Stage 7). The simulator can generate sensor-side fault scenarios now but cannot verify those future control paths.
