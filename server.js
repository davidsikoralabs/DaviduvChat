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

  rooms = data || [];

  if (!rooms.find((r) => r.id === "hlavni-chat")) {
    const mainRoom = { id: "hlavni-chat", name: "Hlavní chat" };
    rooms.push(mainRoom);
    await supabase.from("rooms").insert(mainRoom);
  }

  console.log("ROOMS LOADED:", rooms);
}

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
    console.log("JOIN:", username, userId, roomId);
    const room = rooms.find((r) => r.id === roomId);
    if (!room) {
      socket.emit("errorMessage", "Místnost neexistuje");
      return;
    }

    socket.data.username = username || "Anonym";
    socket.data.userId = userId;
    socket.data.roomId = roomId;

    // 1) Historie z DB
    const { data: history, error } = await supabase
      .from("messages")
      .select("*")
      .eq("room_id", roomId)
      .order("id", { ascending: true });

    if (error) {
      console.error("Chyba při načítání historie:", error);
      socket.emit("chatHistory", []);
    } else {
      const cleaned = (history || []).map((msg) => ({
        id: msg.id,
        user: msg.user,
        userId: msg.user_id,
        text: msg.text,
        time: msg.created_at
          ? new Date(msg.created_at).toLocaleTimeString("cs-CZ")
          : "",
        color: getColorForUser(msg.user)
      }));

      socket.emit("chatHistory", cleaned);
    }

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
  console.log("📩 RAW SEND MESSAGE INPUT:", text);
  console.log("📌 socket.data:", socket.data);

  const username = socket.data.username || "Anonym";
  const userId = socket.data.userId;
  const roomId = socket.data.roomId;

  if (!roomId || !userId) {
    console.error("❌ Chybí roomId nebo userId při odesílání zprávy");
    return;
  }

  const dbMsg = {
    user: username,
    user_id: userId,
    text: text,
    room_id: roomId
  };

  console.log("📌 DEBUG MESSAGE INSERT:", dbMsg);

  const { data, error } = await supabase
    .from("messages")
    .insert(dbMsg)
    .select();

  if (error) {
    console.error("❌ SUPABASE INSERT ERROR:", error);
    return;
  }

  const saved = data?.[0];

  const clientMsg = {
    id: saved.id,
    user: saved.user,
    userId: saved.user_id,
    text: saved.text,
    time: saved.created_at
      ? new Date(saved.created_at).toLocaleTimeString("cs-CZ")
      : "",
    color: getColorForUser(saved.user),
    room: roomId
  };

  io.to(roomId).emit("receiveMessage", clientMsg);
});


  /* ------------------------------
     DELETE MESSAGE
  ------------------------------ */
  socket.on("deleteMessage", async (id) => {
    const username = socket.data.username;

    const { data, error } = await supabase
      .from("messages")
      .select("user")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Chyba při ověřování zprávy pro smazání:", error);
      return;
    }

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

async function startServer() {
  console.log("Načítám místnosti...");
  await loadRoomsFromDB();
  server.listen(PORT, () => console.log("Server běží na portu", PORT));
}

startServer();
