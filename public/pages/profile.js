import { supabase } from "/supabase.js";

/* ---------------------------------------------------
   POMOCNÉ FUNKCE
--------------------------------------------------- */

function goTo(path) {
    window.location.href = path;
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function $(sel) {
    return document.querySelector(sel);
}

// Multi-upload listener
const uploadInput = document.getElementById("uploadPhoto");
if (uploadInput) {
    uploadInput.addEventListener("change", handlePhotoUploadMulti);
}

/* ---------------------------------------------------
   RENDER PROFILU
--------------------------------------------------- */

function renderProfile({ email, created_at, username, bio, avatar_url }) {
    const avatar = $("#avatar");
    const usernameDisplay = $("#usernameDisplay");
    const bioDisplay = $("#bioDisplay");
    const emailDisplay = $("#emailDisplay");
    const createdAtDisplay = $("#createdAtDisplay");

    if (avatar) avatar.src = avatar_url || "/assets/default-avatar.png";
    if (usernameDisplay) usernameDisplay.textContent = username || "";
    if (bioDisplay) bioDisplay.textContent = bio || "";
    if (emailDisplay) emailDisplay.textContent = email || "";
    if (createdAtDisplay) {
        const d = created_at ? new Date(created_at) : new Date();
        createdAtDisplay.textContent = d.toLocaleDateString();
    }
}

/* ---------------------------------------------------
   KOMENTÁŘE + ODPOVĚDI
--------------------------------------------------- */

// načtení komentářů + odpovědí pro jeden post
async function loadCommentsForPhoto(photoId, myId, commentList, commentCountEl, photoOwnerId) {
    if (!commentList) return;

    const { data: commentsData, error } = await supabase
        .from("comments")
        .select("id, text, user_id, parent_id, created_at")
        .eq("photo_id", photoId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Chyba při načítání komentářů:", error);
        return;
    }

    const comments = commentsData || [];
    const rootComments = comments.filter(c => !c.parent_id);
    const repliesByParent = new Map();

    for (const c of comments) {
        if (c.parent_id) {
            if (!repliesByParent.has(c.parent_id)) repliesByParent.set(c.parent_id, []);
            repliesByParent.get(c.parent_id).push(c);
        }
    }

    commentList.innerHTML = "";
    if (commentCountEl) {
        commentCountEl.textContent = rootComments.length;
    }


    for (const c of rootComments) {
        const commentDiv = await createCommentElement(
            c,
            myId,
            photoId,
            repliesByParent,
            photoOwnerId
        );
        commentList.appendChild(commentDiv);
    }
}

// vytvoření DOM pro jeden komentář + jeho odpovědi
async function createCommentElement(c, myId, photoId, repliesByParent, photoOwnerId) {
    const commentDiv = document.createElement("div");
    commentDiv.className = "comment";

    const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", c.user_id)
        .single();

    // HLAVNÍ KOMENTÁŘ
    commentDiv.innerHTML = `
        <div class="comment-row">
            <div class="comment-left">
                <strong class="comment-username" data-user="${c.user_id}">
                    ${profile?.username || "uživatel"}
                </strong>
                <span class="comment-text">${c.text}</span>
            </div>

            ${(c.user_id === myId || photoOwnerId === myId) ? `<button class="delete-comment-btn">×</button>` : ""}
        </div>

        <button class="reply-btn">↳ Odpovědět</button>
        <input class="reply-input hidden" placeholder="Napiš odpověď…">
        <div class="reply-list"></div>
    `;

    // MAZÁNÍ HLAVNÍHO KOMENTÁŘE
    const deleteBtn = commentDiv.querySelector(".delete-comment-btn");
    if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
            await supabase.from("comments").delete().eq("id", c.id);
            commentDiv.remove();
        });
    }

    // KLIK NA USERNAME
    const usernameEl = commentDiv.querySelector(".comment-username");
    if (usernameEl) {
        usernameEl.addEventListener("click", () => {
            window.location.href = `profile.html?user=${c.user_id}`;
        });
    }

    const replyBtn = commentDiv.querySelector(".reply-btn");
    const replyInput = commentDiv.querySelector(".reply-input");
    const replyList = commentDiv.querySelector(".reply-list");

    if (replyBtn && replyInput) {
        replyBtn.onclick = () => {
            replyInput.classList.toggle("hidden");
            replyInput.focus();
        };
    }

    // NOVÁ ODPOVĚĎ
    if (replyInput && replyList) {
        replyInput.addEventListener("keydown", async (e) => {
            if (e.key === "Enter" && replyInput.value.trim() !== "") {
                e.preventDefault();

                const text = replyInput.value.trim();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: newReply } = await supabase
                    .from("comments")
                    .insert({
                        text,
                        user_id: user.id,
                        photo_id: photoId,
                        parent_id: c.id
                    })
                    .select()
                    .single();

                const { data: myProfile } = await supabase
                    .from("profiles")
                    .select("username")
                    .eq("id", user.id)
                    .single();

                const replyDiv = document.createElement("div");
                replyDiv.className = "reply";

                replyDiv.innerHTML = `
                    <div class="comment-row">
                        <div class="comment-left">
                            <strong class="comment-username" data-user="${user.id}">
                                ${myProfile?.username || "já"}
                            </strong>
                            <span class="comment-text">${text}</span>
                        </div>

                        <button class="delete-comment-btn">×</button>
                    </div>
                `;

                // klik na username
                const replyUserEl = replyDiv.querySelector(".comment-username");
                if (replyUserEl) {
                    replyUserEl.addEventListener("click", () => {
                        window.location.href = `profile.html?user=${user.id}`;
                    });
                }

                // MAZÁNÍ NOVÉ ODPOVĚDI
                const deleteReplyBtn = replyDiv.querySelector(".delete-comment-btn");
                if (deleteReplyBtn) {
                    deleteReplyBtn.addEventListener("click", async () => {
                        await supabase.from("comments").delete().eq("id", newReply.id);
                        replyDiv.remove();
                    });
                }

                replyList.appendChild(replyDiv);
                replyInput.value = "";
                replyInput.classList.add("hidden");
            }
        });
    }

    // EXISTUJÍCÍ ODPOVĚDI
    if (replyList && repliesByParent.has(c.id)) {
        const replies = repliesByParent.get(c.id);

        for (const r of replies) {
            const { data: replyAuthor } = await supabase
                .from("profiles")
                .select("username")
                .eq("id", r.user_id)
                .single();

            const replyDiv = document.createElement("div");
            replyDiv.className = "reply";

            replyDiv.innerHTML = `
                <div class="comment-row">
                    <div class="comment-left">
                        <strong class="comment-username" data-user="${r.user_id}">
                            ${replyAuthor?.username || "uživatel"}
                        </strong>
                        <span class="comment-text">${r.text}</span>
                    </div>

                    ${(r.user_id === myId || photoOwnerId === myId) ? `<button class="delete-comment-btn">×</button>` : ""}
                </div>
            `;

            // klik na username
            const replyUserEl = replyDiv.querySelector(".comment-username");
            if (replyUserEl) {
                replyUserEl.addEventListener("click", () => {
                    window.location.href = `profile.html?user=${r.user_id}`;
                });
            }

            // MAZÁNÍ EXISTUJÍCÍ ODPOVĚDI
            const deleteReplyBtn = replyDiv.querySelector(".delete-comment-btn");
            if (deleteReplyBtn) {
                deleteReplyBtn.addEventListener("click", async () => {
                    await supabase.from("comments").delete().eq("id", r.id);
                    replyDiv.remove();
                });
            }

            replyList.appendChild(replyDiv);
        }
    }

    return commentDiv;
}

