import { supabase } from "/supabase.js";

// Spustí se na každé stránce
document.addEventListener("DOMContentLoaded", async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Pokud uživatel otevřel inbox, tečka zmizí
    if (localStorage.getItem("inboxSeen") === "true") {
        const dot = document.getElementById("inboxDot");
        if (dot) dot.style.display = "none";
    }

    // Realtime listener na nové DM zprávy
    supabase
        .channel("dm_notifications_" + user.id)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "private_messages",
                filter: `receiver_id=eq.${user.id}`
            },
            () => {
                const dot = document.getElementById("inboxDot");
                if (dot) dot.style.display = "block";
            }
        )
        .subscribe();
});
