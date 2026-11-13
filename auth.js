// Google Identity Services: албан ёсны товч → JWT → хэрэглэгчийн мэдээлэл.
const loginPanel = document.getElementById("loginPanel");
const profilePanel = document.getElementById("profilePanel");
const weatherPanel = document.getElementById("weatherPanel");
const authStatus = document.getElementById("authStatus");
const profilePicture = document.getElementById("profilePicture");
const profileFallback = document.getElementById("profileFallback");
let expirationTimer;
let expiresAt = 0;
let signInNonce;

function setAuthStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.classList.toggle("error", isError);
}

// JWT-ийн payload нь Base64URL JSON. UTF-8 тайлснаар монгол нэр зөв харагдана.
// Энэ нь зөвхөн мэдээлэл унших үйлдэл; гарын үсгийн баталгаажуулалт биш.
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

    const name = user.name || "Google хэрэглэгч";
    document.getElementById("profileName").textContent = name;
    document.getElementById("profileEmail").textContent = user.email || "Email мэдээлэл байхгүй";
    document.getElementById("profileId").textContent = user.sub;
    profileFallback.textContent = Array.from(name)[0].toUpperCase();
    profileFallback.hidden = false;
    profilePicture.hidden = true;
    profilePicture.removeAttribute("src");

    // Зураг байхгүй эсвэл татагдахгүй үед нэрийн эхний үсгийг харуулна.
    if (typeof user.picture === "string" && user.picture.startsWith("https://")) {
      profilePicture.src = user.picture;
    }

    loginPanel.hidden = true;
    profilePanel.hidden = false;
    weatherPanel.hidden = false;
    setAuthStatus("Амжилттай нэвтэрлээ.");
    saveUserToDb(response.credential, signInNonce?.raw);

    // Token болон profile-ийг localStorage-д хадгалахгүй.
    clearTimeout(expirationTimer);
    expiresAt = user.exp * 1000;
    expirationTimer = setTimeout(expireSignIn, Math.min(expiresAt - Date.now(), 2147483647));
  } catch (error) {
    signOut();
    setAuthStatus(`Нэвтрэхэд алдаа гарлаа: ${error.message}`, true);
  }
}

profilePicture.addEventListener("load", () => {
  profilePicture.hidden = false;
  profileFallback.hidden = true;
});
profilePicture.addEventListener("error", () => {
  profilePicture.hidden = true;
  profileFallback.hidden = false;
});

function signOut() {
  clearTimeout(expirationTimer);
  expiresAt = 0;
  window.google?.accounts?.id.disableAutoSelect();
  dbSignOut();
  loginPanel.hidden = false;
  profilePanel.hidden = true;
  weatherPanel.hidden = true;
  ["profileName", "profileEmail", "profileId", "profileFallback"].forEach(id => {
    document.getElementById(id).textContent = "";
  });
  profilePicture.removeAttribute("src");
  profilePicture.hidden = true;
  setAuthStatus("Та гарлаа. Дахин Google-ээр нэвтэрч болно.");
}

function expireSignIn() {
  signOut();
  setAuthStatus("Нэвтрэлтийн хугацаа дууслаа. Дахин нэвтэрнэ үү.");
}

document.getElementById("signOutButton").addEventListener("click", signOut);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && expiresAt && Date.now() >= expiresAt) expireSignIn();
});

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
    setAuthStatus("");
  } catch {
    setAuthStatus("Google нэвтрэлтийг эхлүүлж чадсангүй. Хуудсаа дахин ачаална уу.", true);
  }
}

if (window.location.protocol === "file:") {
  setAuthStatus("Хуудсаа http://localhost:5500 хаягаар нээнэ үү. HTML файлыг шууд нээхэд Google нэвтрэлт ажиллахгүй.", true);
} else {
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.onload = initializeGoogleSignIn;
  script.onerror = () => setAuthStatus("Google нэвтрэлт ачаалагдсангүй. Интернэт холболтоо шалгаад дахин ачаална уу.", true);
  document.head.appendChild(script);
}
