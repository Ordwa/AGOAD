let googleScriptPromise = null;
const GOOGLE_REDIRECT_STATE_STORAGE_KEY = "agoad_google_redirect_state";
const GOOGLE_CLIENT_ID_PATTERN = /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i;
const GOOGLE_SCRIPT_LOAD_TIMEOUT_MS = 12000;
const GOOGLE_LOGIN_STEP_TIMEOUT_MS = 15000;

function sanitizeGoogleClientId(rawValue) {
  let value = String(rawValue ?? "").trim();
  if (value.length === 0) {
    return "";
  }

  // Accept values accidentally saved with quotes in env/variables.
  value = value.replace(/^['"]+|['"]+$/g, "").trim();
  return value;
}

function isValidGoogleClientId(value) {
  return GOOGLE_CLIENT_ID_PATTERN.test(String(value ?? "").trim());
}

function readGoogleClientId() {
  if (typeof window === "undefined") {
    return "";
  }

  const fromConfig =
    typeof window.__APP_CONFIG__ === "object" && window.__APP_CONFIG__
      ? String(window.__APP_CONFIG__.googleClientId ?? "").trim()
      : "";
  if (fromConfig.length > 0) {
    const normalized = sanitizeGoogleClientId(fromConfig);
    if (isValidGoogleClientId(normalized)) {
      return normalized;
    }

    console.warn("[AGOAD] googleClientId non valido in __APP_CONFIG__.");
  }

  const meta = document.querySelector('meta[name="google-client-id"]');
  if (!meta) {
    return "";
  }

  const normalized = sanitizeGoogleClientId(meta.getAttribute("content") ?? "");
  if (isValidGoogleClientId(normalized)) {
    return normalized;
  }

  if (normalized.length > 0) {
    console.warn("[AGOAD] google-client-id meta tag non valido.");
  }
  return "";
}

function readApiBaseUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  const fromConfig =
    typeof window.__APP_CONFIG__ === "object" && window.__APP_CONFIG__
      ? String(window.__APP_CONFIG__.apiBaseUrl ?? "").trim()
      : "";
  if (fromConfig.length > 0) {
    return fromConfig;
  }

  const meta = document.querySelector('meta[name="api-base-url"]');
  if (!meta) {
    return "";
  }

  return String(meta.getAttribute("content") ?? "").trim();
}

function buildApiUrl(path) {
  const rawPath = String(path ?? "").trim();
  if (rawPath.length === 0) {
    return rawPath;
  }

  const baseUrl = readApiBaseUrl();
  if (baseUrl.length === 0) {
    return rawPath;
  }

  try {
    return new URL(rawPath, baseUrl).toString();
  } catch {
    return rawPath;
  }
}

function isRunningOnGitHubPages() {
  if (typeof window === "undefined" || !window.location) {
    return false;
  }

  const hostname = String(window.location.hostname || "").toLowerCase();
  return hostname.endsWith(".github.io");
}

function readWindowOrigin() {
  if (typeof window === "undefined" || !window.location) {
    return "";
  }

  return String(window.location.origin || "").trim();
}

function isSupportedGoogleLoginOrigin(origin) {
  if (origin === "https://ordwa.github.io") {
    return true;
  }

  if (/^http:\/\/localhost(?::\d+)?$/.test(origin)) {
    return true;
  }

  if (/^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(origin)) {
    return true;
  }

  return false;
}

function getPromptMomentReason(notification, kind) {
  if (!notification || typeof notification !== "object") {
    return "";
  }

  try {
    if (kind === "not_displayed" && typeof notification.getNotDisplayedReason === "function") {
      return String(notification.getNotDisplayedReason() || "").trim();
    }
    if (kind === "skipped" && typeof notification.getSkippedReason === "function") {
      return String(notification.getSkippedReason() || "").trim();
    }
    if (kind === "dismissed" && typeof notification.getDismissedReason === "function") {
      return String(notification.getDismissedReason() || "").trim();
    }
  } catch {
    return "";
  }

  return "";
}

function appendReason(baseMessage, reason) {
  const safeReason = String(reason || "").trim();
  if (safeReason.length === 0) {
    return baseMessage;
  }
  return `${baseMessage} (${safeReason})`;
}

function shouldUseButtonFallback(errorMessage) {
  const text = String(errorMessage || "").toLowerCase();
  if (text.includes("annullato")) {
    return false;
  }

  if (text.includes("client id non configurato")) {
    return false;
  }

  if (text.includes("origine non valida")) {
    return false;
  }

  return true;
}

function shouldSuggestExternalBrowser(errorMessage) {
  const text = String(errorMessage || "").toLowerCase();
  if (text.length === 0) {
    return false;
  }

  return text.includes("disallowed_useragent") || text.includes("unsupported_useragent");
}

function getExternalBrowserLoginUrl() {
  if (typeof window === "undefined" || !window.location) {
    return "";
  }

  try {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.hash = "";
    return cleanUrl.toString();
  } catch {
    return String(window.location.href || "");
  }
}

function createExternalBrowserLoginResult(previousError = "") {
  const detail = String(previousError || "").trim();
  const baseMessage = "Browser integrato non supportato da Google. Apri il gioco in un browser esterno.";
  return {
    ok: false,
    error: detail.length > 0 ? `${baseMessage} (${detail})` : baseMessage,
    recovery: {
      type: "external-browser",
      url: getExternalBrowserLoginUrl(),
      label: "APRI NEL BROWSER",
    },
  };
}

function requestGoogleIdTokenWithButton(clientId, previousError = "") {
  if (typeof window === "undefined" || typeof document === "undefined" || !window.google?.accounts?.id) {
    return Promise.resolve({
      ok: false,
      error: previousError || "Google Identity non disponibile.",
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = 0;

    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(2, 10, 18, 0.75)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "20px";
    overlay.style.zIndex = "99999";

    const card = document.createElement("div");
    card.style.width = "min(92vw, 420px)";
    card.style.background = "#0f1f33";
    card.style.border = "2px solid #8bb0df";
    card.style.borderRadius = "14px";
    card.style.padding = "16px";
    card.style.boxSizing = "border-box";
    card.style.color = "#f3f9ff";
    card.style.fontFamily = "monospace";
    card.style.textAlign = "center";

    const title = document.createElement("div");
    title.textContent = "LOGIN GOOGLE";
    title.style.fontSize = "18px";
    title.style.marginBottom = "10px";

    const hint = document.createElement("div");
    hint.textContent = "One Tap non disponibile su questo browser. Continua con Google.";
    hint.style.fontSize = "12px";
    hint.style.opacity = "0.9";
    hint.style.marginBottom = "14px";

    const buttonHost = document.createElement("div");
    buttonHost.style.display = "flex";
    buttonHost.style.justifyContent = "center";
    buttonHost.style.marginBottom = "12px";

    const directAuthButton = document.createElement("button");
    directAuthButton.type = "button";
    directAuthButton.textContent = "APRI POPUP GOOGLE";
    directAuthButton.style.border = "1px solid #8bb0df";
    directAuthButton.style.background = "#2a5fa2";
    directAuthButton.style.color = "#f3f9ff";
    directAuthButton.style.borderRadius = "8px";
    directAuthButton.style.padding = "8px 14px";
    directAuthButton.style.fontFamily = "monospace";
    directAuthButton.style.fontSize = "12px";
    directAuthButton.style.cursor = "pointer";
    directAuthButton.style.marginBottom = "10px";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "ANNULLA";
    cancelButton.style.border = "1px solid #8bb0df";
    cancelButton.style.background = "#1d3554";
    cancelButton.style.color = "#f3f9ff";
    cancelButton.style.borderRadius = "8px";
    cancelButton.style.padding = "8px 14px";
    cancelButton.style.fontFamily = "monospace";
    cancelButton.style.fontSize = "12px";
    cancelButton.style.cursor = "pointer";

    card.appendChild(title);
    card.appendChild(hint);
    card.appendChild(buttonHost);
    card.appendChild(directAuthButton);
    card.appendChild(cancelButton);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      directAuthButton.removeEventListener("click", onDirectAuth);
      cancelButton.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlayTap);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };

    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(result);
    };

    const onCancel = () => finish({ ok: false, error: "Login Google annullato." });
    const onDirectAuth = () => {
      directAuthButton.disabled = true;
      cancelButton.disabled = true;
      hint.textContent = "Apertura popup Google...";
      requestGoogleAccessTokenWithPopup(clientId, previousError || "Login popup richiesto.")
        .then((result) => {
          if (!result.ok) {
            finish(result);
            return;
          }

          finish({ ok: true, accessToken: result.accessToken });
        })
        .catch((error) => {
          finish({
            ok: false,
            error: error instanceof Error ? error.message : "Errore popup Google.",
          });
        });
    };
    const onOverlayTap = (event) => {
      if (event.target === overlay) {
        finish({ ok: false, error: "Login Google annullato." });
      }
    };

    directAuthButton.addEventListener("click", onDirectAuth);
    cancelButton.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlayTap);

    timeoutId = window.setTimeout(() => {
      finish({ ok: false, error: "Timeout login Google." });
    }, GOOGLE_LOGIN_STEP_TIMEOUT_MS);

    try {
      window.google.accounts.id.cancel?.();
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (!response || typeof response.credential !== "string" || response.credential.length === 0) {
            finish({ ok: false, error: "Token Google non ricevuto." });
            return;
          }
          finish({ ok: true, idToken: response.credential });
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: false,
      });

      window.google.accounts.id.renderButton(buttonHost, {
        theme: "outline",
        size: "large",
        type: "standard",
        text: "signin_with",
        shape: "pill",
        width: 280,
      });
    } catch (error) {
      finish({
        ok: false,
        error: error instanceof Error ? error.message : "Impossibile mostrare pulsante Google.",
      });
    }
  });
}

