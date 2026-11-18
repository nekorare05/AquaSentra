# Stage 1 acceptance checklist

**Status:** Implementation package prepared; pure tests passed. Actual HTTPS + MongoDB integration must be run on a machine with MongoDB and installed Node.js dependencies.

- [x] Fixed directory layout `/firmware`, `/backend`, `/ml`, `/frontend`, `/simulator`, `/docs`.
- [x] Sensor record with ISO-8601 timestamp, calibrated placeholders, identity, required status, units, and boot flag.
- [x] Device credential checked before any validation or insert.
- [x] Configurable plausibility, sensor status, schema and timestamp policy; invalid input retained with reasons.
- [x] Atomic canonical device/timestamp uniqueness under MongoDB index, with duplicate retained invalid.
- [x] No inference, persistence count, automatic isolation, rating, or false valve verification.
- [x] CLI sensor scenarios, offline queue/replay, variable speed, local-only TLS developer mode.
- [x] 21 Node pure tests and 6 Python tests passed.
- [ ] Execute real HTTPS + MongoDB smoke test: `cd backend && npm run test:smoke`.
- [ ] User reviews provisional software choices below before enabling later-stage decision logic.

## Provisional decisions needing research/adviser approval

1. `sensor_status` is currently a structured object with `ph`, `turbidity`, `tds`, `temperature` status codes and a `clock` synchronization flag. Should hardware firmware and the dataset match this shape?
2. Sensor plausible ranges are pH 0–14, turbidity 0–3000 NTU, TDS 0–1000 mg/L, temperature -55–125°C, which are **not drinking-water safety ratings**. Verify against module datasheets and empirical calibration.
3. A ±120-second live timestamp tolerance and 24-hour max historical acceptance are provisional. A backfilled record outside 120 seconds is stored valid but cannot trigger live decision logic.
4. Canonical device/timestamp uniqueness records the first submission even when it is invalid. Later collisions are invalid duplicates, never overwrite.
5. No K, Kc, M, Tmax, model threshold, confirmation limit, rearm/closure timeout, risky/critical cutoffs or other safety-critical values have been assigned. Explicit study-defined approval is required before implementing those stages.

The application remains a **research prototype, not a certified drinking-water safety device**.
