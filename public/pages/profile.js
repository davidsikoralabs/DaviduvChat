import { supabase } from "/supabase.js";

console.log("PROFILE JS LOADED");

async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        goTo("/login");
        return;
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    document.getElementById("emailDisplay").textContent = user.email;
    document.getElementById("createdAtDisplay").textContent =
        new Date(user.created_at).toLocaleDateString("cs-CZ");

    document.getElementById("usernameDisplay").textContent = profile.username;
    document.getElementById("bioDisplay").textContent = profile.bio || "Bez popisu";

    if (profile.avatar_url) {
        document.getElementById("avatar").src = profile.avatar_url;
    }
    document.getElementById("editProfileBtn").onclick = async () => {
    const newUsername = prompt("Nové uživatelské jméno:");
    const newBio = prompt("Nový popis profilu:");

    const { data: { user } } = await supabase.auth.getUser();

    await supabase
        .from("profiles")
        .update({
            username: newUsername,
            bio: newBio
        })
        .eq("id", user.id);

    loadProfile();
};

}

// ZMĚNA AVATARU
document.getElementById("changeAvatarBtn").onclick = () => {
    document.getElementById("avatarInput").click();
};

document.getElementById("avatarInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const { data: { user } } = await supabase.auth.getUser();

    const fileName = `${user.id}-${Date.now()}`;

    // 1) Upload do Storage
    const { error: uploadError } = await supabase.storage
        .from("avatar")
        .upload(fileName, file, {
            cacheControl: "3600",
            upsert: true
        });

    if (uploadError) {
        alert("Chyba při nahrávání obrázku.");
        return;
    }

    // 2) Získání veřejné URL
    const { data: publicUrlData } = supabase.storage
        .from("avatar")
        .getPublicUrl(fileName);

    const avatarUrl = publicUrlData.publicUrl;

    // 3) Uložení do profilu
    const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);

    if (updateError) {
        alert("Chyba při ukládání URL.");
        return;
    }

    // 4) Aktualizace UI
    document.getElementById("avatar").src = avatarUrl;
    alert("Avatar aktualizován!");
};

document.getElementById("logoutBtn").onclick = async () => {
    await supabase.auth.signOut();
    goTo("/login");
};

loadProfile();
