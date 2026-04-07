import { supabase } from "/supabase.js";

const searchInput = document.getElementById("searchInput");
const resultsContainer = document.getElementById("resultsContainer");

document.getElementById("backBtn").onclick = () => history.back();

searchInput.addEventListener("input", async () => {
    const query = searchInput.value.trim();

    if (query.length === 0) {
        resultsContainer.innerHTML = "";
        return;
    }

    const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .ilike("username", `%${query}%`);

    if (error) {
        console.error(error);
        return;
    }

    renderResults(data);
});

function renderResults(users) {
    resultsContainer.innerHTML = "";

    if (users.length === 0) {
        resultsContainer.innerHTML = "<p>Žádní uživatelé nenalezeni.</p>";
        return;
    }

    users.forEach(user => {
        const item = document.createElement("div");
        item.classList.add("result-item");

        item.innerHTML = `
            <img src="${user.avatar_url || '/default-avatar.png'}">
            <span class="username">${user.username}</span>
        `;

        item.onclick = () => {
            window.location.href = `/profile.html?user=${user.id}`;
        };

        resultsContainer.appendChild(item);
    });
}
