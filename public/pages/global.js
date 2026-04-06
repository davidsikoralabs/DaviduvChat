import { supabase } from "/supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
    const inboxDot = document.getElementById("inboxDot");
    const inboxIcon = document.getElementById("inboxIcon");

    if (!inboxDot || !inboxIcon) return;

    // 1) Získat přihlášeného uživatele
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 2) Zkontrolovat, jestli má uživatel nepřečtené zprávy
    checkUnread(user.id);

    // 3) Realtime poslouchání nových zpráv
    supabase
        .channel("global_inbox")
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "private_messages",
                filter: `receiver_id=eq.${user.id}`
            },
            () => {
                inboxDot.style.display = "block";
                localStorage.setItem("inboxSeen", "false");
            }
        )
        .subscribe();

    // 4) Když klikneš na obálku → tečka zmizí
    inboxIcon.addEventListener("click", () => {
        inboxDot.style.display = "none";
        localStorage.setItem("inboxSeen", "true");
    });
});


// FUNKCE: Zjistí, jestli má uživatel nepřečtené zprávy
async function checkUnread(userId) {
    const inboxDot = document.getElementById("inboxDot");
    if (!inboxDot) return;

    const { data, error } = await supabase
        .from("private_messages")
        .select("id")
        .eq("receiver_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

    if (error) {
        console.error("UNREAD CHECK ERROR:", error);
        return;
    }

    const seen = localStorage.getItem("inboxSeen");

    if (data && data.length > 0 && seen !== "true") {
        inboxDot.style.display = "block";
    } else {
        inboxDot.style.display = "none";
    }
}
