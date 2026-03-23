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

    scripts.forEach(oldScript => {
        const newScript = document.createElement("script");
        newScript.type = oldScript.type || "text/javascript";

        if (oldScript.src) {
            newScript.src = oldScript.src;
        } else {
            newScript.textContent = oldScript.textContent;
        }

        oldScript.replaceWith(newScript);
    });
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

    if (route === "/" || route === "/rooms") {
        loadPage("/pages/rooms.html");
    }
    else if (route === "/login") {
        loadPage("/pages/login.html");
    }
    else if (route === "/register") {
        loadPage("/pages/register.html");
    }
    else if (route.startsWith("/profile")) {
        loadPage("/pages/profile.html");
    }
    else if (route === "/reset-password") {
        loadPage("/pages/reset-password.html");
    }
    else {
        loadPage("/pages/rooms.html"); // fallback
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
