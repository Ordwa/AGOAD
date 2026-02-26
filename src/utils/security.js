const GM_EDIT_ADMIN_PASSWORD_HASH = "31f828f57cab9a9b725a7a43e5a090a1472b9eb35fc94a60b93cf315f3a2916b";

export async function verifyGmEditPassword(password) {
  if (typeof password !== "string") {
    return false;
  }

  const trimmedPassword = password.trim();
  if (trimmedPassword.length === 0) {
    return false;
  }

  const hash = await sha256Hex(trimmedPassword);
  if (!hash) {
    return false;
  }

  return hash === GM_EDIT_ADMIN_PASSWORD_HASH;
}

async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) {
    return "";
  }

  const encoded = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
