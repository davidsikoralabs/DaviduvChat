import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import cors from "cors";

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

// 🔹 jednoduchý seznam místností v paměti
let rooms = [
  { id: "Hlavní chat", name: "Hlavní chat" }
];

app.use(express.static("public"));

/* ========== API PRO MÍSTNOSTI ========== */

// seznam místností + počet lidí
app.get("/api/rooms", (req, res) => {
  const enriched = rooms.map((room) => {
    const roomSet = io.sockets.adapter.rooms.get(room.id);
    const count = roomSet ? roomSet.size : 0;
    return { ...room, users: count };
  });
  res.json(enriched);
});

// vytvoření místnosti (jen admin)
app.post("/api/rooms", (req, res) => {
  const { name, password } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Neplatné heslo" });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Název místnosti je povinný" });
  }

  const id = name.trim().toLowerCase().replace(/\s+/g, "-"); // jednoduché ID
  if (rooms.find((r) => r.id === id)) {
    return res.status(400).json({ error: "Místnost už existuje" });
  }

  const room = { id, name: name.trim() };
  rooms.push(room);
  res.json(room);
});

// smazání místnosti (jen admin)
app.delete("/api/rooms/:id", (req, res) => {
  const { password } = req.body;
  const { id } = req.params;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Neplatné heslo" });
  }

  rooms = rooms.filter((r) => r.id !== id);
  // zprávy v Supabase zatím nemažeme – jen se k nim už nebude přistupovat
  res.json({ success: true });
});

/* ========== SOCKET.IO ========== */

io.on("connection", async (socket) => {
  console.log("Uživatel připojen");

  // klient po připojení pošle jméno + místnost
  socket.on("joinRoom", async ({ username, roomId }) => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) {
      socket.emit("errorMessage", "Místnost neexistuje");
      return;
    }

    socket.data.username = username || "Anonym";
    socket.data.roomId = roomId;

    socket.join(roomId);

    // načti historii jen pro danou místnost
    try {
      const { data: history, error } = await supabase
        .from("messages")
        .select("*")
        .eq("room", roomId)
        .order("id", { ascending: true });

      if (error) {
        console.error("Chyba při načítání historie:", error);
      } else {
        const cleaned = history.map((msg) => ({
          user: msg.user,
          text: msg.text,
          time: msg.time,
          color: msg.color
        }));
        socket.emit("chatHistory", cleaned);
      }
    } catch (err) {
      console.error("Výjimka při načítání historie:", err);
    }

    // po připojení aktualizuj počty uživatelů
    updateRoomUserCount(roomId);
  });

  // příjem zprávy
  socket.on("sendMessage", async (text) => {
    const username = socket.data.username || "Anonym";
    const roomId = socket.data.roomId || "general";

    const msg = {
      user: username,
      text,
      time: new Date().toLocaleTimeString("cs-CZ"),
      color: getColorForUser(username),
      room: roomId
    };

    try {
      const { error: insertError } = await supabase
        .from("messages")
        .insert(msg);

      if (insertError) {
        console.error("Chyba při ukládání zprávy:", insertError);
        return;
      }
    } catch (err) {
      console.error("Výjimka při ukládání zprávy:", err);
      return;
    }

    io.to(roomId).emit("receiveMessage", msg);
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (roomId) {
      updateRoomUserCount(roomId);
    }
    console.log("Uživatel odpojen");
  });
});

// barva podle jména
function getColorForUser(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

// aktualizace počtu uživatelů v místnosti
function updateRoomUserCount(roomId) {
  const roomSet = io.sockets.adapter.rooms.get(roomId);
  const count = roomSet ? roomSet.size : 0;
  io.emit("roomUserCount", { roomId, count });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server běží na portu", PORT));