// přidání nového komentáře
async function attachNewCommentHandler(photo, myId, commentsWrapper, photoOwnerId) {
    if (!commentsWrapper) return;

    const commentList = commentsWrapper.querySelector(".comment-list");
    const commentInput = commentsWrapper.querySelector(".comment-input");
    const commentCountEl = commentsWrapper.parentElement?.querySelector(".comment-count");

    if (!commentInput || !commentList) return;

    commentInput.addEventListener("keydown", async (e) => {
        if (e.key === "Enter" && commentInput.value.trim() !== "") {
            e.preventDefault();

            const text = commentInput.value.trim();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: inserted } = await supabase
                .from("comments")
                .insert([{ user_id: user.id, photo_id: photo.id, text }])
                .select()
                .single();

            const { data: profile } = await supabase
                .from("profiles")
                .select("username")
                .eq("id", user.id)
                .single();

            const newCommentDiv = document.createElement("div");
            newCommentDiv.className = "comment";

            newCommentDiv.innerHTML = `
                <div class="comment-row">
                    <div class="comment-left">
                        <strong class="comment-username" data-user="${user.id}">
                            ${profile?.username || "já"}
                        </strong>
                        <span class="comment-text">${text}</span>
                    </div>

                    ${(user.id === myId || photoOwnerId === myId) ? `<button class="delete-comment-btn">×</button>` : ""}
                </div>

                <button class="reply-btn">↳ Odpovědět</button>
                <input class="reply-input hidden" placeholder="Napiš odpověď…">
                <div class="reply-list"></div>
            `;

            // klik na username
            const usernameEl = newCommentDiv.querySelector(".comment-username");
            if (usernameEl) {
                usernameEl.addEventListener("click", () => {
                    window.location.href = `profile.html?user=${user.id}`;
                });
            }

            // MAZÁNÍ NOVÉHO KOMENTÁŘE
            const deleteBtn = newCommentDiv.querySelector(".delete-comment-btn");
            if (deleteBtn) {
                deleteBtn.addEventListener("click", async () => {
                    await supabase.from("comments").delete().eq("id", inserted.id);
                    newCommentDiv.remove();
                });
            }

            // REPLY HANDLER
            const replyBtn = newCommentDiv.querySelector(".reply-btn");
            const replyInput = newCommentDiv.querySelector(".reply-input");
            const replyList = newCommentDiv.querySelector(".reply-list");

            if (replyBtn && replyInput) {
                replyBtn.onclick = () => {
                    replyInput.classList.toggle("hidden");
                    replyInput.focus();
                };
            }

            if (replyInput && replyList) {
                replyInput.addEventListener("keydown", async (e2) => {
                    if (e2.key === "Enter" && replyInput.value.trim() !== "") {
                        e2.preventDefault();

                        const replyText = replyInput.value.trim();

                        const { data: newReply } = await supabase
                            .from("comments")
                            .insert({
                                text: replyText,
                                user_id: user.id,
                                photo_id: photo.id,
                                parent_id: inserted.id
                            })
                            .select()
                            .single();

                        const replyDiv = document.createElement("div");
                        replyDiv.className = "reply";

                        replyDiv.innerHTML = `
                            <div class="comment-row">
                                <div class="comment-left">
                                    <strong class="comment-username" data-user="${user.id}">
                                        ${profile?.username || "já"}
                                    </strong>
                                    <span class="comment-text">${replyText}</span>
                                </div>

                                ${(user.id === myId || photoOwnerId === myId) ? `<button class="delete-comment-btn">×</button>` : ""}
                            </div>
                        `;

                        // klik na username
                        const replyUserEl = replyDiv.querySelector(".comment-username");
                        if (replyUserEl) {
                            replyUserEl.addEventListener("click", () => {
                                window.location.href = `profile.html?user=${user.id}`;
                            });
                        }

                        // MAZÁNÍ NOVÉ ODPOVĚDI
                        const deleteReplyBtn = replyDiv.querySelector(".delete-comment-btn");
                        if (deleteReplyBtn) {
                            deleteReplyBtn.addEventListener("click", async () => {
                                await supabase.from("comments").delete().eq("id", newReply.id);
                                replyDiv.remove();
                            });
                        }

                        replyList.appendChild(replyDiv);
                        replyInput.value = "";
                        replyInput.classList.add("hidden");
                    }
                });
            }

            commentList.appendChild(newCommentDiv);
            commentInput.value = "";

            if (commentCountEl) {
                commentCountEl.textContent = (Number(commentCountEl.textContent) + 1).toString();
            }
        }
    });
}

