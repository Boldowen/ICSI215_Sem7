// Нэвтрэлт: (1) өгөгдлийн сангийн имэйл/нууц үг, (2) Google Identity Services.
// Хоёр арга хоёулаа ижил showSignedIn() → ижил профайл, цаг агаарын хэсгийг нээнэ.
const loginPanel = document.getElementById("loginPanel");
const profilePanel = document.getElementById("profilePanel");
const weatherPanel = document.getElementById("weatherPanel");
const authStatus = document.getElementById("authStatus");
const profilePicture = document.getElementById("profilePicture");
const profileFallback = document.getElementById("profileFallback");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
let expirationTimer;
let expiresAt = 0;
let signInNonce;

function setAuthStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.classList.toggle("error", isError);
}

// ---------- Нийтлэг UI: аль ч аргаар нэвтэрсэн ижил харагдана ----------
function showSignedIn({ name, email, id, picture, method }) {
  const displayName = name || email || "Хэрэглэгч";
  document.getElementById("profileName").textContent = displayName;
  document.getElementById("profileEmail").textContent = email || "Email мэдээлэл байхгүй";
  document.getElementById("profileMethod").textContent = method;
  document.getElementById("profileId").textContent = id;
  profileFallback.textContent = Array.from(displayName)[0].toUpperCase();
  profileFallback.hidden = false;
  profilePicture.hidden = true;
  profilePicture.removeAttribute("src");

  // Зураг байхгүй эсвэл татагдахгүй үед нэрийн эхний үсгийг харуулна.
  if (typeof picture === "string" && picture.startsWith("https://")) {
    profilePicture.src = picture;
  }

  loginForm.reset();
  registerForm.reset();
  loginPanel.hidden = true;
  profilePanel.hidden = false;
  weatherPanel.hidden = false;
  setAuthStatus("Амжилттай нэвтэрлээ.");
}

function signOut() {
  clearTimeout(expirationTimer);
  expiresAt = 0;
  window.google?.accounts?.id.disableAutoSelect();
  dbSignOut();
  loginPanel.hidden = false;
  profilePanel.hidden = true;
  weatherPanel.hidden = true;
  ["profileName", "profileEmail", "profileMethod", "profileId", "profileFallback"].forEach(id => {
    document.getElementById(id).textContent = "";
  });
  profilePicture.removeAttribute("src");
  profilePicture.hidden = true;
  setAuthStatus("Та гарлаа. Дахин нэвтэрч болно.");
}

function expireSignIn() {
  signOut();
  setAuthStatus("Нэвтрэлтийн хугацаа дууслаа. Дахин нэвтэрнэ үү.");
}

profilePicture.addEventListener("load", () => {
  profilePicture.hidden = false;
  profileFallback.hidden = true;
});
profilePicture.addEventListener("error", () => {
  profilePicture.hidden = true;
  profileFallback.hidden = false;
});

document.getElementById("signOutButton").addEventListener("click", signOut);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && expiresAt && Date.now() >= expiresAt) expireSignIn();
});

// ---------- Нэвтрэх / Бүртгүүлэх таб ----------
function showTab(register) {
  loginForm.hidden = register;
  registerForm.hidden = !register;
  tabLogin.setAttribute("aria-selected", String(!register));
  tabRegister.setAttribute("aria-selected", String(register));
  setAuthStatus("");
}
tabLogin.addEventListener("click", () => showTab(false));
tabRegister.addEventListener("click", () => showTab(true));

// ---------- Өгөгдлийн сангаар нэвтрэх ----------
function showDbUser(row) {
  showSignedIn({
    name: [row.last_name, row.first_name].filter(Boolean).join(" ") || row.name,
    email: row.email,
    id: row.id,
    picture: row.picture,
    method: "Имэйл, нууц үг"
  });
}

async function submitForm(form, busyText, action) {
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  setAuthStatus(busyText);
  try {
    await action(Object.fromEntries(new FormData(form)));
  } catch (error) {
    dbSignOut();
    setAuthStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
}

loginForm.addEventListener("submit", event => {
  event.preventDefault();
  submitForm(loginForm, "Нэвтэрч байна...", async ({ email, password }) => {
    showDbUser(await dbEmailLogin(email.trim(), password));
  });
});

registerForm.addEventListener("submit", event => {
  event.preventDefault();
  submitForm(registerForm, "Бүртгэж байна...", async ({ lastName, firstName, email, password }) => {
    const row = await dbEmailRegister({
      lastName: lastName.trim(),
      firstName: firstName.trim(),
      email: email.trim(),
      password
    });
    if (row) {
      showDbUser(row);
    } else {
      registerForm.reset();
      showTab(false);
      setAuthStatus("Бүртгэл үүслээ. Имэйлээр ирсэн холбоосоор хаягаа баталгаажуулаад нэвтэрнэ үү.");
    }
  });
});

// ---------- Google-ээр нэвтрэх ----------
// JWT-ийн payload нь Base64URL JSON. UTF-8 тайлснаар монгол нэр зөв харагдана.
// Энэ нь зөвхөн мэдээлэл унших үйлдэл; гарын үсгийг Supabase сервер талд шалгана.
function decodeCredential(credential) {
  const parts = credential.split(".");
  if (parts.length !== 3) throw new Error("ID token-ийн бүтэц буруу байна.");
  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), ch => ch.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function handleCredentialResponse(response) {
  try {
    const user = decodeCredential(response.credential);
    if (user.aud !== APP_CONFIG.googleClientId
        || !["https://accounts.google.com", "accounts.google.com"].includes(user.iss)
        || typeof user.exp !== "number" || user.exp * 1000 <= Date.now()
        || typeof user.sub !== "string" || !user.sub) {
      throw new Error("Нэвтрэх мэдээлэл тохирохгүй эсвэл хугацаа нь дууссан байна.");
    }

    showSignedIn({
      name: user.name || "Google хэрэглэгч",
      email: user.email,
      id: user.sub,
      picture: user.picture,
      method: "Google"
    });
    saveGoogleUserToDb(response.credential, signInNonce?.raw);

    // Token болон profile-ийг localStorage-д хадгалахгүй.
    clearTimeout(expirationTimer);
    expiresAt = user.exp * 1000;
    expirationTimer = setTimeout(expireSignIn, Math.min(expiresAt - Date.now(), 2147483647));
  } catch (error) {
    signOut();
    setAuthStatus(`Нэвтрэхэд алдаа гарлаа: ${error.message}`, true);
  }
}

async function initializeGoogleSignIn() {
  try {
    if (dbConfigured) signInNonce = await createNonce();
    google.accounts.id.initialize({
      client_id: APP_CONFIG.googleClientId,
      nonce: signInNonce?.hashed,
      callback: handleCredentialResponse,
      auto_select: false,
      ux_mode: "popup"
    });
    google.accounts.id.renderButton(document.getElementById("googleButton"), {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with"
    });
  } catch {
    setAuthStatus("Google нэвтрэлтийг эхлүүлж чадсангүй. Хуудсаа дахин ачаална уу.", true);
  }
}

if (window.location.protocol === "file:") {
  setAuthStatus("Хуудсаа http://localhost:5500 хаягаар нээнэ үү. HTML файлыг шууд нээхэд нэвтрэлт ажиллахгүй.", true);
} else {
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.onload = initializeGoogleSignIn;
  script.onerror = () => setAuthStatus("Google нэвтрэлт ачаалагдсангүй. Имэйл, нууц үгээр нэвтэрч болно.", true);
  document.head.appendChild(script);
}
