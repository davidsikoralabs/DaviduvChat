import { supabase } from "/supabase.js";

console.log("PROFILE JS LOADED");

// Zjistíme, zda se díváme na cizí profil
const viewedUser = localStorage.getItem("profileUser");

// Spustíme správný režim
if (viewedUser) {
    loadOtherUser(viewedUser);
} else {
    loadMyProfile();
}

/* ---------------------------------------------------
   1) MŮJ PROFIL (přihlášený uživatel)
--------------------------------------------------- */
async function loadMyProfile() {
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

    renderProfile({
        email: user.email,
        created_at: user.created_at,
        username: profile.username,
        bio: profile.bio,
        avatar_url: profile.avatar_url
    });

    // Umožnit editaci
    document.getElementById("editProfileBtn").style.display = "flex";
    document.getElementById("changeAvatarBtn").style.display = "flex";
}

/* ---------------------------------------------------
   2) CIZÍ PROFIL (kliknutí na jméno v chatu)
--------------------------------------------------- */
async function loadOtherUser(username) {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

    if (error || !data) {
        console.error("Profil nenalezen:", error);
        return;
    }

    renderProfile({
        email: data.email || "Skryto",
        created_at: data.created_at,
        username: data.username,
        bio: data.bio,
        avatar_url: data.avatar_url
    });

    // Zakázat editaci cizího profilu
    document.getElementById("editProfileBtn").style.display = "none";
    document.getElementById("changeAvatarBtn").style.display = "none";
}

/* ---------------------------------------------------
   3) FUNKCE PRO ZOBRAZENÍ PROFILU
--------------------------------------------------- */
function renderProfile(data) {
    document.getElementById("emailDisplay").textContent = data.email;
    document.getElementById("createdAtDisplay").textContent =
        new Date(data.created_at).toLocaleDateString("cs-CZ");

    document.getElementById("usernameDisplay").textContent = data.username;
    document.getElementById("bioDisplay").textContent = data.bio || "Bez popisu";

    if (data.avatar_url) {
        document.getElementById("avatar").src = data.avatar_url;
    }
}

/* ---------------------------------------------------
   4) ZMĚNA AVATARU (jen můj profil)
--------------------------------------------------- */
document.getElementById("changeAvatarBtn").onclick = () => {
    document.getElementById("avatarInput").click();
};

document.getElementById("avatarInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const { data: { user } } = await supabase.auth.getUser();
    const fileName = `${user.id}-${Date.now()}`;

    const { error: uploadError } = await supabase.storage
        .from("avatar")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

    if (uploadError) {
        alert("Chyba při nahrávání obrázku.");
        return;
    }

    const { data: publicUrlData } = supabase.storage
        .from("avatar")
        .getPublicUrl(fileName);

    const avatarUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);

    if (updateError) {
        alert("Chyba při ukládání URL.");
        return;
    }

    document.getElementById("avatar").src = avatarUrl;
    alert("Avatar aktualizován!");
};

/* ---------------------------------------------------
   5) OSTATNÍ TLAČÍTKA
--------------------------------------------------- */
document.get