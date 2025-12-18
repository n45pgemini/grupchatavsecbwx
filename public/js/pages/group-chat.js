import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, push, onChildAdded, serverTimestamp, query, limitToLast } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
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

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    initChat();
  }
});

function initChat() {
  const chatRef = query(ref(db, 'group_chat'), limitToLast(100));
  
  onChildAdded(chatRef, (snapshot) => {
    const data = snapshot.val();
    renderMessage(data);
  });
}

function renderMessage(data) {
  const isMe = data.uid === currentUser.uid;
  const msgDiv = document.createElement('div');
  msgDiv.className = `msg ${isMe ? 'sent' : 'received'}`;
  
  const time = data.timestamp ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  msgDiv.innerHTML = `
    ${!isMe ? `<span class="sender-name">${data.name}</span>` : ''}
    <div class="text">${escapeHTML(data.text)}</div>
    <span class="time">${time}</span>
  `;
  
  msgContainer.appendChild(msgDiv);
  msgContainer.scrollTop = msgContainer.scrollHeight;
}

function escapeHTML(str) {
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text || !currentUser) return;

  // Gunakan nama dari tinydb_name (Home.js) jika tersedia
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
    console.error("Gagal mengirim:", err);
  }
});
