import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp, query, limitToLast } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { requireAuth } from "/js/auth-guard.js";

// Pastikan user login sebelum masuk ke halaman ini
requireAuth({ loginPath: "/index.html", hideWhileChecking: true });

// KONFIGURASI PERSIS SEPERTI YANG ANDA BERIKAN
const firebaseConfig = {
  apiKey: "AIzaSyBc-kE-_q1yoENYECPTLC3EZf_GxBEwrWY",
  authDomain: "avsecbwx-4229c.firebaseapp.com",
  databaseURL: "https://avsecbwx-4229c-default-rtdb.firebaseio.com",
  projectId: "avsecbwx-4229c",
  storageBucket: "avsecbwx-4229c.firebasestorage.app",
  messagingSenderId: "1029406629258",
  appId: "1:1029406629258:web:53e8f09585cd77823efc73",
  measurementId: "G-P37F88HGFE"
};

// Inisialisasi Firebase
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
    currentUser = user;
    console.log("Chat terhubung sebagai:", user.email);
    loadMessages();
  }
});

// Fungsi memuat pesan
function loadMessages() {
  const chatRef = query(ref(db, 'group_chat'), limitToLast(100));
  
  onChildAdded(chatRef, (snapshot) => {
    const data = snapshot.val();
    displayMessage(data);
  }, (error) => {
    console.error("Gagal memuat database:", error);
    alert("Koneksi Database Gagal! Periksa Firebase Rules Anda.\nError: " + error.message);
  });
}

// Fungsi menampilkan pesan di UI
function displayMessage(data) {
  if (!data || !data.text) return;

  const isMe = data.uid === currentUser?.uid;
  const msgDiv = document.createElement('div');
  msgDiv.className = `msg ${isMe ? 'sent' : 'received'}`;
  
  // Format waktu
  const ts = data.timestamp ? new Date(data.timestamp) : new Date();
  const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  msgDiv.innerHTML = `
    ${!isMe ? `<span class="sender-name">${data.name || 'User'}</span>` : ''}
    <div class="text">${escapeHTML(data.text)}</div>
    <span class="time">${timeStr}</span>
  `;
  
  msgContainer.appendChild(msgDiv);
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

// Fungsi kirim pesan
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text || !currentUser) return;

  // Nama diambil dari tinydb_name yang diset di home.js
  const senderName = localStorage.getItem('tinydb_name') || currentUser.displayName || currentUser.email.split('@')[0];

  try {
    await push(ref(db, 'group_chat'), {
      uid: currentUser.uid,
      name: senderName,
      text: text,
      timestamp: serverTimestamp()
    });
    chatInput.value = '';
    chatInput.focus();
  } catch (err) {
    console.error("Gagal mengirim pesan:", err);
    alert("Gagal mengirim! Pastikan Rules Firebase Anda sudah di-Publish.");
  }
});

// Keamanan input HTML
function escapeHTML(str) {
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}
