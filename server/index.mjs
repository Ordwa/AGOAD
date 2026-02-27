import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

loadEnvFile(path.resolve(PROJECT_ROOT, ".env"));
loadEnvFile(path.resolve(__dirname, ".env"));

const PORT = Number(process.env.PORT || 8080);
const SESSION_SECRET = String(process.env.SESSION_SECRET || "change-me");
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "");
const GOOGLE_CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || "");
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 giorni
const OAUTH_TEMP_MAX_AGE_SECONDS = 60 * 10;
const OAUTH_STATE_COOKIE = "rpg_oauth_state";
const OAUTH_RETURN_TO_COOKIE = "rpg_oauth_return_to";
const COOKIE_SAMESITE = normalizeCookieSameSite(process.env.COOKIE_SAMESITE || "Lax");
const CORS_ALLOWED_ORIGINS = parseAllowedOrigins(
  process.env.CORS_ALLOWED_ORIGINS || "http://localhost:8080,https://ordwa.github.io",
);

const GITHUB_OWNER = String(process.env.GITHUB_OWNER || "");
const GITHUB_REPO = String(process.env.GITHUB_REPO || "");
const GITHUB_BRANCH = String(process.env.GITHUB_BRANCH || "main");
const GITHUB_TOKEN = String(process.env.GITHUB_TOKEN || "");
const GIT_PLAYERS_PREFIX = String(process.env.GIT_PLAYERS_PREFIX || "server-data/players");
const GIT_GAME_DATA_PATH = String(process.env.GIT_GAME_DATA_PATH || "server-data/game-data.json");

const MIME_BY_EXT = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      return;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      return;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(process.env, key)) {
      return;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  });
}

function parseAllowedOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function normalizeCookieSameSite(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "none") {
    return "None";
  }
  if (normalized === "strict") {
    return "Strict";
  }
  return "Lax";
}

function resolveCorsOrigin(req) {
  const requestOrigin = String(req.headers.origin || "").trim();
  if (requestOrigin.length === 0) {
    return "";
  }

  return CORS_ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : "";
}

function applyApiCorsHeaders(req, res) {
  const origin = resolveCorsOrigin(req);
  if (origin.length === 0) {
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function json(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  res.end(body);
}

function parseCookies(headerValue) {
  const raw = String(headerValue || "");
  if (raw.length === 0) {
    return {};
  }

  return raw.split(";").reduce((acc, token) => {
    const index = token.indexOf("=");
    if (index < 0) {
      return acc;
    }
    const key = token.slice(0, index).trim();
    const value = token.slice(index + 1).trim();
    acc[key] = value;
    return acc;
  }, {});
}

function toBase64Url(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function createSessionToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(user.sub || ""),
    email: String(user.email || ""),
    name: String(user.name || ""),
    picture: String(user.picture || ""),
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url(createHmac("sha256", SESSION_SECRET).update(encodedPayload).digest());
  return `${encodedPayload}.${signature}`;
}

function readSessionToken(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, encodedSignature] = parts;
  const expectedSignature = toBase64Url(
    createHmac("sha256", SESSION_SECRET).update(encodedPayload).digest(),
  );
  const provided = Buffer.from(encodedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  let payload = null;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8"));
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (Number(payload.exp) <= now) {
    return null;
  }

  if (String(payload.sub || "").length === 0) {
    return null;
  }

  return payload;
}

function setSessionCookie(res, token) {
  appendSetCookie(
    res,
    buildCookie("rpg_session", token, {
      maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
      httpOnly: true,
    }),
  );
}

function clearSessionCookie(res) {
  appendSetCookie(
    res,
    buildCookie("rpg_session", "", {
      maxAgeSeconds: 0,
      httpOnly: true,
    }),
  );
}

function appendSetCookie(res, cookieValue) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookieValue);
    return;
  }

  if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing, cookieValue]);
    return;
  }

  res.setHeader("Set-Cookie", [String(existing), cookieValue]);
}

