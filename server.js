const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log("Uživatel se připojil");

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
