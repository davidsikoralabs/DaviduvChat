import { supabase } from "/supabase.js";

async function requireAuth() {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
}

async function loadPage(path) {
    const html = await fetch(path).then(r => r.text());

    const app = document.getElementById("app");
    app.innerHTML = html;

    // Najdeme všechny <script> tagy v načteném HTML
    const scripts = app.querySelectorAll("script");

    for (const oldScript of scripts) {
        const newScript = document.createElement("script");

        // zachováme typ (module / text/javascript)
        newScript.type = oldScript.type || "text/javascript";

        if (oldScript.src) {
            newScript.src = oldScript.src;
        } else {
            newScript.textContent = oldScript.textContent;
        }

        oldScript.replaceWith(newScript);

        // počkáme, až se script načte
        if (newScript.src) {
            await new Promise(resolve => {
                newScript.onload = resolve;
            });
        }
    }
}

// Jednoduchý router
async function router() {
    const route = window.location.pathname;

    // Ochrana chráněných stránek
    if (route === "/rooms" || route.startsWith("/profile")) {
        if (!(await requireAuth())) {
            goTo("/login");
            return;
        }
    }

    if (route === "/") {
    goTo("/login");
    return;
    }
    if (route === "/rooms") {
    await loadPage("/rooms.html");
    }
    else if (route === "/login") {
        await loadPage("/login.html");
    }
    else if (route === "/register") {
        await loadPage("/register.html");
    }
    else if (route.startsWith("/profile")) {
        await loadPage("/profile.html");
    }
    else if (route === "/reset-password") {
        await loadPage("/reset-password.html");
    }
    else {
        await loadPage("/rooms.html"); // fallback
    }
}

// Navigace bez reloadu
function goTo(url) {
    history.pushState({}, "", url);
    router();
}

window.goTo = goTo;

// Reakce na tlačítko zpět/vpřed
window.addEventListener("popstate", router);

// Spuštění routeru při načtení
router();
