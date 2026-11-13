// Supabase (PostgreSQL): хэрэглэгчийн бүртгэл, нэвтрэлт, users хүснэгт.
// Имэйл/нууц үг болон Google ID token хоёуланг Supabase Auth сервер талд шалгасны дараа л мөр бичигдэнэ.
const dbStatus = document.getElementById("dbStatus");
const dbConfigured = Boolean(APP_CONFIG.supabaseUrl && APP_CONFIG.supabaseAnonKey);
let dbClient = null;

const DB_ERRORS = {
  invalid_credentials: "Имэйл эсвэл нууц үг буруу байна.",
  email_not_confirmed: "Имэйл хаягаа баталгаажуулаагүй байна. Ирсэн захидлын холбоосыг дарна уу.",
  user_already_exists: "Энэ имэйлээр бүртгүүлсэн хэрэглэгч байна. Нэвтэрнэ үү.",
  email_exists: "Энэ имэйлээр бүртгүүлсэн хэрэглэгч байна. Нэвтэрнэ үү.",
  weak_password: "Нууц үг хэт сул байна. Дор хаяж 6 тэмдэгт оруулна уу.",
  email_address_invalid: "Имэйл хаяг буруу байна.",
  over_email_send_rate_limit: "Хэт олон захидал илгээсэн байна. Түр хүлээгээд дахин оролдоно уу.",
  over_request_rate_limit: "Хэт олон оролдлого хийлээ. Түр хүлээгээд дахин оролдоно уу.",
  email_provider_disabled: "Имэйлээр нэвтрэх боломж Supabase дээр унтраалттай байна (Authentication → Providers → Email).",
  signup_disabled: "Шинэ хэрэглэгч бүртгэх боломж хаалттай байна."
};

function dbError(error) {
  return new Error(DB_ERRORS[error?.code] || error?.message || "Тодорхойгүй алдаа.");
}

function setDbStatus(message, isError = false) {
  dbStatus.textContent = message;
  dbStatus.classList.toggle("error", isError);
}

function getDbClient() {
  if (!dbConfigured) throw new Error("Өгөгдлийн сан тохируулаагүй байна (config.js → supabaseUrl, supabaseAnonKey).");
  if (!window.supabase) throw new Error("Supabase сан ачаалагдсангүй. Интернэт холболтоо шалгана уу.");
  // Session-ийг browser storage-д хадгалахгүй: хуудсыг шинэчлэхэд дахин нэвтэрнэ.
  dbClient ??= window.supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  return dbClient;
}

// users хүснэгтэд мөр үүсгэх эсвэл сүүлд нэвтэрсэн огноо, тоог шинэчилнэ.
async function recordLogin(client) {
  const { data, error } = await client.rpc("record_login");
  if (error) throw dbError(error);
  const since = new Date(data.created_at).toLocaleDateString("mn-MN");
  setDbStatus(`Өгөгдлийн санд хадгалагдлаа · ${data.login_count} дэх нэвтрэлт · бүртгүүлсэн: ${since}`);
  return data;
}

// Имэйл, нууц үгээр нэвтэрнэ. users хүснэгтийн мөрийг буцаана.
async function dbEmailLogin(email, password) {
  const client = getDbClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw dbError(error);
  return recordLogin(client);
}

// Шинэ хэрэглэгч бүртгэнэ. Имэйл баталгаажуулалт шаардлагатай бол null буцаана.
async function dbEmailRegister({ lastName, firstName, email, password }) {
  const client = getDbClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { last_name: lastName, first_name: firstName } }
  });
  if (error) throw dbError(error);
  // Баталгаажуулалт асаалттай үед бүртгэлтэй имэйлд Supabase хоосон identities буцаадаг.
  if (data.user?.identities?.length === 0) throw dbError({ code: "user_already_exists" });
  if (!data.session) return null;
  return recordLogin(client);
}

// Google-д nonce-ийн SHA-256 hash-ийг, Supabase-д эх nonce-ийг өгнө.
// Ингэснээр token яг энэ хуудаснаас хүссэн token мөн эсэхийг Supabase шалгана.
async function createNonce() {
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

// Google-ээр нэвтэрсэн хэрэглэгчийг мөн адил users хүснэгтэд хадгална.
async function saveGoogleUserToDb(credential, nonce) {
  if (!dbConfigured) {
    setDbStatus("Өгөгдлийн сан тохируулаагүй байна (config.js → supabaseUrl, supabaseAnonKey).");
    return;
  }
  setDbStatus("Өгөгдлийн санд хадгалж байна...");
  try {
    const client = getDbClient();
    const { error } = await client.auth.signInWithIdToken({ provider: "google", token: credential, nonce });
    if (error) throw dbError(error);
    await recordLogin(client);
  } catch (error) {
    setDbStatus(`Өгөгдлийн санд хадгалж чадсангүй: ${error.message}`, true);
  }
}

function dbSignOut() {
  setDbStatus("");
  dbClient?.auth.signOut().catch(() => {});
}
