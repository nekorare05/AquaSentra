#pragma once
// Copy to config.h and supply local credentials. Never commit config.h.
#define WIFI_SSID "CONFIGURE_WIFI"
#define WIFI_PASSWORD "CONFIGURE_PASSWORD"
#define API_BASE "https://192.168.1.2:8443"
#define DEVICE_ID "AS-ESP32-001"
#define DEVICE_TOKEN "CONFIGURE_DEVICE_TOKEN"
// Paste the CA certificate that signs your HTTPS server certificate.
static const char ROOT_CA[] = "CONFIGURE_PEM_CA";
