// ===== Firebase =====
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBc-kE-_q1yoENYECPTLC3EZf_GxBEwrWY",
  authDomain: "avsecbwx-4229c.firebaseapp.com",
  projectId: "avsecbwx-4229c",
  appId: "1:1029406629258:web:53e8f09585cd77823efc73",
  storageBucket: "avsecbwx-4229c.appspot.com",
  messagingSenderId: "1029406629258",
  measurementId: "G-P37F88HGFE",
  databaseURL: "https://avsecbwx-4229c-default-rtdb.firebaseio.com"
};

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

// ===== Utils & WIB =====
const $ = (s, el = document) => el.querySelector(s);

function getWIBDate(d = new Date()) {
  return new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
}
function bannerString() {
  const d = getWIBDate();
  const hari = d.toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();
  const tanggal = d.getDate();
  const bulan = d.toLocaleDateString('id-ID', { month: 'long' }).toLowerCase();
  const tahun = d.getFullYear();
  return `${hari}, ${tanggal} ${bulan} ${tahun}`;
}
function getGreetingID(d = getWIBDate()) {
  const h = d.getHours();
  if (h >= 4 && h < 11)  return "Selamat Pagi,";
  if (h >= 11 && h < 15) return "Selamat Siang,";
  if (h >= 15 && h < 18) return "Selamat Sore,";
  return "Selamat Malam,";
}
function updateGreeting() {
  const greetEl = $("#greet");
  if (greetEl) greetEl.textContent = getGreetingID();

  const k = (greetEl?.textContent || "")
    .replace(/[^\p{L}\s]/gu, "")
    .split(" ")[1];
  const t = {
    Pagi:  "Fokus & semangat produktif ☕",
    Siang: "Jeda sejenak, tarik napas 🌤️",
    Sore:  "Akhiri dengan yang manis ya 😄👍",
    Malam: "Santai kawan, recharge energi dulu 🌙"
  };
  const taglineEl = $("#taglineText");
  if (taglineEl) taglineEl.textContent = t[k] || "Siap bantu aktivitasmu hari ini ✨";

  const bannerEl = $("#dateBanner");
  if (bannerEl) bannerEl.textContent = bannerString();
}

