#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include "driver/twai.h"
#include <Adafruit_NeoPixel.h>

#define PIN        48
#define NUMPIXELS  1

const char* ssid = "WMTF_Network";        // Nome do seu WiFi
const char* wifiPass = "KxLzD8-f[o#AS0";   // Senha do seu WiFi

const char* httpUser = "admin";
const char* httpPass = "motor123";

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

static uint32_t messagesReceived = 0;
static bool canInitialized = false;

// Motor state
static uint16_t currentRPM = 0;
static uint8_t pwmPercent = 0;
static uint16_t presetRPM = 0;
static bool escLog[2] = {false, false};
static bool escPwr[2] = {false, false};
static bool motorRunning = false;
static bool modeRPM = true;  // true = RPM, false = PWM

// Telemetry
static float telemetryRPM = 0;
static float telemetryForce = 0;
static float telemetryCurrent = 0;
static float telemetryVoltage = 24.0;
static float escCurrents[2] = {0, 0};
static uint8_t escTemps[2] = {25, 25};

Adafruit_NeoPixel pixels(NUMPIXELS, PIN, NEO_GRB + NEO_KHZ800);

void notifyClients(String msg) {
    ws.textAll(msg);
}

void sendTelemetry() {
    String json = "{";
    json += "\"rpm\":" + String(telemetryRPM, 0) + ",";
    json += "\"force\":" + String(telemetryForce, 2) + ",";
    json += "\"current\":" + String(telemetryCurrent, 2) + ",";
    json += "\"voltage\":" + String(telemetryVoltage, 2) + ",";
    json += "\"esc1\":" + String(escCurrents[0], 2) + ",";
    json += "\"esc2\":" + String(escCurrents[1], 2) + ",";
    json += "\"esc1Temp\":" + String(escTemps[0]) + ",";
    json += "\"esc2Temp\":" + String(escTemps[1]) + ",";
    json += "\"escTotal\":" + String(escCurrents[0] + escCurrents[1], 2);
    json += "}";
    ws.textAll(json);
}

void updateTelemetrySimulation() {
    if (motorRunning) {
        if (modeRPM) {
            telemetryRPM = currentRPM + random(-50, 50);
        } else {
            telemetryRPM = (pwmPercent / 100.0) * 3000 + random(-50, 50);
        }
        telemetryForce = random(0, 500) / 10.0;
        telemetryCurrent = random(50, 200) / 10.0;
        telemetryVoltage = 23.5 + random(0, 100) / 100.0;
        for (int i = 0; i < 2; i++) {
            if (escPwr[i]) {
                escCurrents[i] = random(20, 80) / 10.0;
                escTemps[i] = 30 + random(0, 40);
            } else {
                escCurrents[i] = 0;
                escTemps[i] = 25 + random(0, 5);
            }
        }
    } else {
        telemetryRPM = 0;
        telemetryForce = 0;
        telemetryCurrent = 0;
        for (int i = 0; i < 2; i++) {
            escCurrents[i] = 0;
            escTemps[i] = 25;
        }
    }
}

void setLED(uint8_t r, uint8_t g, uint8_t b) {
    pixels.setPixelColor(0, pixels.Color(r, g, b));
    pixels.show();
}

void setupLED() {
    pixels.begin();
    pixels.setBrightness(100);
    setLED(0, 0, 0);
    Serial.println("LED OK!");
}

void processCommand(String cmd) {
    Serial.println("CMD: " + cmd);
    
    if (cmd.startsWith("LED:")) {
        int p1 = cmd.indexOf(':');
        int p2 = cmd.indexOf(':', p1 + 1);
        int p3 = cmd.indexOf(':', p2 + 1);
        if (p3 > p2) {
            setLED(cmd.substring(p1 + 1, p2).toInt(),
                   cmd.substring(p2 + 1, p3).toInt(),
                   cmd.substring(p3 + 1).toInt());
        }
    }
    else if (cmd.startsWith("MODE:")) {
        String mode = cmd.substring(5);
        modeRPM = (mode == "RPM");
        Serial.printf("Mode: %s\n", modeRPM ? "RPM" : "PWM");
    }
    else if (cmd.startsWith("RPM:")) {
        currentRPM = cmd.substring(4).toInt();
        Serial.printf("RPM: %d\n", currentRPM);
    }
    else if (cmd.startsWith("PWM:")) {
        pwmPercent = cmd.substring(4).toInt();
        Serial.printf("PWM: %d%%\n", pwmPercent);
    }
    else if (cmd.startsWith("PRESET:")) {
        presetRPM = cmd.substring(7).toInt();
        currentRPM = presetRPM;
        Serial.printf("Preset RPM: %d\n", presetRPM);
    }
    else if (cmd.startsWith("SW-ESC-LOG")) {
        int escNum = cmd.substring(10, 11).toInt() - 1;
        if (escNum >= 0 && escNum < 2) {
            escLog[escNum] = (cmd.substring(cmd.indexOf(':') + 1) == "ON");
            Serial.printf("ESC_LOG%d: %s\n", escNum + 1, escLog[escNum] ? "ON" : "OFF");
        }
    }
    else if (cmd.startsWith("SW-ESC-PWR")) {
        int escNum = cmd.substring(10, 11).toInt() - 1;
        if (escNum >= 0 && escNum < 2) {
            escPwr[escNum] = (cmd.substring(cmd.indexOf(':') + 1) == "ON");
            Serial.printf("ESC_PWR%d: %s\n", escNum + 1, escPwr[escNum] ? "ON" : "OFF");
        }
    }
    else if (cmd.startsWith("CMD:")) {
        String subCmd = cmd.substring(4);
        if (subCmd == "START") {
            motorRunning = true;
            Serial.println("MOTOR START!");
        }
        else if (subCmd == "STOP") {
            motorRunning = false;
            currentRPM = 0;
            pwmPercent = 0;
            Serial.println("MOTOR STOP!");
        }
        else if (subCmd == "EMERGENCY") {
            motorRunning = false;
            currentRPM = 0;
            pwmPercent = 0;
            escPwr[0] = false;
            escPwr[1] = false;
            setLED(255, 0, 0);
            Serial.println("EMERGENCY!");
        }
    }
}