function buildCookie(name, value, { maxAgeSeconds, httpOnly = true } = {}) {
  const secure = process.env.COOKIE_SECURE === "1" || COOKIE_SAMESITE === "None";
  const cookieParts = [
    `${name}=${value}`,
    "Path=/",
    `SameSite=${COOKIE_SAMESITE}`,
  ];
  if (httpOnly) {
    cookieParts.push("HttpOnly");
  }
  if (Number.isFinite(maxAgeSeconds)) {
    cookieParts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`);
  }
  if (secure) {
    cookieParts.push("Secure");
  }
  return cookieParts.join("; ");
}

function setOAuthTempCookies(res, state, returnTo) {
  appendSetCookie(
    res,
    buildCookie(OAUTH_STATE_COOKIE, encodeURIComponent(state), {
      maxAgeSeconds: OAUTH_TEMP_MAX_AGE_SECONDS,
      httpOnly: true,
    }),
  );
  appendSetCookie(
    res,
    buildCookie(OAUTH_RETURN_TO_COOKIE, encodeURIComponent(returnTo), {
      maxAgeSeconds: OAUTH_TEMP_MAX_AGE_SECONDS,
      httpOnly: true,
    }),
  );
}

function clearOAuthTempCookies(res) {
  appendSetCookie(
    res,
    buildCookie(OAUTH_STATE_COOKIE, "", {
      maxAgeSeconds: 0,
      httpOnly: true,
    }),
  );
  appendSetCookie(
    res,
    buildCookie(OAUTH_RETURN_TO_COOKIE, "", {
      maxAgeSeconds: 0,
      httpOnly: true,
    }),
  );
}

function resolveRequestBaseUrl(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const protocol = forwardedProto || (req.socket?.encrypted ? "https" : "http");
  const host = String(req.headers.host || `localhost:${PORT}`).trim();
  return `${protocol}://${host}`;
}

function sanitizeReturnTo(returnToRaw, requestBaseUrl) {
  const fallback = `${requestBaseUrl}/`;
  const raw = String(returnToRaw || "").trim();
  if (raw.length === 0) {
    return fallback;
  }

  if (raw.startsWith("/")) {
    return new URL(raw, requestBaseUrl).toString();
  }

  try {
    const parsed = new URL(raw);
    if (parsed.origin === requestBaseUrl || CORS_ALLOWED_ORIGINS.includes(parsed.origin)) {
      return parsed.toString();
    }
  } catch {
    return fallback;
  }

  return fallback;
}

function ensureGoogleOAuthServerConfig() {
  return GOOGLE_CLIENT_ID.length > 0 && GOOGLE_CLIENT_SECRET.length > 0;
}

async function exchangeGoogleCodeForTokens(code, redirectUri) {
  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error("Scambio codice Google fallito.");
  }

  return response.json();
}

function createOAuthState() {
  return randomBytes(24).toString("hex");
}

async function readJsonBody(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(part);
    length += part.length;
    if (length > 1024 * 1024) {
      throw new Error("Body troppo grande.");
    }
  }

  if (length === 0) {
    return {};
  }

  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("JSON non valido.");
  }
}

function ensureGithubConfig() {
  return GITHUB_OWNER.length > 0 && GITHUB_REPO.length > 0 && GITHUB_TOKEN.length > 0;
}

function assertGithubConfigured() {
  if (!ensureGithubConfig()) {
    throw new Error("Config GitHub mancante (GITHUB_OWNER/GITHUB_REPO/GITHUB_TOKEN).");
  }
}

async function githubRequest(apiPath, options = {}) {
  assertGithubConfigured();
  const url = `https://api.github.com${apiPath}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "User-Agent": "AGOAD-CloudSync-Server",
      ...(options.headers || {}),
    },
  });

  if (response.status === 404) {
    return { ok: false, status: 404, data: null };
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message : `GitHub API ${response.status}`;
    throw new Error(message);
  }

  return { ok: true, status: response.status, data };
}

async function getGitFile(filePath) {
  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const response = await githubRequest(
    `/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${encodedPath}?ref=${encodeURIComponent(GITHUB_BRANCH)}`,
    { method: "GET" },
  );
  if (!response.ok && response.status === 404) {
    return null;
  }

  const content = String(response.data?.content || "").replace(/\n/g, "");
  const decoded = Buffer.from(content, "base64").toString("utf8");
  return {
    sha: String(response.data?.sha || ""),
    text: decoded,
  };
}

async function putGitFile(filePath, text, message) {
  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const existing = await getGitFile(filePath);

  const response = await githubRequest(
    `/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/contents/${encodedPath}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        message,
        branch: GITHUB_BRANCH,
        content: Buffer.from(text, "utf8").toString("base64"),
        sha: existing?.sha || undefined,
      }),
    },
  );

  return response.ok;
}

