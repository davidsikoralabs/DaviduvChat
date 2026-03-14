// Načtení jména a místnosti
const username = localStorage.getItem("username");
const roomId = localStorage.getItem("roomId");

if (!username || !roomId) {
  alert("Chybí jméno nebo místnost. Vraťte se na hlavní stránku.");
  window.location.href = "/";
}

document.getElementById("roomTitle").textContent = "Místnost: " + roomId;

// Připojení k socket.io
const socket = io("https://daviduvchat.onrender.com");

// Po připojení do místnosti
socket.emit("joinRoom", { username, roomId });

// Zobrazení historie
socket.on("chatHistory", (messages) => {
  const container = document.getElementById("messages");
  container.innerHTML = "";

  messages.forEach(msg => addMessage(msg));
});

// Příjem nové zprávy
socket.on("receiveMessage", (msg) => {
  addMessage(msg);
});

// Počet lidí online
socket.on("roomUserCount", ({ roomId: id, count }) => {
  if (id === roomId) {
    document.getElementById("onlineCount").textContent = "Online: " + count;
  }
});

// Odeslání zprávy
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

// Funkce pro zobrazení zprávy
function addMessage(msg) {
  const container = document.getElementById("messages");

  const div = document.createElement("div");
  div.style.marginBottom = "10px";
  div.innerHTML = `<strong style="color:${msg.color}">${msg.user}</strong>: ${msg.text} <span style="font-size:12px;color:#888">(${msg.time})</span>`;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}
