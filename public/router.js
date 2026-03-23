async function loadPage(path) {
    const html = await fetch(path).then(r => r.text());
    document.getElementById("app").innerHTML = html;
}

// Jednoduchý router
function router() {
    const route = window.location.pathname;

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

// Reakce na tlačítko zpět/vpřed
window.addEventListener("popstate", router);

// Spuštění routeru při načtení
router();