async function verifyGoogleIdToken(idToken) {
  if (GOOGLE_CLIENT_ID.length === 0) {
    throw new Error("GOOGLE_CLIENT_ID non configurato sul server.");
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!response.ok) {
    throw new Error("Token Google non valido.");
  }

  const payload = await response.json();
  if (String(payload?.aud || "") !== GOOGLE_CLIENT_ID) {
    throw new Error("Token Google con client ID errato.");
  }

  if (String(payload?.sub || "").length === 0) {
    throw new Error("Token Google senza utente.");
  }

  return {
    sub: String(payload.sub),
    email: String(payload.email || ""),
    name: String(payload.name || ""),
    picture: String(payload.picture || ""),
  };
}

async function verifyGoogleAccessToken(accessToken) {
  if (GOOGLE_CLIENT_ID.length === 0) {
    throw new Error("GOOGLE_CLIENT_ID non configurato sul server.");
  }

  const tokenInfoResponse = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!tokenInfoResponse.ok) {
    throw new Error("Access token Google non valido.");
  }

  const tokenInfo = await tokenInfoResponse.json();
  const aud = String(tokenInfo?.aud || "").trim();
  const azp = String(tokenInfo?.azp || "").trim();
  if (aud.length > 0 && aud !== GOOGLE_CLIENT_ID && azp !== GOOGLE_CLIENT_ID) {
    throw new Error("Access token Google con client ID errato.");
  }

  const expiresIn = Number(tokenInfo?.expires_in);
  if (Number.isFinite(expiresIn) && expiresIn <= 0) {
    throw new Error("Access token Google scaduto.");
  }

  const subFromToken = String(tokenInfo?.sub || tokenInfo?.user_id || "").trim();
  const emailFromToken = String(tokenInfo?.email || "").trim();

  let userInfo = {};
  try {
    const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (userInfoResponse.ok) {
      userInfo = await userInfoResponse.json();
    }
  } catch {
    userInfo = {};
  }

  const sub = String(userInfo?.sub || subFromToken || "").trim();
  if (sub.length === 0) {
    throw new Error("Access token Google senza utente.");
  }

  return {
    sub,
    email: String(userInfo?.email || emailFromToken || ""),
    name: String(userInfo?.name || ""),
    picture: String(userInfo?.picture || ""),
  };
}

function getSessionUserFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.rpg_session;
  return readSessionToken(token);
}

