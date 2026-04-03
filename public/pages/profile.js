import { supabase } from "/supabase.js";

function goTo(path) {
    window.location.href = path;
}

console.log("PROFILE JS LOADED");

/* ---------------------------------------------------
   1) FUNKCE – MŮJ PROFIL
--------------------------------------------------- */
async function loadMyProfile() {
   
    localStorage.removeItem("profileUser");

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

    document.getElementById("backBtn").style.display = "none";
    document.getElementById("editProfileBtn").style.display = "flex";
    document.getElementById("changeAvatarBtn").style.display = "flex";
    document.getElementById("chatBtn").style.display = "flex";
    document.getElementById("logoutBtn").style.display = "flex";
    document.querySelector(".upload-btn").style.display = "inline-block";

    loadGallery(user.id);
}

/* ---------------------------------------------------
   2) FUNKCE – CIZÍ PROFIL
--------------------------------------------------- */
async function loadOtherUser(userId) {
    const { data: profile, error } = await supabase
        .from("profiles")
        .select("username, bio, avatar_url, email, created_at")
        .eq("id", userId)
        .single();

    if (error || !profile) {
        console.error("Profil nenalezen:", error);
        return;
    }

    renderProfile({
        email: profile.email || "Skryto",
        created_at: profile.created_at || new Date(),
        username: profile.username,
        bio: profile.bio,
        avatar_url: profile.avatar_url
    });

    document.getElementById("backBtn").style.display = "inline-block";
    document.getElementById("backBtn").onclick = () => {
    history.back();
    };
    document.getElementById("editProfileBtn").style.display = "none";
    document.getElementById("changeAvatarBtn").style.display = "none";
    document.getElementById("chatBtn").style.display = "none";
    document.getElementById("logoutBtn").style.display = "none";
    document.querySelector(".upload-btn").style.display = "none";

    loadGallery(userId);
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
    window.location.href = "/login.html";
};

document.getElementById("chatBtn").onclick = () => {
    localStorage.removeItem("profileUser");
    window.location.href = "/rooms.html";
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
   6) UPLOAD FOTKY DO GALERIE
--------------------------------------------------- */
document.getElementById('uploadPhoto').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const { data: { user } } = await supabase.auth.getUser();
    const fileName = Date.now() + "_" + file.name;

    const { error } = await supabase.storage
        .from('user_photos')
        .upload(`${user.id}/${fileName}`, file);

    if (error) {
        console.error(error);
        alert("Nepodařilo se nahrát fotku.");
        return;
    }

    loadGallery(user.id);
};

/* ---------------------------------------------------
   7) NAČÍTÁNÍ GALERIE
--------------------------------------------------- */
async function loadGallery(targetUserId) {
    const { data, error } = await supabase.storage
        .from('user_photos')
        .list(`${targetUserId}/`, { limit: 100 });

    if (error) {
        console.error(error);
        return;
    }

    const gallery = document.getElementById('gallery');
    gallery.innerHTML = "";

    // Zjistíme, jestli se díváme na svůj profil
    const { data: { user } } = await supabase.auth.getUser();
    const isMyProfile = user && user.id === targetUserId;

    data.forEach(file => {
        const url = supabase.storage
            .from('user_photos')
            .getPublicUrl(`${targetUserId}/${file.name}`).data.publicUrl;

        const wrapper = document.createElement('div');
        wrapper.classList.add('gallery-item');

        const img = document.createElement('img');
        img.src = url;
        img.onclick = () => openPhoto(url);

        wrapper.appendChild(img);

        // Přidáme tlačítko mazání jen na vlastním profilu
        if (isMyProfile) {
            const del = document.createElement('button');
            del.classList.add('delete-photo');
            del.textContent = "×";

            del.onclick = async (e) => {
                e.stopPropagation(); // aby se neotevřel lightbox

                const { error: deleteError } = await supabase.storage
                    .from('user_photos')
                    .remove([`${targetUserId}/${file.name}`]);

                if (deleteError) {
                    console.error(deleteError);
                    alert("Nepodařilo se smazat fotku.");
                    return;
                }

                loadGallery(targetUserId);
            };

            wrapper.appendChild(del);
        }

        gallery.appendChild(wrapper);
    });
}


/* ---------------------------------------------------
   8) LIGHTBOX
--------------------------------------------------- */
function openPhoto(url) {
    document.getElementById('lightbox-img').src = url;
    document.getElementById('lightbox').classList.remove('hidden');
}

document.getElementById('lightbox').onclick = () => {
    document.getElementById('lightbox').classList.add('hidden');
};

/* ---------------------------------------------------
   9) SPUŠTĚNÍ PROFILU
--------------------------------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
    const viewedUser = localStorage.getItem("profileUser");

    const { data: { user } } = await supabase.auth.getUser();

    if (!viewedUser || viewedUser === user.id) {
        loadMyProfile();
    } else {
        loadOtherUser(viewedUser);
    }
});

