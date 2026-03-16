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

console.log("SUPABASE URL:", process.env.SUPABASE_URL);
console.log("SUPABASE KEY:", process.env.SUPABASE_ANON_KEY?.slice(0, 15) + "...");

let rooms = [];

async function loadRoomsFromDB() {
  const { data, error } = await supabase
    .from("rooms")
    .select("*");

  if (error) {
    console.error("Chyba při načítání místností:", error);
    return;
  }

  rooms = data;

  // Pokud v DB není hlavní místnost, vytvoříme ji
  if (!rooms.find(r => r.id === "hlavni-chat")) {
    const mainRoom = { id: "hlavni-chat", name: "Hlavní chat" };
    rooms.push(mainRoom);
    await supabase.from("rooms").insert(mainRoom);
  }

  console.log("Načtené místnosti:", rooms);
}

loadRoomsFromDB();

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
app.post("/api/rooms", async (req, res) => {
  const { name, password } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Neplatné heslo" });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Název místnosti je povinný" });
  }

  const id = name.trim().toLowerCase().replace(/\s+/g, "-");

  if (rooms.find((r) => r.id === id)) {
    return res.status(400).json({ error: "Místnost už existuje" });
  }

  const room = { id, name: name.trim() };

  // 🔥 ULOŽIT DO SUPABASE
  const { error } = await supabase.from("rooms").insert(room);

  if (error) {
    console.error("Chyba při ukládání místnosti:", error);
    return res.status(500).json({ error: "Nepodařilo se uložit místnost" });
  }

  rooms.push(room);
  res.json(room);
});


// smazání místnosti (jen admin)
app.delete("/api/rooms/:id", async (req, res) => {
  const { password } = req.body;
  const { id } = req.params;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Neplatné heslo" });
  }

  await supabase.from("rooms").delete().eq("id", id);
  rooms = rooms.filter((r) => r.id !== id);
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

  // 1) Nejdřív načteme historii
  try {
    const { data: history } = await supabase
      .from("messages")
      .select("*")
      .eq("room", roomId)
      .order("id", { ascending: true });

    const cleaned = history.map((msg) => ({
      user: msg.user,
      text: msg.text,
      time: msg.time,
      color: msg.color
    }));

    // pošleme historii jen tomu, kdo se připojuje
    socket.emit("chatHistory", cleaned);

  } catch (err) {
    console.error("Chyba při načítání historie:", err);
  }

  // 2) Teprve teď připojíme socket do místnosti
  socket.join(roomId);

  // 3) A teď pošleme systémovou zprávu všem ostatním
  socket.to(roomId).emit("receiveMessage", {
    system: true,
    text: `${socket.data.username} se připojil do místnosti`
  });

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