/* ---------------------------------------------------
   RENDER POSTU (JEDNOTNÝ PRO VŠECHNY FEEDY)
--------------------------------------------------- */
async function renderPostMulti(photos, author, myId, feedEl) {
    const post = document.createElement("div");
    post.className = "post";

    const first = photos[0]; // první fotka = hlavní metadata

    post.innerHTML = `
        <div class="post-header">
            <img class="post-avatar" src="${author?.avatar_url || "/assets/default-avatar.png"}">
            <div>
                <div class="post-username" data-user="${author?.id || ""}">
                    ${author?.username || "uživatel"}
                </div>
                <div class="post-time">${new Date(first.created_at).toLocaleString()}</div>
            </div>
            ${author?.id === myId ? `<button class="delete-post-btn">🗑️</button>` : ""}
        </div>

        <div class="post-carousel">
            <div class="carousel-track">
                ${photos.map(p => `<img class="post-image" src="${p.url}">`).join("")}
            </div>

            ${photos.length > 1 ? `
                <button class="carousel-prev">‹</button>
                <button class="carousel-next">›</button>
            ` : ""}
        </div>

        ${first.caption ? `<div class="post-caption">${first.caption}</div>` : ""}

        <div class="post-actions">
            <button class="like-btn">❤️</button>
            <span class="like-count">0</span>
            <button class="comment-toggle-btn">💬</button>
            <span class="comment-count">0</span>
        </div>

        <div class="comments hidden">
            <div class="comment-list"></div>
            <input class="comment-input" placeholder="Napiš komentář...">
        </div>
    `;

    // -----------------------------
    // Username click
    // -----------------------------
    const usernameEl = post.querySelector(".post-username");
    if (usernameEl && author?.id) {
        usernameEl.addEventListener("click", () => {
            window.location.href = `profile.html?user=${author.id}`;
        });
    }

    // -----------------------------
    // DELETE POST (smaže všechny fotky se stejným post_id)
    // -----------------------------
    const deletePostBtn = post.querySelector(".delete-post-btn");
    if (deletePostBtn && author?.id === myId) {
        deletePostBtn.addEventListener("click", async () => {

            const confirmed = confirm("Opravdu chceš smazat celý příspěvek?");
            if (!confirmed) return;

            await deleteEntirePost(first.post_id);

            post.remove();
        });
    }

    // -----------------------------
    // LIKES – navážeme na post_id
    // -----------------------------
    const likeBtn = post.querySelector(".like-btn");
    const likeCount = post.querySelector(".like-count");

    const { data: likesData } = await supabase
        .from("likes")
        .select("*")
        .eq("post_id", first.post_id);

    const likes = likesData || [];
    likeCount.textContent = likes.length.toString();

    let alreadyLiked = likes.some(l => l.user_id === myId);
    if (alreadyLiked) likeBtn.classList.add("liked");

    likeBtn.addEventListener("click", async () => {
        if (alreadyLiked) {
            await supabase
                .from("likes")
                .delete()
                .eq("user_id", myId)
                .eq("post_id", first.post_id);

            alreadyLiked = false;
            likeBtn.classList.remove("liked");
            likeCount.textContent = (Number(likeCount.textContent) - 1).toString();
        } else {
            await supabase
                .from("likes")
                .insert([{ user_id: myId, post_id: first.post_id }]);

            alreadyLiked = true;
            likeBtn.classList.add("liked");
            likeCount.textContent = (Number(likeCount.textContent) + 1).toString();
        }
    });

    // -----------------------------
    // COMMENTS – navážeme na post_id
    // -----------------------------
    const commentToggleBtn = post.querySelector(".comment-toggle-btn");
    const commentsWrapper = post.querySelector(".comments");
    const commentList = post.querySelector(".comment-list");
    const commentCountEl = post.querySelector(".comment-count");

    const { count: rootCommentsCount } = await supabase
        .from("comments")
        .select("*", { count: "exact", head: true })
        .eq("post_id", first.post_id)
        .is("parent_id", null);

    commentCountEl.textContent = rootCommentsCount || 0;

    commentToggleBtn.addEventListener("click", async () => {
        commentsWrapper.classList.toggle("hidden");
        if (!commentsWrapper.classList.contains("hidden")) {
            await loadCommentsForPost(first.post_id, myId, commentList, commentCountEl, first.user_id);
        }
    });

    await attachNewCommentHandlerForPost(first.post_id, myId, commentsWrapper, first.user_id);

    // -----------------------------
    // CAROUSEL
    // -----------------------------
    if (photos.length > 1) {
        let index = 0;
        const track = post.querySelector(".carousel-track");
        const prev = post.querySelector(".carousel-prev");
        const next = post.querySelector(".carousel-next");

        function update() {
            track.style.transform = `translateX(-${index * 100}%)`;
        }

        prev.addEventListener("click", () => {
            index = (index - 1 + photos.length) % photos.length;
            update();
        });

        next.addEventListener("click", () => {
            index = (index + 1) % photos.length;
            update();
        });
    }

    // -----------------------------
    // MODAL – otevře všechny fotky
    // -----------------------------
    post.querySelectorAll(".post-image").forEach(img => {
        img.addEventListener("click", () => openPostModal(photos));
    });

    feedEl.appendChild(post);
}

