import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

app.use(express.static("public"));

io.on("connection", async (socket) => {
  console.log("Uživatel připojen");

  // 1) Po připojení pošli historii z databáze
  const { data: history, error } = await supabase
    .from("messages")
    .select("*")
    .order("id", { ascending: true });

  if (!error) {
    socket.emit("chatHistory", history.map(msg => ({
  user: msg.user,
  text: msg.text,
  time: msg.time,
  color: msg.color
})));


  // 2) Uživatel si nastaví jméno
  socket.on("setName", (name) => {
    socket.data.username = name;
  });

  // 3) Když přijde zpráva
  socket.on("sendMessage", async (text) => {
    const msg = {
      user: socket.data.username,
      text,
      time: new Date().toLocaleTimeString("cs-CZ"),
      color: getColorForUser(socket.data.username)
    };

    // 3a) Uložit do databáze
    const { error: insertError } = await supabase
      .from("messages")
      .insert(msg);

    if (insertError) {
      console.error("Chyba při ukládání:", insertError);
      return;
    }

    // 3b) Poslat ostatním
    io.emit("receiveMessage", msg);
  });
});

// Jednoduchá funkce pro barvu uživatele....
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



