console.log("LOGIN JS LOADED");

import { supabase } from "/supabase.js";

const emailInput = document.getElementById("loginEmail");
const passwordInput = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");

// ⭐ 1) ENTER v emailu → přesun do hesla
emailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        passwordInput.focus();
    }
});

// ⭐ 2) ENTER v heslu → login
passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        loginBtn.click(); // ← tohle spustí login
    }
});

// ⭐ 3) Kliknutí na tlačítko → login
loginBtn.onclick = async () => {
    console.log("CLICK WORKS");

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        alert("Vyplňte email i heslo.");
        return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    console.log("SIGNIN RESULT:", data, error);

    if (error) {
        alert("Chyba: " + error.message);
        return;
    }

    await new Promise(r => setTimeout(r, 200));

    localStorage.removeItem("profileUser");
    window.location.href = "/profile.html";
};
