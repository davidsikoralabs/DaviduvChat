import { supabase } from "/supabase.js";
window.supabase = supabase;

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

const uploadInput = document.getElementById("uploadPhoto");
if (uploadInput) {
    uploadInput.addEventListener("change", handlePhotoUploadMulti);
}

function updateProfileUI({ isOwnProfile = false, activeTab = null } = {}) {
    const createBox = document.querySelector(".create-post-box");
    const uploadBtn = document.querySelector(".upload-btn");
    if (createBox) createBox.style.display = isOwnProfile ? "" : "none";
    if (uploadBtn) uploadBtn.style.display = (activeTab === "gallery") ? "" : "none";
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
async function renderPostMulti(photos, author, myId, feedEl, post = null) {
    const postEl = document.createElement("div");
    postEl.className = "post";

    const hasPhotos = Array.isArray(photos) && photos.length > 0;
    const first = hasPhotos ? photos[0] : null;

    const postId = (first && (first.post_id || first.id)) || (post && post.id) || "";
    const createdAt = (first && first.created_at) || (post && post.created_at) || "";
    const postUserId = (first && first.user_id) || (post && post.user_id) || (author && author.id) || "";

    postEl.dataset.postId = postId;

    postEl.innerHTML = `
    <div class="post-header">
      <img class="post-avatar" src="${escapeHtml(author?.avatar_url || "/assets/default-avatar.png")}" />
      <div>
        <div class="post-username" data-user="${escapeHtml(author?.id || "")}">
          ${escapeHtml(author?.username || "uživatel")}
        </div>
        <div class="post-time">${createdAt ? escapeHtml(new Date(createdAt).toLocaleString()) : ""}</div>
      </div>
      ${author?.id === myId ? `<button class="delete-post-btn">🗑️</button>` : ""}
    </div>
  `;

    const textHtml = post && post.text ? `<div class="post-text">${escapeHtml(post.text)}</div>` : (first && first.caption ? `<div class="post-caption">${escapeHtml(first.caption)}</div>` : "");

    if (hasPhotos) {
        const imagesHtml = photos.map(p => `<img class="post-image" src="${escapeHtml(p.url)}" data-photo-id="${escapeHtml(p.id || "")}">`).join("");
        postEl.innerHTML += `
      <div class="post-carousel">
        <div class="carousel-track">
          ${imagesHtml}
        </div>
        ${photos.length > 1 ? `<button class="carousel-prev">‹</button><button class="carousel-next">›</button>` : ""}
      </div>
      ${textHtml}
    `;
    } else {

        postEl.innerHTML += `
      ${textHtml}
    `;
    }

    // actions + comments wrapper
    postEl.innerHTML += `
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
    const usernameEl = postEl.querySelector(".post-username");
    if (usernameEl && author?.id) {
        usernameEl.addEventListener("click", () => {
            window.location.href = `profile.html?user=${author.id}`;
        });
    }

    // -----------------------------
    // DELETE POST
    // -----------------------------
    const deletePostBtn = postEl.querySelector(".delete-post-btn");
    if (deletePostBtn && author?.id === myId) {
        deletePostBtn.addEventListener("click", async () => {
            const confirmed = confirm("Opravdu chceš smazat celý příspěvek?");
            if (!confirmed) return;
            await deleteEntirePost(postId);
            postEl.remove();
        });
    }

    // -----------------------------
    // LIKES
    // -----------------------------
    const likeBtn = postEl.querySelector(".like-btn");
    const likeCount = postEl.querySelector(".like-count");

    try {
        const { data: likesData } = await supabase
            .from("likes")
            .select("*")
            .eq("post_id", postId);

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
                    .eq("post_id", postId);

                alreadyLiked = false;
                likeBtn.classList.remove("liked");
                likeCount.textContent = (Number(likeCount.textContent) - 1).toString();
            } else {
                await supabase
                    .from("likes")
                    .insert([{ user_id: myId, post_id: postId }]);

                alreadyLiked = true;
                likeBtn.classList.add("liked");
                likeCount.textContent = (Number(likeCount.textContent) + 1).toString();
            }
        });
    } catch (e) {
        console.error("Likes load error:", e);
    }

    // -----------------------------
    // COMMENTS
    // -----------------------------
    const commentToggleBtn = postEl.querySelector(".comment-toggle-btn");
    const commentsWrapper = postEl.querySelector(".comments");
    const commentList = postEl.querySelector(".comment-list");
    const commentCountEl = postEl.querySelector(".comment-count");

    try {
        const { count: rootCommentsCount } = await supabase
            .from("comments")
            .select("*", { count: "exact", head: true })
            .eq("post_id", postId)
            .is("parent_id", null);

        commentCountEl.textContent = rootCommentsCount || 0;
    } catch (e) {
        console.error("Comments count error:", e);
    }

    commentToggleBtn.addEventListener("click", async () => {
        commentsWrapper.classList.toggle("hidden");
        if (!commentsWrapper.classList.contains("hidden")) {
            await loadCommentsForPost(postId, myId, commentList, commentCountEl, postUserId);
        }
    });

    await attachNewCommentHandlerForPost(postId, myId, commentsWrapper, postUserId);

    // -----------------------------
    // CAROUSEL
    // -----------------------------
    if (hasPhotos && photos.length > 1) {
        let index = 0;
        const track = postEl.querySelector(".carousel-track");
        const prev = postEl.querySelector(".carousel-prev");
        const next = postEl.querySelector(".carousel-next");

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
    // MODAL 
    // -----------------------------
    if (hasPhotos) {
        postEl.querySelectorAll(".post-image").forEach(img => {
            img.addEventListener("click", () => openPostModal(photos));
        });
    }

    feedEl.appendChild(postEl);
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

    // 1) Načíst textové posty
    const { data: posts } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    const postIds = posts.map(p => p.id);

    // 2) Načíst VŠECHNY fotky uživatele
    const { data: allPhotos } = await supabase
        .from("photos")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    // 3) Seskupit fotky podle post_id nebo id
    const photosByPost = new Map();
    allPhotos.forEach(ph => {
        const key = ph.post_id || ph.id;
        if (!photosByPost.has(key)) photosByPost.set(key, []);
        photosByPost.get(key).push(ph);
    });

    // 4) Načíst autora
    const { data: author } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .eq("id", userId)
        .single();

    feedEl.innerHTML = "";

    // 5) Vyrenderovat textové posty (s fotkami i bez)
    for (const post of posts) {
        const postPhotos = photosByPost.get(post.id) || [];
        await renderPostMulti(postPhotos, author, myId, feedEl, post);
    }

    // 6) Vyrenderovat orphan fotky i fotky s neexistujícím postem
    for (const photo of allPhotos) {
        if (!postIds.includes(photo.post_id)) {
            await renderPostMulti([photo], author, myId, feedEl, {
                id: photo.id,
                user_id: photo.user_id,
                text: null,
                created_at: photo.created_at
            });
        }
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

    const { data: posts, error: postsError } = await supabase
        .from("posts")
        .select("id, user_id, text, created_at")
        .in("user_id", ids)
        .order("created_at", { ascending: false });

    if (postsError) {
        console.error("Chyba při načítání postů:", postsError);
        feedEl.innerHTML = "Chyba při načítání feedu.";
        return;
    }

    if (!posts || posts.length === 0) {
        feedEl.innerHTML = "<p>Žádné příspěvky.</p>";
        return;
    }

    const postIds = posts.map(p => p.id);
    const { data: photos, error: photosError } = await supabase
        .from("photos")
        .select("*")
        .in("post_id", postIds)
        .order("created_at", { ascending: false });

    if (photosError) {
        console.error("Chyba při načítání fotek:", photosError);
    }

    const photosByPost = new Map();
    (photos || []).forEach(ph => {
        const key = ph.post_id || ph.id;
        if (!photosByPost.has(key)) photosByPost.set(key, []);
        photosByPost.get(key).push(ph);
    });

    posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    feedEl.innerHTML = "";
    // batch načtení autorů pro výkon
    const userIds = [...new Set(posts.map(p => p.user_id))];
    const { data: authors } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

    const authorsById = new Map((authors || []).map(a => [a.id, a]));

    for (const post of posts) {
        const postPhotos = photosByPost.get(post.id) || [];
        const author = authorsById.get(post.user_id) || { id: post.user_id };
        // zavoláme render jen jednou pro každý post
        await renderPostMulti(postPhotos, author, myId, feedEl, post);
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

    const postId = crypto.randomUUID();

    for (const file of files) {
        const fileName = `${user.id}_${Date.now()}_${file.name}`;

        const { error: uploadError } = await supabase.storage
            .from("user_photos")
            .upload(fileName, file);

        if (uploadError) {
            console.error("Chyba při uploadu:", uploadError);
            continue;
        }

        const { data: urlData } = supabase.storage
            .from("user_photos")
            .getPublicUrl(fileName);

        const url = urlData.publicUrl;
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

    event.target.value = "";

    await loadGallery(user.id);

    await loadGallery(user.id);
    if (typeof loadCombinedFeed === "function") {
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

/* ---------------- Create Post: upload + publish ---------------- */

function initCreatePost() {
    const addBtn = document.getElementById("addPostPhotoBtn");
    const fileInput = document.getElementById("postPhotoInput");
    const publishBtn = document.getElementById("publishPostBtn");
    const textArea = document.getElementById("postText");
    const preview = document.getElementById("postPhotoPreview");

    if (!addBtn || !fileInput || !publishBtn || !textArea || !preview) return;

    addBtn.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", () => {
        renderPostPreview(fileInput.files, preview);
    });

    publishBtn.addEventListener("click", async () => {
        await publishPostHandler(textArea, fileInput, preview, publishBtn);
    });
}

function renderPostPreview(fileList, previewEl) {
    previewEl.innerHTML = "";
    if (!fileList || fileList.length === 0) return;
    Array.from(fileList).slice(0, 6).forEach(file => {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.style.width = "80px";
        img.style.height = "80px";
        img.style.objectFit = "cover";
        img.style.borderRadius = "8px";
        img.style.marginRight = "6px";
        previewEl.appendChild(img);
    });
}

async function publishPostHandler(textArea, fileInput, previewEl, publishBtn) {
    if (publishBtn.dataset.processing === "1") {
        console.log("publishPostHandler: už probíhá publikování, přeskočeno");
        return;
    }
    publishBtn.dataset.processing = "1";
    const text = textArea.value.trim();
    const files = fileInput.files ? Array.from(fileInput.files) : [];
    publishBtn.disabled = true;
    publishBtn.textContent = "Publikuji…";

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Nejste přihlášen.");

        const postId = crypto.randomUUID();

        const uploadedPhotos = [];
        for (const file of files) {
            try {
                const fileName = `${user.id}_${Date.now()}_${file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from("user_photos")
                    .upload(fileName, file);

                if (uploadError) {
                    console.error("Upload error:", uploadError);
                    continue;
                }

                const { data: urlData } = supabase.storage
                    .from("user_photos")
                    .getPublicUrl(fileName);

                const url = urlData?.publicUrl || "";

                const { error: insertError } = await supabase
                    .from("photos")
                    .insert({
                        user_id: user.id,
                        url,
                        caption: "",
                        post_id: postId
                    });

                if (insertError) {
                    console.error("DB insert photo error:", insertError);
                } else {
                    uploadedPhotos.push({ id: null, url, user_id: user.id, post_id: postId, created_at: new Date().toISOString() });
                }
            } catch (e) {
                console.error("Photo upload loop error:", e);
            }
        }

        const { data: postData, error: postError } = await supabase
            .from("posts")
            .insert({
                id: postId,
                user_id: user.id,
                text
            })
            .select("id, user_id, text, created_at")
            .single();

        if (postError) {
            console.error("Chyba při vytváření postu:", postError);
            throw new Error("Chyba při ukládání příspěvku.");
        }

        const { data: photosForPost, error: photosError } = await supabase
            .from("photos")
            .select("id, url")
            .eq("post_id", postId);

        const newPost = {
            ...postData,
            photos: photosForPost || []
        };

        console.log("Post vytvořen:", newPost);

        textArea.value = "";
        fileInput.value = "";
        previewEl.innerHTML = "";

        if (typeof loadCombinedFeed === "function") {
            await loadCombinedFeed("feed");
        } else if (typeof loadUserFeed === "function") {
            const userParam = getQueryParam("user");
            if (userParam) await loadUserFeed(userParam, "feed");
            else {
                const { data: { user: me } } = await supabase.auth.getUser();
                if (me) await loadUserFeed(me.id, "feed");
            }
        } else {
            appendPostToFeed(newPost);
        }

        const { data: { user: me } } = await supabase.auth.getUser();
        if (me) await loadGallery(me.id);

    } catch (err) {
        console.error(err);
        alert(err.message || "Chyba při publikování příspěvku.");
    } finally {
        publishBtn.disabled = false;
        publishBtn.textContent = "Publikovat";
    }

    publishBtn.dataset.processing = "0";
}

