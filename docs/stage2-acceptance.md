# AquaSentra Stage 2 — Acceptance checklist

## Scope

Stage 2 extends validated Stage 1 records. It **does not** implement XGBoost, recurrence counters, repeat confirmation, relay commands, valve closure verification or AI explanation. `POST /api/v1/readings` preserves device auth -> validation -> storage -> provisional rating -> optional alert. Incoming invalid parseable data are retained and flagged, not rated. Historical delayed-but-valid records can be rated but never generate live warning. Temperature is operational context only.

## Example decisions (provisional study values; update config to change)

| pH | NTU | TDS mg/L | Valid? | Expected overall | Alert on live eligible? |
|---:|---:|---:|---|---|---|
| 7.2 | 1.6 | 250 | Yes | Normal | None |
| 6.5 | 5 | 600 | Yes | Normal | None |
| 8.7 | 2 | 200 | Yes | Risky | Early warning |
| 7.0 | 10.0 | 850 | Yes | Risky | Early warning |
| 10.8 | 1 | 250 | Yes | Critical | Critical alert |
| 7.0 | 12 | 250 | Yes | Critical | Critical alert |
| 7.0 | 2 | 950 | Yes | Critical | Critical alert |
| 17 | 2 | 200 | **No: implausible pH** | **None** | Sensor fault notice only |
| 8.7 | 2 | 200 | Yes, delayed/outside tolerance | Risky, historical | **No new live alert** |
| 7.0 | 1 | 200 | **No: duplicate** | None | No sensor-fault alert for duplicate-only |

Warnings occur immediately on the first valid eligible Risky/Critical reading, per Stage 2 rule. They are not isolation authorization. All alert writes are idempotent by `reading_id`.

## Verification

- `npm test`: 42 pure backend tests (Stage 1 tests 21, Stage 2 tests 21). Tested in authoring container: **42 passed, 0 failed**.
- `python -m unittest discover -s simulator -p 'test_*.py' -v`: 6 simulator tests in Stage 1; run against Stage 2 unchanged.
- `npm run test:smoke`: original 5 live HTTPS/MongoDB tests (user previously verified in Stage 1; Stage 2 retest necessary).
- `npm run test:stage2-smoke`: 10 new live HTTPS/MongoDB checks provided, **not executed in the authoring container** (no accessible running MongoDB there).
- React JSX source parsed/transpiled with TypeScript parser without syntax diagnostics. Full frontend `npm install` and `npm run build` **not verified in the authoring container** (npm registry downloads unavailable); complete locally on Windows.

## Manual browser acceptance

1. Run backend (`npm start`) and Vite frontend (`npm run dev`); connect using seeded viewer token.
2. Confirm dashboard initially loads from MongoDB, not canned UI values.
3. Simulate `normal` and inspect `Normal` rating and trend.
4. Simulate `ph-spike`, `high-tds`; observe new Critical alert entries and stored rated records.
5. Simulate `out-of-range`; observe a sensor-fault alert, not a rule rating.
6. Simulate `delayed` and `duplicate`; verify history flags and no new live early-warning alert for delayed record.
7. Verify Parameters displays version and explicit **provisional** labeling.
8. Confirm ML shows `Stage 3 · pending`; valve shows `Disabled · Stage 5` and flow `Unknown`.
9. Confirm footer states **not a certified drinking-water safety device**.
10. Disconnect and refresh; no access token should be retained in localStorage. Confirm API requests without headers get 401.

## Remaining limitations

Not certified or tested on actual hardware. Dashboard online/offline based on last server contact plus 180-second provisional timeout, not independent network reachability or flow verification. Browser tokens are entered manually and held in tab memory; this Vite localhost proxy setup is not intended for production. No parameter edits from dashboard: auditing/editor is deferred. No machine learning, no valve commands, no advanced persistence, no alerts for missed readings in Stage 2.