// ===== Avatar default =====
const DEFAULT_AVATAR =
  "data:image/svg+xml;base64," + btoa(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>
      <rect width='128' height='128' rx='18' fill='#0b1220'/>
      <circle cx='64' cy='52' r='22' fill='#9C27B0'/>
      <rect x='26' y='84' width='76' height='26' rx='13' fill='#6A1B9A'/>
    </svg>`
  );

function resolveDisplayName(user){
  if (user?.displayName && user.displayName.trim()) return user.displayName.trim();
  if (user?.email) return user.email.split("@")[0];
  return "Pengguna";
}

function normalizeName(n) {
  return String(n || "")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z\s]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

const NAME_SEPARATOR_REGEX = /\s*(?:[,/&]| dan | and |\+|;|\s-\s|\s\|\s|\n+)\s*/i;

function splitNameCandidates(str) {
  const cleaned = String(str || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  return cleaned
    .split(NAME_SEPARATOR_REGEX)
    .map(part => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function extractNameList(src) {
  if (!src) return [];
  if (Array.isArray(src)) {
    return src.flatMap(item => extractNameList(item)).filter(Boolean);
  }
  if (typeof src === 'object') {
    const names = [];
    if (typeof src.nama === 'string') names.push(...splitNameCandidates(src.nama));
    if (typeof src.name === 'string') names.push(...splitNameCandidates(src.name));
    if (Array.isArray(src.names)) names.push(...extractNameList(src.names));
    if (Array.isArray(src.rows)) names.push(...extractNameList(src.rows));
    if (src.hidden) names.push(...extractNameList(src.hidden));
    if (src.malamSebelum) names.push(...extractNameList(src.malamSebelum));
    if (src.malam_sebelum) names.push(...extractNameList(src.malam_sebelum));
    if (src.extra) names.push(...extractNameList(src.extra));
    return names.filter(Boolean);
  }
  if (typeof src === 'string') {
    return splitNameCandidates(src);
  }
  return [];
}

function addNormalizedNames(targetSet, value) {
  extractNameList(value).forEach(nm => {
    const normalized = normalizeName(nm);
    if (normalized) targetSet.add(normalized);
  });
}

function getHiddenMalamSebelumFromStorage(storageObj){
  if (!storageObj) return [];
  try {
    const raw = storageObj.getItem('roster.malamSebelum');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return extractNameList(parsed?.names || parsed?.rows || parsed);
  } catch {
    return [];
  }
}

function getHiddenMalamSebelumFromScriptTag(){
  try {
    const node = document.getElementById('malamSebelumData');
    if (!node?.textContent) return [];
    const parsed = JSON.parse(node.textContent);
    return extractNameList(parsed?.names || parsed?.rows || parsed);
  } catch {
    return [];
  }
}

function appendHiddenMalamSebelum(targetSet, payload){
  const sources = [];
  if (typeof window !== 'undefined' && window.__ROSTER_HIDDEN?.malamSebelum) {
    sources.push(window.__ROSTER_HIDDEN.malamSebelum);
  }
  if (payload) {
    if (payload.hidden?.malamSebelum) sources.push(payload.hidden.malamSebelum);
    if (payload.hidden?.malam_sebelum) sources.push(payload.hidden.malam_sebelum);
    if (payload.malamSebelum) sources.push(payload.malamSebelum);
    if (payload.malam_sebelum) sources.push(payload.malam_sebelum);
    if (payload.hiddenMalamSebelum) sources.push(payload.hiddenMalamSebelum);
    if (payload.extra?.malamSebelum) sources.push(payload.extra.malamSebelum);
    if (payload.extra?.malam_sebelum) sources.push(payload.extra.malam_sebelum);
  }

  sources.forEach(src => addNormalizedNames(targetSet, src));
  addNormalizedNames(targetSet, getHiddenMalamSebelumFromStorage(window?.sessionStorage));
  addNormalizedNames(targetSet, getHiddenMalamSebelumFromStorage(window?.localStorage));
  addNormalizedNames(targetSet, getHiddenMalamSebelumFromScriptTag());
}

// ===== Cache roster gating =====
const DUTY_CACHE_KEY = 'home.dutyAccessCache';
const DUTY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 jam
const ROSTER_PAYLOAD_CACHE_KEY = 'roster.latestPayload';
const ROSTER_CLASSIFIED_CACHE_KEY = 'roster.latestClassified';
const ROSTER_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 jam untuk data roster lokal

function loadDutyCache(){
  try {
    const raw = localStorage.getItem(DUTY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const ts = Number(parsed.ts) || 0;
    const names = new Set(Array.isArray(parsed.names) ? parsed.names.map(normalizeName) : []);
    return { ts, names };
  } catch {
    return null;
  }
}

function readRosterCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const ts = Number(parsed.ts) || 0;
    const payload = parsed.payload ?? parsed.data ?? parsed;
    if (!payload || typeof payload !== 'object') return null;
    return { ts, payload };
  } catch {
    return null;
  }
}

function isRosterCacheFresh(ts) {
  if (!ts) return false;
  const age = Date.now() - ts;
  return age >= 0 && age <= ROSTER_CACHE_TTL_MS;
}

function saveRosterPayloadCache(payload) {
  try {
    localStorage.setItem(
      ROSTER_PAYLOAD_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), payload })
    );
  } catch {}
}

function saveRosterClassifiedCache(payload) {
  try {
    localStorage.setItem(
      ROSTER_CLASSIFIED_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), payload })
    );
  } catch {}
}

function saveDutyCache(names){
  try {
    const payload = {
      ts: Date.now(),
      names: Array.from(names || []).map(normalizeName)
    };
    localStorage.setItem(DUTY_CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

function isDutyCacheFresh(cache){
  if (!cache) return false;
  const age = Date.now() - (cache.ts || 0);
  return age >= 0 && age <= DUTY_CACHE_TTL_MS;
}

function collectNamesFromRosterPayload(payload){
  const names = new Set();
  const data = payload?.data || payload || {};

  if (Array.isArray(data.rosters)) {
    data.rosters.forEach((row) => {
      if (!row) return;
      addNormalizedNames(names, row.nama || row.name);
    });
  }

  const cfg = data.config || {};
  [
    cfg.chief,
    cfg.assistant_chief,
    cfg.chief2,
    cfg.assistant_chief2,
    cfg.supervisor_pscp,
    cfg.supervisor_hbscp,
    cfg.supervisor_cctv,
    cfg.supervisor_patroli,
    cfg.supervisor_pos1,
    cfg.pic_malam,
    cfg.picMalam,
  ].forEach(value => addNormalizedNames(names, value));

  appendHiddenMalamSebelum(names, payload);
  appendHiddenMalamSebelum(names, data);
  appendHiddenMalamSebelum(names, data?.hidden);

  return names;
}

function collectNamesFromClassified(classified){
  const names = new Set();
  if (!classified || typeof classified !== 'object') return names;

  [
    classified.chief,
    classified.asstChief,
    classified.chief2,
    classified.asstChief2,
    classified.spvPscp,
    classified.spvHbs,
    classified.spvCctv,
    classified.spvPatroli,
    classified.spvPos1,
    classified.picMalam,
    classified.pic_malam,
  ].forEach(value => addNormalizedNames(names, value));

  const rosterKeys = [
    'pos1Arr',
    'angHbs',
    'angPscp',
    'angPatroli',
    'angMalam',
    'angCargo',
    'angArrival',
  ];

  rosterKeys.forEach((key) => {
    const arr = classified[key];
    if (Array.isArray(arr)) {
      arr.forEach((item) => {
        if (item && typeof item === 'object') {
          addNormalizedNames(names, item.nama || item.name);
        } else {
          addNormalizedNames(names, item);
        }
      });
    } else {
      addNormalizedNames(names, arr);
    }
  });

  appendHiddenMalamSebelum(names, classified?.hidden);
  appendHiddenMalamSebelum(names, classified);

  return names;
}

async function tryRosterFallback(loginKey){
  const cache = loadDutyCache();
  if (isDutyCacheFresh(cache)) {
    return { source: 'cache', names: cache.names, isOn: cache.names.has(loginKey) };
  }

  const classifiedCache = readRosterCache(ROSTER_CLASSIFIED_CACHE_KEY);
  if (classifiedCache) {
    const names = collectNamesFromClassified(classifiedCache.payload);
    if (names.size) {
      const fresh = isRosterCacheFresh(classifiedCache.ts);
      if (fresh) saveDutyCache(names);
      return {
        source: fresh ? 'local-classified' : 'local-classified-stale',
        names,
        isOn: names.has(loginKey)
      };
    }
  }

  const payloadCache = readRosterCache(ROSTER_PAYLOAD_CACHE_KEY);
  if (payloadCache) {
    const names = collectNamesFromRosterPayload(payloadCache.payload);
    if (names.size) {
      const fresh = isRosterCacheFresh(payloadCache.ts);
      if (fresh) saveDutyCache(names);
      return {
        source: fresh ? 'local-payload' : 'local-payload-stale',
        names,
        isOn: names.has(loginKey)
      };
    }
  }

  try {
    const snap = await get(child(ref(db), 'roster'));
    if (snap.exists()) {
      const classified = snap.val();
      const names = collectNamesFromClassified(classified);
      if (names.size) {
        saveDutyCache(names);
        saveRosterClassifiedCache(classified);
      }
      return { source: 'rtdb', names, isOn: names.has(loginKey) };
    }
  } catch (err) {
    console.warn('Fallback roster lookup failed', err);
  }

  if (cache) {
    return { source: 'stale-cache', names: cache.names, isOn: cache.names.has(loginKey) };
  }

  return null;
}

// ===== URL helpers (Drive primary+fallback) =====
function cleanURL(s) {
  if (!s) return "";
  return String(s).trim().replace(/^['"]+|['"]+$/g, "");
}
function normalizeDriveURL(u) {
  if (!u) return { primary: "", fallback: "" };
  const url = cleanURL(u);
  const m1 = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  const m2 = url.match(/[?&]id=([^&]+)/i);
  const id = m1 ? m1[1] : (m2 ? m2[1] : null);
  if (!id) return { primary: url, fallback: "" };
  return {
    primary: `https://drive.google.com/uc?export=view&id=${id}`,
    fallback: `https://drive.google.com/thumbnail?id=${id}&sz=w512`
  };
}
async function resolvePhotoURL(raw, user) {
  let url = cleanURL(raw || user?.photoURL || "");
  if (!url) return { primary: "", fallback: "" };
  if (location.protocol === "https:" && url.startsWith("http://"))
    return { primary: "", fallback: "" };
  if (/drive\.google\.com/i.test(url)) return normalizeDriveURL(url);
  return { primary: url, fallback: "" };
}

