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

async function loadUserFeed(userId) {
    const feed = document.getElementById("feed");
    feed.innerHTML = "Načítám...";

    const { data: photos, error: photosError } = await supabase
        .from("photos")
        .select("id, url, caption, created_at, user_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (photosError) {
        console.error("Chyba při načítání fotek:", photosError);
        feed.innerHTML = "<p>Nepodařilo se načíst příspěvky.</p>";
        return;
    }

    if (!photos || photos.length === 0) {
        feed.innerHTML = "<p>Zatím žádné příspěvky.</p>";
        return;
    }

    const { data: author, error: authorError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", userId)
        .single();

    if (authorError || !author) {
        console.error("Chyba při načítání profilu autora:", authorError);
        feed.innerHTML = "<p>Nepodařilo se načíst profil autora.</p>";
        return;
    }

    feed.innerHTML = "";

    for (const photo of photos) {
        const post = document.createElement("div");
        post.className = "post";

        post.innerHTML = `
            <div class="post-header">
                <img class="post-avatar" src="${author.avatar_url || '/assets/default-avatar.png'}">
                <div>
                    <div class="post-username" data-user="${author.id}">
                        ${author.username}
                    </div>
                    <div class="post-time">${new Date(photo.created_at).toLocaleString()}</div>
                </div>
            </div>

            <img class="post-image" src="${photo.url}">

            ${photo.caption ? `<div class="post-caption">${photo.caption}</div>` : ""}

            <div class="post-actions">
                <button class="like-btn">❤️</button>
                <span class="like-count">0</span>
            </div>

            <div class="comments">
                <div class="comment-list"></div>
                <input class="comment-input" placeholder="Napiš komentář...">
            </div>
        `;

        // klik na jméno
        post.querySelector(".post-username").onclick = () => {
            window.location.href = `profile.html?user=${author.id}`;
        };

        // --- KOMENTÁŘE ---
        const commentList = post.querySelector(".comment-list");
        const commentInput = post.querySelector(".comment-input");

        const { data: commentsData, error: commentsError } = await supabase
            .from("comments")
            .select("*") // bez joinu na profiles, ať to nepadá
            .eq("photo_id", photo.id)
            .order("created_at", { ascending: true });

        if (commentsError) {
            console.error("Chyba při načítání komentářů:", commentsError);
        }

        const comments = commentsData || [];

        comments.forEach(c => {
            const div = document.createElement("div");
            div.className = "comment";
            // zatím jen text, username můžeme dodělat později přes join nebo extra dotaz
            div.textContent = c.text;
            commentList.appendChild(div);
        });

        commentInput.onkeydown = async (e) => {
            if (e.key === "Enter" && commentInput.value.trim() !== "") {
                const text = commentInput.value.trim();
                const { data: { user } } = await supabase.auth.getUser();

                const { error: insertError } = await supabase
                    .from("comments")
                    .insert([{ user_id: user.id, photo_id: photo.id, text }]);

                if (insertError) {
                    console.error("Chyba při ukládání komentáře:", insertError);
                    return;
                }

                const div = document.createElement("div");
                div.className = "comment";
                div.textContent = text;
                commentList.appendChild(div);

                commentInput.value = "";
            }
        };

        // --- LAJKY ---
        const likeBtn = post.querySelector(".like-btn");
        const likeCount = post.querySelector(".like-count");

        const { data: likesData, error: likesError } = await supabase
            .from("likes")
            .select("*")
            .eq("photo_id", photo.id);

        if (likesError) {
            console.error("Chyba při načítání lajků:", likesError);
        }

        const likes = likesData || [];
        likeCount.textContent = likes.length;

        const { data: { user } } = await supabase.auth.getUser();
        let alreadyLiked = likes.some(l => l.user_id === user.id);

        if (alreadyLiked) likeBtn.classList.add("liked");

        likeBtn.onclick = async () => {
            if (alreadyLiked) {
                const { error: unlikeError } = await supabase
                    .from("likes")
                    .delete()
                    .eq("user_id", user.id)
                    .eq("photo_id", photo.id);

                if (unlikeError) {
                    console.error("Chyba při odstraňování lajku:", unlikeError);
                    return;
                }

                alreadyLiked = false;
                likeBtn.classList.remove("liked");
                likeCount.textContent = Number(likeCount.textContent) - 1;
            } else {
                const { error: likeError } = await supabase
                    .from("likes")
                    .insert([{ user_id: user.id, photo_id: photo.id }]);

                if (likeError) {
                    console.error("Chyba při přidávání lajku:", likeError);
                    return;
                }

                alreadyLiked = true;
                likeBtn.classList.add("liked");
                likeCount.textContent = Number(likeCount.textContent) + 1;
            }
        };

        feed.appendChild(post);
    }
}

async function loadFollowingFeed() {
    const feed = document.getElementById("feed");
    feed.innerHTML = "Načítám...";

    const { data: { user } } = await supabase.auth.getUser();
    const myId = user.id;

    // 1) Zjistíme, koho sleduju
    const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", myId);

    if (!following || following.length === 0) {
        feed.innerHTML = "<p>Začni někoho sledovat!</p>";
        return;
    }

    const followingIds = following.map(f => f.following_id);

    // 2) Načteme fotky od sledovaných
    const { data: photos } = await supabase
        .from("photos")
        .select("id, url, caption, created_at, user_id")
        .in("user_id", followingIds)
        .order("created_at", { ascending: false });

    if (!photos || photos.length === 0) {
        feed.innerHTML = "<p>Zatím žádné příspěvky.</p>";
        return;
    }

    // 3) Načteme profily autorů
    const userIds = [...new Set(photos.map(p => p.user_id))];

    const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

    const profileMap = {};
    profiles.forEach(p => profileMap[p.id] = p);

    // 4) Render
    feed.innerHTML = "";

    for (const photo of photos) {
        const author = profileMap[photo.user_id];

        const post = document.createElement("div");
        post.className = "post";

        post.innerHTML = `
            <div class="post-header">
                <img class="post-avatar" src="${author.avatar_url || '/assets/default-avatar.png'}">
                <div>
                    <div class="post-username" data-user="${author.id}">
                        ${author.username}
                    </div>
                    <div class="post-time">${new Date(photo.created_at).toLocaleString()}</div>
                </div>
            </div>

            <img class="post-image" src="${photo.url}">
            ${photo.caption ? `<div class="post-caption">${photo.caption}</div>` : ""}

            <div class="post-actions">
                <button class="like-btn">❤️</button>
                <span class="like-count">0</span>
            </div>

            <div class="comments">
                <div class="comment-list"></div>
                <input class="comment-input" placeholder="Napiš komentář...">
            </div>
        `;

        // Klik na jméno
        post.querySelector(".post-username").onclick = () => {
            window.location.href = `profile.html?user=${author.id}`;
        };

        // --- KOMENTÁŘE ---
        const commentList = post.querySelector(".comment-list");
        const commentInput = post.querySelector(".comment-input");

        // Načtení komentářů
        const { data: commentsData } = await supabase
            .from("comments")
            .select("text, user_id")
            .eq("photo_id", photo.id)
            .order("created_at", { ascending: true });

        const comments = commentsData || [];

        // Render komentářů
        for (const c of comments) {
            const { data: profile } = await supabase
                .from("profiles")
                .select("username")
                .eq("id", c.user_id)
                .single();

            const div = document.createElement("div");
            div.className = "comment";
            div.textContent = `${profile?.username || "uživatel"}: ${c.text}`;
            commentList.appendChild(div);
        }

        // Přidání komentáře
        commentInput.addEventListener("keydown", async (e) => {
            if (e.key === "Enter") {
                e.preventDefault(); // 🔥 ZABRÁNÍ SUBMITU FORMULÁŘE

                const text = commentInput.value.trim();
                if (!text) return;

                const { data: { user } } = await supabase.auth.getUser();

                await supabase
                    .from("comments")
                    .insert([{ user_id: user.id, photo_id: photo.id, text }]);

                // Získáme username
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("username")
                    .eq("id", user.id)
                    .single();

                // Přidáme do UI
                const div = document.createElement("div");
                div.className = "comment";
                div.textContent = `${profile?.username || "já"}: ${text}`;
                commentList.appendChild(div);

                commentInput.value = "";
            }
        });

        // --- LAJKY ---
        const likeBtn = post.querySelector(".like-btn");
        const likeCount = post.querySelector(".like-count");

        const { data: likesData } = await supabase
            .from("likes")
            .select("*")
            .eq("photo_id", photo.id);

        const likes = likesData || [];
        likeCount.textContent = likes.length;

        let alreadyLiked = likes.some(l => l.user_id === myId);

        if (alreadyLiked) likeBtn.classList.add("liked");

        likeBtn.onclick = async () => {
            if (alreadyLiked) {
                await supabase
                    .from("likes")
                    .delete()
                    .eq("user_id", myId)
                    .eq("photo_id", photo.id);

                alreadyLiked = false;
                likeBtn.classList.remove("liked");
                likeCount.textContent = Number(likeCount.textContent) - 1;
            } else {
                await supabase
                    .from("likes")
                    .insert([{ user_id: myId, photo_id: photo.id }]);

                alreadyLiked = true;
                likeBtn.classList.add("liked");
                likeCount.textContent = Number(likeCount.textContent) + 1;
            }
        };

        feed.appendChild(post);
    }
}

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

    // Tlačítka
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

    await loadFollowingFeed(user.id);
    await loadGallery(user.id);
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
    document.getElementById("backBtn").onclick = () => history.back();

    document.getElementById("dmBtn").style.display = "inline-block";
    document.getElementById("editProfileBtn").style.display = "none";
    document.getElementById("changeAvatarBtn").style.display = "none";
    document.getElementById("chatBtn").style.display = "none";
    document.getElementById("logoutBtn").style.display = "none";
    document.querySelector(".upload-btn").style.display = "none";

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
            await supabase.from("follows").delete().eq("id", current.id);
        } else {
            await supabase
                .from("follows")
                .insert([{ follower_id: me.id, following_id: userId }]);
        }

        await refreshFollowButton();
        await updateFollowCounts();
    };

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

    await loadUserFeed(userId);
    await loadGallery(userId);
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
    const userId = user.id;
    const fileName = Date.now() + "_" + file.name;

    const { error } = await supabase.storage
        .from('user_photos')
        .upload(`${userId}/${fileName}`, file);

    if (error) {
        console.error(error);
        alert("Nepodařilo se nahrát fotku.");
        return;
    }

    const { data: urlData } = supabase
        .storage
        .from("user_photos")
        .getPublicUrl(`${userId}/${fileName}`);

    await supabase.from("photos").insert({
        user_id: userId,
        url: urlData.publicUrl,
        caption: ""
    });

    loadGallery(userId);
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

    if (userIdFromUrl && userIdFromUrl !== (await supabase.auth.getUser()).data.user.id) {
        loadOtherUser(userIdFromUrl);
    } else {
        loadMyProfile();
    }

});
