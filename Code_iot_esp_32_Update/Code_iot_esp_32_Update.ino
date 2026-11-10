#include <ESP32Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <string.h>
#include <DHT.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include "esp32_secrets.h"

const char* API_READINGS_URL = "https://smarcityandhome.vercel.app/api/readings";
const char* API_COMMANDS_URL = "https://smarcityandhome.vercel.app/api/commands";
const char* DEVICE_ID = "esp32-smart-city";
#define API_USE_HTTPS 1

const unsigned long INTERVAL_KIRIM_API = 1000UL;
const unsigned long INTERVAL_CEK_PERINTAH = 1000UL;
const unsigned long INTERVAL_WIFI_ULANG = 10000UL;
const unsigned long INTERVAL_ULTRASONIC_US = 60000UL;
const unsigned long TIMEOUT_ULTRASONIC_US = 30000UL;

struct PaketTelemetri {
  char payload[768];
};

struct PaketPerintah {
  bool rgbLedOn;
  bool streetLightOverrideEnabled;
  bool streetLightOverride;
  bool temperatureServoOverrideEnabled;
  bool temperatureServoOverride;
  char updatedAt[32];
};

QueueHandle_t antreanTelemetri = nullptr;
QueueHandle_t antreanPerintah = nullptr;

// =================================
// PIN ULTRASONIC
// =================================
#define TRIG_PIN 5
#define ECHO_PIN 18

// =================================
// PIN SERVO PALANG
// =================================
#define SERVO_PIN 13
#define SERVO2_PIN 12

// =================================
// PIN PIR
// =================================
#define PIR_PIN 14

// =================================
// PIN OUTPUT SENSOR SLOT PARKIR
// =================================
#define IR_SLOT_A_PIN 36
#define IR_SLOT_B_PIN 39
#define IR_SLOT_C_PIN 33

// =================================
// PIN LCD I2C
// =================================
#define SDA_PIN 21
#define SCL_PIN 22

// =================================
// PIN LDR DAN LED
// =================================
#define LDR_PIN 34
#define LED_JALAN_PIN 26

// =================================
// PIN TRAFFIC LIGHT
// =================================
#define TRAFFIC_RED_PIN 32
#define TRAFFIC_YELLOW_PIN 15
#define TRAFFIC_GREEN_PIN 2

// =================================
// PIN WATER LEVEL DAN BUZZER
// =================================
#define WATER_LEVEL_PIN 35
#define BUZZER_PIN 27

// =================================
// PIN SENSOR GETARAN SW-420
// =================================
#define SW420_PIN 25

// =================================
// PIN SENSOR SUHU DHT11
// =================================
#define DHT_PIN 4
#define DHT_TYPE DHT11

// =================================
// PIN SERVO SUHU (OUTPUT DHT11)
// =================================
#define SERVO_SUHU_PIN 23

// =================================
// PIN LED RGB (MODUL)
// =================================
#define LED_RGB_R_PIN 16
#define LED_RGB_G_PIN 17
#define LED_RGB_B_PIN 19

// =================================
// ALAMAT LCD
// =================================
#define LCD_ADDRESS 0x27

// =================================
// OBJEK SERVO DAN LCD
// =================================
Servo myServo;
Servo myServo2;
Servo myServoSuhu;

LiquidCrystal_I2C lcd(LCD_ADDRESS, 16, 2);

// =================================
// OBJEK SENSOR DHT11
// =================================
DHT sensorSuhu(DHT_PIN, DHT_TYPE);

// =================================
// POSISI SERVO
// =================================
const int posisiAwal = 0;
const int posisiAktif = 90;

// =================================
// BATAS JARAK ULTRASONIC
// =================================
const int batasJarak = 10;

// =================================
// WAKTU TUNGGU PALANG
// =================================
const unsigned long waktuTunggu = 3000UL;
const unsigned long waktuTundaOverrideWeb = 10000UL;

// =================================
// WAKTU TRAFFIC LIGHT
// =================================
const unsigned long waktuTrafficLight = 10000UL;

// =================================
// KONDISI SENSOR IR
// =================================
const int IR_DETECTED_LEVEL = LOW;

// =================================
// PENGATURAN LDR
// =================================
const int BATAS_LDR = 1000;

// =================================
// PENGATURAN LED
// =================================
const int LED_ON_LEVEL = HIGH;

// =================================
// PENGATURAN LED RGB
// =================================
// Modul LED RGB common cathode (GND):
// HIGH = menyala, LOW = mati
const int LED_RGB_ON_LEVEL = HIGH;

// =================================
// PENGATURAN WATER LEVEL
// =================================
const int BATAS_BANJIR = 500;
const int JUMLAH_SAMPEL_AIR = 10;

const unsigned long INTERVAL_BACA_AIR = 100UL;
const unsigned long INTERVAL_SERIAL_AIR = 500UL;

// =================================
// PENGATURAN BUZZER
// =================================
const unsigned long DURASI_BUZZER = 10000UL;
const int BUZZER_ON_LEVEL = HIGH;

// =================================
// PENGATURAN SW-420
// =================================
const int GETARAN_DETECTED_LEVEL = LOW;

// =================================
// KALIBRASI KETINGGIAN AIR
// =================================
const bool KALIBRASI_AKTIF = false;

const int NILAI_ADC_KERING = 0;
const int NILAI_ADC_REFERENSI = 2000;
const float TINGGI_REFERENSI_CM = 5.0;

// =================================
// PENGATURAN SUHU DHT11
// =================================
// Suhu > 28 : servo BUKA (90 derajat)
// Suhu < 28 : servo TUTUP (0 derajat)
// Suhu = 28 : posisi servo ditahan (tidak berubah)
const float BATAS_SUHU = 28.0;

