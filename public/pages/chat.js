import { supabase } from "/supabase.js";

// 1) username a roomId jako první
const username = localStorage.getItem("username");
let roomId = localStorage.getItem("roomId") || "hlavni-chat";

if (!username || !roomId) {
  alert("Chybí jméno nebo místnost. Vraťte se na hlavní stránku.");
  window.location.href = "/";
}

// 2) UI
document.getElementById("roomTitle").textContent = "Místnost: " + roomId;

// 3) getUser
const { data: { user } } = await supabase.auth.getUser();
console.log("AUTH USER:", user);

// 4) socket
const socket = io("https://daviduvchat.onrender.com");

// 5) joinRoom
socket.on("connect", () => {
    console.log("SOCKET CONNECTED");

    socket.emit("joinRoom", {
        username,       // 🔥 teď už existuje
        userId: user.id,
        roomId
    });
});


// HISTORIE
socket.on("chatHistory", (messages) => {
  const chat = document.getElementById("chat");
  chat.innerHTML = "";
  messages.forEach(msg => addMessage(msg));
});

// NOVÁ ZPRÁVA
socket.on("receiveMessage", (msg) => {
  addMessage(msg);
});

// ONLINE COUNT
socket.on("roomUserCount", ({ roomId: id, count }) => {
  if (id === roomId) {
    document.getElementById("onlineCount").textContent = "Online: " + count;
  }
});

// SMAZÁNÍ ZPRÁVY
socket.on("messageDeleted", (id) => {
  const el = document.querySelector(`[data-id="${id}"]`)?.closest(".msg");
  if (el) el.remove();
});

// ODESLÁNÍ ZPRÁVY
document.getElementById("sendButton").onclick = sendMessage;
document.getElementById("message").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const input = document.getElementById("message");
  const text = input.value.trim();
  if (!text) return;

  socket.emit("sendMessage", text);
  input.value = "";
}

// VYKRESLENÍ ZPRÁVY
function addMessage(msg) {
  const chat = document.getElementById("chat");

  const div = document.createElement("div");
  div.className = "msg";
  div.dataset.id = msg.id;

  let html = `
    <span class="user clickable-user" data-user="${msg.userId}" style="color:${msg.color}">
      ${msg.user}
    </span>
    <span class="text" style="color:${msg.color}">${msg.text}</span>
    <span class="time">(${msg.time})</span>
  `;

  if (msg.user === username) {
    html += `<button class="delete-btn" data-id="${msg.id}">×</button>`;
  }

  div.innerHTML = html;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

// PŘEPÍNÁNÍ MÍSTNOSTÍ
function switchRoom(newRoomId) {
  if (newRoomId === roomId) return;
  localStorage.setItem("roomId", newRoomId);
  window.location.reload();
}

// KLIK NA UŽIVATELE
document.getElementById("chat").addEventListener("click", (e) => {
    const userEl = e.target.closest(".clickable-user");
    if (userEl) {
        const userId = userEl.dataset.user;
        localStorage.setItem("profileUser", userId);
        window.location.href = "profile.html";
    }
});

// ZPĚT NA MÍSTNOSTI
document.getElementById("backToRooms").onclick = () => {
  window.location.href = "/rooms.html";
};
