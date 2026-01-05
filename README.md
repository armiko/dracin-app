Panduan Upload ke GitHub - NontonDracin App

Ikuti langkah-langkah di bawah ini untuk mengunggah kode dari Canvas ke GitHub dengan susunan folder yang benar.

1. Susunan Folder Proyek

Pastikan folder proyek Anda di komputer memiliki struktur seperti ini:

NontonDracin/
├── index.html
├── package.json
├── vite.config.js
├── README.md
└── src/
    ├── main.jsx
    └── App.jsx (Salin kode dari Canvas ke sini)


2. Cara Mengunggah ke GitHub (Repositori Kosong)

Buka terminal atau CMD di dalam folder proyek Anda, lalu jalankan perintah berikut secara berurutan:

Inisialisasi Git:

git init


Tambahkan semua file:

git add .


Lakukan commit pertama:

git commit -m "Initial commit: NontonDracin App"


Hubungkan ke repositori GitHub Anda:
(Ganti URL di bawah dengan URL repositori yang Anda buat di GitHub)

git remote add origin [https://github.com/username/nama-repo.git](https://github.com/username/nama-repo.git)


Ganti nama branch ke main:

git branch -M main


Upload kode:

git push -u origin main


3. Cara Menjalankan di Lokal

Jika Anda ingin menjalankan aplikasi ini di komputer sendiri:

Install dependensi: npm install

Jalankan server: npm run dev