// ===== Fetch profil dari RTDB =====
async function fetchProfile(user){
  try{
    const root = ref(db);
    const [nameSnap, specSnap, roleSnap, isAdminSnap, photoSnap] = await Promise.all([
      get(child(root, `users/${user.uid}/name`)),
      get(child(root, `users/${user.uid}/spec`)),
      get(child(root, `users/${user.uid}/role`)),
      get(child(root, `users/${user.uid}/isAdmin`)),
      get(child(root, `users/${user.uid}/photoURL`)),
    ]);

    const name = nameSnap.exists() ? String(nameSnap.val()).trim()
               : (user.displayName?.trim() || (user.email?.split("@")[0] ?? "Pengguna"));
    const role = roleSnap.exists() ? String(roleSnap.val()).trim()
               : (isAdminSnap.exists() && isAdminSnap.val() ? "admin" : "user");
    const isAdmin  = isAdminSnap.exists() ? !!isAdminSnap.val() : role === "admin";

    const rawPhoto = photoSnap.exists() ? photoSnap.val() : (user.photoURL || "");
    const photoURL = await resolvePhotoURL(rawPhoto, user);

    return { name, role, isAdmin, photoURL };
  }catch{
    return { name: resolveDisplayName(user), role: "user", isAdmin: false, photoURL: { primary: DEFAULT_AVATAR, fallback: "" } };
  }
}

