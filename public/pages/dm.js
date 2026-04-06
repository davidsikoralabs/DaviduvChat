import { supabase } from "/supabase.js";

let currentUser = null;
let chatIdFromUrl = null;
let targetUserId = null;

document.addEventListener("DOMContentLoaded", async () => {

    // 1) Načíst přihlášeného uživatele
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        console.error("AUTH ERROR:", userError);
        window.location.href = "/login.html";
        return;
    }
    currentUser = user;

    // 2) Získat chatId z URL
    const params = new URLSearchParams(window.location.search);
    chatIdFromUrl = params.get("chatId");

    if (!chatIdFromUrl) {
        alert("Chybí chatId v URL.");
        window.location.href = "/messages.html";
        return;
    }

    // 3) Z chatId zjistit druhého uživatele
    targetUserId = await getTargetUserFromChat(chatIdFromUrl, currentUser.id);
    if (!targetUserId) {
        alert("Konverzace neexistuje.");
        window.location.href = "/messages.html";
        return;
    }

    // 4) Načíst profil druhého uživatele
    await loadTargetUser(targetUserId);

    // 5) Spustit chat
    await setupChat(chatIdFromUrl, currentUser.id, targetUserId);
});


// ============================================================
// ZÍSKAT DRUHÉHO UŽIVATELE Z CHATU
// ============================================================
async function getTargetUserFromChat(chatId, currentUserId) {
    const { data, error } = await supabase
        .from("dms")
        .select("*")
        .eq("id", chatId)
        .single();

    if (error || !data) {
        console.error("CHAT LOOKUP ERROR:", error);
        return null;
    }

    return data.user1_id === currentUserId ? data.user2_id : data.user1_id;
}


// ============================================================
// NAČTENÍ PROFILU DRUHÉHO UŽIVATELE
// ============================================================
async function loadTargetUser(targetUserId) {
    const { data, error } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", targetUserId)
        .single();

    if (error) {
        console.error("LOAD TARGET USER ERROR:", error);
        return;
    }

    // 1) ZOBRAZENÍ JMÉNA A AVATARU
    document.getElementById("dmUsername").textContent = data.username;
    document.getElementById("dmAvatar").src = data.avatar_url || "/assets/default-avatar.png";

    // 2) KLIK NA PROFIL DRUHÉHO UŽIVATELE
    document.getElementById("dmUsername").addEventListener("click", () => {
        window.location.href = `/profile.html?user=${targetUserId}`;
    });

    document.getElementById("dmAvatar").addEventListener("click", () => {
        window.location.href = `/profile.html?user=${targetUserId}`;
    });

    // 3) ZPĚT DO INBOXU
    document.getElementById("backToInbox").onclick = () => {
        window.location.href = "/messages.html";
    };

    // 4) SKRYTÍ NOTIFIKACE
    localStorage.setItem("inboxSeen", "true");
}

// ============================================================
// HLAVNÍ CHAT FUNKCE
// ============================================================
async function setupChat(chatId, userId, targetUserId) {

    // 1) Načíst staré zprávy
    const { data: messages, error: messagesError } = await supabase
        .from("private_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

    if (messagesError) {
        console.error("LOAD MESSAGES ERROR:", messagesError);
    }

    if (messages) {
        messages.forEach(renderMessage);
    }

    // 2) Realtime poslouchání nových zpráv
    supabase
        .channel("dm_" + chatId)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "private_messages",
                filter: `chat_id=eq.${chatId}`
            },
            (payload) => {
                renderMessage(payload.new);
            }
        )
        .subscribe();

    // 3) Odesílání zpráv
    const sendBtn = document.getElementById("dmSendBtn");
    if (sendBtn) {
        sendBtn.onclick = () => {
            sendMessage(chatId, userId, targetUserId);
        };
    }

    // ENTER → odeslat zprávu
    const input = document.getElementById("dmInput");
    if (input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                sendMessage(chatId, userId, targetUserId);
            }
        });
    }


    // 4) Mazání celé konverzace
    const deleteBtn = document.getElementById("deleteChatBtn");
    if (deleteBtn) {
        deleteBtn.onclick = () => deleteConversation(chatId);
    }
}


// ============================================================
// VYKRESLENÍ ZPRÁVY
// ============================================================
function renderMessage(msg) {
    const container = document.getElementById("dmMessages");
    if (!container) return;

    const div = document.createElement("div");
    div.classList.add("dm-message");

    if (msg.sender_id === currentUser.id) {
        div.classList.add("dm-me");
    } else {
        div.classList.add("dm-them");
    }

    div.textContent = msg.text;
    container.appendChild(div);

    container.scrollTop = container.scrollHeight;
}


// ============================================================
// ODESLÁNÍ ZPRÁVY
// ============================================================
async function sendMessage(chatId, senderId, receiverId) {
    const input = document.getElementById("dmInput");
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    const { error } = await supabase.from("private_messages").insert({
        chat_id: chatId,
        sender_id: senderId,
        receiver_id: receiverId,
        text: text
    });

    if (error) {
        console.error("INSERT MESSAGE ERROR:", error);
        return;
    }

    input.value = "";
}


// ============================================================
// SMAZÁNÍ CELÉ KONVERZACE
// ============================================================
async function deleteConversation(chatId) {
    if (!confirm("Opravdu chceš smazat celou konverzaci?")) return;

    // 1) Smazat všechny zprávy
    const { error: msgError } = await supabase
        .from("private_messages")
        .delete()
        .eq("chat_id", chatId);

    if (msgError) {
        console.error("DELETE MESSAGES ERROR:", msgError);
        alert("Nepodařilo se smazat zprávy.");
        return;
    }

    // 2) Smazat DM room
    const { error: roomError } = await supabase
        .from("dms")
        .delete()
        .eq("id", chatId);

    if (roomError) {
        console.error("DELETE ROOM ERROR:", roomError);
        alert("Nepodařilo se smazat konverzaci.");
        return;
    }

    // 3) Hotovo → zpět na seznam konverzací
    window.location.href = "/messages.html";
}
