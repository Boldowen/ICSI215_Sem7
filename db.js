// Supabase (PostgreSQL): нэвтэрсэн Google хэрэглэгчийг users хүснэгтэд хадгална.
// Google ID token-ийг Supabase Auth сервер талд баталгаажуулсны дараа л мөр бичигдэнэ.
const dbStatus = document.getElementById("dbStatus");
const dbConfigured = Boolean(APP_CONFIG.supabaseUrl && APP_CONFIG.supabaseAnonKey);
let dbClient = null;

function setDbStatus(message, isError = false) {
  dbStatus.textContent = message;
  dbStatus.classList.toggle("error", isError);
}

function getDbClient() {
  if (!dbConfigured) return null;
  if (!window.supabase) throw new Error("Supabase сан ачаалагдсангүй.");
  // Session-ийг browser storage-д хадгалахгүй: хуудсыг шинэчлэхэд дахин нэвтэрнэ.
  dbClient ??= window.supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  return dbClient;
}

// Google-д nonce-ийн SHA-256 hash-ийг, Supabase-д эх nonce-ийг өгнө.
// Ингэснээр token яг энэ хуудаснаас хүссэн token мөн эсэхийг Supabase шалгана.
async function createNonce() {
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

async function saveUserToDb(credential, nonce) {
  if (!dbConfigured) {
    setDbStatus("Өгөгдлийн сан тохируулаагүй байна (config.js → supabaseUrl, supabaseAnonKey).");
    return;
  }
  setDbStatus("Өгөгдлийн санд хадгалж байна...");
  try {
    const client = getDbClient();
    const { error: authError } = await client.auth.signInWithIdToken({ provider: "google", token: credential, nonce });
    if (authError) throw authError;
    const { data, error } = await client.rpc("record_login");
    if (error) throw error;
    const since = new Date(data.created_at).toLocaleDateString("mn-MN");
    setDbStatus(`Өгөгдлийн санд хадгалагдлаа · ${data.login_count} дэх нэвтрэлт · бүртгүүлсэн: ${since}`);
  } catch (error) {
    setDbStatus(`Өгөгдлийн санд хадгалж чадсангүй: ${error.message}`, true);
  }
}

function dbSignOut() {
  setDbStatus("");
  dbClient?.auth.signOut().catch(() => {});
}
