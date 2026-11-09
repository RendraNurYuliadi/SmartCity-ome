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
5. Jalankan `npm run dev`, lalu buka `http://localhost:3000` pada komputer server. Untuk ESP32 lokal, gunakan IPv4 komputer tersebut (lihat `ipconfig`) dan port `3000`.

Di firmware untuk penggunaan lokal, isi `WIFI_SSID` dan `WIFI_PASSWORD`, lalu ubah alamat `192.168.1.10` pada `API_READINGS_URL` dan `API_COMMANDS_URL` menjadi IPv4 komputer Anda. ESP32 dan komputer harus berada pada Wi-Fi/jaringan yang sama. Firewall Windows mungkin perlu mengizinkan koneksi masuk untuk Node.js pada jaringan privat.

Collection pembacaan aktif adalah capped collection MongoDB dengan `max: 50`. Saat pembacaan baru masuk, MongoDB otomatis menimpa/mengeluarkan dokumen paling lama; tidak ada proses pembersihan berkala atau risiko penumpukan melewati batas 50. Data diurutkan menurut waktu penerimaan server.

## API

- `POST /api/readings` — menerima satu pembacaan sensor dari ESP32.
- `GET /api/readings?limit=50` — membaca paling banyak 50 data terbaru.
- `GET /api/commands` — membaca status perintah LED terakhir.
- `POST /api/commands` dengan `{"rgbLedOn":true}` atau `{"rgbLedOn":false}` — mengubah status perintah LED.
- `GET /api/messages` — mengambil inbox dan jumlah pesan belum dibaca.
- `POST /api/messages` dengan `{"ids":["<message-id>"]}` atau `{"all":true}` — menandai pesan sudah dibaca.
- `POST /api/chat` — mengambil snapshot sensor langsung dari MongoDB lalu mengirim pertanyaan dan snapshot tersebut ke model AI gratis OpenRouter.

Pesan dibuat saat sensor berubah menjadi kondisi banjir, getaran, gerakan, suhu di atas 28 °C, atau parkir penuh. Dashboard memeriksa data dan badge pesan setiap 1,5 detik; membuka pesan menandainya sudah dibaca dan mengurangi angka badge.

Dashboard memeriksa API setiap 1,5 detik. ESP32 mengirim telemetri setiap 2 detik dan memeriksa perintah setiap 1 detik. Polling ini juga kompatibel dengan deployment serverless Vercel tanpa koneksi WebSocket permanen.

## Chatbot OpenRouter gratis

Chatbot hanya mengirim request ke model router [`openrouter/free`](https://openrouter.ai/docs/guides/routing/routers/free-router), yang memilih model gratis OpenRouter dan tidak memakai fallback ke model berbayar. Model gratis dapat memiliki batas/rate limit dan kadang tidak tersedia; jika limit tercapai, coba lagi nanti.

1. Buat API key OpenRouter baru di [OpenRouter API Keys](https://openrouter.ai/settings/keys). Jangan gunakan key yang pernah ditempel di chat; buat ulang jika key tersebut pernah aktif.
2. Di Vercel → Project → Settings → Environment Variables, tambahkan `OPENROUTER_API_KEY` dengan key baru sebagai value. Jangan tambahkan `NEXT_PUBLIC_` pada nama variabel.
3. Pilih Production dan Preview, simpan, lalu redeploy agar variable diterapkan.
4. Untuk penggunaan lokal, tambahkan `OPENROUTER_API_KEY=<key-baru>` ke `.env.local` yang diabaikan Git.

Key hanya dibaca server-side; tidak pernah dikirim ke browser. Setiap pertanyaan mengambil lima pembacaan ESP32 terbaru langsung dari MongoDB sebelum prompt dikirim. Prompt juga menjelaskan semua variabel, pin, logika sensor, dan ambang firmware.

Custom system prompt chatbot dapat diedit di `src/lib/chat-prompt.ts`. Instruksi format jawabannya menggunakan Markdown; dashboard merender heading, teks tebal, daftar, tabel, dan blok kode dengan styling khusus.

API tidak memakai autentikasi sesuai kebutuhan proyek ini. Endpoint yang dipublikasikan dapat menerima data/perintah dari siapa saja; gunakan hanya pada jaringan/lingkungan yang sesuai.

## Deploy ke Vercel (nanti)

1. Push folder proyek ke repository Git dan impor repository tersebut di Vercel.
2. Siapkan MongoDB yang bisa diakses publik dari Vercel, misalnya MongoDB Atlas. URI `mongodb://localhost:27017` hanya berlaku di komputer lokal dan **tidak dapat dipakai dari Vercel**.
3. Isi Vercel Project → Settings → Environment Variables:
   - `MONGODB_URI`: connection string Atlas.
   - `MONGODB_DB`: `smart_home_city`.
   - `OPENROUTER_API_KEY`: API key OpenRouter (server-side, tanpa prefix `NEXT_PUBLIC_`).
4. Pastikan akses jaringan/IP Vercel ke MongoDB diizinkan, lalu deploy. Collection capped dibuat otomatis pada request pertama.
5. Ubah kedua URL firmware menjadi URL deployment HTTPS, lalu set `API_USE_HTTPS` ke `1`.

## Menghubungkan ESP32

Kode firmware final satu file ada di `Code_iot_esp_32_Update.txt` dan sudah berisi konfigurasi Wi-Fi serta endpoint Vercel. File ini mengandung password Wi-Fi; jangan commit atau push perubahan lokal tersebut ke repository.

1. Pasang library ArduinoJson, DHT sensor library, LiquidCrystal I2C, dan ESP32Servo di Arduino IDE.
2. Buat sketch baru di Arduino IDE, salin seluruh isi `Code_iot_esp_32_Update.txt`, lalu simpan sebagai `Code_iot_esp_32_Update.ino`.
3. Pilih board dan port ESP32, lalu upload.
4. Pastikan ESP32 tersambung ke internet. Perintah LED mengubah kanal B pada GPIO19; kanal R/G tetap mati.

Untuk mengganti Wi-Fi, edit nilai `WIFI_SSID` dan `WIFI_PASSWORD` di bagian atas file.

Firmware mempertahankan sensor yang sudah ada pada sketch awal (ultrasonik, PIR, IR parkir, LDR, water-level, SW-420, DHT11, lampu lalu lintas, servo, buzzer, dan LCD) serta mengirim nilainya ke API.

ESP32 klasik hanya mendukung Wi-Fi 2,4 GHz. Jika jaringan yang dipilih hanya berjalan pada 5 GHz, aktifkan/pilih SSID 2,4 GHz dari router atau hotspot; jaringan 2,4 GHz dan 5 GHz boleh memakai nama berbeda.

> Saat nanti beralih ke Vercel, mode HTTPS firmware saat ini memakai `WiFiClientSecure::setInsecure()` untuk memudahkan pengujian. Untuk produksi, sebaiknya gunakan `setCACert()` dan root CA yang sesuai.