function openPostModal(photos) {
    const modal = document.getElementById("postModal");
    const track = modal.querySelector(".post-modal-track");
    const closeBtn = document.getElementById("postModalClose");
    const prevBtn = modal.querySelector(".post-modal-prev");
    const nextBtn = modal.querySelector(".post-modal-next");

    // vložíme všechny fotky
    track.innerHTML = photos
        .map(p => `<img class="post-modal-img" src="${p.url}">`)
        .join("");

    if (photos.length <= 1) {
        prevBtn.style.display = "none";
        nextBtn.style.display = "none";
    } else {
        prevBtn.style.display = "block";
        nextBtn.style.display = "block";
    }

    let index = 0;

    let startX = 0;
    let endX = 0;

    track.addEventListener("touchstart", (e) => {
        startX = e.touches[0].clientX;
    });

    track.addEventListener("touchmove", (e) => {
        endX = e.touches[0].clientX;
    });

    track.addEventListener("touchend", () => {
        const diff = endX - startX;

        if (Math.abs(diff) > 50) {
            if (diff < 0) {
                // swipe left → další fotka
                index = (index + 1) % photos.length;
            } else {
                // swipe right → předchozí fotka
                index = (index - 1 + photos.length) % photos.length;
            }
            update();
        }

        startX = 0;
        endX = 0;
    });

    function update() {
        track.style.transform = `translateX(-${index * 100}%)`;
    }

    prevBtn.onclick = () => {
        index = (index - 1 + photos.length) % photos.length;
        update();
    };

    nextBtn.onclick = () => {
        index = (index + 1) % photos.length;
        update();
    };

    closeBtn.onclick = () => modal.classList.add("hidden");

    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.add("hidden");
    };

    update();

    modal.classList.remove("hidden");
}