// DHT11 dibaca setiap 2 detik
const unsigned long INTERVAL_BACA_SUHU = 2000UL;

// =================================
// STATUS LAMPU JALAN
// =================================
bool statusLampuJalan = false;

// =================================
// STATUS LED RGB (PIN B / GPIO19)
// Sementara dibuat true (nyala).
// Nanti nilai ini diisi dari API.
// =================================
bool statusLampuRGB = false;
bool overrideLampuJalanAktif = false;
bool statusLampuJalanManual = false;
bool overrideLampuJalanTertunda = false;
bool statusLampuJalanTertunda = false;
unsigned long waktuMulaiTundaLampuJalan = 0;
bool overrideServoSuhuAktif = false;
bool statusServoSuhuManual = false;
bool overrideServoSuhuTertunda = false;
bool statusServoSuhuTertunda = false;
unsigned long waktuMulaiTundaServoSuhu = 0;
char updatedAtPerintahTerakhir[32] = "";
bool statusPerintahLampuJalanDiketahui = false;
bool statusPerintahServoSuhuDiketahui = false;
bool perintahLampuJalanAktif = false;
bool nilaiPerintahLampuJalan = false;
bool perintahServoSuhuAktif = false;
bool nilaiPerintahServoSuhu = false;

bool slotATerisi = false;
bool slotBTerisi = false;
bool slotCTerisi = false;
int nilaiLDRTerakhir = 0;
bool pirTerdeteksi = false;
bool jarakValid = false;
float jarakTerakhir = 0;
bool suhuValid = false;
unsigned long waktuKirimApiTerakhir = 0;
unsigned long waktuCekPerintahTerakhir = 0;
unsigned long waktuCobaWiFiTerakhir = 0;
unsigned long waktuTriggerUltrasonik = 0;
unsigned long waktuMulaiEcho = 0;
unsigned long waktuMulaiPulsaTrigger = 0;
unsigned long waktuSampelAirTerakhir = 0;
long totalSampelAir = 0;
int jumlahSampelAir = 0;
int statusPengukuranUltrasonik = 0;

void aturOverrideLampuJalan(bool enabled, bool value);
void aturOverrideServoSuhu(bool enabled, bool value);

// =================================
// STATUS TRAFFIC LIGHT
// 0 = Hijau
// 1 = Kuning
// 2 = Merah
// =================================
int statusTrafficLight = 0;
unsigned long waktuTrafficTerakhir = 0;

// =================================
// STATUS WATER LEVEL
// =================================
bool statusBanjir = false;
bool statusBanjirSebelumnya = false;

unsigned long waktuSerialAirTerakhir = 0;

int nilaiAirTerakhir = 0;

// =================================
// STATUS SENSOR GETARAN
// =================================
bool statusGetaran = false;
bool statusGetaranSebelumnya = false;

// =================================
// STATUS BUZZER GABUNGAN
// =================================
bool alarmAktif = false;
unsigned long waktuMulaiBuzzer = 0;

// =================================
// STATUS PALANG
// =================================
bool statusPalangMasuk = false;
bool statusPalangKeluar = false;

unsigned long waktuMasuk = 0;
unsigned long waktuKeluar = 0;

// =================================
// STATUS SENSOR SUHU DAN SERVO SUHU
// =================================
float suhuSekarang = 0;
float kelembapanSekarang = 0;

bool statusServoSuhuTerbuka = false;

unsigned long waktuBacaSuhuTerakhir = 0;

// =================================
// FUNGSI MENAMPILKAN TEKS LCD
// =================================
void tulisBarisLCD(int baris, const char* teks) {

  lcd.setCursor(0, baris);

  int panjang = strlen(teks);

  for (int i = 0; i < 16; i++) {

    if (i < panjang) {
      lcd.print(teks[i]);
    } else {
      lcd.print(' ');
    }
  }
}

// =================================
// FUNGSI MEMBACA SENSOR IR
// =================================
void cekSlotParkir() {

  bool slotA = digitalRead(IR_SLOT_A_PIN) == IR_DETECTED_LEVEL;
  bool slotB = digitalRead(IR_SLOT_B_PIN) == IR_DETECTED_LEVEL;
  bool slotC = digitalRead(IR_SLOT_C_PIN) == IR_DETECTED_LEVEL;

  static bool slotSudahDitampilkan = false;
  bool berubah = !slotSudahDitampilkan ||
                 slotA != slotATerisi ||
                 slotB != slotBTerisi ||
                 slotC != slotCTerisi;

  slotATerisi = slotA;
  slotBTerisi = slotB;
  slotCTerisi = slotC;

  if (!berubah) return;
  slotSudahDitampilkan = true;

  int jumlahTerisi = 0;

  if (slotA) jumlahTerisi++;
  if (slotB) jumlahTerisi++;
  if (slotC) jumlahTerisi++;

  int jumlahKosong = 3 - jumlahTerisi;

  char baris1[17];
  char baris2[17];

  snprintf(
    baris1,
    sizeof(baris1),
    "OA:%c OB:%c OC:%c",
    slotB ? 'I' : 'K',
    slotA ? 'I' : 'K',
    slotC ? 'I' : 'K'
  );

  if (jumlahTerisi == 3) {

    snprintf(baris2, sizeof(baris2), "PARKIR PENUH 3/3");

  } else {

    snprintf(
      baris2,
      sizeof(baris2),
      "Slot: %d/3 Terisi",
      jumlahTerisi
    );
  }

  tulisBarisLCD(0, baris1);
  tulisBarisLCD(1, baris2);

  Serial.println();
  Serial.println("================================");
  Serial.println("      OUTPUT SLOT PARKIR");
  Serial.println("================================");

  Serial.print("Output A : ");
  Serial.println(slotB ? "TERISI" : "KOSONG");

  Serial.print("Output B : ");
  Serial.println(slotA ? "TERISI" : "KOSONG");

  Serial.print("Output C : ");
  Serial.println(slotC ? "TERISI" : "KOSONG");

  Serial.println("--------------------------------");

  Serial.print("Jumlah slot terisi : ");
  Serial.print(jumlahTerisi);
  Serial.println("/3");

  Serial.print("Jumlah slot kosong : ");
  Serial.print(jumlahKosong);
  Serial.println("/3");

  Serial.println(
    jumlahTerisi == 3 ?
    "STATUS: PARKIR PENUH" :
    "STATUS: SLOT TERSEDIA"
  );

  Serial.println("================================");
}

