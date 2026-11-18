# Recovered AquaSentra Stages 1-7 software prototype

Recovered from the existing writable workspace on 18 November 2026. No implementation was
restarted and no new test executions were performed for this recovery. Source files and trained
model artifacts are preserved byte-for-byte; SHA-256 values are in RECOVERY_MANIFEST.json.

Existing recorded results: 73 backend unit tests passed, 8 ML tests passed, 6 simulator tests
passed, 12 integrated checks passed, and 11 browser checks passed. Live ML outage results,
frontend build output, and the synthetic ML evaluation report are included under docs/ and ml/.
Earlier Stage 1/2 reports are retained as historical records; their dates and scope differ.

Unfinished: ESP32 PlatformIO compile failed with CreateProcess: No such file or directory.
Firmware source is included, but no successful firmware build or hardware test is claimed.
Docker engine connectivity remained unresolved; the software demo used the native Windows
MongoDB service with an isolated aquasentra_stage7_demo database. The original Capstone
project was not upgraded in place because it was outside the writable workspace.

All sensors and valve behavior are virtual. The AI provider is a mock/template with fallback.
The trained model is synthetic-only; its perfect reported test scores do not demonstrate real
household performance. Thresholds, timings and Option A/B selections remain provisional.
Production hardening, transactional crash recovery and hardware integration remain future work.

Excluded: private .env files, HTTPS certificates/keys, private firmware configuration, database
contents, dependency/toolchain folders, runtime logs, caches, intermediate compiler outputs and
internal browser screenshots. Public .env.example/config.example.h templates and package lock
files are included. Supply your existing private configuration locally; do not overwrite it.

See README.md, Start-Demo.ps1 and docs/panel-demonstration.md for the existing setup and demo
workflow. This archive does not include private credentials or an automatically configured DB.
