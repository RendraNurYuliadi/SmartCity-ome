# Smart Home & City IoT

Dashboard Next.js untuk menerima telemetri ESP32, menyimpan 50 pembacaan terbaru di MongoDB, dan mengendalikan LED RGB biru pada GPIO19.

## Stack

- Node.js 20.9 atau lebih baru (proyek ini memakai Node.js 22).
- Next.js, React, Tailwind CSS, MongoDB Node.js Driver, dan Recharts.
- MongoDB database: `smart_home_city`.
- Collections: `sensor_readings` (capped, maksimum 50 dokumen) dan `device_commands`. Jika `sensor_readings` sudah ada sebagai collection biasa, data lamanya dipertahankan dan aplikasi menggunakan `sensor_readings_latest50` sebagai collection capped.

## Skema MongoDB

`sensor_readings` memvalidasi setiap dokumen dengan skema MongoDB:

```json
{
  "deviceId": "esp32-smart-city",
  "recordedAt": "Date (waktu diterima server)",
  "temperatureC": "number | null",
  "humidityPercent": "number | null",
  "distanceCm": "number | null",
  "parking": {
    "slotAOccupied": "boolean",
    "slotBOccupied": "boolean",
    "slotCOccupied": "boolean",
    "occupied": "number",
    "available": "number"
  },
  "pirDetected": "boolean",
  "ldrRaw": "number",
  "streetLightOn": "boolean",
  "waterLevelRaw": "number",
  "floodDetected": "boolean",
  "vibrationDetected": "boolean",
  "rgbLedOn": "boolean",
  "trafficLight": "green | yellow | red",
  "entryGateOpen": "boolean",
  "exitGateOpen": "boolean"
}
```

`device_commands` menyimpan `{ "_id": "esp32-smart-city", "rgbLedOn": "boolean", "updatedAt": "Date" }`.

## Menjalankan lokal

1. Pastikan MongoDB berjalan dan dapat diakses.
2. Salin `.env.example` menjadi `.env.local`; sesuaikan `MONGODB_URI` dan `MONGODB_DB` bila perlu.
3. Instal dependensi dengan `npm install`.
4. Siapkan collections dengan `npm run db:setup`. Aplikasi juga membuat collections saat pertama kali menerima request.
5. Jalankan `npm run dev`, lalu buka `http://localhost:3000` pada komputer server. Untuk ESP32, gunakan IPv4 komputer tersebut (lihat `ipconfig`) dan port `3000`.

Di firmware, isi `WIFI_SSID` dan `WIFI_PASSWORD`, lalu ubah alamat `192.168.1.10` pada `API_READINGS_URL` dan `API_COMMANDS_URL` menjadi IPv4 komputer Anda. ESP32 dan komputer harus berada pada Wi-Fi/jaringan yang sama. Firewall Windows mungkin perlu mengizinkan koneksi masuk untuk Node.js pada jaringan privat.

Collection pembacaan aktif adalah capped collection MongoDB dengan `max: 50`. Saat pembacaan baru masuk, MongoDB otomatis menimpa/mengeluarkan dokumen paling lama; tidak ada proses pembersihan berkala atau risiko penumpukan melewati batas 50. Data diurutkan menurut waktu penerimaan server.

## API

- `POST /api/readings` — menerima satu pembacaan sensor dari ESP32.
- `GET /api/readings?limit=50` — membaca paling banyak 50 data terbaru.
- `GET /api/commands` — membaca status perintah LED terakhir.
- `POST /api/commands` dengan `{"rgbLedOn":true}` atau `{"rgbLedOn":false}` — mengubah status perintah LED.

Dashboard memeriksa API setiap 1,5 detik. ESP32 mengirim telemetri setiap 2 detik dan memeriksa perintah setiap 1 detik. Polling ini juga kompatibel dengan deployment serverless Vercel tanpa koneksi WebSocket permanen.

API tidak memakai autentikasi sesuai kebutuhan proyek ini. Endpoint yang dipublikasikan dapat menerima data/perintah dari siapa saja; gunakan hanya pada jaringan/lingkungan yang sesuai.

## Deploy ke Vercel (nanti)

1. Push folder proyek ke repository Git dan impor repository tersebut di Vercel.
2. Siapkan MongoDB yang bisa diakses publik dari Vercel, misalnya MongoDB Atlas. URI `mongodb://localhost:27017` hanya berlaku di komputer lokal dan **tidak dapat dipakai dari Vercel**.
3. Isi Vercel Project → Settings → Environment Variables:
   - `MONGODB_URI`: connection string Atlas.
   - `MONGODB_DB`: `smart_home_city`.
4. Pastikan akses jaringan/IP Vercel ke MongoDB diizinkan, lalu deploy. Collection capped dibuat otomatis pada request pertama.
5. Ubah kedua URL firmware menjadi URL deployment HTTPS, lalu set `API_USE_HTTPS` ke `1`.

## Menghubungkan ESP32

Kode lengkap yang diperbarui ada di [`Code_iot_esp_32_Update.txt`](./Code_iot_esp_32_Update.txt). Konfigurasi awal file memakai HTTP lokal; sebelum kompilasi:

1. Pasang library ArduinoJson, DHT sensor library, LiquidCrystal I2C, dan ESP32Servo di Arduino IDE.
2. Isi `WIFI_SSID`, `WIFI_PASSWORD`, serta IPv4 komputer lokal pada URL API di bagian atas file.
3. Simpan/ubah file menjadi `.ino`, pilih board ESP32, lalu upload.
4. Pastikan ESP32 dan komputer server terhubung ke jaringan yang sama. Perintah LED mengubah kanal B pada GPIO19; kanal R/G tetap mati.

Firmware mempertahankan sensor yang sudah ada pada sketch awal (ultrasonik, PIR, IR parkir, LDR, water-level, SW-420, DHT11, lampu lalu lintas, servo, buzzer, dan LCD) serta mengirim nilainya ke API.

> Saat nanti beralih ke Vercel, mode HTTPS firmware saat ini memakai `WiFiClientSecure::setInsecure()` untuk memudahkan pengujian. Untuk produksi, sebaiknya gunakan `setCACert()` dan root CA yang sesuai.