async function loadCommentsForPost(postId, myId, commentList, commentCountEl, authorId) {
    const { data: comments, error } = await supabase
        .from("comments")
        .select(`
            id,
            text,
            user_id,
            parent_id,
            created_at,
            profiles (
                username,
                avatar_url
            )
        `)
        .eq("post_id", postId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Chyba při načítání komentářů:", error);
        return;
    }

    commentList.innerHTML = "";

    // seskupíme podle parent_id
    const byParent = new Map();
    comments.forEach(c => {
        const key = c.parent_id || "root";
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key).push(c);
    });

    function renderComment(c, container) {
        const div = document.createElement("div");
        div.className = c.parent_id ? "reply" : "comment";

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:6px;">
                <strong class="comment-author">${c.profiles?.username || "uživatel"}</strong>
                <span class="comment-text">${c.text}</span>

            ${(c.user_id === myId || authorId === myId)
                ? `<button class="comment-delete" style="margin-left:auto;">×</button>`
                : ""
            }
            </div>

            ${!c.parent_id
                ? `<button class="reply-btn">Odpovědět</button>`
                : ""
            }

            ${!c.parent_id
                ? `<div class="reply-list"></div>`
                : ""
            }
            `;

        container.appendChild(div);

        const authorEl = div.querySelector(".comment-author");
        if (authorEl) {
            authorEl.addEventListener("click", () => {
                loadOtherUser(c.user_id);
            });
        }

        // DELETE
        const del = div.querySelector(".comment-delete");
        if (del) {
            del.addEventListener("click", async () => {
                const confirmed = confirm("Smazat komentář?");
                if (!confirmed) return;

                await supabase.from("comments").delete().eq("id", c.id);
                await loadCommentsForPost(postId, myId, commentList, commentCountEl, authorId);
            });
        }

        // REPLY
        const replyBtn = div.querySelector(".reply-btn");
        if (replyBtn) {
            replyBtn.addEventListener("click", () => {
                const input = container.closest(".comments").querySelector(".comment-input");
                input.dataset.replyTo = c.id;
                input.focus();
            });
        }

        // CHILDREN
        const children = byParent.get(c.id) || [];
        if (children.length > 0) {
            const replyList = div.querySelector(".reply-list");
            children.forEach(child => renderComment(child, replyList));
        }
    }

    // render root komentářů
    const roots = byParent.get("root") || [];
    roots.forEach(c => renderComment(c, commentList));

    if (commentCountEl) {
        commentCountEl.textContent = roots.length;
    }
}

async function attachNewCommentHandlerForPost(postId, myId, commentsWrapper, authorId) {
    const input = commentsWrapper.querySelector(".comment-input");
    const list = commentsWrapper.querySelector(".comment-list");

    if (!input) return;

    input.addEventListener("keypress", async (e) => {
        if (e.key !== "Enter") return;

        const text = input.value.trim();
        if (!text) return;

        const parentId = input.dataset.replyTo || null;

        const { error } = await supabase
            .from("comments")
            .insert({
                user_id: myId,
                post_id: postId,
                text,
                parent_id: parentId
            });

        if (error) {
            console.error("Chyba při ukládání komentáře:", error);
            return;
        }

        input.value = "";
        delete input.dataset.replyTo;

        await loadCommentsForPost(postId, myId, list, null, authorId);
    });
}

/* ---------------------------------------------------
  GALERIE
--------------------------------------------------- */
async function loadGallery(userId) {
    const galleryWrapper = document.getElementById("tab-content-gallery");
    if (!galleryWrapper) return;

    const grid = galleryWrapper.querySelector(".gallery-grid");
    if (!grid) return;

    grid.innerHTML = "Načítám...";

    const { data: photos, error } = await supabase
        .from("photos")
        .select("id, url, user_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) {
        grid.innerHTML = "Chyba při načítání galerie.";
        return;
    }

    if (!photos || photos.length === 0) {
        grid.innerHTML = "<p>Žádné fotky.</p>";
        return;
    }

    grid.innerHTML = "";

    const { data: { user: me } } = await supabase.auth.getUser();

    photos.forEach(photo => {
        const img = document.createElement("img");
        img.src = photo.url;
        img.className = "gallery-photo";

        img.addEventListener("click", () => {
            openPhotoModal(photo, me.id);
        });

        grid.appendChild(img);
    });
}

function openPhotoModal(photo, myId) {
    const modal = document.getElementById("photoModal");
    const modalImg = document.getElementById("photoModalImg");
    const closeBtn = document.getElementById("photoModalClose");
    const deleteBtn = document.getElementById("photoDeleteBtn");

    modalImg.src = photo.url;
    modal.classList.remove("hidden");

    // zobrazit delete jen pokud je to moje fotka
    if (photo.user_id === myId) {
        deleteBtn.classList.remove("hidden");
    } else {
        deleteBtn.classList.add("hidden");
    }

    closeBtn.onclick = () => modal.classList.add("hidden");

    deleteBtn.onclick = async () => {
        await supabase.from("photos").delete().eq("id", photo.id);
        modal.classList.add("hidden");
        loadGallery(photo.user_id); // refresh galerie
    };
}

/* ---------------------------------------------------
   FEED FUNKCE
--------------------------------------------------- */
async function loadUserFeed(userId, targetId = "feed") {
    const feedEl = document.getElementById(targetId);
    if (!feedEl) return;

    feedEl.innerHTML = "Načítám...";

    const { data: { user: me } } = await supabase.auth.getUser();
    if (!me) {
        goTo("/login.html");
        return;
    }

    const myId = me.id;

    // 1) načteme všechny fotky uživatele
    const { data: photos, error } = await supabase
        .from("photos")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Chyba při načítání feedu:", error);
        feedEl.innerHTML = "Chyba při načítání feedu.";
        return;
    }

    feedEl.innerHTML = "";
    if (!photos || photos.length === 0) {
        feedEl.innerHTML = "<p>Žádné příspěvky.</p>";
        return;
    }

    // 2) seskupíme podle post_id
    const grouped = new Map();
    for (const p of photos) {
        const key = p.post_id || p.id; // fallback pro staré fotky
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(p);
    }

    // 3) renderujeme posty
    for (const [postId, postPhotos] of grouped) {
        const { data: author } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .eq("id", postPhotos[0].user_id)
            .single();

        await renderPostMulti(postPhotos, author, myId, feedEl);
    }
}

async function loadCombinedFeed(targetId = "feed") {
    const feedEl = document.getElementById(targetId);
    if (!feedEl) return;

    feedEl.innerHTML = "Načítám...";

    const { data: { user: me } } = await supabase.auth.getUser();
    if (!me) {
        goTo("/login.html");
        return;
    }

    const myId = me.id;

    // 1) zjistíme koho sleduju
    const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", myId);

    const followingIds = (following || []).map(f => f.following_id);
    const ids = [...new Set([myId, ...followingIds])];

    if (ids.length === 0) {
        feedEl.innerHTML = "<p>Žádné příspěvky.</p>";
        return;
    }

    // 2) načteme všechny fotky
    const { data: photos, error } = await supabase
        .from("photos")
        .select("*")
        .in("user_id", ids)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Chyba při načítání combined feedu:", error);
        feedEl.innerHTML = "Chyba při načítání feedu.";
        return;
    }

    feedEl.innerHTML = "";
    if (!photos || photos.length === 0) {
        feedEl.innerHTML = "<p>Žádné příspěvky.</p>";
        return;
    }

    // 3) seskupíme podle post_id
    const grouped = new Map();
    for (const p of photos) {
        const key = p.post_id || p.id; // staré fotky mají post_id = id
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(p);
    }

    // 4) seřadíme celé posty podle času (nejnovější nahoře)
    const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
        const aTime = new Date(a[1][0].created_at);
        const bTime = new Date(b[1][0].created_at);
        return bTime - aTime; // nejnovější první
    });

    // 5) renderujeme posty
    for (const [postId, postPhotos] of sortedGroups) {

        // seřadíme fotky uvnitř postu (1 → 2 → 3)
        postPhotos.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const { data: author } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .eq("id", postPhotos[0].user_id)
            .single();

        await renderPostMulti(postPhotos, author, myId, feedEl);
    }
}

async function loadFollowingFeed(targetId = "feed") {
    const feedEl = document.getElementById(targetId);
    if (!feedEl) return;

    feedEl.innerHTML = "Načítám...";

    const { data: { user: me } } = await supabase.auth.getUser();
    if (!me) {
        goTo("/login.html");
        return;
    }

    const myId = me.id;

    // 1) koho sleduju
    const { data: following } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", myId);

    const followingIds = (following || []).map(f => f.following_id);
    if (followingIds.length === 0) {
        feedEl.innerHTML = "<p>Ještě nikoho nesleduješ.</p>";
        return;
    }

    // 2) načteme fotky
    const { data: photos, error } = await supabase
        .from("photos")
        .select("*")
        .in("user_id", followingIds)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Chyba při načítání following feedu:", error);
        feedEl.innerHTML = "Chyba při načítání feedu.";
        return;
    }

    feedEl.innerHTML = "";
    if (!photos || photos.length === 0) {
        feedEl.innerHTML = "<p>Žádné příspěvky od sledovaných.</p>";
        return;
    }

    // 3) seskupíme podle post_id
    const grouped = new Map();
    for (const p of photos) {
        const key = p.post_id || p.id;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(p);
    }

    // 4) renderujeme posty
    for (const [postId, postPhotos] of grouped) {
        const { data: author } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .eq("id", postPhotos[0].user_id)
            .single();

        await renderPostMulti(postPhotos, author, myId, feedEl);
    }
}

async function deleteEntirePost(postId) {
    // 1) smažeme komentáře
    await supabase
        .from("comments")
        .delete()
        .eq("post_id", postId);

    // 2) smažeme lajky
    await supabase
        .from("likes")
        .delete()
        .eq("post_id", postId);

    // 3) smažeme všechny fotky z DB
    await supabase
        .from("photos")
        .delete()
        .eq("post_id", postId);
}

/* ---------------------------------------------------
   MŮJ PROFIL
--------------------------------------------------- */

async function loadMyProfile() {
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
        username: profile?.username,
        bio: profile?.bio,
        avatar_url: profile?.avatar_url
    });

    const { count: followers } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", userId);

    const { count: following } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId);

    $("#followersCount").textContent = followers + " ";
    $("#followingCount").textContent = following + " ";

    $("#followersCount").onclick = () => {
        openFollowModal("Sledující", userId, "followers");
    };

    $("#followingCount").onclick = () => {
        openFollowModal("Sledování", userId, "following");
    };

    $("#backBtn").style.display = "none";
    $("#dmBtn").style.display = "none";
    $("#followBtn").style.display = "none";
    $("#editProfileBtn").style.display = "flex";
    $("#changeAvatarBtn").style.display = "flex";
    $("#chatBtn").style.display = "flex";
    $("#logoutBtn").style.display = "flex";
    $(".upload-btn").style.display = "inline-block";

    $("#inboxIcon").onclick = () => {
        window.location.href = "/inbox.html";
    };

    // OTEVŘÍT MODAL UPRAVIT PROFIL
    $("#editProfileBtn").onclick = () => {
        $("#editModal").style.display = "flex";
        $("#modalUsername").value = $("#usernameDisplay").textContent;
        $("#modalBio").value = $("#bioDisplay").textContent;
    };

    // ZAVŘÍT MODAL
    $("#closeModalBtn").onclick = () => {
        $("#editModal").style.display = "none";
    };

    // ULOŽIT PROFIL
    $("#saveProfileBtn").onclick = async () => {
        const newUsername = $("#modalUsername").value.trim();
        const newBio = $("#modalBio").value.trim();

        const { data: { user } } = await supabase.auth.getUser();

        await supabase
            .from("profiles")
            .update({
                username: newUsername,
                bio: newBio
            })
            .eq("id", user.id);

        $("#usernameDisplay").textContent = newUsername;
        $("#bioDisplay").textContent = newBio;

        $("#editModal").style.display = "none";
    };

    // ZMĚNIT AVATAR
    $("#changeAvatarBtn").onclick = () => {
        $("#avatarInput").click();
    };

    // UPLOAD AVATARU
    $("#avatarInput").onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const filePath = `${user.id}-${Date.now()}`;

        const { error: uploadError } = await supabase.storage
            .from("avatar")
            .upload(filePath, file, { upsert: true });

        if (uploadError) {
            console.error("Chyba uploadu:", uploadError);
            return;
        }

        const { data: publicUrl } = supabase.storage
            .from("avatar")
            .getPublicUrl(filePath);

        await supabase
            .from("profiles")
            .update({ avatar_url: publicUrl.publicUrl })
            .eq("id", user.id);

        $("#avatar").src = publicUrl.publicUrl;
    };

    // CHAT
    $("#chatBtn").onclick = () => {
        window.location.href = "/rooms.html";
    };

    // ODHLÁŠENÍ
    $("#logoutBtn").onclick = async () => {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
    };

    await loadCombinedFeed("feed");
}

/* ---------------------------------------------------
   CIZÍ PROFIL
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

    $("#backBtn").style.display = "inline-block";
    $("#backBtn").onclick = () => history.back();

    $("#dmBtn").style.display = "inline-block";
    $("#editProfileBtn").style.display = "none";
    $("#changeAvatarBtn").style.display = "none";
    $("#chatBtn").style.display = "none";
    $("#logoutBtn").style.display = "none";
    $(".upload-btn").style.display = "none";

    async function updateFollowCounts() {
        const { count: followers } = await supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", userId);

        const { count: following } = await supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("follower_id", userId);

        $("#followersCount").textContent = followers + " ";
        $("#followingCount").textContent = following + " ";
    }

    $("#followersCount").onclick = () => {
        openFollowModal("Sledující", userId, "followers");
    };

    $("#followingCount").onclick = () => {
        openFollowModal("Sledování", userId, "following");
    };

    await updateFollowCounts();

    const { data: { user: me } } = await supabase.auth.getUser();
    const followBtn = $("#followBtn");
    followBtn.style.display = "inline-block";

    async function refreshFollowButton() {
        const { data: follow } = await supabase
            .from("follows")
            .select("*")
            .eq("follower_id", me.id)
            .eq("following_id", userId)
            .maybeSingle();

        if (follow) {
            followBtn.textContent = "Přestat sledovat";
        } else {
            followBtn.textContent = "Sledovat";
        }
    }

    followBtn.onclick = async () => {
        const { data: follow } = await supabase
            .from("follows")
            .select("*")
            .eq("follower_id", me.id)
            .eq("following_id", userId)
            .maybeSingle();

        if (follow) {
            await supabase
                .from("follows")
                .delete()
                .eq("follower_id", me.id)
                .eq("following_id", userId);
        } else {
            await supabase
                .from("follows")
                .insert([{ follower_id: me.id, following_id: userId }]);
        }

        await updateFollowCounts();
        await refreshFollowButton();
    };

    $("#dmBtn").onclick = async () => {
        const { data: { user: me } } = await supabase.auth.getUser();

        // 1) Najdi existující DM
        const { data: existingChat } = await supabase
            .from("dms")
            .select("*")
            .or(
                `and(user1_id.eq.${me.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${me.id})`
            )
            .maybeSingle();

        if (existingChat) {
            window.location.href = `/messages.html?chatId=${existingChat.id}`;
            return;
        }

        // 2) Pokud neexistuje → vytvoř nový
        const { data: newChat } = await supabase
            .from("dms")
            .insert([
                { user1_id: me.id, user2_id: userId }
            ])
            .select()
            .single();

        window.location.href = `/messages.html?chatId=${newChat.id}`;
    };

    await refreshFollowButton();
    await loadUserFeed(userId, "feed");
}

async function handlePhotoUploadMulti(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1) vytvoříme nový post_id
    const postId = crypto.randomUUID();

    for (const file of files) {
        const fileName = `${user.id}_${Date.now()}_${file.name}`;

        // 2) nahrajeme fotku do storage
        const { error: uploadError } = await supabase.storage
            .from("user_photos")
            .upload(fileName, file);

        if (uploadError) {
            console.error("Chyba při uploadu:", uploadError);
            continue;
        }

        // 3) získáme public URL
        const { data: urlData } = supabase.storage
            .from("user_photos")
            .getPublicUrl(fileName);

        const url = urlData.publicUrl;

        // 4) uložíme do DB
        const { error: insertError } = await supabase
            .from("photos")
            .insert({
                user_id: user.id,
                url,
                caption: "",
                post_id: postId
            });

        if (insertError) {
            console.error("Chyba při ukládání do DB:", insertError);
        }
    }

    // 5) vyčistíme input
    event.target.value = "";

    // 6) refresh galerie
    await loadGallery(user.id);

    // 7) refresh feedu
    if (typeof loadCombinedFeed === "function") {
        await loadCombinedFeed();
        await loadGallery(user.id);
        await loadCombinedFeed("feed");
    }
}

/* ---------------------------------------------------
   FOLLOW MODAL
--------------------------------------------------- */
async function openFollowModal(title, userId, type) {
    const modal = $("#followModal");
    const modalTitle = $("#modalTitle");
    const modalList = $("#modalList");
    const closeModalBtn = $("#closeModal");

    if (!modal || !modalTitle || !modalList || !closeModalBtn) return;

    modalTitle.textContent = title;
    modalList.innerHTML = "Načítám...";

    // otevřít modal
    modal.style.display = "block";

    // zavřít modal
    closeModalBtn.onclick = () => {
        modal.style.display = "none";
    };

    // načtení followerů / following
    let query;
    if (type === "followers") {
        query = supabase
            .from("follows")
            .select("follower_id, profiles!follower_id(username, avatar_url)")
            .eq("following_id", userId);
    } else {
        query = supabase
            .from("follows")
            .select("following_id, profiles!following_id(username, avatar_url)")
            .eq("follower_id", userId);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Chyba při načítání follow seznamu:", error);
        modalList.innerHTML = "Chyba při načítání.";
        return;
    }

    modalList.innerHTML = "";

    // vygenerování řádků
    (data || []).forEach(item => {
        const profile = item.profiles;
        const otherUserId = type === "followers" ? item.follower_id : item.following_id;

        const row = document.createElement("div");
        row.className = "follow-row";
        row.innerHTML = `
            <img src="${profile?.avatar_url || "/assets/default-avatar.png"}" class="follow-avatar">
            <span class="follow-username" data-user="${otherUserId}">
                ${profile?.username || "uživatel"}
            </span>
        `;

        modalList.appendChild(row);
    });

    // klikání na uživatele (event delegation)
    modalList.onclick = (e) => {
        const userEl = e.target.closest(".follow-username");
        if (!userEl) return;

        const uid = userEl.dataset.user;
        if (uid) {
            window.location.href = `/profile.html?user=${uid}`;
        }
    };
}

/* ---------------------------------------------------
   INIT PROFILU + TABY
--------------------------------------------------- */

function initTabs() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    const feedTab = $("#tab-content-feed");
    const galleryTab = $("#tab-content-gallery");
    const marketTab = $("#tab-content-market");
    const uploadBtn = $(".upload-btn");

    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const tab = btn.dataset.tab;

            if (tab === "feed") {
                feedTab.classList.remove("hidden");
                galleryTab.classList.add("hidden");
                marketTab.classList.add("hidden");

                if (uploadBtn) uploadBtn.classList.add("hidden");
            }

            else if (tab === "gallery") {
                feedTab.classList.add("hidden");
                marketTab.classList.add("hidden");
                galleryTab.classList.remove("hidden");

                const isMyProfile = !new URLSearchParams(window.location.search).get("user");
                if (uploadBtn && isMyProfile) uploadBtn.classList.remove("hidden");

                (async () => {
                    const userParam = getQueryParam("user");
                    if (userParam) {
                        await loadGallery(userParam);
                    } else {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) return;
                        await loadGallery(user.id);
                    }
                })();
            }

            else if (tab === "market") {
                feedTab.classList.add("hidden");
                galleryTab.classList.add("hidden");
                marketTab.classList.remove("hidden");

                if (uploadBtn) uploadBtn.classList.add("hidden");
            }
        });
    });
}

async function initProfile() {
    initTabs();

    const userParam = getQueryParam("user");

    if (userParam) {
        await loadOtherUser(userParam);
    } else {
        await loadMyProfile();
    }
}

/* ---------------------------------------------------
   START
--------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    initProfile().catch(err => console.error(err));
});
