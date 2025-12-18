/**
 * app.js - utilitas ringan untuk memuat modul legacy.
 *
 * Halaman lama masih menggunakan model multi-page. Helper di bawah
 * mempermudah pemanggilan modul tersebut secara dinamis jika sewaktu-waktu
 * ingin membuat shell SPA tanpa menghapus halaman eksisting.
 */

const PAGE_LOADERS = {
  login: () => import('./pages/login.js'),
  home: () => import('./pages/home.js'),
  ACP: () => import('./pages/ACP.js'),
  SIDS: () => import('./pages/SIDS.js'),
  boardingpass: () => import('./pages/boardingpass.js'),
  chatbot: () => import('./pages/chatbot.js'),
  check: () => import('./pages/check.js'),
  cuti: () => import('./pages/cuti.js'),
  fuel: () => import('./pages/fuel.js'),
  gate: () => import('./pages/gate.js'),
  gun: () => import('./pages/gun.js'),
  id: () => import('./pages/id.js'),
  kunci: () => import('./pages/kunci.js'),
  'lb_all': () => import('./pages/lb_all.js'),
  plotting: () => import('./pages/plotting.js'),
  random: () => import('./pages/random.js'),
  schedule: () => import('./pages/schedule.js'),
  visit: () => import('./pages/visit.js'),
};

/**
 * Memuat modul legacy berdasarkan nama kunci. Kembalikan modul ES asli
 * sehingga pemanggil bebas mengeksekusi API yang disediakan modul tersebut.
 */
export async function loadLegacyPageModule(pageKey) {
  const normalized = String(pageKey || '').trim();
  const loader = PAGE_LOADERS[normalized];
  if (!loader) {
    const available = Object.keys(PAGE_LOADERS).join(', ');
    throw new Error(`Legacy page '${normalized}' tidak ditemukan. Pilihan: ${available}`);
  }
  return loader();
}

/**
 * Mengembalikan daftar halaman legacy yang tersedia.
 */
export function listLegacyPages() {
  return Object.keys(PAGE_LOADERS);
}

/**
 * Pastikan service worker terpasang jika didukung browser.
 */
export function registerServiceWorker(swUrl = '/sw.js') {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(swUrl).catch((err) => {
    console.warn('Gagal memasang service worker:', err);
  });
}

/**
 * Memastikan banner offline aktif. Mengembalikan modul offline (jika diperlukan).
 */
export async function ensureOfflineBanner() {
  const mod = await import('./offline.js');
  if (typeof mod.initOfflineSheet === 'function') {
    mod.initOfflineSheet();
  }
  return mod;
}
