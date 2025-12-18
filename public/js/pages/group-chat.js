import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp, query, limitToLast, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { requireAuth } from "/js/auth-guard.js";

// 1. Proteksi Halaman
requireAuth({ loginPath: "/index.html" });

// 2. Konfigurasi (Pastikan sama dengan home.js)
const firebaseConfig = {
  apiKey: "AIzaSyBc-kE-_q1yoENYECPTLC3EZf_GxBEwrWY",
  authDomain: "avsecbwx-4229c.firebaseapp.com",
  projectId: "avsecbwx-4229c",
  appId: "1:1029406629258:web:53e8f09585cd77823efc73",
  databaseURL: "https://avsecbwx-4229c-default-rtdb.firebaseio.com"
};

// 3. Inisialisasi
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const msgContainer = document.getElementById('msgContainer');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

let currentUser = null;

// 4. Pantau Status Auth
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Chat: User terautentikasi", user.email);
    currentUser = user;
    initChat();
  } else {
    console.warn("Chat: User tidak ditemukan, diarahkan ke login.");
  }
});

// 5. Inisialisasi Chat
function initChat() {
  const chatRef = ref(db, 'group_chat');
  const chatQuery = query(chatRef, limitToLast(50));

  // Cek apakah koneksi ke database berhasil
  const connectedRef = ref(db, ".info/connected");
  onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      console.log("Chat: Terhubung ke Firebase Database.");
    } else {
      console.error("Chat: Terputus dari Firebase Database.");
    }
  });

  // Ambil pesan secara Real-time
  onChildAdded(chatQuery, (snapshot) => {
    const data = snapshot.val();
    console.log("Pesan baru diterima:", data);
    renderMessage(data);
  }, (error) => {
    console.error("Gagal memuat pesan. Cek Database Rules di Firebase Console:", error);
    alert("Izin akses chat ditolak. Silakan cek Firebase Rules.");
  });
}

// 6. Tampilkan Pesan ke UI
function renderMessage(data) {
  if (!data.text) return;
  
  const isMe = data.uid === currentUser?.uid;
  const msgDiv = document.createElement('div');
  msgDiv.className = `msg ${isMe ? 'sent' : 'received'}`;
  
  const ts = data.timestamp ? new Date(data.timestamp) : new Date();
  const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  msgDiv.innerHTML = `
    ${!isMe ? `<span class="sender-name">${data.name || 'Anonim'}</span>` : ''}
    <div class="text">${escapeHTML(data.text)}</div>
    <span class="time">${timeStr}</span>
  `;
  
  msgContainer.appendChild(msgDiv);
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

// 7. Kirim Pesan
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  
  if (!text || !currentUser) return;

  // Nama diambil dari localStorage (diset oleh home.js)
  const senderName = localStorage.getItem('tinydb_name') || currentUser.displayName || currentUser.email.split('@')[0];

  try {
    await push(ref(db, 'group_chat'), {
      uid: currentUser.uid,
      name: senderName,
      text: text,
      timestamp: serverTimestamp()
    });
    console.log("Pesan terkirim!");
    chatInput.value = '';
    chatInput.focus();
  } catch (err) {
    console.error("Gagal mengirim pesan:", err);
    alert("Gagal mengirim pesan. Pastikan Database Rules sudah diubah ke 'true'.");
  }
});

function escapeHTML(str) {
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}
