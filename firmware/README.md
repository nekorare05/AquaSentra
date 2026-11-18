# ESP32 virtual-only firmware

This PlatformIO Arduino build sends synthetic readings over CA-verified HTTPS, retains up to
24 unsent readings in RAM with their original timestamps, reconnects Wi-Fi, reports clock/boot
status, and polls the authenticated repeat-confirmation endpoint.

No GPIO output is configured. Physical sensor calibration and actuator transport are intentionally
not enabled. The future pin plan is in ../docs/wiring-plan.md. Copy include/config.example.h to
include/config.h for private configuration; never commit credentials. Compile with
`python -m platformio run -d firmware` from the project root. The post-build configuration script
shortens include/library paths to avoid the Windows compiler subprocess command-length limit.
Compilation is not hardware validation. Do not claim physical measurements or valve testing.
