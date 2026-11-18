// Future ESP32 transport prototype. Every measurement and actuator remains virtual.
// No GPIO is configured as an output and there is no physical command endpoint.
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#if __has_include("config.h")
#include "config.h"
#else
#include "config.example.h"
#endif
#if !defined(AQUASENTRA_VIRTUAL_ONLY) || AQUASENTRA_VIRTUAL_ONLY != 1
#error "Physical actuation is intentionally unsupported in this prototype"
#endif

constexpr unsigned long SAMPLE_MS=60000, RETRY_MS=5000;
constexpr size_t QUEUE_SIZE=24;
String pending[QUEUE_SIZE]; size_t head=0, used=0;
unsigned long sampled=0,retried=0,polled=0; bool boot=true;
String lastConfirmation;
// Pin plan only: ADC1 pH=34, turbidity=35, TDS=32, DS18B20=4;
// prospective relay=26, independent position=27. Not driven by this build.

String timestamp(){
  time_t now=time(nullptr);if(now<1700000000)return "1970-01-01T00:00:00.000Z";
  struct tm utc;gmtime_r(&now,&utc);char value[32];strftime(value,sizeof(value),"%Y-%m-%dT%H:%M:%S.000Z",&utc);return String(value);
}
void acquire(bool confirmation){
  JsonDocument doc;
  doc["device_id"]=DEVICE_ID;doc["measured_at"]=timestamp();
  doc["pH"]=7.2;doc["turbidity"]=2.0;doc["TDS"]=300.0;doc["temperature_c"]=26.0;
  doc["turbidity_unit"]="NTU";doc["tds_unit"]="mg/L";doc["boot_flag"]=boot;
  doc["purpose"]=confirmation?"repeat_confirmation":"routine";
  for(const char* key:{"ph","turbidity","tds","temperature"})doc["sensor_status"][key]="ok";
  doc["sensor_status"]["clock"]=time(nullptr)>1700000000?"synced":"unsynced";
  if(used==QUEUE_SIZE){Serial.println("Queue full: dropping oldest virtual record");head=(head+1)%QUEUE_SIZE;used--;}
  serializeJson(doc,pending[(head+used)%QUEUE_SIZE]);used++;boot=false;
}
int request(const String& path,const String* body,String& response){
  if(WiFi.status()!=WL_CONNECTED)return -1;
  WiFiClientSecure tls;tls.setCACert(ROOT_CA); // Never setInsecure().
  HTTPClient http;http.setTimeout(4000);
  if(!http.begin(tls,String(API_BASE)+path))return -1;
  http.addHeader("x-device-id",DEVICE_ID);http.addHeader("x-device-token",DEVICE_TOKEN);
  http.addHeader("Content-Type","application/json");
  int status=body?http.POST(*body):http.GET();response=http.getString();http.end();return status;
}
void setup(){
  Serial.begin(115200);Serial.println("AquaSentra VIRTUAL ONLY. Relay and position are not hardware outputs.");
  WiFi.mode(WIFI_STA);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
  configTime(0,0,"pool.ntp.org","time.nist.gov");
}
void loop(){
  unsigned long now=millis();
  if(now-sampled>=SAMPLE_MS || sampled==0){sampled=now?now:1;acquire(false);}
  if(now-retried>=RETRY_MS){retried=now;
    if(WiFi.status()!=WL_CONNECTED)WiFi.reconnect();
    else if(used){String response;int status=request("/api/v1/readings",&pending[head],response);
      if(status==201||status==202){pending[head]="";head=(head+1)%QUEUE_SIZE;used--;}
      Serial.printf("Virtual transmission HTTP %d; queued=%u\n",status,(unsigned)used);
    }
  }
  if(now-polled>=3000 && WiFi.status()==WL_CONNECTED){polled=now;String response;
    if(request("/api/v1/device/confirmation",nullptr,response)==200){JsonDocument doc;
      if(!deserializeJson(doc,response) && !doc["pending"].isNull()){
        String id=doc["pending"]["id"].as<String>();
        double ready=doc["pending"]["not_before"].as<double>();
        double deadline=doc["pending"]["deadline"].as<double>();
        double current=static_cast<double>(time(nullptr))*1000.0;
        if(id!=lastConfirmation && current>=ready && current<=deadline){acquire(true);lastConfirmation=id;}
      }
    }
  }
  delay(10);
}
