import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

let rooms = [];

/* ============================================================
   NAČTENÍ MÍSTNOSTÍ
============================================================ */
async function loadRoomsFromDB() {
  const { data, error } = await supabase.from("rooms").select("*");

  if (error) {
    console.error("Chyba při načítání místností:", error);
    return;
  }

  rooms = data;

  if (!rooms.find(r => r.id === "hlavni-chat")) {
    const mainRoom = { id: "hlavni-chat", name: "Hlavní chat" };
    rooms.push(mainRoom);
    await supabase.from("rooms").insert(mainRoom);
  }
}

loadRoomsFromDB();

app.use(express.static("public"));

/* ============================================================
   API PRO MÍSTNOSTI
============================================================ */
app.get("/api/rooms", (req, res) => {
  const enriched = rooms.map((room) => {
    const roomSet = io.sockets.adapter.rooms.get(room.id);
    const count = roomSet ? roomSet.size : 0;
    return { ...room, users: count };
  });
  res.json(enriched);
});

/* ============================================================
   SOCKET.IO
============================================================ */
io.on("connection", (socket) => {
  console.log("Uživatel připojen");

  /* ------------------------------
     JOIN ROOM
  ------------------------------ */
  socket.on("joinRoom", async ({ username, userId, roomId }) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) {
      socket.emit("errorMessage", "Místnost neexistuje");
      return;
    }

    socket.data.username = username || "Anonym";
    socket.data.userId = userId;      // 🔥 TADY JE userId
    socket.data.roomId = roomId;

    // 1) Historie
    const { data: history } = await supabase
      .from("messages")
      .select("*")
      .eq("room", roomId)
      .order("id", { ascending: true });

    const cleaned = history.map((msg) => ({
      id: msg.id,
      user: msg.user,
      userId: msg.userId,      // 🔥 přidáno
      text: msg.text,
      time: msg.time,
      color: msg.color
    }));

    socket.emit("chatHistory", cleaned);

    // 2) Připojení do místnosti
    socket.join(roomId);

    // 3) Systémová zpráva
    socket.to(roomId).emit("receiveMessage", {
      system: true,
      text: `${socket.data.username} se připojil do místnosti`
    });

    updateRoomUserCount(roomId);
  });

  /* ------------------------------
     SEND MESSAGE
  ------------------------------ */
  socket.on("sendMessage", async (text) => {
    const username = socket.data.username || "Anonym";
    const userId = socket.data.userId;     // 🔥
    const roomId = socket.data.roomId;

    const msg = {
      user: username,
      userId: userId,                      // 🔥
      text,
      time: new Date().toLocaleTimeString("cs-CZ"),
      color: getColorForUser(username),
      room: roomId
    };

    const { data, error } = await supabase
      .from("messages")
      .insert(msg)
      .select();

    const saved = data?.[0] || msg;

    io.to(roomId).emit("receiveMessage", saved);
  });

  /* ------------------------------
     DELETE MESSAGE
  ------------------------------ */
  socket.on("deleteMessage", async (id) => {
    const username = socket.data.username;

    const { data } = await supabase
      .from("messages")
      .select("user")
      .eq("id", id)
      .single();

    if (!data || data.user !== username) return;

    await supabase.from("messages").delete().eq("id", id);

    io.to(socket.data.roomId).emit("messageDeleted", id);
  });

  /* ------------------------------
     DISCONNECT
  ------------------------------ */
  socket.on("disconnect", () => {
    const username = socket.data.username;
    const roomId = socket.data.roomId;

    if (username && roomId) {
      socket.to(roomId).emit("receiveMessage", {
        system: true,
        text: `${username} opustil místnost`
      });
    }

    updateRoomUserCount(roomId);
  });
});

/* ============================================================
   FUNKCE
============================================================ */
function getColorForUser(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

function updateRoomUserCount(roomId) {
  const roomSet = io.sockets.adapter.rooms.get(roomId);
  const count = roomSet ? roomSet.size : 0;
  io.emit("roomUserCount", { roomId, count });
}

/* ============================================================
   START SERVERU
============================================================ */
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server běží na portu", PORT));
