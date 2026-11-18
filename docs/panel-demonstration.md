# Proposed-system demonstration script

1. Open http://127.0.0.1:4173 and sign in as `research-viewer` using your local token.
   Say: “This is a software prototype. Sensors, relay and position feedback are simulated.
   A Normal rating does not establish drinking-water safety.”
2. Show the charts, history, sensor contact status and provisional parameter register.
   Say: “Rules rate pH, turbidity and TDS. Temperature is contextual. Invalid and delayed
   records remain visible but do not authorize live isolation.”
3. Run `python simulator/demo.py` from the project root. It begins with a Normal sample,
   performs an authenticated virtual restoration, waits for holdoff, and sends three abnormal
   readings followed by a fresh repeat. Watch persistence and the event journal.
   Say: “XGBoost and the rules are separate. Option A needs persistence and repeat confirmation,
   and the confirmed rule rating must remain at least Risky.”
4. Show the `commanded`, `acknowledged` and `verified` events in order.
   Say: “These are distinct virtual observations. No physical closure time or flow is claimed.”
5. Run `python simulator/demo.py --fault no_ack`, then optionally `--fault stuck` or
   `--fault no_feedback`. Point out that fault states never report verified closure.
6. Click **Explain current state**, then **Demonstrate AI fallback**.
   Say: “The free mock generates template text. It cannot change decisions or control a valve.”
7. Show that a viewer is denied restoration. For admin UI demonstration, disconnect and sign
   in as `research-admin`, using its local token. Run `python simulator/demo.py --restore`
   for a repeatable return to Normal/open after fault resolution and inspection acknowledgment.
8. Open `ml/artifacts/metrics.json`. Explain the chronological episode splits, validation-only
   selection and untouched test partition. “Perfect scores here reflect easy synthetic cases.
   These are not field accuracy or potability results.”
9. Show the automated test reports and compiled firmware result if available. Close with the
   unresolved limits: no real sensors, no physical valve, no field dataset, no household trials,
   no paid LLM dependency and no certification.

Allow about 6–8 minutes. Each isolation scenario spends 10 seconds on re-arm holdoff and a few
seconds on repeat/feedback timing. Do not run smoke tests concurrently with a panel scenario,
because they legitimately add measurements to the same demo device.