void setupWebServer() {
    if (!LittleFS.begin(true)) {
        Serial.println("LittleFS ERRO!");
        return;
    }
    Serial.println("LittleFS OK!");

    ws.onEvent([](AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
        if (type == WS_EVT_CONNECT) {
            Serial.println("Cliente conectado!");
        } else if (type == WS_EVT_DISCONNECT) {
            Serial.println("Cliente desconectado!");
        } else if (type == WS_EVT_DATA) {
            data[len] = 0;
            processCommand(String((char*)data));
        }
    });
    
    server.addHandler(&ws);
    
    auto checkAuth = [](AsyncWebServerRequest *request) -> bool {
        if (!request->authenticate(httpUser, httpPass)) {
            request->requestAuthentication();
            return false;
        }
        return true;
    };
    
    server.on("/", HTTP_GET, [checkAuth](AsyncWebServerRequest *request) {
        if (checkAuth(request)) request->send(LittleFS, "/index.html", "text/html");
    });
    
    server.on("/style.css", HTTP_GET, [checkAuth](AsyncWebServerRequest *request) {
        if (checkAuth(request)) request->send(LittleFS, "/style.css", "text/css");
    });
    
    server.on("/app.js", HTTP_GET, [checkAuth](AsyncWebServerRequest *request) {
        if (checkAuth(request)) request->send(LittleFS, "/app.js", "application/javascript");
    });
    
    server.on("/favicon.ico", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(204);
    });
    
    server.begin();
    Serial.println("Web Server OK!");
}

void setupCAN() {
    twai_general_config_t g_config = TWAI_GENERAL_CONFIG_DEFAULT(GPIO_NUM_46, GPIO_NUM_45, TWAI_MODE_NORMAL);
    twai_timing_config_t t_config = TWAI_TIMING_CONFIG_250KBITS();
    twai_filter_config_t f_config = TWAI_FILTER_CONFIG_ACCEPT_ALL();
    
    g_config.tx_queue_len = 16;
    g_config.rx_queue_len = 16;
    
    esp_err_t err = twai_driver_install(&g_config, &t_config, &f_config);
    
    if (err == ESP_OK) {
        Serial.println("CAN OK: 250 kbps");
        canInitialized = true;
        twai_start();
    } else {
        Serial.print("CAN ERRO: ");
        Serial.println(esp_err_to_name(err));
        canInitialized = false;
    }
}

void setup() {
    Serial.begin(115200);
    delay(500);
    
    Serial.println();
    Serial.println("===========================================");
    Serial.println("  Motor Test Bench - ESP32-S3");
    Serial.println("===========================================");
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, wifiPass);
    Serial.print("Conectando ao WiFi ");
    Serial.print(ssid);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println();
        Serial.print("WiFi OK! IP: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println();
        Serial.println("WiFi falhou! Tentando AP...");
        WiFi.mode(WIFI_AP);
        WiFi.softAP("ESP32-CAN", "12345678");
        Serial.print("AP IP: ");
        Serial.println(WiFi.softAPIP());
    }
    
    setupWebServer();
    setupCAN();
    setupLED();
    
    Serial.println();
    Serial.println("Pronto! http://" + WiFi.localIP().toString());
}

void loop() {
    if (canInitialized) {
        twai_message_t message;
        if (twai_receive(&message, pdMS_TO_TICKS(10)) == ESP_OK) {
            messagesReceived++;
            
            String canMsg = "CAN:";
            canMsg += String(message.identifier, HEX);
            canMsg += " | ";
            for (int i = 0; i < message.data_length_code; i++) {
                if (message.data[i] < 16) canMsg += "0";
                canMsg += String(message.data[i], HEX);
                canMsg += " ";
            }
            
            Serial.printf("CAN:%X|%d|", message.identifier, message.data_length_code);
            for (int i = 0; i < message.data_length_code; i++) {
                if (message.data[i] < 16) Serial.print("0");
                Serial.print(message.data[i], HEX);
                Serial.print(" ");
            }
            Serial.println();
            
            notifyClients(canMsg + "\n");
        }
    }
    
    static unsigned long lastTelemetry = 0;
    if (millis() - lastTelemetry > 100) {
        updateTelemetrySimulation();
        sendTelemetry();
        lastTelemetry = millis();
    }
    
    delayMicroseconds(100);
}