function requestGoogleAccessTokenWithPopup(clientId, previousError = "") {
  if (typeof window === "undefined" || !window.google?.accounts?.oauth2) {
    return Promise.resolve({
      ok: false,
      error: previousError || "OAuth Google non disponibile.",
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({ ok: false, error: "Timeout login Google (popup)." });
    }, GOOGLE_LOGIN_STEP_TIMEOUT_MS);

    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(result);
    };

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid email profile",
        prompt: "select_account",
        callback: (response) => {
          if (!response || typeof response !== "object") {
            finish({ ok: false, error: "Risposta OAuth non valida." });
            return;
          }

          if (typeof response.error === "string" && response.error.length > 0) {
            finish({ ok: false, error: `Login Google non disponibile (${response.error}).` });
            return;
          }

          if (
            typeof response.access_token !== "string" ||
            response.access_token.trim().length === 0
          ) {
            finish({ ok: false, error: "Access token Google non ricevuto." });
            return;
          }

          finish({ ok: true, accessToken: response.access_token });
        },
        error_callback: (error) => {
          const reason =
            error && typeof error.type === "string" && error.type.length > 0
              ? error.type
              : "popup_failed";
          finish({ ok: false, error: `Login Google non disponibile (${reason}).` });
        },
      });

      tokenClient.requestAccessToken({
        prompt: "select_account",
      });
    } catch (error) {
      finish({
        ok: false,
        error: error instanceof Error ? error.message : "Impossibile avviare OAuth Google.",
      });
    }
  });
}

