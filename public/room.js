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
    <span class="text">${msg.text}</span>
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


document.addEventListener("click", (e) => {
  if (e.target.classList.contains("delete-btn")) {
    const id = e.target.dataset.id;
    socket.emit("deleteMessage", id);
  }
});