/* ---------------- pomocné funkce pro zobrazení ---------------- */

function appendPostToFeed(post) {
    const feedEl = document.getElementById("feed");
    if (!feedEl) return;

    if (post && post.id) {
        const existing = feedEl.querySelector(`[data-post-id="${post.id}"]`);
        if (existing) {
            console.log("appendPostToFeed: post již existuje v DOM, přeskočeno:", post.id);
            return;
        }
    }

    const div = document.createElement("div");
    div.className = "post";
    div.dataset.postId = post.id;

    const created = post.created_at ? new Date(post.created_at).toLocaleString() : "";
    const photosHtml = (post.photos && post.photos.length)
        ? `<div class="post-photos">${post.photos.map(p => `<img src="${escapeHtml(p.url)}" class="post-photo-thumb">`).join("")}</div>`
        : "";

    div.innerHTML = `
    <div class="post-meta">Uživatel: <strong>${escapeHtml(post.user_id)}</strong> • ${escapeHtml(created)}</div>
    <div class="post-text">${escapeHtml(post.text || "")}</div>
    ${photosHtml}
    <div class="post-actions">
      <button class="like-btn">👍 <span>0</span></button>
      <button class="dislike-btn">👎 <span>0</span></button>
      <button class="comment-btn">💬</button>
    </div>
  `;

    feedEl.prepend(div);
}

