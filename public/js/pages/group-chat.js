import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp, query, limitToLast, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { requireAuth } from "/js/auth-guard.js";

// Proteksi halaman
requireAuth({ loginPath: "/index.html" });

const firebaseConfig = {
  apiKey: "AIzaSyBc-kE-_q1yoENYECPTLC3EZf_GxBEwrWY",
  authDomain: "avsecbwx-4229c.firebaseapp.com",
  projectId: "avsecbwx-4229c",
  appId: "1:1029406629258:web:53e8f09585cd77823efc73",
  databaseURL: "https://avsecbwx-4229c-default-rtdb.firebaseio.com"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const msgContainer = document.getElementById('msgContainer');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

let currentUser = null;

// Pantau status login
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("✅ Chat: User login sebagai", user.email);
    currentUser = user;
    initChat();
  } else {
    console.error("❌ Chat: User tidak login!");
  }
});

function initChat() {
  const chatRef = ref(db, 'group_chat');
  
  // 🔍 CEK KONEKSI (DIAGNOSTIC)
  const connectedRef = ref(db, ".info/connected");
  onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      console.log("✅ Chat: Terhubung ke Firebase Database.");
    } else {
      console.warn("⚠️ Chat: Menunggu koneksi database...");
    }
  });

  const chatQuery = query(chatRef, limitToLast(50));
  
  // Ambil pesan secara real-time
  onChildAdded(chatQuery, (snapshot) => {
    const data = snapshot.val();
    console.log("📩 Pesan baru diterima dari database:", data);
    renderMessage(data);
  }, (error) => {
    console.error("❌ Chat: Gagal memuat pesan!", error.message);
    if (error.message.includes("permission_denied")) {
        alert("Error: Izin Database ditolak! Cek Firebase Rules Anda.");
    }
  });
}

function renderMessage(data) {
  if (!data.text) return;
  const isMe = data.uid === currentUser?.uid;
  const msgDiv = document.createElement('div');
  msgDiv.className = `msg ${isMe ? 'sent' : 'received'}`;
  
  const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

  msgDiv.innerHTML = `
    ${!isMe ? `<span class="sender-name">${data.name || 'Anonim'}</span>` : ''}
    <div class="text">${escapeHTML(data.text)}</div>
    <span class="time">${time}</span>
  `;
  
  msgContainer.appendChild(msgDiv);
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text || !currentUser) return;

  const senderName = localStorage.getItem('tinydb_name') || currentUser.displayName || currentUser.email.split('@')[0];

  try {
    console.log("📤 Mengirim pesan...");
    await push(ref(db, 'group_chat'), {
      uid: currentUser.uid,
      name: senderName,
      text: text,
      timestamp: serverTimestamp()
    });
    chatInput.value = '';
    console.log("✅ Pesan terkirim.");
  } catch (err) {
    console.error("❌ Chat: Gagal mengirim pesan!", err);
    alert("Gagal mengirim pesan: " + err.message);
  }
});

function escapeHTML(str) {
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}
