const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const messagesFile = path.join(__dirname, "messages.json");

function loadMessages() {
  try {
    const data = fs.readFileSync(messagesFile, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Chyba při načítání messages.json:", err);
    return [];
  }
}

function saveMessages(messages) {
  try {
    fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
  } catch (err) {
    console.error("Chyba při ukládání messages.json:", err);
  }
}

function getRandomColor() {
  const colors = [
    "#e6194b", "#3cb44b", "#ffe119", "#383434",
    "#f58231", "#911eb4", "#46f0f0", "#72013d",
    "#bcf60c", "#f5500e", "#008080", "#e300f7",
    "#9a6324", "#8b0000", "#ff0707", "#13f055",
    "#808000", "#3d43f3", "#000075", "#808080"
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

let messages = loadMessages();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log("Uživatel se připojil");

  socket.emit("chatHistory", messages);

  socket.on("setName", (name) => {
    socket.username = name || "Anonym";
    socket.color = getRandomColor();
  });

  socket.on("sendMessage", (text) => {
    if (!socket.username) socket.username = "Anonym";

    const msg = {
      user: socket.username,
      text,
      time: new Date().toLocaleTimeString(),
      color: socket.color
    };

    messages.push(msg);
    saveMessages(messages);

    io.emit("receiveMessage", msg);
  });

  socket.on("disconnect", () => {
    console.log("Uživatel se odpojil");
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server běží na http://localhost:${PORT}`);
});