// =================================
// FUNGSI LDR DAN LED LAMPU JALAN
// =================================
void terapkanStatusLampuJalan() {
  if (overrideLampuJalanTertunda &&
      millis() - waktuMulaiTundaLampuJalan >= waktuTundaOverrideWeb) {
    overrideLampuJalanTertunda = false;
    overrideLampuJalanAktif = true;
    statusLampuJalanManual = statusLampuJalanTertunda;
    Serial.println("Override lampu jalan dari web diterapkan.");
  }

  statusLampuJalan = overrideLampuJalanAktif ?
                     statusLampuJalanManual :
                     nilaiLDRTerakhir >= BATAS_LDR;

  digitalWrite(
    LED_JALAN_PIN,
    statusLampuJalan ?
    LED_ON_LEVEL :
    (LED_ON_LEVEL == HIGH ? LOW : HIGH)
  );
}

void cekLampuJalan() {

  int nilaiLDR = analogRead(LDR_PIN);
  nilaiLDRTerakhir = nilaiLDR;

  terapkanStatusLampuJalan();
}

void aturOverrideLampuJalan(bool enabled, bool value) {
  overrideLampuJalanTertunda = false;
  overrideLampuJalanAktif = false;

  if (!enabled) {
    terapkanStatusLampuJalan();
    return;
  }

  if (nilaiLDRTerakhir >= BATAS_LDR) {
    statusLampuJalanTertunda = value;
    waktuMulaiTundaLampuJalan = millis();
    overrideLampuJalanTertunda = true;
    Serial.println("Override lampu jalan dijadwalkan 10 detik.");
    return;
  }

  overrideLampuJalanAktif = true;
  statusLampuJalanManual = value;
  terapkanStatusLampuJalan();
}

// =================================
// FUNGSI MENGATUR LED RGB
// Saat ini hanya pin B (GPIO19) yang dipakai.
// R dan G dibiarkan mati.
// Nilai statusLampuRGB nanti dari API.
// =================================
void aturLampuRGB() {

  digitalWrite(
    LED_RGB_R_PIN,
    LED_RGB_ON_LEVEL == HIGH ? LOW : HIGH
  );

  digitalWrite(
    LED_RGB_G_PIN,
    LED_RGB_ON_LEVEL == HIGH ? LOW : HIGH
  );

  digitalWrite(
    LED_RGB_B_PIN,
    statusLampuRGB ?
    LED_RGB_ON_LEVEL :
    (LED_RGB_ON_LEVEL == HIGH ? LOW : HIGH)
  );

}

// =================================
// FUNGSI TRAFFIC LIGHT
// =================================
void cekTrafficLight() {

  unsigned long waktuSekarang = millis();

  if (
    waktuSekarang - waktuTrafficTerakhir
    >= waktuTrafficLight
  ) {

    waktuTrafficTerakhir = waktuSekarang;

    if (statusTrafficLight == 0) {
      statusTrafficLight = 1;
    }
    else if (statusTrafficLight == 1) {
      statusTrafficLight = 2;
    }
    else {
      statusTrafficLight = 0;
    }
  }

  static int statusTrafficDiterapkan = -1;
  if (statusTrafficDiterapkan == statusTrafficLight) return;
  statusTrafficDiterapkan = statusTrafficLight;

  digitalWrite(TRAFFIC_RED_PIN, LOW);
  digitalWrite(TRAFFIC_YELLOW_PIN, LOW);
  digitalWrite(TRAFFIC_GREEN_PIN, LOW);

  if (statusTrafficLight == 0) {
    digitalWrite(TRAFFIC_GREEN_PIN, HIGH);
  }
  else if (statusTrafficLight == 1) {
    digitalWrite(TRAFFIC_YELLOW_PIN, HIGH);
  }
  else {
    digitalWrite(TRAFFIC_RED_PIN, HIGH);
  }
}

