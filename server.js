import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import cors from "cors";
app.use(cors());


dotenv.config();

const app = express();
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

app.use(express.static("public"));

io.on("connection", async (socket) => {
  console.log("Uživatel připojen");

  // 1) Po připojení pošli historii z databáze.
  try {
    const { data: history, error } = await supabase
      .from("messages")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error("Chyba při načítání historie:", error);
    } else {
      // pošleme jen to, co klient očekává
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

  // 2) Uživatel si nastaví jméno
  socket.on("setName", (name) => {
    socket.data.username = name || "Anonym";
  });

  // 3) Když přijde zpráva
  socket.on("sendMessage", async (text) => {
    const username = socket.data.username || "Anonym";
    const msg = {
      user: username,
      text,
      time: new Date().toLocaleTimeString("cs-CZ"),
      color: getColorForUser(username)
    };

    // 3a) Uložit do databáze
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

    // 3b) Poslat ostatním
    io.emit("receiveMessage", msg);
  });

  socket.on("disconnect", () => {
    console.log("Uživatel odpojen");
  });
});

// Jednoduchá funkce pro barvu uživatele
function getColorForUser(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server běží na portu", PORT));
