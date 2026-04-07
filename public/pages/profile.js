import { supabase } from "/supabase.js";

function goTo(path) {
    window.location.href = path;
}

console.log("PROFILE JS LOADED");

async function openFollowModal(title, userId, type) {
    document.getElementById("modalTitle").textContent = title;
    const modal = document.getElementById("followModal");
    const list = document.getElementById("modalList");

    modal.style.display = "flex";
    list.innerHTML = "Načítám...";

    let query;

    if (type === "followers") {
        query = supabase
            .from("follows")
            .select("follower_id")
            .eq("following_id", userId);
    } else {
        query = supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", userId);
    }

    const { data } = await query;

    list.innerHTML = "";

    for (const row of data) {
        const id = type === "followers" ? row.follower_id : row.following_id;

        const { data: profile } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .eq("id", id)
            .single();

        const item = document.createElement("div");
        item.classList.add("item");

        item.innerHTML = `
            <img src="${profile.avatar_url || '/default-avatar.png'}">
            <span>${profile.username}</span>
        `;

        item.onclick = () => {
            window.location.href = `/profile.html?user=${profile.id}`;
        };

        list.appendChild(item);
    }
}

document.getElementById("closeModal").onclick = () => {
    document.getElementById("followModal").style.display = "none";
};


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

    const userId = user.id;


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

    const { count: followers } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", userId);

    const { count: following } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId);

    document.getElementById("followersCount").textContent = followers + " ";
    document.getElementById("followingCount").textContent = following + " ";


    document.getElementById("followersCount").onclick = () => {
        openFollowModal("Sledující", userId, "followers");
    };

    document.getElementById("followingCount").onclick = () => {
        openFollowModal("Sledování", userId, "following");
    };

    //Tlačítka//
    document.getElementById("backBtn").style.display = "none";
    document.getElementById("dmBtn").style.display = "none";
    document.getElementById("followBtn").style.display = "none";
    document.getElementById("editProfileBtn").style.display = "flex";
    document.getElementById("changeAvatarBtn").style.display = "flex";
    document.getElementById("chatBtn").style.display = "flex";
    document.getElementById("logoutBtn").style.display = "flex";
    document.querySelector(".upload-btn").style.display = "inline-block";
    document.getElementById("inboxIcon").onclick = () => {
        window.location.href = "/inbox.html";
    };

    loadGallery(user.id);
}

/* ---------------------------------------------------
   2) FUNKCE – CIZÍ PROFIL
--------------------------------------------------- */
async function loadOtherUser(userId) {
    // 1) Načtení profilu
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

    // 2) Základní UI nastavení
    document.getElementById("backBtn").style.display = "inline-block";
    document.getElementById("backBtn").onclick = () => history.back();

    document.getElementById("dmBtn").style.display = "inline-block";
    document.getElementById("editProfileBtn").style.display = "none";
    document.getElementById("changeAvatarBtn").style.display = "none";
    document.getElementById("chatBtn").style.display = "none";
    document.getElementById("logoutBtn").style.display = "none";
    document.querySelector(".upload-btn").style.display = "none";



    // 4) Načtení počtů sledujících/sledovaných
    async function updateFollowCounts() {
        const { count: followers } = await supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", userId);

        const { count: following } = await supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("follower_id", userId);

        document.getElementById("followersCount").textContent = followers + " ";
        document.getElementById("followingCount").textContent = following + " ";
    }


    document.getElementById("followersCount").onclick = () => {
        openFollowModal("Sledující", userId, "followers");
    };

    document.getElementById("followingCount").onclick = () => {
        openFollowModal("Sledování", userId, "following");
    };

    await updateFollowCounts();

    // 5) Follow / Unfollow logika
    const { data: { user: me } } = await supabase.auth.getUser();
    const followBtn = document.getElementById("followBtn");
    followBtn.style.display = "inline-block";

    async function refreshFollowButton() {
        const { data: follow } = await supabase
            .from("follows")
            .select("*")
            .eq("follower_id", me.id)
            .eq("following_id", userId)
            .maybeSingle();

        if (follow) {
            followBtn.textContent = "Sledujete";
            followBtn.classList.add("following");
        } else {
            followBtn.textContent = "Sledovat";
            followBtn.classList.remove("following");
        }
    }

    await refreshFollowButton();

    followBtn.onclick = async () => {
        const { data: current } = await supabase
            .from("follows")
            .select("*")
            .eq("follower_id", me.id)
            .eq("following_id", userId)
            .maybeSingle();

        if (current) {
            // UNFOLLOW
            await supabase.from("follows").delete().eq("id", current.id);
        } else {
            // FOLLOW
            await supabase
                .from("follows")
                .insert([{ follower_id: me.id, following_id: userId }]);
        }

        await refreshFollowButton();
        await updateFollowCounts();
    };

    // 6) DM tlačítko
    document.getElementById("dmBtn").onclick = async () => {
        const myId = me.id;
        const targetId = userId;

        const { data: existingChat } = await supabase
            .from("dms")
            .select("*")
            .or(
                `and(user1_id.eq.${myId},user2_id.eq.${targetId}),and(user1_id.eq.${targetId},user2_id.eq.${myId})`
            )
            .maybeSingle();

        if (existingChat) {
            window.location.href = `/dm.html?chatId=${existingChat.id}`;
            return;
        }

        const { data: newChat, error: insertError } = await supabase
            .from("dms")
            .insert([{ user1_id: myId, user2_id: targetId }])
            .select()
            .single();

        if (insertError) {
            alert("Chyba při vytváření chatu.");
            return;
        }

        window.location.href = `/dm.html?chatId=${newChat.id}`;
    };

    // 7) Galerie
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
    const params = new URLSearchParams(window.location.search);
    const userIdFromUrl = params.get("user");

    const { data: { user } } = await supabase.auth.getUser();

    // Pokud není user param → zobrazím svůj profil
    if (!userIdFromUrl || userIdFromUrl === user.id) {
        loadMyProfile();
    }
    // Jinak zobrazím cizí profil
    else {
        loadOtherUser(userIdFromUrl);
    }
});