async function fetchAndRenderLatestPosts() {
    const { data: posts, error } = await supabase
        .from("posts")
        .select("id, user_id, text, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

    if (error) {
        console.error("Chyba při načítání postů:", error);
        return;
    }

    const feedEl = document.getElementById("feed");
    if (!feedEl) return;
    feedEl.innerHTML = "";
    for (const p of posts) {
        // načti fotky pro každý post (jednoduchý způsob)
        const { data: photos } = await supabase.from("photos").select("id, url").eq("post_id", p.id);
        p.photos = photos || [];
        appendPostToFeed(p);
    }
}

function escapeHtml(str = "") {
    return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

(function syncPostWidthWithInput() {
    const input = document.querySelector(".create-post-box textarea#postText, .create-post-box input#postText");
    if (!input) return;

    function applyWidth() {
        const w = input.getBoundingClientRect().width;
        document.querySelectorAll(".feed-list .post").forEach(p => {
            p.style.maxWidth = `${Math.round(w)}px`;
            p.style.marginLeft = "auto";
            p.style.marginRight = "auto";
        });
    }

    applyWidth();
    window.addEventListener("resize", applyWidth);
})();

/* ---------------------------------------------------
   INIT PROFILU + TABY
--------------------------------------------------- */

function initTabs() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const activeTab = e.currentTarget.dataset.tab;
            const isOwn = window.currentProfileIsOwn === true;
            updateProfileUI({ isOwnProfile: isOwn, activeTab });
        });
    });

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
    initCreatePost();

    const userParam = getQueryParam("user");

    if (userParam) {
        await loadOtherUser(userParam);
    } else {
        await loadMyProfile();
    }

    window.currentProfileIsOwn = !userParam;

    const activeTab = document.querySelector(".tab-btn.active")?.dataset.tab || "feed";
    updateProfileUI({ isOwnProfile: window.currentProfileIsOwn, activeTab });
}

/* ---------------------------------------------------
   START
--------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    initProfile().catch(err => console.error(err));
});
