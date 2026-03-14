const username = localStorage.getItem("username");
const roomId = localStorage.getItem("roomId");

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

// ODESLÁNÍ
document.getElementById("sendBtn").onclick = sendMessage;
document.getElementById("messageInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const input = document.getElementById("messageInput");
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

  div.innerHTML = `
    <span class="user" style="color:${msg.color}">${msg.user}</span>
    ${msg.text}
    <span class="time">(${msg.time})</span>
  `;

  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