// ===== Render profil =====
function applyProfile({ name, photoURL }) {
  if (name) {
    const nameEl = $("#name");
    if (nameEl) nameEl.textContent = name;
    try { localStorage.setItem('tinydb_name', name); } catch(_) {}
  }

  const srcs = typeof photoURL === "object"
    ? [photoURL.primary, photoURL.fallback, DEFAULT_AVATAR]
    : [photoURL, DEFAULT_AVATAR];

  const avatar = $("#avatar");
  if (avatar) {
    avatar.referrerPolicy = "no-referrer";
    let i = 0;
    const tryNext = () => {
      const next = (srcs[i] || "").trim();
      i++;
      avatar.src = next || DEFAULT_AVATAR;
    };
    avatar.onerror = tryNext;
    tryNext();

    avatar.addEventListener("load", () => {
      try { localStorage.setItem('tinydb_photo', avatar.src || DEFAULT_AVATAR); } catch(_) {}
    }, { once: true });
  }
}

// ===== Gunakan cache lokal lebih dulu =====
(function applyCachedProfile(){
  try{
    const name = localStorage.getItem('tinydb_name');
    const photo = localStorage.getItem('tinydb_photo');
    if (name || photo){
      applyProfile({ name, photoURL: photo || DEFAULT_AVATAR });
    }
  }catch(_){
    // abaikan jika storage tidak tersedia
  }
})();