function startGoogleRedirectLogin(previousError = "") {
  if (typeof window === "undefined") {
    return { ok: false, error: previousError || "Reindirizzamento Google non disponibile." };
  }

  try {
    const clientId = readGoogleClientId();
    if (clientId.length === 0) {
      return { ok: false, error: "Google Client ID non configurato." };
    }

    const redirectUri = new URL(window.location.href);
    redirectUri.hash = "";
    const state = createOAuthStateValue();
    try {
      window.sessionStorage.setItem(GOOGLE_REDIRECT_STATE_STORAGE_KEY, state);
    } catch {
      // ignore
    }

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri.toString());
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("prompt", "select_account");
    authUrl.searchParams.set("include_granted_scopes", "true");

    window.location.assign(authUrl.toString());
    return { ok: false, error: "Reindirizzamento login Google in corso..." };
  } catch {
    return { ok: false, error: previousError || "Impossibile avviare login Google." };
  }
}

function createOAuthStateValue() {
  if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  const randomPart = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}_${randomPart}`;
}

function consumeRedirectHash() {
  if (typeof window === "undefined") {
    return null;
  }

  const hash = String(window.location.hash || "");
  if (hash.length <= 1) {
    return null;
  }

  const params = new URLSearchParams(hash.slice(1));
  const hasOAuthMarker = params.has("access_token") || params.has("error");
  if (!hasOAuthMarker) {
    return null;
  }

  const accessToken = String(params.get("access_token") || "").trim();
  const state = String(params.get("state") || "").trim();
  const error = String(params.get("error") || "").trim();
  const errorDescription = String(params.get("error_description") || "").trim();

  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  if (window.history?.replaceState) {
    window.history.replaceState(null, "", cleanUrl);
  } else {
    window.location.hash = "";
  }

  let expectedState = "";
  try {
    expectedState = String(
      window.sessionStorage.getItem(GOOGLE_REDIRECT_STATE_STORAGE_KEY) || "",
    ).trim();
    window.sessionStorage.removeItem(GOOGLE_REDIRECT_STATE_STORAGE_KEY);
  } catch {
    expectedState = "";
  }

  return {
    accessToken,
    state,
    expectedState,
    error,
    errorDescription,
  };
}

async function consumeRedirectLoginIfPresent() {
  const payload = consumeRedirectHash();
  if (!payload) {
    return { handled: false };
  }

  if (payload.error.length > 0) {
    const details =
      payload.errorDescription.length > 0
        ? `${payload.error} (${payload.errorDescription})`
        : payload.error;
    return { handled: true, ok: false, error: `Login Google non completato (${details}).` };
  }

  if (payload.accessToken.length === 0) {
    return { handled: true, ok: false, error: "Access token Google non ricevuto." };
  }

  if (
    payload.expectedState.length > 0 &&
    payload.state.length > 0 &&
    payload.expectedState !== payload.state
  ) {
    return { handled: true, ok: false, error: "Sessione login non valida (state mismatch)." };
  }

  const login = await authenticateWithGoogleToken({
    accessToken: payload.accessToken,
  });
  return {
    handled: true,
    ok: login.ok,
    user: login.user ?? null,
    error: login.error ?? "",
  };
}

async function authenticateWithGoogleToken(payload) {
  const authResponse = await requestJson("/api/auth/google", {
    method: "POST",
    body: payload,
  });
  if (!authResponse.ok) {
    return { ok: false, error: authResponse.error ?? "Autenticazione server fallita." };
  }

  return {
    ok: true,
    user: authResponse.data?.user ?? null,
  };
}

function loadGoogleScript() {
  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      googleScriptPromise = null;
      reject(new Error("Ambiente browser non disponibile."));
      return;
    }

    if (window.google?.accounts?.id) {
      resolve(window.google);
      return;
    }

    let settled = false;
    let timeoutId = 0;

    const cleanupAndReject = (message) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      googleScriptPromise = null;
      reject(new Error(message));
    };

    const cleanupAndResolve = () => {
      if (settled) {
        return;
      }
      if (!window.google?.accounts?.id) {
        cleanupAndReject("Google Identity non disponibile sul browser corrente.");
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(window.google);
    };

    timeoutId = window.setTimeout(() => {
      cleanupAndReject("Timeout caricamento Google Identity.");
    }, GOOGLE_SCRIPT_LOAD_TIMEOUT_MS);

    const existing = document.querySelector('script[data-google-gsi="true"]');
    if (existing) {
      const existingStatus = String(existing.dataset.googleGsiStatus || "").toLowerCase();
      if (existingStatus === "loaded") {
        cleanupAndResolve();
        return;
      }
      if (existingStatus === "failed") {
        cleanupAndReject("Impossibile caricare Google Identity.");
        return;
      }

      existing.addEventListener(
        "load",
        () => {
          existing.dataset.googleGsiStatus = "loaded";
          cleanupAndResolve();
        },
        { once: true },
      );
      existing.addEventListener(
        "error",
        () => {
          existing.dataset.googleGsiStatus = "failed";
          cleanupAndReject("Impossibile caricare Google Identity.");
        },
        {
          once: true,
        },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleGsi = "true";
    script.dataset.googleGsiStatus = "loading";
    script.onload = () => {
      script.dataset.googleGsiStatus = "loaded";
      cleanupAndResolve();
    };
    script.onerror = () => {
      script.dataset.googleGsiStatus = "failed";
      cleanupAndReject("Impossibile caricare Google Identity.");
    };
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

async function requestJson(path, { method = "GET", body } = {}) {
  const requestUrl = buildApiUrl(path);
  try {
    const response = await fetch(requestUrl, {
      method,
      credentials: "include",
      headers: body
        ? {
            "Content-Type": "application/json",
          }
        : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const payload = text.length > 0 ? safeJsonParse(text) : {};
    if (!response.ok) {
      const isApiRoute = String(path || "").startsWith("/api/");
      const baseUrl = readApiBaseUrl();
      const githubPagesNoApiBase = isApiRoute && isRunningOnGitHubPages() && baseUrl.length === 0;
      let fallbackError = `HTTP ${response.status}`;
      if (isApiRoute && response.status === 501) {
        fallbackError =
          "API non disponibile su questo host (server statico). Avvia il backend Node o configura API_BASE_URL.";
      } else if (isApiRoute && response.status === 404) {
        fallbackError = githubPagesNoApiBase
          ? "API_BASE_URL non configurato su GitHub Pages. Impostalo in Settings > Secrets and variables > Actions e rifai deploy."
          : "Endpoint API non trovato. Verifica backend e API_BASE_URL.";
      } else if (isApiRoute && response.status === 405) {
        fallbackError =
          "API non disponibile su questo host (HTTP 405). Avvia backend Node e configura API_BASE_URL.";
      }

      return {
        ok: false,
        status: response.status,
        error:
          (payload && typeof payload.error === "string" && payload.error.length > 0
            ? payload.error
            : fallbackError),
      };
    }

    return {
      ok: true,
      status: response.status,
      data: payload ?? {},
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Connessione server non disponibile.",
    };
  }
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export async function fetchSessionAccount() {
  const redirectResult = await consumeRedirectLoginIfPresent();
  if (redirectResult.handled) {
    if (!redirectResult.ok) {
      return { ok: false, error: redirectResult.error ?? "Login Google fallito." };
    }

    return {
      ok: true,
      user: redirectResult.user ?? null,
    };
  }

  const response = await requestJson("/api/auth/me");
  if (!response.ok) {
    return { ok: false, error: response.error ?? "Sessione non valida." };
  }

  return {
    ok: true,
    user: response.data?.user ?? null,
  };
}

export async function logoutSessionAccount() {
  const response = await requestJson("/api/auth/logout", { method: "POST" });
  if (!response.ok) {
    return { ok: false, error: response.error ?? "Logout fallito." };
  }

  return { ok: true };
}

export async function signInWithGoogle() {
  const clientId = readGoogleClientId();
  if (clientId.length === 0) {
    return {
      ok: false,
      error:
        "Google Client ID non configurato o non valido. Verifica meta google-client-id / variabile GOOGLE_CLIENT_ID.",
    };
  }

  const origin = readWindowOrigin();
  if (origin.length > 0 && !isSupportedGoogleLoginOrigin(origin)) {
    console.warn(
      `[AGOAD] Origine non nella allowlist client (${origin}). Continuo con fallback Google per evitare blocchi lato browser.`,
    );
  }

  try {
    await loadGoogleScript();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Identity non disponibile.";
    if (shouldUseButtonFallback(message)) {
      if (shouldSuggestExternalBrowser(message)) {
        return createExternalBrowserLoginResult(message);
      }
      return startGoogleRedirectLogin(message);
    }
    return { ok: false, error: message };
  }

  if (!window.google?.accounts?.id) {
    const popupTokenResult = await requestGoogleAccessTokenWithPopup(
      clientId,
      "Google Identity non disponibile.",
    );
    if (popupTokenResult.ok) {
      return authenticateWithGoogleToken({
        accessToken: popupTokenResult.accessToken,
      });
    }

    if (shouldSuggestExternalBrowser(popupTokenResult.error || "")) {
      return createExternalBrowserLoginResult(popupTokenResult.error || "Google Identity non disponibile.");
    }
    return startGoogleRedirectLogin("Google Identity non disponibile.");
  }

  const idTokenResult = await new Promise((resolve) => {
    let settled = false;
    let fallbackWithoutFedCmTried = false;
    const timeout = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({ ok: false, error: "Timeout login Google." });
    }, GOOGLE_LOGIN_STEP_TIMEOUT_MS);

    const startPrompt = (useFedCmPrompt) => {
      window.google.accounts.id.cancel?.();
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (settled) {
            return;
          }
          settled = true;
          window.clearTimeout(timeout);
          if (!response || typeof response.credential !== "string" || response.credential.length === 0) {
            resolve({ ok: false, error: "Token Google non ricevuto." });
            return;
          }
          resolve({ ok: true, idToken: response.credential });
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        use_fedcm_for_prompt: useFedCmPrompt,
      });

      window.google.accounts.id.prompt((notification) => {
        if (settled) {
          return;
        }

        if (notification.isDismissedMoment?.()) {
          settled = true;
          window.clearTimeout(timeout);
          const reason = getPromptMomentReason(notification, "dismissed");
          resolve({ ok: false, error: appendReason("Login Google annullato.", reason) });
          return;
        }

        const notDisplayed = notification.isNotDisplayed?.();
        const skipped = notification.isSkippedMoment?.();
        if (!notDisplayed && !skipped) {
          return;
        }

        const reason = notDisplayed
          ? getPromptMomentReason(notification, "not_displayed")
          : getPromptMomentReason(notification, "skipped");

        if (useFedCmPrompt && !fallbackWithoutFedCmTried) {
          fallbackWithoutFedCmTried = true;
          startPrompt(false);
          return;
        }

        settled = true;
        window.clearTimeout(timeout);
        const baseMessage = notDisplayed ? "Popup Google non mostrato." : "Login Google non disponibile.";
        resolve({ ok: false, error: appendReason(baseMessage, reason) });
      });
    };

    startPrompt(true);
  });

  if (!idTokenResult.ok) {
    if (!shouldUseButtonFallback(idTokenResult.error)) {
      return idTokenResult;
    }

    if (shouldSuggestExternalBrowser(idTokenResult.error)) {
      return createExternalBrowserLoginResult(idTokenResult.error || "");
    }

    const popupTokenResult = await requestGoogleAccessTokenWithPopup(
      clientId,
      idTokenResult.error || "Login Google non disponibile.",
    );
    if (popupTokenResult.ok) {
      return authenticateWithGoogleToken({
        accessToken: popupTokenResult.accessToken,
      });
    }

    if (shouldSuggestExternalBrowser(popupTokenResult.error || "")) {
      return createExternalBrowserLoginResult(popupTokenResult.error || idTokenResult.error || "");
    }

    if (!shouldUseButtonFallback(popupTokenResult.error || "")) {
      return popupTokenResult;
    }

    return startGoogleRedirectLogin(popupTokenResult.error || idTokenResult.error || "");
  }

  return authenticateWithGoogleToken({
    idToken: idTokenResult.idToken,
  });
}

export async function fetchRemotePlayerProgress() {
  const response = await requestJson("/api/player/progress");
  if (!response.ok) {
    return { ok: false, error: response.error ?? "Lettura progressi fallita." };
  }

  return {
    ok: true,
    progress: response.data?.progress ?? null,
  };
}

export async function saveRemotePlayerProgress(progress) {
  const response = await requestJson("/api/player/progress", {
    method: "PUT",
    body: {
      progress,
    },
  });
  if (!response.ok) {
    return { ok: false, error: response.error ?? "Salvataggio progressi fallito." };
  }

  return { ok: true };
}

export async function fetchRemoteGameData() {
  const response = await requestJson("/api/game-data");
  if (!response.ok) {
    return { ok: false, error: response.error ?? "Lettura dati gioco fallita." };
  }

  return {
    ok: true,
    data: response.data?.data ?? null,
  };
}

export async function saveRemoteGameData(data) {
  const response = await requestJson("/api/game-data", {
    method: "PUT",
    body: {
      data,
    },
  });
  if (!response.ok) {
    return { ok: false, error: response.error ?? "Salvataggio dati gioco fallito." };
  }

  return { ok: true };
}
