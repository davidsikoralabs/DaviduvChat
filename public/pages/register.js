console.log("REGISTER JS LOADED");

import { supabase } from "/supabase.js";

console.log("Supabase client:", supabase);
console.log("Supabase URL:", supabase?.supabaseUrl);
console.log("Supabase Key exists:", !!supabase?.supabaseKey);

document.getElementById("registerBtn").onclick = async () => {
    console.log("CLICK WORKS");

    const username = document.getElementById("regUsername").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPassword").value.trim();
    const password2 = document.getElementById("regPassword2").value.trim();

    console.log("VALUES:", { username, email, password, password2 });

    if (!username || !email || !password || !password2) {
        alert("Vyplňte všechna pole.");
        return;
    }

    if (password !== password2) {
        alert("Hesla se neshodují.");
        return;
    }

    // 1) vytvoření účtu
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { username }
        }
    });

    console.log("SIGNUP RESULT:", data, error);

    if (error) {
        alert("Chyba: " + error.message);
        return;
    }

    // 2) vytvoření profilu v DB
    await supabase.from("profiles").insert({
        id: data.user.id,
        username: username
    });

    // 3) přesměrování
    window.location.href = "/login.html";
};
