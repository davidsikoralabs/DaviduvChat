import { supabase } from "/supabase.js";

const { data: { user } } = await supabase.auth.getUser();
const username = localStorage.getItem("username");

let roomId = localStorage.getItem("roomId") || "hlavni-chat";

async function loadRooms() {
  const res = await fetch("/api/rooms");
  const rooms = await res.json();

  const list = document.getElementById("roomsList");
  list.innerHTML = "";

  rooms.forEach(room => {
    const div = document.createElement("div");
    div.className = "room-item";
    div.textContent = `${room.name} (${room.users})`;
    div.onclick = () => switchRoom(room.id);
    list.appendChild(div);
  });
}

loadRooms();

if (!username || !roomId) {
  alert("Chybí jméno nebo místnost. Vraťte se na hlavní stránku.");
  window.location.href = "/";
}

document.getElementById("roomTitle").textContent = "Místnost: " + roomId;

const socket = io("https://daviduvchat.onrender.com");

socket.emit("joinRoom", { username, roomId });


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

socket.on("messageDeleted", (id) => {
  const el = document.querySelector(`[data-id="${id}"]`)?.closest(".msg");
  if (el) el.remove();
});


// ODESLÁNÍ
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

function addMessage(msg) {
  const chat = document.getElementById("chat");

  const div = document.createElement("div");
  div.className = "msg";
  div.dataset.id = msg.id; // důležité pro mazání

  let html = `
    <span class="user" style="color:${msg.color}">${msg.user}</span>
    <span class="text" style="color:${msg.color}">${msg.text}</span>
    <span class="time">(${msg.time})</span>
  `;

  // 🔥 Tady přidáme tlačítko Smazat
  if (msg.user === username) {
    html += `<button class="delete-btn" data-id="${msg.id}">×</button>`;
  }

  div.innerHTML = html;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function switchRoom(newRoomId) {
  if (newRoomId === roomId) return;
  localStorage.setItem("roomId", newRoomId);
  window.location.reload();
}

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("delete-btn")) {
    const id = e.target.dataset.id;
    socket.emit("deleteMessage", id);
  }
});

document.getElementById("backToRooms").onclick = () => {
    window.location.href = "/rooms.html";
};

document.getElementById("goToProfile").onclick = () => {
    window.location.href = "/profile.html";
};