// ===== Toggle foto ↔ logout =====
(function setupGreetCard() {
  const card = $("#greetCard");
  const profileSlot = $("#profileSlot");
  if (!card || !profileSlot) return;

  card.addEventListener('click', () => {
    const active = card.getAttribute('aria-pressed') === 'true';
    const next = !active;
    card.setAttribute('aria-pressed', String(next));

    if (next) {
      profileSlot.innerHTML =
        '<button id="logoutBtn" class="logout-btn" title="Logout" aria-label="Logout">✖</button>';
      $("#logoutBtn")?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof window.onLogout === 'function') window.onLogout();
      });
    } else {
      const photo = localStorage.getItem('tinydb_photo') || '';
      profileSlot.innerHTML =
        `<img id="avatar" class="avatar-large" alt="Foto pengguna" src="${photo}" />`;
    }
  });
})();

// ===== Logout hook =====
window.onLogout = function () {
  try {
    localStorage.removeItem("tinydb_name");
    localStorage.removeItem("tinydb_photo");
  } catch (_) {}
  location.href = "index.html?logout=1";
};

// ===== Pressed effect untuk dock (stabil di mobile) =====
function enableDockPressedEffect(){
  document.querySelectorAll('.dock-btn').forEach(btn=>{
    const press = ()=> btn.classList.add('is-pressed');
    const release = ()=> btn.classList.remove('is-pressed');
    btn.addEventListener('pointerdown', press, {passive:true});
    btn.addEventListener('pointerup', release, {passive:true});
    btn.addEventListener('pointerleave', release, {passive:true});
    btn.addEventListener('pointercancel', release, {passive:true});
  });
}

// ===== Init =====
function tick() { updateGreeting(); }
tick();
setInterval(tick, 60 * 1000);

enableDockPressedEffect();

// Aktif/nonaktif elemen yang butuh dinas
function applyDutyAccess(enable){
  document.querySelectorAll('.requires-duty').forEach(el=>{
    const target = el.dataset.href;
    if (enable && target){
      el.href = target;
      el.classList.remove('is-disabled');
      el.removeAttribute('aria-disabled');
    } else {
      if (target) el.href = '#';
      el.classList.add('is-disabled');
      el.setAttribute('aria-disabled','true');
    }
  });
}

// Ambil profil user saat state Auth siap (redirect ditangani oleh auth-guard.js)
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const p = await fetchProfile(user);
    applyProfile({ name: p.name, photoURL: p.photoURL });
    if (p.isAdmin){
      applyDutyAccess(true);
    } else {
      lookupSchedule(p.name);
    }
  } catch {
    const nm = resolveDisplayName(user);
    applyProfile({ name: nm, photoURL: DEFAULT_AVATAR });
    lookupSchedule(nm);
  }
});

// ===== Cek roster untuk akses fitur dinas =====
  async function lookupSchedule(name){
    const overlay = document.getElementById('lookupOverlay');
    overlay?.classList.add('show');

    const loginKey = normalizeName(name);
    const warmCache = loadDutyCache();
    if (isDutyCacheFresh(warmCache) && warmCache.names.has(loginKey)) {
      applyDutyAccess(true);
    }

    try{
      const url = new URL('https://sched.avsecbwx2018.workers.dev/');
      url.searchParams.set('action','getRoster');
      url.searchParams.set('token','N45p');
      url.searchParams.set('_', Date.now());

      const res = await fetch(url.toString(), {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });

      const ctype = (res.headers.get('content-type') || '').toLowerCase();
      if (!ctype.includes('application/json')) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Respon tidak valid');
      }

      const payload = await res.json();
      if (!payload || !payload.ok) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      saveRosterPayloadCache(payload);
      const names = collectNamesFromRosterPayload(payload);
      if (names.size) saveDutyCache(names);

      const isOn = names.has(loginKey);
      applyDutyAccess(isOn);
    } catch (err) {
      console.error('Roster lookup failed', err);

      const fallback = await tryRosterFallback(loginKey);
      if (fallback) {
        applyDutyAccess(fallback.isOn);
        if (fallback.isOn) {
          console.info('Duty access granted via fallback roster', fallback.source);
          return;
        }
      }

      alert('Gagal mengambil data jadwal: ' + (err?.message || err));
      applyDutyAccess(false);
    } finally {
      overlay?.classList.remove('show');
    }
  }
