# Stage 1 ingestion decision flow

```mermaid
flowchart TD
    A[POST /readings] --> B{Valid device credential?}
    B -->|No| C[401 + security event]
    B -->|Yes| D[Check JSON schema, unit, range, status]
    D --> E[Check ISO timestamp and delay policy]
    E --> F[Attempt canonical indexed insert]
    F -->|Unique key collision| G[Flag DUPLICATE_READING]
    G --> H[(Store duplicate as invalid)]
    F -->|No collision| I[(Store first record with validity reasons)]
    H --> J[202 flagged stored]
    I --> K{All checks valid?}
    K -->|Yes| L[201 valid stored]
    K -->|No| J
    L --> M[No rating, ML, counters, or valve control in Stage 1]
    J --> M
```

**Future logic (NOT ACTIVE):** A stored valid reading is not by itself an isolation trigger. A future detection must use past-only model features, designated persistence conditions, a valid repeat-confirmation measurement, and all authorization gates. Authorization must write the command event before transmission. Any failed/invalid confirmation means no command. Relay acknowledgment must not be reported as independent verification of closure.

## Configured Stage 1 timestamp policy (provisional)

- Within ±`timestamp_tolerance_seconds` of receipt: candidate for live processing (if all other checks pass).
- Older than that tolerance, but not older than `max_delayed_record_age_seconds`: store as **valid delayed historical record**, but not eligible for live decisions.
- Future beyond tolerance or older than maximum backfill age: invalid, retained with reason.
- Clock unsynced status: invalid even when numeric timestamp looks plausible.
- Confirmation state, `last_counted_reading` monotonicity, and persistence behavior are reserved for Stage 4.
