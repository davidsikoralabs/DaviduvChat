import { supabase } from "/supabase.js";

const dmList = document.getElementById("dmList");

// 🔥 Skryj červenou tečku, protože uživatel otevřel inbox
localStorage.setItem("inboxSeen", "true");
const dot = document.getElementById("inboxDot");
if (dot) dot.style.display = "none";

// ============================================================
// 1) ZÍSKÁNÍ PŘIHLÁŠENÉHO UŽIVATELE
// ============================================================
async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

// ============================================================
// 2) NAČTENÍ VŠECH DM ROOMS, KDE JE UŽIVATEL
// ============================================================
async function loadDMRooms(userId) {
    const { data, error } = await supabase
        .from("dms")
        .select("*")
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

    if (error) {
        console.error("Chyba při načítání DM rooms:", error);
        return [];
    }

    return data || [];
}

// ============================================================
// 3) NAČTENÍ POSLEDNÍ ZPRÁVY V DANÉ ROOM
// ============================================================
async function loadLastMessage(roomId) {
    const { data, error } = await supabase
        .from("private_messages")
        .select("*")
        .eq("chat_id", roomId)
        .order("created_at", { ascending: false })
        .limit(1);

    if (error) {
        console.error("Chyba při načítání poslední zprávy:", error);
        return null;
    }

    return data?.[0] || null;
}

// ============================================================
// 4) NAČTENÍ PROFILU DRUHÉHO UŽIVATELE
// ============================================================
async function loadUserProfile(userId) {
    const { data, error } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", userId)
        .single();

    if (error) {
        console.error("Chyba při načítání profilu:", error);
        return null;
    }

    return data;
}

// ============================================================
// 5) VYKRESLENÍ JEDNÉ DM POLOŽKY
// ============================================================
function renderDMItem(roomId, profile, lastMessage) {
    const div = document.createElement("div");
    div.className = "dm-item";

    div.onclick = () => {
        window.location.href = `/dm.html?chatId=${roomId}`;
    };

    div.innerHTML = `
        <img class="dm-avatar" src="${profile?.avatar_url || "/assets/default-avatar.png"}">
        <div class="dm-info">
            <div class="dm-name">${profile?.username || "Neznámý uživatel"}</div>
            <div class="dm-last-message">${lastMessage?.text || "Žádné zprávy"}</div>
        </div>
        <div class="dm-time">${formatTime(lastMessage?.created_at || lastMessage?.time)}</div>
    `;

    dmList.appendChild(div);
}

// ============================================================
// 6) FORMÁTOVÁNÍ ČASU
// ============================================================
function formatTime(timestamp) {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
}

// ============================================================
// 7) HLAVNÍ FUNKCE
// ============================================================
async function init() {
    const user = await getCurrentUser();
    if (!user) return;

    const rooms = await loadDMRooms(user.id);

    for (const room of rooms) {
        const otherUserId = room.user1_id === user.id ? room.user2_id : room.user1_id;

        const profile = await loadUserProfile(otherUserId);
        const lastMessage = await loadLastMessage(room.id);

        renderDMItem(room.id, profile, lastMessage);
    }
}

document.getElementById("backToProfile2").addEventListener("click", () => {
    window.location.href = "/profile.html";
});


init();
