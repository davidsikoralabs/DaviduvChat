import { supabase } from "/supabase.js";

function goTo(path) {
    window.location.href = path;
}

console.log("PROFILE JS LOADED");

/* ---------------------------------------------------
   1) FUNKCE – MŮJ PROFIL
--------------------------------------------------- */
async function loadMyProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        goTo("/login.html");
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

    document.getElementById("editProfileBtn").style.display = "flex";
    document.getElementById("changeAvatarBtn").style.display = "flex";
}

/* ---------------------------------------------------
   2) FUNKCE – CIZÍ PROFIL
--------------------------------------------------- */
async function loadOtherUser(username) {

    // 1) Najdeme profil podle username
    const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

    if (error || !profile) {
        console.error("Profil nenalezen:", error);
        return;
    }

    // 2) Najdeme auth uživatele podle ID
    const { data: authUser } = await supabase
        .from("auth_users_view") // vysvětlím níže
        .select("email, created_at")
        .eq("id", profile.id)
        .single();

    renderProfile({
        email: authUser?.email || "Skryto",
        created_at: authUser?.created_at || new Date(),
        username: profile.username,
        bio: profile.bio,
        avatar_url: profile.avatar_url
    });

    // 3) Skryj tlačítka
    document.getElementById("editProfileBtn").style.display = "none";
    document.getElementById("changeAvatarBtn").style.display = "none";
}

/* ---------------------------------------------------
   3) FUNKCE – RENDER PROFILU
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
   4) ZMĚNA AVATARU
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
   5) TLAČÍTKA
--------------------------------------------------- */
document.getElementById("logoutBtn").onclick = async () => {
    await supabase.auth.signOut();
    goTo("/login");
};

document.getElementById("chatBtn").onclick = () => {
    localStorage.removeItem("profileUser");
    goTo("/chat.html");
};

document.getElementById("editProfileBtn").onclick = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data } = await supabase
        .from("profiles")
        .select("username, bio")
        .eq("id", user.id)
        .single();

    document.getElementById("modalUsername").value = data.username || "";
    document.getElementById("modalBio").value = data.bio || "";

    document.getElementById("editModal").style.display = "flex";
};

document.getElementById("closeModalBtn").onclick = () => {
    document.getElementById("editModal").style.display = "none";
};

document.getElementById("saveProfileBtn").onclick = async () => {
    const newUsername = document.getElementById("modalUsername").value;
    const newBio = document.getElementById("modalBio").value;

    const { data: { user } } = await supabase.auth.getUser();

    await supabase
        .from("profiles")
        .update({ username: newUsername, bio: newBio })
        .eq("id", user.id);

    document.getElementById("editModal").style.display = "none";
    loadMyProfile();
};

/* ---------------------------------------------------
   6) SPUŠTĚNÍ PROFILU
--------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    const viewedUser = localStorage.getItem("profileUser");

    if (viewedUser) {
        loadOtherUser(viewedUser);
    } else {
        loadMyProfile();
    }
});

