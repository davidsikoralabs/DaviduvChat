console.log("LOGIN JS LOADED");

import { supabase } from "/supabase.js";

document.getElementById("loginBtn").onclick = async () => {
    console.log("CLICK WORKS");

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

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

    // počkáme, až Supabase uloží session
    await new Promise(r => setTimeout(r, 200));

    // 🔥 TADY JE OPRAVA
    localStorage.removeItem("profileUser");
    goTo("/pages/profile.html");
};