// =================================
// KONEKSI API DAN TELEMETRI
// =================================
void jagaKoneksiWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  if (millis() - waktuCobaWiFiTerakhir >= INTERVAL_WIFI_ULANG) {
    waktuCobaWiFiTerakhir = millis();
    Serial.println("Wi-Fi terputus, mencoba menyambung kembali...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}

void cekPerintahLampuDariAPI() {
  if (WiFi.status() != WL_CONNECTED ||
      millis() - waktuCekPerintahTerakhir < INTERVAL_CEK_PERINTAH) {
    return;
  }

  waktuCekPerintahTerakhir = millis();

#if API_USE_HTTPS
  WiFiClientSecure client;
  client.setInsecure();  // Untuk uji coba; validasi CA diperlukan untuk produksi.
#else
  WiFiClient client;
#endif
  HTTPClient http;
  http.setTimeout(1500);

  if (!http.begin(client, API_COMMANDS_URL)) {
    Serial.println("Gagal memulai koneksi API perintah.");
    return;
  }

  int kodeHTTP = http.GET();
  if (kodeHTTP == HTTP_CODE_OK) {
    StaticJsonDocument<384> dokumen;
    DeserializationError error = deserializeJson(dokumen, http.getString());
    if (!error && dokumen["deviceId"] == DEVICE_ID &&
        dokumen["rgbLedOn"].is<bool>()) {
      const char* updatedAt = dokumen["updatedAt"] | "";
      if (updatedAt[0] != '\0' && antreanPerintah != nullptr) {
        PaketPerintah perintah = {};
        perintah.rgbLedOn = dokumen["rgbLedOn"].as<bool>();
        perintah.streetLightOverrideEnabled =
          dokumen["streetLightOverride"].is<bool>();
        perintah.streetLightOverride =
          dokumen["streetLightOverride"].as<bool>();
        perintah.temperatureServoOverrideEnabled =
          dokumen["temperatureServoOverride"].is<bool>();
        perintah.temperatureServoOverride =
          dokumen["temperatureServoOverride"].as<bool>();
        strncpy(perintah.updatedAt, updatedAt, sizeof(perintah.updatedAt) - 1);
        xQueueOverwrite(antreanPerintah, &perintah);
      }
    } else if (error) {
      Serial.print("JSON perintah tidak valid: ");
      Serial.println(error.c_str());
    }
  } else {
    Serial.printf("Gagal membaca perintah API (HTTP %d)\n", kodeHTTP);
  }

  http.end();
}

void jadwalkanDataSensorKeAPI() {
  if (antreanTelemetri == nullptr ||
      millis() - waktuKirimApiTerakhir < INTERVAL_KIRIM_API) {
    return;
  }
  waktuKirimApiTerakhir = millis();

  PaketTelemetri paket;
  StaticJsonDocument<768> dokumen;
  dokumen["deviceId"] = DEVICE_ID;
  if (suhuValid) {
    dokumen["temperatureC"] = suhuSekarang;
    dokumen["humidityPercent"] = kelembapanSekarang;
  } else {
    dokumen["temperatureC"] = nullptr;
    dokumen["humidityPercent"] = nullptr;
  }
  if (jarakValid) {
    dokumen["distanceCm"] = jarakTerakhir;
  } else {
    dokumen["distanceCm"] = nullptr;
  }

  JsonObject parkir = dokumen.createNestedObject("parking");
  parkir["slotAOccupied"] = slotATerisi;
  parkir["slotBOccupied"] = slotBTerisi;
  parkir["slotCOccupied"] = slotCTerisi;
  parkir["occupied"] = (slotATerisi ? 1 : 0) +
                       (slotBTerisi ? 1 : 0) +
                       (slotCTerisi ? 1 : 0);
  parkir["available"] = 3 - parkir["occupied"].as<int>();

  dokumen["pirDetected"] = pirTerdeteksi;
  dokumen["ldrRaw"] = nilaiLDRTerakhir;
  dokumen["streetLightOn"] = statusLampuJalan;
  dokumen["waterLevelRaw"] = nilaiAirTerakhir;
  dokumen["floodDetected"] = statusBanjir;
  dokumen["vibrationDetected"] = statusGetaran;
  dokumen["rgbLedOn"] = statusLampuRGB;
  dokumen["trafficLight"] = statusTrafficLight == 0 ? "green" :
                            statusTrafficLight == 1 ? "yellow" : "red";
  dokumen["entryGateOpen"] = statusPalangMasuk;
  dokumen["exitGateOpen"] = statusPalangKeluar;
  dokumen["temperatureServoOpen"] = statusServoSuhuTerbuka;

  size_t panjangPayload =
    serializeJson(dokumen, paket.payload, sizeof(paket.payload));
  if (panjangPayload == 0) {
    Serial.println("Gagal membentuk data telemetri.");
    return;
  }

  xQueueOverwrite(antreanTelemetri, &paket);
}

void kirimDataSensorKeAPI(const PaketTelemetri& paket) {
#if API_USE_HTTPS
  WiFiClientSecure client;
  client.setInsecure();  // Untuk uji coba; validasi CA diperlukan untuk produksi.
#else
  WiFiClient client;
#endif
  HTTPClient http;
  http.setTimeout(2000);

  if (!http.begin(client, API_READINGS_URL)) {
    Serial.println("Gagal memulai koneksi API sensor.");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  int kodeHTTP = http.POST(paket.payload);
  if (kodeHTTP == HTTP_CODE_CREATED) {
    Serial.println("Data sensor berhasil dikirim ke API.");
  } else {
    Serial.printf("Gagal mengirim data sensor (HTTP %d)\n", kodeHTTP);
  }

  http.end();
}

void tugasJaringan(void* parameter) {
  (void)parameter;
  PaketTelemetri paket;

  for (;;) {
    jagaKoneksiWiFi();

    if (WiFi.status() == WL_CONNECTED &&
        xQueueReceive(antreanTelemetri, &paket, 0) == pdTRUE) {
      kirimDataSensorKeAPI(paket);
    }

    cekPerintahLampuDariAPI();
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

// =================================
// FUNGSI MEMBACA WATER LEVEL
// =================================
int bacaWaterLevel() {
  return analogRead(WATER_LEVEL_PIN);
}

// =================================
// FUNGSI MENGHITUNG TINGGI AIR
// =================================
float hitungTinggiAir(int nilaiADC) {

  float tinggiAir =
    (float)(nilaiADC - NILAI_ADC_KERING) /
    (float)(NILAI_ADC_REFERENSI - NILAI_ADC_KERING) *
    TINGGI_REFERENSI_CM;

  if (tinggiAir < 0) {
    tinggiAir = 0;
  }

  return tinggiAir;
}

// =================================
// FUNGSI MENGAKTIFKAN BUZZER
// =================================
void aktifkanAlarm(const char* sumber) {

  alarmAktif = true;
  waktuMulaiBuzzer = millis();

  digitalWrite(BUZZER_PIN, BUZZER_ON_LEVEL);

  Serial.println();
  Serial.println("!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  Serial.println("       PERINGATAN ALARM");
  Serial.print("Sumber Deteksi : ");
  Serial.println(sumber);
  Serial.println("BUZZER MENYALA 10 DETIK");
  Serial.println("!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
}

// =================================
// FUNGSI MENGATUR BUZZER
// =================================
void cekBuzzer() {

  unsigned long waktuSekarang = millis();

  if (alarmAktif) {

    if (
      waktuSekarang - waktuMulaiBuzzer
      < DURASI_BUZZER
    ) {

      digitalWrite(BUZZER_PIN, BUZZER_ON_LEVEL);

    } else {

      alarmAktif = false;

      digitalWrite(
        BUZZER_PIN,
        BUZZER_ON_LEVEL == HIGH ? LOW : HIGH
      );

      Serial.println();
      Serial.println("================================");
      Serial.println("ALARM 10 DETIK SELESAI");
      Serial.println("BUZZER MATI");
      Serial.println("Menunggu deteksi berikutnya");
      Serial.println("================================");
    }

  } else {

    digitalWrite(
      BUZZER_PIN,
      BUZZER_ON_LEVEL == HIGH ? LOW : HIGH
    );
  }
}

// =================================
// FUNGSI WATER LEVEL
// =================================
void cekWaterLevel() {

  unsigned long waktuSekarang = millis();

  const unsigned long intervalSampel =
    INTERVAL_BACA_AIR / JUMLAH_SAMPEL_AIR;
  if (waktuSekarang - waktuSampelAirTerakhir >= intervalSampel) {
    waktuSampelAirTerakhir = waktuSekarang;
    totalSampelAir += bacaWaterLevel();
    jumlahSampelAir++;

    if (jumlahSampelAir >= JUMLAH_SAMPEL_AIR) {
      nilaiAirTerakhir = totalSampelAir / JUMLAH_SAMPEL_AIR;
      totalSampelAir = 0;
      jumlahSampelAir = 0;
      statusBanjir = (nilaiAirTerakhir >= BATAS_BANJIR);

      if (statusBanjir && !statusBanjirSebelumnya) {
        aktifkanAlarm("WATER LEVEL / BANJIR");
      }

      statusBanjirSebelumnya = statusBanjir;
    }
  }

  if (
    millis() - waktuSerialAirTerakhir
    >= INTERVAL_SERIAL_AIR
  ) {

    waktuSerialAirTerakhir = millis();

    Serial.println();
    Serial.println("================================");
    Serial.println("       MONITORING WATER LEVEL");
    Serial.println("================================");

    Serial.print("Nilai ADC Sensor : ");
    Serial.println(nilaiAirTerakhir);

    Serial.print("Batas ADC Banjir : ");
    Serial.println(BATAS_BANJIR);

    if (KALIBRASI_AKTIF) {

      float tinggiAir = hitungTinggiAir(nilaiAirTerakhir);

      Serial.print("Tinggi Air       : ");
      Serial.print(tinggiAir, 2);
      Serial.println(" cm");

    } else {

      Serial.println("Tinggi Air       : Belum dikalibrasi");
    }

    Serial.println(
      statusBanjir ?
      "Kondisi Air      : BANJIR" :
      "Kondisi Air      : NORMAL"
    );
  }
}

// =================================
// FUNGSI SENSOR GETARAN SW-420
// =================================
void cekGetaran() {

  int nilaiSW420 = digitalRead(SW420_PIN);

  statusGetaran = (nilaiSW420 == GETARAN_DETECTED_LEVEL);

  if (statusGetaran && !statusGetaranSebelumnya) {

    Serial.println();
    Serial.println("================================");
    Serial.println("      DETEKSI GETARAN SW-420");
    Serial.println("================================");

    Serial.println("Status Sensor : GETARAN TERDETEKSI");

    aktifkanAlarm("SENSOR GETARAN SW-420");
  }

  statusGetaranSebelumnya = statusGetaran;

}

// =================================
// FUNGSI MENGATUR SERVO SUHU
// Terbuka = 90 derajat, Tertutup = 0 derajat
// =================================
void aturServoSuhu() {

  myServoSuhu.write(
    statusServoSuhuTerbuka ?
    posisiAktif :
    posisiAwal
  );
}

void terapkanOverrideServoSuhuTertunda() {
  if (!overrideServoSuhuTertunda ||
      millis() - waktuMulaiTundaServoSuhu < waktuTundaOverrideWeb) {
    return;
  }

  overrideServoSuhuTertunda = false;
  overrideServoSuhuAktif = true;
  statusServoSuhuManual = statusServoSuhuTertunda;
  statusServoSuhuTerbuka = statusServoSuhuManual;
  aturServoSuhu();
  Serial.println("Override servo suhu dari web diterapkan.");
}

void aturOverrideServoSuhu(bool enabled, bool value) {
  overrideServoSuhuTertunda = false;
  overrideServoSuhuAktif = false;

  if (!enabled) {
    if (suhuValid) {
      if (suhuSekarang > BATAS_SUHU) {
        statusServoSuhuTerbuka = true;
      } else if (suhuSekarang < BATAS_SUHU) {
        statusServoSuhuTerbuka = false;
      }
    }
    aturServoSuhu();
    return;
  }

  if (suhuValid && suhuSekarang > BATAS_SUHU) {
    statusServoSuhuTertunda = value;
    waktuMulaiTundaServoSuhu = millis();
    overrideServoSuhuTertunda = true;
    Serial.println("Override servo suhu dijadwalkan 10 detik.");
    return;
  }

  overrideServoSuhuAktif = true;
  statusServoSuhuManual = value;
  statusServoSuhuTerbuka = value;
  aturServoSuhu();
}

// =================================
// FUNGSI SENSOR SUHU DHT11
// DAN KONTROL SERVO SUHU
// =================================
void cekSuhuDanServo() {

  unsigned long waktuSekarang = millis();

  // Baca DHT11 setiap 2 detik
  if (
    waktuSekarang - waktuBacaSuhuTerakhir
    < INTERVAL_BACA_SUHU
  ) {
    return;
  }

  waktuBacaSuhuTerakhir = waktuSekarang;

  // Baca suhu dan kelembapan
  float hasilSuhu = sensorSuhu.readTemperature();
  float hasilKelembapan = sensorSuhu.readHumidity();

  Serial.println();
  Serial.println("================================");
  Serial.println("       MONITORING DHT11");
  Serial.println("================================");

  // Periksa apakah pembacaan berhasil
  if (isnan(hasilSuhu) || isnan(hasilKelembapan)) {
    suhuValid = false;

    // Servo ditahan di posisi terakhir
    Serial.println("DHT11 : PEMBACAAN GAGAL");
    Serial.println("Periksa kabel DATA GPIO4");
    Serial.println("Servo : POSISI DITAHAN");
    Serial.println("================================");

    return;
  }

  // Simpan hasil pembacaan
  suhuSekarang = hasilSuhu;
  kelembapanSekarang = hasilKelembapan;
  suhuValid = true;

  Serial.print("Suhu Saat Ini       : ");
  Serial.print(suhuSekarang, 1);
  Serial.println(" C");

  Serial.print("Kelembapan Saat Ini : ");
  Serial.print(kelembapanSekarang, 1);
  Serial.println(" %");

  Serial.print("Batas Suhu          : ");
  Serial.print(BATAS_SUHU, 1);
  Serial.println(" C");

  // =================================
  // KONTROL SERVO BERDASARKAN SUHU
  // =================================

  if (!overrideServoSuhuAktif && !overrideServoSuhuTertunda &&
      suhuSekarang > BATAS_SUHU) {

    // Di atas 28 derajat: buka 90 derajat
    // dan tetap terbuka selama suhu belum turun di bawah 28
    statusServoSuhuTerbuka = true;

  } else if (!overrideServoSuhuAktif && !overrideServoSuhuTertunda &&
             suhuSekarang < BATAS_SUHU) {

    // Di bawah 28 derajat: tutup ke 0 derajat
    statusServoSuhuTerbuka = false;
  }

  // Tepat 28 derajat: status tidak diubah (posisi ditahan)

  if (statusServoSuhuTerbuka) {

    Serial.println("Kondisi             : SUHU DI ATAS/SAMA BATAS");
    Serial.println("Servo               : TERBUKA (90 derajat)");

  } else {

    Serial.println("Kondisi             : SUHU DI BAWAH BATAS");
    Serial.println("Servo               : TERTUTUP (0 derajat)");
  }

  // Terapkan posisi servo
  aturServoSuhu();

  Serial.println("================================");
}

void bacaUltrasonikNonblocking() {
  unsigned long waktuSekarang = micros();

  if (statusPengukuranUltrasonik == 0 &&
      waktuSekarang - waktuTriggerUltrasonik >= INTERVAL_ULTRASONIC_US) {
    digitalWrite(TRIG_PIN, LOW);
    waktuMulaiPulsaTrigger = waktuSekarang;
    statusPengukuranUltrasonik = 4;
    return;
  }

  if (statusPengukuranUltrasonik == 4 &&
      waktuSekarang - waktuMulaiPulsaTrigger >= 2UL) {
    digitalWrite(TRIG_PIN, HIGH);
    waktuMulaiPulsaTrigger = waktuSekarang;
    waktuTriggerUltrasonik = waktuSekarang;
    statusPengukuranUltrasonik = 1;
  }

  if (statusPengukuranUltrasonik == 1 &&
      waktuSekarang - waktuMulaiPulsaTrigger >= 10UL) {
    digitalWrite(TRIG_PIN, LOW);
    statusPengukuranUltrasonik = 2;
  }

  if (statusPengukuranUltrasonik == 2) {
    if (digitalRead(ECHO_PIN) == HIGH) {
      waktuMulaiEcho = waktuSekarang;
      statusPengukuranUltrasonik = 3;
    } else if (waktuSekarang - waktuTriggerUltrasonik >= TIMEOUT_ULTRASONIC_US) {
      jarakValid = false;
      statusPengukuranUltrasonik = 0;
    }
  } else if (statusPengukuranUltrasonik == 3) {
    if (digitalRead(ECHO_PIN) == LOW) {
      unsigned long durasi = waktuSekarang - waktuMulaiEcho;
      jarakTerakhir = durasi * 0.0343f / 2.0f;
      jarakValid = true;
      statusPengukuranUltrasonik = 0;
    } else if (waktuSekarang - waktuMulaiEcho >= TIMEOUT_ULTRASONIC_US) {
      jarakValid = false;
      statusPengukuranUltrasonik = 0;
    }
  }
}

void terapkanPerintahApiLokal() {
  PaketPerintah perintah;
  if (antreanPerintah != nullptr &&
      xQueueReceive(antreanPerintah, &perintah, 0) == pdTRUE &&
      strcmp(perintah.updatedAt, updatedAtPerintahTerakhir) != 0) {
    strncpy(
      updatedAtPerintahTerakhir,
      perintah.updatedAt,
      sizeof(updatedAtPerintahTerakhir) - 1
    );

    if (perintah.rgbLedOn != statusLampuRGB) {
      statusLampuRGB = perintah.rgbLedOn;
      aturLampuRGB();
    }

    if (!statusPerintahLampuJalanDiketahui ||
        perintah.streetLightOverrideEnabled != perintahLampuJalanAktif ||
        (perintah.streetLightOverrideEnabled &&
         perintah.streetLightOverride != nilaiPerintahLampuJalan)) {
      aturOverrideLampuJalan(
        perintah.streetLightOverrideEnabled,
        perintah.streetLightOverride
      );
      statusPerintahLampuJalanDiketahui = true;
      perintahLampuJalanAktif = perintah.streetLightOverrideEnabled;
      nilaiPerintahLampuJalan = perintah.streetLightOverride;
    }

    if (!statusPerintahServoSuhuDiketahui ||
        perintah.temperatureServoOverrideEnabled != perintahServoSuhuAktif ||
        (perintah.temperatureServoOverrideEnabled &&
         perintah.temperatureServoOverride != nilaiPerintahServoSuhu)) {
      aturOverrideServoSuhu(
        perintah.temperatureServoOverrideEnabled,
        perintah.temperatureServoOverride
      );
      statusPerintahServoSuhuDiketahui = true;
      perintahServoSuhuAktif = perintah.temperatureServoOverrideEnabled;
      nilaiPerintahServoSuhu = perintah.temperatureServoOverride;
    }
  }
}

// =================================
// SETUP
// =================================
void setup() {

  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  waktuCobaWiFiTerakhir = millis();
  Serial.println("Wi-Fi menghubungkan di latar belakang.");

  // SETUP ULTRASONIC
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  // SETUP PIR
  pinMode(PIR_PIN, INPUT);

  // SETUP IR SLOT
  pinMode(IR_SLOT_A_PIN, INPUT);
  pinMode(IR_SLOT_B_PIN, INPUT);
  pinMode(IR_SLOT_C_PIN, INPUT);

  // SETUP LDR
  pinMode(LDR_PIN, INPUT);

  // RESOLUSI ADC ESP32
  analogReadResolution(12);

  // SETUP WATER LEVEL
  pinMode(WATER_LEVEL_PIN, INPUT);

  // SETUP SENSOR GETARAN SW-420
  pinMode(SW420_PIN, INPUT);

  // SETUP LED JALAN
  pinMode(LED_JALAN_PIN, OUTPUT);

  digitalWrite(
    LED_JALAN_PIN,
    LED_ON_LEVEL == HIGH ? LOW : HIGH
  );

  // SETUP LED RGB
  pinMode(LED_RGB_R_PIN, OUTPUT);
  pinMode(LED_RGB_G_PIN, OUTPUT);
  pinMode(LED_RGB_B_PIN, OUTPUT);

  // SETUP BUZZER
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(
    BUZZER_PIN,
    BUZZER_ON_LEVEL == HIGH ? LOW : HIGH
  );

  // SETUP TRAFFIC LIGHT
  pinMode(TRAFFIC_RED_PIN, OUTPUT);
  pinMode(TRAFFIC_YELLOW_PIN, OUTPUT);
  pinMode(TRAFFIC_GREEN_PIN, OUTPUT);

  digitalWrite(TRAFFIC_RED_PIN, LOW);
  digitalWrite(TRAFFIC_YELLOW_PIN, LOW);
  digitalWrite(TRAFFIC_GREEN_PIN, HIGH);

  statusTrafficLight = 0;
  waktuTrafficTerakhir = millis();

  // =================================
  // SETUP SENSOR DHT11
  // =================================
  sensorSuhu.begin();

  Serial.println();
  Serial.println("================================");
  Serial.println("       CEK SENSOR DHT11");
  Serial.println("================================");
  Serial.println("Status DHT11 : DIINISIALISASI");
  Serial.println("Pin DATA     : GPIO4");
  Serial.println("Tipe Sensor  : DHT11");

  Serial.print("Batas suhu   : ");
  Serial.print(BATAS_SUHU);
  Serial.println(" C");

  Serial.println("================================");

  // Supaya pembacaan pertama segera dilakukan
  waktuBacaSuhuTerakhir =
    millis() - INTERVAL_BACA_SUHU;

  // SETUP LCD
  Wire.begin(SDA_PIN, SCL_PIN);

  lcd.init();
  lcd.backlight();
  lcd.clear();

  lcd.clear();

  // SETUP SERVO 1
  myServo.setPeriodHertz(50);
  myServo.attach(SERVO_PIN, 500, 2400);
  myServo.write(posisiAwal);

  // SETUP SERVO 2
  myServo2.setPeriodHertz(50);
  myServo2.attach(SERVO2_PIN, 500, 2400);
  myServo2.write(posisiAwal);

  // SETUP SERVO SUHU (kondisi awal tertutup)
  myServoSuhu.setPeriodHertz(50);
  myServoSuhu.attach(SERVO_SUHU_PIN, 500, 2400);
  statusServoSuhuTerbuka = false;
  aturServoSuhu();

  // INFORMASI SERIAL
  Serial.println();
  Serial.println("================================");
  Serial.println("   SISTEM SMART CITY & HOME");
  Serial.println("================================");

  Serial.println("Ultrasonic : Palang Masuk");
  Serial.println("Servo 1    : Palang Masuk");

  Serial.println("PIR        : Palang Keluar");
  Serial.println("Servo 2    : Palang Keluar");

  Serial.println("Output A/B/C: Slot Parkir");
  Serial.println("LCD 1602   : Tampilan Slot");

  Serial.println("LDR        : Deteksi Cahaya");
  Serial.println("LED GPIO26 : Lampu Jalan");

  Serial.println("Traffic    : GPIO32,15,2");

  Serial.println("Water Level: GPIO35");
  Serial.println("SW-420     : GPIO25");

  Serial.println("Buzzer     : GPIO27");
  Serial.println("Buzzer     : Water Level + SW-420");

  Serial.println("Durasi Alarm: 10 Detik");
  Serial.println("Waktu Traffic: 10 Detik");
  Serial.println("Waktu Palang : 3 Detik");

  Serial.println("--------------------------------");

  Serial.println("DHT11      : GPIO4");
  Serial.println("Servo Suhu : GPIO23");
  Serial.println("Servo Suhu : Kontrol Suhu Otomatis");

  Serial.print("Batas Suhu : ");
  Serial.print(BATAS_SUHU);
  Serial.println(" Derajat Celsius");

  Serial.println("LED RGB    : R=GPIO16, G=GPIO17, B=GPIO19");
  Serial.println("LED RGB    : B/GPIO19 dikontrol dari dashboard");

  Serial.println("================================");

  cekSlotParkir();
  cekLampuJalan();
  cekTrafficLight();
  aturLampuRGB();

  waktuSerialAirTerakhir = millis();

  Serial.println();
  Serial.println("Monitoring Water Level dimulai.");
  Serial.println("Monitoring SW-420 dimulai.");
  Serial.println("Monitoring DHT11 dimulai.");

  waktuTriggerUltrasonik = micros() - INTERVAL_ULTRASONIC_US;
  waktuSampelAirTerakhir = millis();
  waktuKirimApiTerakhir = millis() - INTERVAL_KIRIM_API;
  antreanTelemetri = xQueueCreate(1, sizeof(PaketTelemetri));
  antreanPerintah = xQueueCreate(1, sizeof(PaketPerintah));

  if (antreanTelemetri == nullptr || antreanPerintah == nullptr) {
    Serial.println("Gagal membuat antrean jaringan; API tidak dijalankan.");
    return;
  }

  BaseType_t statusTask = xTaskCreatePinnedToCore(
    tugasJaringan,
    "tugasJaringan",
    8192,
    nullptr,
    1,
    nullptr,
    0
  );
  if (statusTask != pdPASS) {
    Serial.println("Gagal membuat task jaringan; API tidak dijalankan.");
  }
}

// =================================
// LOOP
// =================================
void loop() {

  unsigned long waktuSekarang = millis();

  terapkanPerintahApiLokal();
  bacaUltrasonikNonblocking();

  // =================================
  // BAGIAN 1
  // ULTRASONIC DAN SERVO 1
  // PALANG MASUK
  // =================================

  bool kendaraanMasuk = jarakValid && jarakTerakhir <= batasJarak;

  if (kendaraanMasuk) {
    bool palangBaruTerbuka = !statusPalangMasuk;
    statusPalangMasuk = true;
    waktuMasuk = waktuSekarang;
    if (palangBaruTerbuka) {
      myServo.write(posisiAktif);
      Serial.println("Palang masuk TERBUKA");
    }
  } else if (statusPalangMasuk &&
             waktuSekarang - waktuMasuk >= waktuTunggu) {
    statusPalangMasuk = false;
    myServo.write(posisiAwal);
    Serial.println("Palang masuk TERTUTUP");
  }

  // =================================
  // BAGIAN 2
  // PIR DAN SERVO 2
  // PALANG KELUAR
  // =================================

  int statusPIR = digitalRead(PIR_PIN);

  bool kendaraanKeluar = (statusPIR == HIGH);
  pirTerdeteksi = kendaraanKeluar;

  if (kendaraanKeluar) {
    bool palangBaruTerbuka = !statusPalangKeluar;
    statusPalangKeluar = true;
    waktuKeluar = waktuSekarang;
    if (palangBaruTerbuka) {
      myServo2.write(posisiAktif);
      Serial.println("Palang keluar TERBUKA");
    }
  } else if (statusPalangKeluar &&
             waktuSekarang - waktuKeluar >= waktuTunggu) {
    statusPalangKeluar = false;
    myServo2.write(posisiAwal);
    Serial.println("Palang keluar TERTUTUP");
  }

  // =================================
  // BAGIAN 3
  // IR SENSOR SLOT PARKIR
  // =================================

  cekSlotParkir();

  // =================================
  // BAGIAN 4
  // LDR DAN LED LAMPU JALAN
  // =================================

  cekLampuJalan();

  // =================================
  // BAGIAN 5
  // TRAFFIC LIGHT
  // =================================

  cekTrafficLight();

  // =================================
  // BAGIAN 6
  // WATER LEVEL
  // =================================

  cekWaterLevel();

  // =================================
  // BAGIAN 7
  // SENSOR GETARAN SW-420
  // =================================

  cekGetaran();

  // =================================
  // BAGIAN 8
  // BUZZER GABUNGAN
  // =================================

  cekBuzzer();

  // =================================
  // BAGIAN 9
  // SENSOR SUHU DHT11 DAN SERVO SUHU
  // =================================

  cekSuhuDanServo();
  terapkanOverrideServoSuhuTertunda();

  jadwalkanDataSensorKeAPI();
}