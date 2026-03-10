const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const messagesFile = path.join(__dirname, "messages.json");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log("Uživatel se připojil");

  // Pošleme historii novému uživateli
  socket.emit("chatHistory", messages);

  socket.on("setName", (name) => {
    socket.username = name || "Anonym";
  });

  socket.on("sendMessage", (text) => {
    if (!socket.username) socket.username = "Anonym";

    const msg = {
      user: socket.username,
      text,
      time: new Date().toLocaleTimeString()
    };

    messages.push(msg);
    saveMessages(messages); // ← uložíme do JSON souboru

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

let messages = loadMessages();