async function handleApi(req, res, urlObject) {
  const method = req.method || "GET";
  const pathname = urlObject.pathname || "";

  if (method === "GET" && pathname === "/api/health") {
    json(res, 200, { ok: true });
    return true;
  }

  if (method === "GET" && pathname === "/api/auth/google/start") {
    if (!ensureGoogleOAuthServerConfig()) {
      json(res, 500, {
        error: "OAuth Google non configurato sul server (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET).",
      });
      return true;
    }

    const requestBaseUrl = resolveRequestBaseUrl(req);
    const returnTo = sanitizeReturnTo(urlObject.searchParams.get("returnTo"), requestBaseUrl);
    const redirectUri = `${requestBaseUrl}/api/auth/google/callback`;
    const state = createOAuthState();
    setOAuthTempCookies(res, state, returnTo);

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "online",
      include_granted_scopes: "true",
      prompt: "select_account",
    });

    res.writeHead(302, {
      Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      "Cache-Control": "no-store",
    });
    res.end();
    return true;
  }

  if (method === "GET" && pathname === "/api/auth/google/callback") {
    const requestBaseUrl = resolveRequestBaseUrl(req);
    const cookies = parseCookies(req.headers.cookie);
    const returnTo = sanitizeReturnTo(
      decodeURIComponent(cookies[OAUTH_RETURN_TO_COOKIE] || ""),
      requestBaseUrl,
    );
    const redirectUri = `${requestBaseUrl}/api/auth/google/callback`;
    const callbackError = String(urlObject.searchParams.get("error") || "").trim();
    const callbackState = String(urlObject.searchParams.get("state") || "").trim();
    const callbackCode = String(urlObject.searchParams.get("code") || "").trim();
    const expectedState = decodeURIComponent(cookies[OAUTH_STATE_COOKIE] || "").trim();

    const redirectWithStatus = (statusCode) => {
      const target = new URL(returnTo);
      if (statusCode.length > 0) {
        target.searchParams.set("login_error", statusCode);
      }
      clearOAuthTempCookies(res);
      res.writeHead(302, {
        Location: target.toString(),
        "Cache-Control": "no-store",
      });
      res.end();
    };

    if (callbackError.length > 0) {
      redirectWithStatus(`google_${callbackError}`);
      return true;
    }

    if (
      callbackCode.length === 0 ||
      callbackState.length === 0 ||
      expectedState.length === 0 ||
      callbackState !== expectedState
    ) {
      redirectWithStatus("invalid_oauth_state");
      return true;
    }

    try {
      if (!ensureGoogleOAuthServerConfig()) {
        redirectWithStatus("oauth_not_configured");
        return true;
      }

      const tokens = await exchangeGoogleCodeForTokens(callbackCode, redirectUri);
      const idToken = String(tokens?.id_token || "").trim();
      const accessToken = String(tokens?.access_token || "").trim();
      if (idToken.length === 0 && accessToken.length === 0) {
        redirectWithStatus("missing_google_tokens");
        return true;
      }

      const user =
        idToken.length > 0
          ? await verifyGoogleIdToken(idToken)
          : await verifyGoogleAccessToken(accessToken);
      const sessionToken = createSessionToken(user);
      setSessionCookie(res, sessionToken);
      clearOAuthTempCookies(res);
      res.writeHead(302, {
        Location: returnTo,
        "Cache-Control": "no-store",
      });
      res.end();
      return true;
    } catch {
      redirectWithStatus("oauth_exchange_failed");
      return true;
    }
  }

  if (method === "POST" && pathname === "/api/auth/google") {
    try {
      const body = await readJsonBody(req);
      const idToken = String(body?.idToken || "");
      const accessToken = String(body?.accessToken || "");
      if (idToken.length === 0 && accessToken.length === 0) {
        json(res, 400, { error: "idToken/accessToken mancante." });
        return true;
      }

      const user =
        idToken.length > 0
          ? await verifyGoogleIdToken(idToken)
          : await verifyGoogleAccessToken(accessToken);
      const sessionToken = createSessionToken(user);
      setSessionCookie(res, sessionToken);
      json(res, 200, { ok: true, user });
      return true;
    } catch (error) {
      json(res, 401, { error: error instanceof Error ? error.message : "Login Google fallito." });
      return true;
    }
  }

  if (method === "GET" && pathname === "/api/auth/me") {
    const user = getSessionUserFromRequest(req);
    if (!user) {
      json(res, 401, { error: "Sessione non valida." });
      return true;
    }

    json(res, 200, {
      ok: true,
      user: {
        sub: user.sub,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
    return true;
  }

  if (method === "POST" && pathname === "/api/auth/logout") {
    clearSessionCookie(res);
    json(res, 200, { ok: true });
    return true;
  }

  if (method === "GET" && pathname === "/api/game-data") {
    try {
      if (!ensureGithubConfig()) {
        json(res, 200, { ok: true, data: null });
        return true;
      }

      const file = await getGitFile(GIT_GAME_DATA_PATH);
      if (!file) {
        json(res, 200, { ok: true, data: null });
        return true;
      }

      const parsed = JSON.parse(file.text);
      json(res, 200, { ok: true, data: parsed?.data ?? null });
      return true;
    } catch (error) {
      json(res, 500, { error: error instanceof Error ? error.message : "Errore lettura game-data." });
      return true;
    }
  }

  if (method === "PUT" && pathname === "/api/game-data") {
    const user = getSessionUserFromRequest(req);
    if (!user) {
      json(res, 401, { error: "Autenticazione richiesta." });
      return true;
    }

    try {
      const body = await readJsonBody(req);
      if (!body || typeof body.data !== "object" || !body.data) {
        json(res, 400, { error: "Body data non valido." });
        return true;
      }

      await putGitFile(
        GIT_GAME_DATA_PATH,
        JSON.stringify(
          {
            version: 1,
            updatedAt: Date.now(),
            updatedBy: user.sub,
            data: body.data,
          },
          null,
          2,
        ),
        `Update game-data by ${user.sub}`,
      );
      json(res, 200, { ok: true });
      return true;
    } catch (error) {
      json(res, 500, { error: error instanceof Error ? error.message : "Errore salvataggio game-data." });
      return true;
    }
  }

  if (pathname === "/api/player/progress") {
    const user = getSessionUserFromRequest(req);
    if (!user) {
      json(res, 401, { error: "Autenticazione richiesta." });
      return true;
    }

    const filePath = `${GIT_PLAYERS_PREFIX}/${user.sub}.json`;
    if (method === "GET") {
      try {
        if (!ensureGithubConfig()) {
          json(res, 200, { ok: true, progress: null });
          return true;
        }

        const file = await getGitFile(filePath);
        if (!file) {
          json(res, 200, { ok: true, progress: null });
          return true;
        }

        const parsed = JSON.parse(file.text);
        json(res, 200, { ok: true, progress: parsed?.progress ?? null });
        return true;
      } catch (error) {
        json(res, 500, { error: error instanceof Error ? error.message : "Errore lettura progressi." });
        return true;
      }
    }

    if (method === "PUT") {
      try {
        const body = await readJsonBody(req);
        if (!body || typeof body.progress !== "object" || !body.progress) {
          json(res, 400, { error: "Body progress non valido." });
          return true;
        }

        await putGitFile(
          filePath,
          JSON.stringify(
            {
              version: 1,
              user: {
                sub: user.sub,
                email: user.email,
                name: user.name,
              },
              updatedAt: Date.now(),
              progress: body.progress,
            },
            null,
            2,
          ),
          `Update progress for ${user.sub}`,
        );
        json(res, 200, { ok: true });
        return true;
      } catch (error) {
        json(res, 500, { error: error instanceof Error ? error.message : "Errore salvataggio progressi." });
        return true;
      }
    }
  }

  return false;
}

function safeResolveStaticPath(requestPathname) {
  const decoded = decodeURIComponent(requestPathname.split("?")[0] || "/");
  const normalized = decoded === "/" ? "/index.html" : decoded;
  const absolutePath = path.resolve(PROJECT_ROOT, `.${normalized}`);
  if (!absolutePath.startsWith(PROJECT_ROOT)) {
    return null;
  }
  return absolutePath;
}

function serveStatic(req, res, pathname) {
  const filePath = safeResolveStaticPath(pathname);
  if (!filePath || !existsSync(filePath)) {
    const fallback = path.resolve(PROJECT_ROOT, "index.html");
    if (!existsSync(fallback)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const stream = createReadStream(fallback);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    stream.pipe(res);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": mime,
    "Cache-Control": ext === ".html" || ext === ".js" || ext === ".css" ? "no-store" : "public, max-age=86400",
  });
  createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  const urlObject = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (urlObject.pathname.startsWith("/api/")) {
    applyApiCorsHeaders(req, res);
    if ((req.method || "GET") === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const handled = await handleApi(req, res, urlObject);
    if (!handled) {
      json(res, 404, { error: "API route non trovata." });
    }
    return;
  }

  serveStatic(req, res, urlObject.pathname);
});

server.listen(PORT, () => {
  console.log(`[server] AGOAD in ascolto su http://localhost:${PORT}`);
  if (!ensureGithubConfig()) {
    console.log("[server] GitHub sync non configurata: usa GITHUB_OWNER/GITHUB_REPO/GITHUB_TOKEN.");
  }
  if (GOOGLE_CLIENT_ID.length === 0) {
    console.log("[server] Google login non configurato: imposta GOOGLE_CLIENT_ID.");
  }
  console.log(`[server] Cookie SameSite: ${COOKIE_SAMESITE}`);
  console.log(`[server] CORS consentiti: ${CORS_ALLOWED_ORIGINS.join(", ") || "(nessuno)"}`);
});
