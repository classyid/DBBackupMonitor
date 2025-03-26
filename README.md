# DBBackupMonitor

![Dashboard](https://blog.classy.id/upload/gambar_berita/b79dba55d5874719fcfb872fd6dd7b65_20250326153941.png)

Sistem monitoring backup database untuk Classy Indonesia yang memvisualisasikan proses, status, dan statistik backup database secara real-time.

## Fitur

- **Dashboard Real-time**: Visualisasi status backup terkini, termasuk tingkat keberhasilan dan kegagalan
- **Analisis Performa**: Statistik dan grafik tentang performa backup selama periode waktu tertentu
- **Detail Session**: Informasi mendalam tentang setiap sesi backup
- **Monitoring User**: Pantau kinerja backup per pengguna MySQL
- **Analisis Error**: Identifikasi dan analisis pola error dalam proses backup
- **Notifikasi Telegram**: Histori notifikasi yang dikirim via Telegram

## Teknologi

- **Backend**: Google Apps Script dengan JdbcConnection ke MySQL
- **Frontend**: HTML, JavaScript, Tailwind CSS
- **Database**: MySQL
- **Visualisasi**: Chart.js

## Struktur Database

Sistem ini menggunakan skema database berikut:

- `backup_sessions`: Data master untuk setiap sesi backup
- `user_backups`: Backup per pengguna MySQL
- `database_backups`: Status backup individu per database
- `backup_logs`: Log detail dari proses backup
- `telegram_notifications`: Notifikasi yang dikirim via bot Telegram

## Instalasi

1. Buat project baru di Google Apps Script
2. Copy file `code.gs` dan `index.html` ke project Anda
3. Update konfigurasi database di `code.gs`:
   ```javascript
   const DB_CONFIG = {
     host: 'your-db-host',
     user: 'your-username',
     password: 'your-password',
     database: 'your-database'
   };
   ```
4. Deploy sebagai web app dengan akses sesuai kebutuhan

## Penggunaan

Setelah deployment, buka URL web app untuk mengakses dashboard monitoring. Navigasi menggunakan menu di sidebar untuk mengakses berbagai fitur:

- **Dashboard**: Ringkasan statistik dan status terkini
- **Analytics**: Analisis performa backup dalam jangka waktu tertentu
- **Backup Sessions**: Daftar lengkap sesi backup
- **MySQL Users**: Statistik per pengguna MySQL
- **Logs**: Catatan aktivitas sistem
- **Errors**: Analisis kesalahan yang terjadi

## Pengembangan Mendatang

- Implementasi fitur notifikasi email
- Integrasi dengan layanan cloud storage
- Ekspor data ke format CSV/Excel
- Dashboard yang dapat dikustomisasi
- Sistem pelaporan otomatis berkala

## Pembuat

Dikembangkan oleh Tim IT Classy Indonesia untuk kebutuhan internal monitoring backup database.
