# Avsec BWX Web App

Repositori ini ditata ulang mengikuti pola PWA sederhana: seluruh aset statis berada di `public/` sementara sumber kode JavaScript modular disimpan di `src/`. Folder `public/js/` tetap ada sebagai hasil salinan dari modul `src/` supaya Cloudflare Pages atau GitHub Pages dapat melayani berkas tanpa proses bundling tambahan. Seluruh halaman lama tetap dipertahankan sehingga fungsi web versi sebelumnya tidak berubah, hanya lokasi berkasnya saja yang dirapikan agar konsisten.

## Struktur direktori

```
pwa-app/
├─ public/
│  ├─ *.html              # Semua halaman legacy: login, home, ACP, dsb.
│  ├─ styles/             # CSS tiap halaman (`/styles/*.css`)
│  ├─ js/                 # Output hasil salinan dari folder src/
│  ├─ icons/              # Ikon PWA (favicon & maskable icons)
│  ├─ assets/             # Gambar/logo aplikasi lain yang dipakai halaman
│  ├─ manifest.webmanifest# Manifest PWA
│  └─ sw.js               # Service Worker root scope
├─ src/
│  ├─ app.js              # Entry helper memuat modul legacy
│  ├─ router.js           # Router hash → halaman legacy
│  ├─ pages/              # Modul untuk tiap halaman legacy
│  └─ components/         # Komponen kecil yang dipakai lintas halaman
├─ package.json           # Script dev-server opsional
├─ .gitignore
└─ README.md
```

> **Catatan:** Semua referensi pada HTML sudah diarahkan ke path absolut seperti `/styles/*.css`, `/js/pages/*.js`, dan `/js/offline.js`. Jika menambahkan halaman baru, tulis modulnya di `src/pages/` lalu jalankan `npm run build` agar tersalin ke `public/js/pages/` sebelum dipanggil lewat `<script type="module" src="/js/pages/nama.js"></script>`.

## Menjalankan secara lokal

Tidak ada dependensi build khusus. Untuk menyalakan server statis lokal bisa menggunakan `npx`:

```bash
npm start        # alias npx serve public
```

Atau gunakan server statis lain seperti `npx http-server public`. Pastikan root server diarahkan ke folder `public/` karena seluruh HTML dan aset berada di sana.

### Service Worker & PWA

- `public/manifest.webmanifest` dan ikon di `public/icons/` mengaktifkan fitur instalasi PWA.
- `public/sw.js` memuat ulang cache versi baru setiap kali `VERSION` diperbarui.
- Modul `public/js/offline.js` otomatis memasang banner saat koneksi terputus.

## Firebase & variabel lingkungan

Aplikasi ini memakai Firebase (Auth & Realtime Database). Seluruh konfigurasi berada langsung di berkas JavaScript karena sebelumnya juga ditanam langsung. Tidak ada variabel lingkungan tambahan.

## Menambahkan aset

- Simpan gambar/logo tambahan ke `public/assets/` lalu rujuk via `/assets/nama-file.ext`.
- Tambah ikon baru (ukuran 48–512) ke `public/icons/` hanya bila diperlukan oleh manifest/install prompt.

## Utilitas modular

`public/js/app.js` menyediakan helper untuk memuat modul legacy secara dinamis jika ingin membuat halaman SPA di masa mendatang tanpa menghilangkan halaman lama. `public/js/components/modal.js` berisi utilitas modal kecil yang bisa dipakai kembali lintas halaman.
