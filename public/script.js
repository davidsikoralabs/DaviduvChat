const socket = io();

const chat = document.getElementById("chat");
const nameInput = document.getElementById("name");
const messageInput = document.getElementById("message");
const sendBtn = document.getElementById("sendButton");

let nameLocked = false;

// odeslání zprávy
sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  // nastavíme jméno jen jednou
  if (!nameLocked) {
    socket.emit("setName", nameInput.value.trim() || "Anonym");
    nameInput.disabled = true;
    nameLocked = true;
  }

  socket.emit("sendMessage", text);
  messageInput.value = "";
}

// přijetí historie
socket.on("chatHistory", (messages) => {
  chat.innerHTML = "";
  messages.forEach(addMessage);
});

// přijetí nové zprávy
socket.on("receiveMessage", (msg) => {
  addMessage(msg);
});

function addMessage(msg) {
  const div = document.createElement("div");
  div.className = "msg";
  div.innerHTML = `
    <span class="user" style="color:${msg.color}">${msg.user}:</span>
    <span style="color:${msg.color}">${msg.text}</span>
    <span class="time">${msg.time}</span>
  `;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
