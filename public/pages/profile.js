import { supabase } from "/supabase.js";

console.log("PROFILE JS LOADED");

async function loadProfile() {
    // 1) Získáme přihlášeného uživatele
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        goTo("/login");
        return;
    }

    // 2) Načteme profil z tabulky profiles
    const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) {
        console.error("Profile load error:", error);
        return;
    }

    // 3) Naplníme UI
    document.getElementById("emailDisplay").textContent = user.email;
    document.getElementById("createdAtDisplay").textContent =
        new Date(user.created_at).toLocaleDateString("cs-CZ");

    document.getElementById("usernameDisplay").textContent = profile.username || "Uživatel";
    document.getElementById("bioDisplay").textContent = profile.bio || "Bez popisu";

    if (profile.avatar_url) {
        document.getElementById("avatar").src = profile.avatar_url;
    }
}

// EDITACE PROFILU
document.getElementById("editProfileBtn").onclick = async () => {
    const newUsername = prompt("Nové uživatelské jméno:");
    const newBio = prompt("Nový popis profilu:");

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
        .from("profiles")
        .update({
            username: newUsername,
            bio: newBio
        })
        .eq("id", user.id);

    if (error) {
        alert("Chyba při ukládání profilu.");
        return;
    }

    alert("Profil aktualizován!");
    loadProfile();
};

// LOGOUT
document.getElementById("logoutBtn").onclick = async () => {
    await supabase.auth.signOut();
    goTo("/login");
};

loadProfile();
