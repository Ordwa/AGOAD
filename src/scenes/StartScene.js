import { Scene } from "../core/Scene.js";
import { GAME_CONFIG, PALETTE } from "../data/constants.js";
import { verifyGmEditPassword } from "../utils/security.js";

const MAIN_OPTION_CONTINUE = "CONTINUE";
const MAIN_OPTION_NEW_GAME = "NEW GAME";
const MAIN_OPTION_SETTINGS = "SETTINGS";
const OPTIONS_MENU = ["SOUND", "MUSIC", "GM-EDIT", "ELIMINA PG", "LOGOUT", "INDIETRO"];
const GM_EDIT_MENU = [
  { id: "debug", label: "DEBUG MODE" },
  { id: "edit_classes", label: "EDIT CLASSES" },
  { id: "back", label: "INDIETRO" },
];
const CLASS_TABLE_FIELDS = [
  { key: "id", label: "ID" },
  { key: "label", label: "LABEL" },
  { key: "description", label: "DESCRIPTION" },
  { key: "maxHp", label: "MAX HP" },
  { key: "attackMin", label: "ATK MIN" },
  { key: "attackMax", label: "ATK MAX" },
  { key: "speed", label: "SPEED" },
  { key: "maxMana", label: "MAX MANA" },
  { key: "specialId", label: "SPECIAL ID" },
  { key: "specialName", label: "SPECIAL NAME" },
  { key: "specialCost", label: "SPECIAL COST" },
  { key: "specialPriority", label: "SPECIAL PRIORITY" },
  { key: "specialDescription", label: "SPECIAL DESCRIPTION" },
];
const CLASS_TABLE_HEADERS = CLASS_TABLE_FIELDS.map((field) => field.key);
const MAX_GM_PASSWORD_LENGTH = 20;
const TAP_MAX_DISTANCE = 14;
const MAIN_BUTTON_PRESS_ANIMATION_SECONDS = 0.14;

export class StartScene extends Scene {
  constructor(game) {
    super(game);
    this.time = 0;
    this.mode = "main";
    this.mainIndex = 0;
    this.slotIndex = 0;
    this.optionsIndex = 0;
    this.gmEditIndex = 0;
    this.gmPasswordBuffer = "";
    this.gmAuthStatus = "";
    this.gmAuthUnlockedSession = false;
    this.gmAuthUnlockedSession = false;
    this.gmAuthToken = 0;
    this.gmActionBusy = false;
    this.gmActionToken = 0;
    this.authActionBusy = false;
    this.authRecoveryAction = null;
    this.notice = "";
    this.deleteProfileConfirmArmed = false;
    this.pointerEventsBound = false;
    this.activePointerId = null;
    this.pointerStart = null;
    this.tapQueue = [];
    this.pendingMainOptionIndex = null;
    this.pendingMainActionTimer = 0;
    this.gmClassesEditor = null;
    this.gmClassesSelection = { row: 0, classIndex: 0 };
    this.gmClassesRowOffset = 0;
    this.homeBackgroundImage = createUiImage("../assets/UI_startscene_background.png");
    this.homeContinueButtonImage = createUiImage("../assets/UI_button_continue.png");
    this.homeNewGameButtonImage = createUiImage("../assets/UI_button_new_game.png");
    this.homeSettingsButtonImage = createUiImage("../assets/UI_button_settings.png");
    this.homeTitleBannerImage = createUiImage("../assets/UI_title_banner.png");
    this.gmPasswordInputElement = null;
    this.handleGmPasswordDomInput = this.handleGmPasswordDomInput.bind(this);
    this.handleGmPasswordDomKeyDown = this.handleGmPasswordDomKeyDown.bind(this);

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerCancel.bind(this);
  }

  onEnter() {
    this.time = 0;
    this.mode = this.game.isAuthenticated() ? "main" : "auth";
    this.mainIndex = 0;
    this.slotIndex = 0;
    this.optionsIndex = 0;
    this.gmEditIndex = 0;
    this.gmPasswordBuffer = "";
    this.gmAuthStatus = "";
    this.gmAuthToken += 1;
    this.gmActionBusy = false;
    this.gmActionToken += 1;
    this.authActionBusy = false;
    this.authRecoveryAction = null;
    this.notice = this.game.isAuthenticated() ? "" : "Accedi con Google per giocare.";
    this.deleteProfileConfirmArmed = false;
    this.activePointerId = null;
    this.pointerStart = null;
    this.tapQueue.length = 0;
    this.pendingMainOptionIndex = null;
    this.pendingMainActionTimer = 0;
    this.gmClassesEditor = null;
    this.gmClassesSelection = { row: 0, classIndex: 0 };
    this.gmClassesRowOffset = 0;
    this.blurGmPasswordInput();
    this.game.input.setTextCapture(false);
    this.syncDocumentMode();
    this.bindPointerEvents();
  }

  onExit() {
    this.gmAuthToken += 1;
    this.gmActionToken += 1;
    this.gmActionBusy = false;
    this.authActionBusy = false;
    this.authRecoveryAction = null;
    this.activePointerId = null;
    this.pointerStart = null;
    this.tapQueue.length = 0;
    this.pendingMainOptionIndex = null;
    this.pendingMainActionTimer = 0;
    this.gmClassesEditor = null;
    this.gmClassesSelection = { row: 0, classIndex: 0 };
    this.gmClassesRowOffset = 0;
    this.deleteProfileConfirmArmed = false;
    this.blurGmPasswordInput();
    this.game.input.setTextCapture(false);
    if (typeof document !== "undefined" && document.body) {
      delete document.body.dataset.startMode;
    }
    this.unbindPointerEvents();
  }

  update(dt, input) {
    this.time += dt;
    this.syncDocumentMode();
    this.handleTouchInput();

    if (this.mode === "auth") {
      this.updateAuthMenu(input);
      return;
    }

    if (this.mode === "main") {
      this.updatePendingMainAction(dt);
      if (this.mode !== "main") {
        return;
      }
      this.updateMainMenu(input);
      return;
    }

    if (this.mode === "slots") {
      this.updateSlotMenu(input);
      return;
    }

    if (this.mode === "options") {
      this.updateOptionsMenu(input);
      return;
    }

    if (this.mode === "gm-auth") {
      this.updateGmAuthMenu(input);
      return;
    }

    if (this.mode === "gm-edit-classes") {
      this.updateGmClassesEditorMenu(input);
      return;
    }

    this.updateGmEditMenu(input);
  }

  syncDocumentMode() {
    if (typeof document === "undefined" || !document.body) {
      return;
    }

    document.body.dataset.startMode = this.mode;
  }

  bindPointerEvents() {
    if (this.pointerEventsBound) {
      return;
    }

    this.game.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.game.canvas.addEventListener("pointerup", this.onPointerUp);
    this.game.canvas.addEventListener("pointercancel", this.onPointerCancel);
    this.pointerEventsBound = true;
  }

  unbindPointerEvents() {
    if (!this.pointerEventsBound) {
      return;
    }

    this.game.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.game.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.game.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.pointerEventsBound = false;
  }

  ensureGmPasswordInput() {
    if (typeof document === "undefined" || !document.body) {
      return null;
    }

    if (this.gmPasswordInputElement) {
      return this.gmPasswordInputElement;
    }

    const input = document.createElement("input");
    input.type = "password";
    input.autocomplete = "off";
    input.autocapitalize = "none";
    input.autocorrect = "off";
    input.spellcheck = false;
    input.inputMode = "text";
    input.maxLength = MAX_GM_PASSWORD_LENGTH;
    input.ariaHidden = "true";
    input.tabIndex = -1;
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0";
    input.style.pointerEvents = "none";
    input.style.border = "0";
    input.style.padding = "0";
    input.style.margin = "0";
    input.style.zIndex = "-1";

    input.addEventListener("input", this.handleGmPasswordDomInput);
    input.addEventListener("keydown", this.handleGmPasswordDomKeyDown);
    document.body.appendChild(input);
    this.gmPasswordInputElement = input;
    return input;
  }

  handleGmPasswordDomInput() {
    if (!this.gmPasswordInputElement) {
      return;
    }

    const rawValue = this.gmPasswordInputElement.value ?? "";
    const normalized = rawValue
      .split("")
      .filter((char) => /^[a-zA-Z0-9]$/.test(char))
      .join("")
      .slice(0, MAX_GM_PASSWORD_LENGTH);

    this.gmPasswordBuffer = normalized;
    if (this.gmPasswordInputElement.value !== normalized) {
      this.gmPasswordInputElement.value = normalized;
    }
  }

  handleGmPasswordDomKeyDown(event) {
    if (!event) {
      return;
    }

    if (event.key === "Enter") {
      this.game.input.tapAction("confirm");
      event.preventDefault();
      return;
    }

    if (event.key === "Escape") {
      this.game.input.tapAction("back");
      event.preventDefault();
    }
  }

  focusGmPasswordInput() {
    const input = this.ensureGmPasswordInput();
    if (!input) {
      return;
    }

    input.value = this.gmPasswordBuffer;
    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }
    const end = input.value.length;
    try {
      input.setSelectionRange(end, end);
    } catch {
      // No-op for platforms that block selection APIs on password fields.
    }
  }

  blurGmPasswordInput() {
    if (!this.gmPasswordInputElement) {
      return;
    }

    this.gmPasswordInputElement.value = "";
    this.gmPasswordInputElement.blur();
  }

  onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    this.activePointerId = event.pointerId;
    this.pointerStart = { x: event.clientX, y: event.clientY };
    this.game.canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  onPointerUp(event) {
    if (this.activePointerId !== event.pointerId || !this.pointerStart) {
      return;
    }

    const deltaX = event.clientX - this.pointerStart.x;
    const deltaY = event.clientY - this.pointerStart.y;
    const distance = Math.hypot(deltaX, deltaY);
    this.activePointerId = null;
    this.pointerStart = null;
    this.game.canvas.releasePointerCapture?.(event.pointerId);

    if (distance > TAP_MAX_DISTANCE) {
      event.preventDefault();
      return;
    }

    const useCanvasSpace =
      this.mode === "auth" ||
      this.mode === "main" ||
      this.mode === "options" ||
      this.mode === "gm-auth" ||
      this.mode === "gm-edit" ||
      this.mode === "gm-edit-classes";
    const tapPoint = useCanvasSpace
      ? this.screenToCanvasPoint(event.clientX, event.clientY)
      : this.screenToGamePoint(event.clientX, event.clientY);
    if (tapPoint) {
      if (this.mode === "auth") {
        this.handleAuthTouchTap(tapPoint);
        event.preventDefault();
        return;
      }

      if (this.mode === "gm-auth") {
        this.handleGmAuthTouchTap(tapPoint);
        event.preventDefault();
        return;
      }

      if (this.mode === "gm-edit-classes") {
        this.handleGmClassesEditorTouchTap(tapPoint);
        event.preventDefault();
        return;
      }

      this.tapQueue.push(tapPoint);
    }

    event.preventDefault();
  }

  onPointerCancel(event) {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.activePointerId = null;
    this.pointerStart = null;
    this.game.canvas.releasePointerCapture?.(event.pointerId);
  }

  screenToCanvasPoint(clientX, clientY) {
    const rect = this.game.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const canvasX = ((clientX - rect.left) / rect.width) * this.game.canvas.width;
    const canvasY = ((clientY - rect.top) / rect.height) * this.game.canvas.height;

    if (canvasX < 0 || canvasY < 0 || canvasX > this.game.canvas.width || canvasY > this.game.canvas.height) {
      return null;
    }

    return { x: canvasX, y: canvasY };
  }

  screenToGamePoint(clientX, clientY) {
    const rect = this.game.canvas.getBoundingClientRect();
    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      this.game.viewportScaleX <= 0 ||
      this.game.viewportScaleY <= 0
    ) {
      return null;
    }

    const canvasX = ((clientX - rect.left) / rect.width) * this.game.canvas.width;
    const canvasY = ((clientY - rect.top) / rect.height) * this.game.canvas.height;
    const gameX = (canvasX - this.game.viewportOffsetX) / this.game.viewportScaleX;
    const gameY = (canvasY - this.game.viewportOffsetY) / this.game.viewportScaleY;

    if (gameX < 0 || gameY < 0 || gameX > GAME_CONFIG.width || gameY > GAME_CONFIG.height) {
      return null;
    }

    return { x: gameX, y: gameY };
  }

  handleTouchInput() {
    if (this.tapQueue.length === 0) {
      return;
    }

    const taps = this.tapQueue.splice(0, this.tapQueue.length);
    taps.forEach((tapPoint) => {
      if (this.mode === "auth") {
        this.handleAuthTouchTap(tapPoint);
        return;
      }

      if (this.mode === "main") {
        this.handleMainTouchTap(tapPoint);
        return;
      }

      if (this.mode === "slots") {
        this.handleSlotsTouchTap(tapPoint);
        return;
      }

      if (this.mode === "options") {
        this.handleOptionsTouchTap(tapPoint);
        return;
      }

      if (this.mode === "gm-auth") {
        this.handleGmAuthTouchTap(tapPoint);
        return;
      }

      if (this.mode === "gm-edit") {
        this.handleGmEditTouchTap(tapPoint);
        return;
      }

      if (this.mode === "gm-edit-classes") {
        this.handleGmClassesEditorTouchTap(tapPoint);
      }
    });
  }

  updateMainMenu(input) {
    if (this.areMainMenuButtonsLoading()) {
      return;
    }

    const options = this.getMainMenuOptions();
    if (options.length === 0) {
      return;
    }
    this.mainIndex = Math.round(clampNumber(this.mainIndex, 0, options.length - 1));

    if (this.pendingMainOptionIndex !== null) {
      return;
    }

    if (input.wasPressed("up")) {
      this.mainIndex = (this.mainIndex + options.length - 1) % options.length;
      return;
    }

    if (input.wasPressed("down")) {
      this.mainIndex = (this.mainIndex + 1) % options.length;
      return;
    }

    if (!input.wasPressed("confirm")) {
      return;
    }

    this.activateMainOption(this.mainIndex);
  }

  updatePendingMainAction(dt) {
    if (this.pendingMainOptionIndex === null) {
      return;
    }

    this.pendingMainActionTimer = Math.max(0, this.pendingMainActionTimer - dt);
    if (this.pendingMainActionTimer > 0) {
      return;
    }

    const optionIndex = this.pendingMainOptionIndex;
    this.pendingMainOptionIndex = null;
    this.pendingMainActionTimer = 0;
    this.executeMainOption(optionIndex);
  }

  updateSlotMenu(input) {
    const slotCount = this.game.getSaveSlots().length;
    const optionsCount = slotCount + 1;

    if (input.wasPressed("up")) {
      this.slotIndex = (this.slotIndex + optionsCount - 1) % optionsCount;
      return;
    }

    if (input.wasPressed("down")) {
      this.slotIndex = (this.slotIndex + 1) % optionsCount;
      return;
    }

    if (input.wasPressed("back")) {
      this.mode = "main";
      return;
    }

    if (!input.wasPressed("confirm")) {
      return;
    }

    this.activateSlotOption(this.slotIndex);
  }

  updateOptionsMenu(input) {
    if (input.wasPressed("up")) {
      this.optionsIndex = (this.optionsIndex + OPTIONS_MENU.length - 1) % OPTIONS_MENU.length;
      this.deleteProfileConfirmArmed = false;
      return;
    }

    if (input.wasPressed("down")) {
      this.optionsIndex = (this.optionsIndex + 1) % OPTIONS_MENU.length;
      this.deleteProfileConfirmArmed = false;
      return;
    }

    if (input.wasPressed("back")) {
      this.mode = "main";
      this.deleteProfileConfirmArmed = false;
      return;
    }

    if (this.optionsIndex === 0) {
      if (input.wasPressed("left")) {
        this.shiftSoundLevel(-1);
        return;
      }

      if (input.wasPressed("right") || input.wasPressed("confirm")) {
        this.shiftSoundLevel(1);
        return;
      }
    }

    if (this.optionsIndex === 1) {
      if (input.wasPressed("left")) {
        this.shiftMusicLevel(-1);
        return;
      }

      if (input.wasPressed("right") || input.wasPressed("confirm")) {
        this.shiftMusicLevel(1);
        return;
      }
    }

    if (!input.wasPressed("confirm")) {
      return;
    }

    this.activateOptionsOption(this.optionsIndex);
  }

  updateAuthMenu(input) {
    if (this.authActionBusy) {
      return;
    }

    if (input.wasPressed("confirm")) {
      this.startGoogleLoginFlow();
    }
  }

  handleAuthTouchTap(tapPoint) {
    const hasExternalAction = this.hasExternalAuthRecovery();
    const layout = getAuthMenuLayout(this.game.canvas.width, this.game.canvas.height, hasExternalAction);
    if (hasExternalAction && layout.externalActionRect && pointInRect(tapPoint, layout.externalActionRect)) {
      this.openAuthRecoveryAction();
      return;
    }

    if (!pointInRect(tapPoint, layout.loginRect)) {
      return;
    }

    this.startGoogleLoginFlow();
  }

  activateMainOption(index) {
    const options = this.getMainMenuOptions();
    if (options.length === 0) {
      return;
    }
    this.mainIndex = Math.round(clampNumber(index, 0, options.length - 1));
    if (this.pendingMainOptionIndex !== null) {
      return;
    }
    this.pendingMainOptionIndex = this.mainIndex;
    this.pendingMainActionTimer = MAIN_BUTTON_PRESS_ANIMATION_SECONDS;
  }

  executeMainOption(index) {
    const options = this.getMainMenuOptions();
    if (options.length === 0) {
      return;
    }
    this.mainIndex = Math.round(clampNumber(index, 0, options.length - 1));
    const option = options[this.mainIndex] ?? MAIN_OPTION_SETTINGS;

    if (option === MAIN_OPTION_CONTINUE) {
      const result = this.game.loadFromSlot(0);
      if (!result.ok) {
        this.notice = "Nessun progresso salvato per questo account.";
        return;
      }

      this.game.changeScene("world", {
        restoreFromSave: true,
        safeSteps: 5,
        message: "Progressi caricati.",
      });
      return;
    }

    if (option === MAIN_OPTION_NEW_GAME) {
      this.game.resetState();
      this.game.changeScene("setup");
      return;
    }

    if (option === MAIN_OPTION_SETTINGS) {
      this.mode = "options";
      this.optionsIndex = 0;
      this.notice = "";
      this.deleteProfileConfirmArmed = false;
      return;
    }

    this.mode = "options";
    this.optionsIndex = 0;
    this.notice = "";
    this.deleteProfileConfirmArmed = false;
  }

  startGoogleLoginFlow() {
    if (this.authActionBusy) {
      return;
    }

    this.authRecoveryAction = null;
    this.authActionBusy = true;
    this.notice = "Login Google in corso...";
    this.game
      .signInWithGoogleAccount()
      .then((result) => {
        if (!result.ok) {
          this.authRecoveryAction =
            result.recovery && typeof result.recovery === "object" ? result.recovery : null;
          this.notice = result.error ?? this.game.getLastSyncError() ?? "Login fallito.";
          return;
        }

        this.authRecoveryAction = null;
        this.mode = "main";
        this.mainIndex = 0;
        const displayName = this.game.getAccountDisplayName();
        this.notice = displayName.length > 0 ? `Ciao ${displayName}` : "Accesso riuscito.";
      })
      .catch((error) => {
        this.authRecoveryAction = null;
        this.notice = error instanceof Error ? error.message : "Login fallito.";
      })
      .finally(() => {
        this.authActionBusy = false;
      });
  }

  startLogoutFlow() {
    if (this.authActionBusy) {
      return;
    }

    this.authActionBusy = true;
    this.notice = "Logout in corso...";
    this.game
      .signOutAccount()
      .then((result) => {
        if (!result.ok) {
          this.notice = result.error ?? this.game.getLastSyncError() ?? "Logout fallito.";
          return;
        }

        this.mode = "auth";
        this.mainIndex = 0;
        this.optionsIndex = 0;
        this.authRecoveryAction = null;
        this.gmAuthUnlockedSession = false;
        this.notice = "Disconnesso. Accedi con Google.";
      })
      .catch((error) => {
        this.notice = error instanceof Error ? error.message : "Logout fallito.";
      })
      .finally(() => {
        this.authActionBusy = false;
      });
  }

  startDeleteProfileFlow() {
    if (this.authActionBusy) {
      return;
    }

    this.authActionBusy = true;
    this.notice = "Eliminazione progressi in corso...";
    this.game
      .clearProfileProgress()
      .then((result) => {
        if (!result.ok) {
          this.notice =
            result.error ?? this.game.getLastSyncError() ?? "Eliminazione progressi fallita.";
          return;
        }

        this.mode = "main";
        this.mainIndex = 0;
        this.optionsIndex = 0;
        this.notice = "Progressi eliminati. Avvia NEW GAME.";
      })
      .catch((error) => {
        this.notice = error instanceof Error ? error.message : "Eliminazione progressi fallita.";
      })
      .finally(() => {
        this.authActionBusy = false;
      });
  }

  hasExternalAuthRecovery() {
    if (!this.authRecoveryAction || this.authRecoveryAction.type !== "external-browser") {
      return false;
    }

    return String(this.authRecoveryAction.url || "").trim().length > 0;
  }

  openAuthRecoveryAction() {
    if (!this.hasExternalAuthRecovery() || typeof window === "undefined") {
      this.notice = "Apertura browser esterno non disponibile.";
      return;
    }

    const targetUrl = String(this.authRecoveryAction.url || "").trim();
    if (targetUrl.length === 0) {
      this.notice = "URL login non valido.";
      return;
    }

    let opened = false;
    if (typeof window.open === "function") {
      try {
        const popupRef = window.open(targetUrl, "_blank");
        opened = Boolean(popupRef);
        if (opened && typeof popupRef.focus === "function") {
          popupRef.focus();
        }
      } catch {
        opened = false;
      }
    }

    if (opened) {
      this.notice = "Tentativo apertura browser esterno...";
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(targetUrl)
          .then(() => {
            this.notice = "Apertura tentata. URL anche copiato: aprilo in Chrome/Safari se non si apre.";
          })
          .catch(() => {
            this.notice = "Apertura tentata. Se non si apre, usa Chrome/Safari.";
          });
      }
      return;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(targetUrl)
        .then(() => {
          this.notice = "URL copiato. Aprilo in Chrome/Safari.";
        })
        .catch(() => {
          this.notice = "Browser embedded bloccato. Apri il gioco in Chrome/Safari.";
        });
      return;
    }

    this.notice = "Browser embedded bloccato. Apri il gioco in Chrome/Safari.";
  }

  activateSlotOption(index) {
    const slotCount = this.game.getSaveSlots().length;
    this.slotIndex = index;

    if (this.slotIndex === slotCount) {
      this.mode = "main";
      return;
    }

    const result = this.game.loadFromSlot(this.slotIndex);
    if (!result.ok) {
      this.notice = `Slot ${this.slotIndex + 1} vuoto.`;
      return;
    }

    this.game.changeScene("world", {
      restoreFromSave: true,
      safeSteps: 5,
      message: `Caricato Slot ${this.slotIndex + 1}.`,
    });
  }

  activateOptionsOption(index) {
    this.optionsIndex = index;
    if (this.optionsIndex !== 3) {
      this.deleteProfileConfirmArmed = false;
    }

    if (this.optionsIndex === 0) {
      this.shiftSoundLevel(1);
      return;
    }

    if (this.optionsIndex === 1) {
      this.shiftMusicLevel(1);
      return;
    }

    if (this.optionsIndex === 2) {
      if (this.gmAuthUnlockedSession) {
        this.mode = "gm-edit";
        this.gmEditIndex = 0;
        this.notice = "";
        return;
      }
      this.enterGmAuthMode();
      return;
    }

    if (this.optionsIndex === 3) {
      if (!this.deleteProfileConfirmArmed) {
        this.deleteProfileConfirmArmed = true;
        this.notice = "Premi ELIMINA PG di nuovo per confermare.";
        return;
      }

      this.deleteProfileConfirmArmed = false;
      this.startDeleteProfileFlow();
      return;
    }

    if (this.optionsIndex === 4) {
      this.startLogoutFlow();
      return;
    }

    this.mode = "main";
    this.deleteProfileConfirmArmed = false;
  }

  shiftSoundLevel(delta) {
    const level = this.game.shiftSoundLevel(delta);
    this.notice = `SFX ${level}/5`;
  }

  shiftMusicLevel(delta) {
    const level = this.game.shiftMusicLevel(delta);
    this.notice = `MUSICA ${level}/5`;
  }

  handleMainTouchTap(tapPoint) {
    if (this.areMainMenuButtonsLoading()) {
      return;
    }

    if (this.pendingMainOptionIndex !== null) {
      return;
    }

    const layout = getMainMenuLayout(
      this.game.canvas.width,
      this.game.canvas.height,
      this.hasSavedProgress(),
    );
    const tappedIndex = layout.itemRects.findIndex((rect) => pointInRect(tapPoint, rect));
    if (tappedIndex < 0) {
      return;
    }

    this.activateMainOption(tappedIndex);
  }

  hasSavedProgress() {
    const firstSlot = this.game.getSaveSlots()[0];
    return Boolean(firstSlot && firstSlot.snapshot);
  }

  getMainMenuOptions() {
    return this.hasSavedProgress()
      ? [MAIN_OPTION_CONTINUE, MAIN_OPTION_SETTINGS]
      : [MAIN_OPTION_NEW_GAME, MAIN_OPTION_SETTINGS];
  }

  handleSlotsTouchTap(tapPoint) {
    const slots = this.game.getSaveSlots();
    const layout = getSlotsMenuLayout(slots.length);
    const tappedIndex = layout.rowRects.findIndex((rect) => pointInRect(tapPoint, rect));
    if (tappedIndex < 0) {
      return;
    }

    this.activateSlotOption(tappedIndex);
  }

  handleOptionsTouchTap(tapPoint) {
    const layout = getOptionsMenuLayout(this.game.canvas.width, this.game.canvas.height);
    const tappedIndex = layout.rowRects.findIndex((rect) => pointInRect(tapPoint, rect));
    if (tappedIndex < 0) {
      return;
    }

    this.optionsIndex = tappedIndex;
    if (tappedIndex !== 3) {
      this.deleteProfileConfirmArmed = false;
    }
    if (tappedIndex === 0) {
      if (pointInRect(tapPoint, layout.soundMinusRect)) {
        this.shiftSoundLevel(-1);
        return;
      }

      this.shiftSoundLevel(1);
      return;
    }

    if (tappedIndex === 1) {
      if (pointInRect(tapPoint, layout.musicMinusRect)) {
        this.shiftMusicLevel(-1);
        return;
      }

      this.shiftMusicLevel(1);
      return;
    }

    this.activateOptionsOption(tappedIndex);
  }

  handleGmAuthTouchTap(tapPoint) {
    const layout = getGmAuthLayout(this.game.canvas.width, this.game.canvas.height);
    if (pointInRect(tapPoint, layout.backRect)) {
      this.leaveGmAuthMode("options");
      return;
    }

    if (pointInRect(tapPoint, layout.confirmRect)) {
      this.submitGmPassword();
      return;
    }

    if (pointInRect(tapPoint, layout.passwordInputRect) || pointInRect(tapPoint, layout.passwordCardRect)) {
      this.focusGmPasswordInput();
    }
  }

  updateGmAuthMenu(input) {
    const typedChars = input.consumeTypedChars();
    if (typedChars.length > 0) {
      typedChars.forEach((char) => {
        if (this.gmPasswordBuffer.length >= MAX_GM_PASSWORD_LENGTH) {
          return;
        }

        if (!/^[a-zA-Z0-9]$/.test(char)) {
          return;
        }

        this.gmPasswordBuffer += char;
      });

      this.gmAuthStatus = "";
      if (this.gmPasswordInputElement && this.gmPasswordInputElement.value !== this.gmPasswordBuffer) {
        this.gmPasswordInputElement.value = this.gmPasswordBuffer;
      }
    }

    const backspaceCount = input.consumeBackspaceCount();
    if (backspaceCount > 0) {
      this.gmPasswordBuffer = this.gmPasswordBuffer.slice(
        0,
        Math.max(0, this.gmPasswordBuffer.length - backspaceCount),
      );
      this.gmAuthStatus = "";
      if (this.gmPasswordInputElement && this.gmPasswordInputElement.value !== this.gmPasswordBuffer) {
        this.gmPasswordInputElement.value = this.gmPasswordBuffer;
      }
    }

    if (input.wasPressed("back")) {
      this.leaveGmAuthMode("options");
      return;
    }

    if (!input.wasPressed("confirm")) {
      return;
    }

    if (this.gmAuthStatus === "Verifica in corso...") {
      return;
    }

    this.submitGmPassword();
  }

  submitGmPassword() {
    if (this.gmAuthStatus === "Verifica in corso...") {
      return;
    }

    if (this.gmPasswordBuffer.trim().length === 0) {
      this.gmAuthStatus = "Inserisci una password.";
      return;
    }

    const authToken = this.gmAuthToken + 1;
    this.gmAuthToken = authToken;
    this.gmAuthStatus = "Verifica in corso...";

    verifyGmEditPassword(this.gmPasswordBuffer)
      .then((isValid) => {
        if (this.gmAuthToken !== authToken) {
          return;
        }

        if (isValid) {
          this.gmAuthUnlockedSession = true;
          this.gmPasswordBuffer = "";
          if (this.gmPasswordInputElement) {
            this.gmPasswordInputElement.value = "";
          }
          this.gmAuthStatus = "";
          this.gmEditIndex = 0;
          this.notice = "";
          this.mode = "gm-edit";
          this.blurGmPasswordInput();
          this.game.input.setTextCapture(false);
          return;
        }

        this.gmPasswordBuffer = "";
        if (this.gmPasswordInputElement) {
          this.gmPasswordInputElement.value = "";
        }
        this.gmAuthStatus = "Password errata.";
        this.focusGmPasswordInput();
      })
      .catch(() => {
        if (this.gmAuthToken !== authToken) {
          return;
        }

        this.gmAuthStatus = "Verifica non disponibile.";
      });
  }

  updateGmEditMenu(input) {
    if (this.gmActionBusy) {
      if (input.wasPressed("back")) {
        this.notice = "Attendi la fine dell'operazione.";
      }
      return;
    }

    if (input.wasPressed("up")) {
      this.gmEditIndex = (this.gmEditIndex + GM_EDIT_MENU.length - 1) % GM_EDIT_MENU.length;
      return;
    }

    if (input.wasPressed("down")) {
      this.gmEditIndex = (this.gmEditIndex + 1) % GM_EDIT_MENU.length;
      return;
    }

    if (input.wasPressed("back")) {
      this.mode = "options";
      return;
    }

    if (!input.wasPressed("confirm")) {
      return;
    }

    this.handleGmEditSelection();
  }

  enterGmAuthMode() {
    this.mode = "gm-auth";
    this.gmPasswordBuffer = "";
    this.gmAuthStatus = "";
    this.notice = "";
    this.gmAuthToken += 1;
    this.game.input.setTextCapture(true);
    this.focusGmPasswordInput();
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        if (this.mode === "gm-auth") {
          this.focusGmPasswordInput();
        }
      }, 0);
    }
  }

  leaveGmAuthMode(nextMode = "options") {
    this.mode = nextMode;
    this.gmPasswordBuffer = "";
    this.gmAuthStatus = "";
    this.gmAuthToken += 1;
    if (this.gmPasswordInputElement) {
      this.gmPasswordInputElement.value = "";
    }
    this.blurGmPasswordInput();
    this.game.input.setTextCapture(false);
  }

  handleGmEditSelection() {
    const selected = GM_EDIT_MENU[this.gmEditIndex];
    if (!selected) {
      return;
    }

    if (selected.id === "debug") {
      const enabled = this.game.toggleDebugOverlay();
      this.notice = `Overlay DEBUG ${enabled ? "attivo" : "disattivo"}.`;
      return;
    }

    if (selected.id === "edit_classes") {
      this.startGmClassesEditing();
      return;
    }

    if (selected.id === "back") {
      this.mode = "options";
      return;
    }

    this.mode = "options";
  }

  handleGmEditTouchTap(tapPoint) {
    const layout = getGmEditLayout(this.game.canvas.width, this.game.canvas.height);
    const tappedIndex = layout.rowRects.findIndex((rect) => pointInRect(tapPoint, rect));
    if (tappedIndex < 0) {
      return;
    }

    this.gmEditIndex = tappedIndex;
    this.handleGmEditSelection();
  }

  updateGmClassesEditorMenu(input) {
    if (!this.gmClassesEditor) {
      this.mode = "gm-edit";
      return;
    }

    const rowCount = this.gmClassesEditor.rows.length;
    const classCount = this.gmClassesEditor.classIds.length;
    if (rowCount === 0 || classCount === 0) {
      if (input.wasPressed("back")) {
        this.cancelGmClassesEditing();
      }
      return;
    }

    if (input.wasPressed("back")) {
      this.cancelGmClassesEditing();
      return;
    }

    if (input.wasPressed("up")) {
      this.gmClassesSelection.row = (this.gmClassesSelection.row + rowCount - 1) % rowCount;
      this.ensureGmClassesSelectionVisible();
      return;
    }

    if (input.wasPressed("down")) {
      this.gmClassesSelection.row = (this.gmClassesSelection.row + 1) % rowCount;
      this.ensureGmClassesSelectionVisible();
      return;
    }

    if (input.wasPressed("left")) {
      this.gmClassesSelection.classIndex =
        (this.gmClassesSelection.classIndex + classCount - 1) % classCount;
      return;
    }

    if (input.wasPressed("right")) {
      this.gmClassesSelection.classIndex = (this.gmClassesSelection.classIndex + 1) % classCount;
      return;
    }

    if (!input.wasPressed("confirm")) {
      return;
    }

    this.editGmClassesCell(this.gmClassesSelection.row, this.gmClassesSelection.classIndex);
  }

  ensureGmClassesSelectionVisible() {
    if (!this.gmClassesEditor) {
      return;
    }

    const rowCount = this.gmClassesEditor.rows.length;
    const layout = getGmClassesEditorLayout(
      this.game.canvas.width,
      this.game.canvas.height,
      this.gmClassesEditor,
      this.gmClassesRowOffset,
      this.gmClassesSelection,
    );
    const maxOffset = Math.max(0, rowCount - layout.visibleRows);

    if (this.gmClassesSelection.row < this.gmClassesRowOffset) {
      this.gmClassesRowOffset = this.gmClassesSelection.row;
      return;
    }

    if (this.gmClassesSelection.row >= this.gmClassesRowOffset + layout.visibleRows) {
      this.gmClassesRowOffset = this.gmClassesSelection.row - layout.visibleRows + 1;
      this.gmClassesRowOffset = clampNumber(this.gmClassesRowOffset, 0, maxOffset);
    }
  }

  handleGmClassesEditorTouchTap(tapPoint) {
    if (!this.gmClassesEditor) {
      return;
    }

    const layout = getGmClassesEditorLayout(
      this.game.canvas.width,
      this.game.canvas.height,
      this.gmClassesEditor,
      this.gmClassesRowOffset,
      this.gmClassesSelection,
    );

    if (pointInRect(tapPoint, layout.cancelRect)) {
      this.cancelGmClassesEditing();
      return;
    }

    if (pointInRect(tapPoint, layout.confirmRect)) {
      this.confirmGmClassesEditing();
      return;
    }

    if (layout.scrollUpRect && pointInRect(tapPoint, layout.scrollUpRect)) {
      this.gmClassesRowOffset = Math.max(0, this.gmClassesRowOffset - 1);
      return;
    }

    if (layout.scrollDownRect && pointInRect(tapPoint, layout.scrollDownRect)) {
      const maxOffset = Math.max(0, this.gmClassesEditor.rows.length - layout.visibleRows);
      this.gmClassesRowOffset = Math.min(maxOffset, this.gmClassesRowOffset + 1);
      return;
    }

    const tappedTab = layout.classTabRects.find((tab) => pointInRect(tapPoint, tab.rect));
    if (tappedTab) {
      this.gmClassesSelection.classIndex = tappedTab.classIndex;
      return;
    }

    const cell = layout.valueCellRects.find((entry) => pointInRect(tapPoint, entry.rect));
    if (!cell) {
      return;
    }

    this.gmClassesSelection = { row: cell.rowIndex, classIndex: cell.classIndex };
    this.ensureGmClassesSelectionVisible();
    this.editGmClassesCell(cell.rowIndex, cell.classIndex);
  }

  startGmClassesEditing() {
    const parsed = parseSimpleDelimitedTable(this.game.exportClassesAsTable());
    if (!parsed.ok) {
      this.notice = `Impossibile aprire classi: ${parsed.error}`;
      return;
    }

    const missingHeaders = CLASS_TABLE_HEADERS.filter((header) => !parsed.headers.includes(header.toLowerCase()));
    if (missingHeaders.length > 0) {
      this.notice = `Colonne mancanti: ${missingHeaders.join(", ")}`;
      return;
    }

    const classIds = parsed.rows.map((row, index) => {
      const idValue = sanitizeTableCellText(row.id);
      if (idValue.length > 0) {
        return idValue;
      }
      return `class_${index + 1}`;
    });

    this.gmClassesEditor = {
      classIds,
      rows: CLASS_TABLE_FIELDS.map((field) => ({
        key: field.key,
        label: field.label,
        values: parsed.rows.map((row) => sanitizeTableCellText(row[field.key])),
      })),
    };
    this.gmClassesSelection = { row: 0, classIndex: 0 };
    this.gmClassesRowOffset = 0;
    this.mode = "gm-edit-classes";
    this.notice = "Tocca una cella per modificarla.";
  }

  cancelGmClassesEditing() {
    this.gmClassesEditor = null;
    this.gmClassesSelection = { row: 0, classIndex: 0 };
    this.gmClassesRowOffset = 0;
    this.mode = "gm-edit";
    this.notice = "Modifiche annullate.";
  }

  confirmGmClassesEditing() {
    if (!this.gmClassesEditor) {
      return;
    }

    const classCount = this.gmClassesEditor.classIds.length;
    const rows = Array.from({ length: classCount }, (_, classIndex) => {
      const row = {};
      this.gmClassesEditor.rows.forEach((field) => {
        row[field.key] = sanitizeTableCellText(field.values[classIndex]);
      });
      return row;
    });
    const tableText = buildDelimitedTable(CLASS_TABLE_HEADERS, rows);

    const importResult = this.game.importClassesFromTable(tableText);
    if (!importResult.ok) {
      this.notice = `Salvataggio fallito: ${importResult.error}`;
      return;
    }

    const saveResult = this.game.saveGmDataChanges();
    if (!saveResult.ok) {
      this.game.discardUnsavedGmDataChanges();
      this.notice = `Salvataggio annullato: ${saveResult.error}`;
      return;
    }

    this.gmClassesEditor = null;
    this.gmClassesSelection = { row: 0, classIndex: 0 };
    this.gmClassesRowOffset = 0;
    this.mode = "gm-edit";
    this.notice = `Classi aggiornate: ${importResult.count} record salvati.`;
  }

  editGmClassesCell(rowIndex, classIndex) {
    if (!this.gmClassesEditor || typeof window === "undefined" || typeof window.prompt !== "function") {
      return;
    }

    const rowData = this.gmClassesEditor.rows[rowIndex];
    if (!rowData) {
      return;
    }

    const classLabel = this.gmClassesEditor.classIds[classIndex] ?? `CLASS ${classIndex + 1}`;
    const currentValue = sanitizeTableCellText(rowData.values[classIndex]);
    const nextRawValue = window.prompt(`${rowData.label} (${classLabel})`, currentValue);
    if (nextRawValue === null) {
      return;
    }

    const nextValue =
      rowData.key === "specialPriority"
        ? normalizeToggleText(nextRawValue, currentValue)
        : sanitizeTableCellText(nextRawValue);

    rowData.values[classIndex] = nextValue;
    if (rowData.key === "id") {
      const nextClassId = sanitizeTableCellText(nextValue);
      this.gmClassesEditor.classIds[classIndex] =
        nextClassId.length > 0 ? nextClassId : `class_${classIndex + 1}`;
    }
  }

  render(ctx) {
    if (this.mode === "auth") {
      this.drawAuthMenu(ctx);
      return;
    }

    if (this.mode === "main") {
      this.drawMainMenu(ctx);
      return;
    }

    if (this.mode === "options") {
      this.drawOptionsPanel(ctx);
      return;
    }

    if (this.mode === "gm-auth") {
      this.drawGmAuthWindow(ctx);
      return;
    }

    if (this.mode === "gm-edit") {
      this.drawGmEditWindow(ctx);
      return;
    }

    if (this.mode === "gm-edit-classes") {
      this.drawGmEditWindow(ctx);
      this.drawGmClassesEditorModal(ctx);
      return;
    }

    this.drawBackground(ctx);
    this.drawTitle(ctx);

    if (this.mode === "slots") {
      this.drawSlotsMenu(ctx);
    }

    if (this.notice.length > 0) {
      this.drawNotice(ctx, this.notice);
    }
  }

  drawAuthMenu(ctx) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;
    const hasExternalAction = this.hasExternalAuthRecovery();
    const layout = getAuthMenuLayout(canvasWidth, canvasHeight, hasExternalAction);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (
      this.homeBackgroundImage &&
      this.homeBackgroundImage.complete &&
      this.homeBackgroundImage.naturalWidth > 0
    ) {
      drawImageCover(ctx, this.homeBackgroundImage, 0, 0, canvasWidth, canvasHeight);
    } else {
      ctx.fillStyle = "#0f1116";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    this.drawMainBanner(ctx, layout.bannerRect);
    this.drawOverlayTitleCard(ctx, layout.titleRect, "ACCOUNT");
    this.drawSettingsRowCard(ctx, layout.loginRect, "LOGIN CON GOOGLE", "", true);
    if (hasExternalAction && layout.externalActionRect) {
      this.drawSettingsRowCard(
        ctx,
        layout.externalActionRect,
        truncate(String(this.authRecoveryAction.label || "APRI NEL BROWSER"), 28),
        "",
        false,
      );
    }

    if (this.notice.length > 0) {
      this.drawMainNotice(ctx, layout.noticeRect, this.notice, layout.noticeFontSize);
    }

    ctx.restore();
  }

  drawBackground(ctx) {
    if (
      this.homeBackgroundImage &&
      this.homeBackgroundImage.complete &&
      this.homeBackgroundImage.naturalWidth > 0
    ) {
      drawImageCover(ctx, this.homeBackgroundImage, 0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
      return;
    }

    ctx.fillStyle = "#0f1116";
    ctx.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
  }

  drawTitle(ctx) {
    this.drawPanel(ctx, 8, 8, GAME_CONFIG.width - 16, 20);
    ctx.fillStyle = PALETTE.uiText;
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.fillText("AGOAD", 14, 14);
    ctx.font = "7px monospace";
    ctx.fillText("MOBILE MENU", GAME_CONFIG.width - 82, 15);
  }

  drawMainMenu(ctx) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;
    const hasSavedProgress = this.hasSavedProgress();
    const options = this.getMainMenuOptions();
    if (options.length === 0) {
      return;
    }
    this.mainIndex = Math.round(clampNumber(this.mainIndex, 0, options.length - 1));
    const layout = getMainMenuLayout(canvasWidth, canvasHeight, hasSavedProgress);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (
      this.homeBackgroundImage &&
      this.homeBackgroundImage.complete &&
      this.homeBackgroundImage.naturalWidth > 0
    ) {
      drawImageCover(ctx, this.homeBackgroundImage, 0, 0, canvasWidth, canvasHeight);
    } else {
      // Neutral fallback while the background image is loading.
      ctx.fillStyle = "#0f1116";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    this.drawMainBanner(ctx, layout.bannerRect);
    if (this.areMainMenuButtonsLoading()) {
      this.drawMainMenuLoadingHint(ctx, layout);
      if (this.notice.length > 0) {
        this.drawMainNotice(ctx, layout.noticeRect, this.notice, layout.noticeFontSize);
      }
      ctx.restore();
      return;
    }

    const primaryOption = hasSavedProgress ? MAIN_OPTION_CONTINUE : MAIN_OPTION_NEW_GAME;
    const primaryImage =
      primaryOption === MAIN_OPTION_CONTINUE
        ? this.homeContinueButtonImage
        : this.homeNewGameButtonImage;

    this.drawMainAssetButton(
      ctx,
      layout.primaryRect,
      primaryImage,
      this.mainIndex === 0,
      primaryOption,
      this.pendingMainOptionIndex === 0,
    );
    this.drawMainAssetButton(
      ctx,
      layout.settingsRect,
      this.homeSettingsButtonImage,
      this.mainIndex === 1,
      "SETTINGS",
      this.pendingMainOptionIndex === 1,
    );

    if (this.notice.length > 0) {
      this.drawMainNotice(ctx, layout.noticeRect, this.notice, layout.noticeFontSize);
    }

    ctx.restore();
  }

  areMainMenuButtonsLoading() {
    const requiredImages = [
      this.homeContinueButtonImage,
      this.homeNewGameButtonImage,
      this.homeSettingsButtonImage,
    ];
    return requiredImages.some((image) => image && !image.complete);
  }

  drawMainMenuLoadingHint(ctx, layout) {
    const hintWidth = Math.round(clampNumber(layout.primaryRect.w * 0.52, 120, layout.primaryRect.w));
    const hintHeight = Math.round(clampNumber(layout.primaryRect.h * 0.36, 20, 72));
    const x = Math.floor((this.game.canvas.width - hintWidth) / 2);
    const y = Math.floor(layout.primaryRect.y + (layout.primaryRect.h - hintHeight) / 2);
    const radius = Math.max(8, Math.round(hintHeight * 0.28));

    ctx.fillStyle = "rgba(7, 18, 33, 0.46)";
    fillRoundedRect(ctx, x, y, hintWidth, hintHeight, radius);
    ctx.strokeStyle = "rgba(167, 204, 247, 0.72)";
    ctx.lineWidth = Math.max(2, Math.round(hintHeight * 0.1));
    strokeRoundedRect(ctx, x, y, hintWidth, hintHeight, radius);

    const dotCount = (Math.floor(this.time * 3) % 3) + 1;
    ctx.fillStyle = "#e6f1ff";
    ctx.font = `${Math.round(clampNumber(hintHeight * 0.45, 10, 34))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`LOADING${".".repeat(dotCount)}`, x + hintWidth / 2, y + hintHeight / 2 + 0.5);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  drawMainBanner(ctx, rect) {
    if (
      this.homeTitleBannerImage &&
      this.homeTitleBannerImage.complete &&
      this.homeTitleBannerImage.naturalWidth > 0
    ) {
      drawImageCover(ctx, this.homeTitleBannerImage, rect.x, rect.y, rect.w, rect.h);
    }
  }

  drawMainAssetButton(ctx, rect, image, selected, fallbackLabel, pressed = false) {
    const radius = Math.max(10, Math.round(rect.h * 0.22));
    const visualRect = pressed
      ? {
          x: rect.x + Math.round(rect.w * 0.055),
          y: rect.y + Math.round(rect.h * 0.06),
          w: Math.round(rect.w * 0.89),
          h: Math.round(rect.h * 0.89),
        }
      : rect;

    if (image && image.complete && image.naturalWidth > 0) {
      drawImageCover(ctx, image, visualRect.x, visualRect.y, visualRect.w, visualRect.h);
      return;
    }

    ctx.fillStyle = selected ? "#4f6791" : "#f4f7ff";
    fillRoundedRect(ctx, visualRect.x, visualRect.y, visualRect.w, visualRect.h, radius);
    ctx.strokeStyle = selected ? "#a7c7ff" : "#223a57";
    ctx.lineWidth = Math.max(2, Math.round(visualRect.h * 0.08));
    strokeRoundedRect(ctx, visualRect.x, visualRect.y, visualRect.w, visualRect.h, radius);

    ctx.fillStyle = selected ? "#f4f8ff" : "#19324c";
    ctx.font = `${Math.round(clampNumber(visualRect.h * 0.35, 8, 46))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      fallbackLabel,
      visualRect.x + visualRect.w / 2,
      visualRect.y + visualRect.h / 2 + 0.5,
    );
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  drawMainNotice(ctx, rect, text, fontSize) {
    const safeText = String(text ?? "").trim();
    if (safeText.length === 0) {
      return;
    }

    const contentPaddingX = Math.round(clampNumber(rect.w * 0.04, 10, 30));
    const contentPaddingY = Math.round(clampNumber(rect.h * 0.24, 8, 24));
    const textMaxWidth = Math.max(40, rect.w - contentPaddingX * 2);
    const safeFontSize = Math.max(8, Math.round(fontSize));
    const lineHeight = Math.round(safeFontSize * 1.18);
    const lines = wrapTextByWidth(ctx, safeText, textMaxWidth, safeFontSize, 3);
    const contentHeight = Math.max(rect.h, lineHeight * lines.length + contentPaddingY * 2);
    const dynamicRect = {
      x: rect.x,
      y: rect.y + rect.h - contentHeight,
      w: rect.w,
      h: contentHeight,
    };
    const radius = Math.max(8, Math.round(dynamicRect.h * 0.22));

    ctx.fillStyle = "rgba(3, 16, 30, 0.68)";
    fillRoundedRect(ctx, dynamicRect.x, dynamicRect.y, dynamicRect.w, dynamicRect.h, radius);
    ctx.strokeStyle = "rgba(167, 204, 247, 0.72)";
    ctx.lineWidth = Math.max(2, Math.round(dynamicRect.h * 0.08));
    strokeRoundedRect(ctx, dynamicRect.x, dynamicRect.y, dynamicRect.w, dynamicRect.h, radius);

    ctx.fillStyle = "#e6f1ff";
    ctx.font = `${safeFontSize}px monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let lineY = dynamicRect.y + Math.round((dynamicRect.h - lineHeight * lines.length) / 2);
    const lineX = dynamicRect.x + contentPaddingX;
    lines.forEach((line) => {
      ctx.fillText(line, lineX, lineY);
      lineY += lineHeight;
    });
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  drawSlotsMenu(ctx) {
    const slots = this.game.getSaveSlots();
    const layout = getSlotsMenuLayout(slots.length);
    this.drawPanel(ctx, layout.panelX, layout.panelY, layout.panelW, layout.panelH, "#eef2f6");

    ctx.fillStyle = PALETTE.uiText;
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.fillText("SCEGLI SALVATAGGIO", layout.panelX + 10, layout.panelY + 8);

    layout.rowRects.forEach((rect, index) => {
      const isBackRow = index === slots.length;
      const selected = this.slotIndex === index;
      this.drawMenuCard(ctx, rect, selected);
      if (selected) {
        this.drawCursor(ctx, rect.x + 7, rect.y + 6, "#f4f7ff");
      }

      let line = "INDIETRO";
      if (!isBackRow) {
        const slot = slots[index];
        line = slot
          ? `SLOT ${index + 1}: ${truncate(
              `${slot.summary?.playerName ?? "Player"} ${formatPlayTime(slot.summary?.playTimeSeconds ?? 0)}`,
              20,
            )}`
          : `SLOT ${index + 1}: (vuoto)`;
      }

      ctx.fillStyle = selected ? "#f4f7ff" : PALETTE.uiText;
      ctx.font = "8px monospace";
      ctx.fillText(line, rect.x + 16, rect.y + 6);
    });
  }

  drawOptionsPanel(ctx) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;
    const layout = getOptionsMenuLayout(canvasWidth, canvasHeight);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (
      this.homeBackgroundImage &&
      this.homeBackgroundImage.complete &&
      this.homeBackgroundImage.naturalWidth > 0
    ) {
      drawImageCover(ctx, this.homeBackgroundImage, 0, 0, canvasWidth, canvasHeight);
    } else {
      ctx.fillStyle = "#0f1116";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    this.drawMainBanner(ctx, layout.bannerRect);

    this.drawOverlayTitleCard(ctx, layout.titleRect, "SETTINGS");

    layout.rowRects.forEach((rect, index) => {
      const selected = this.optionsIndex === index;
      const valueText =
        index === 0
          ? `${this.game.getSoundLevel()}/5`
          : index === 1
            ? `${this.game.getMusicLevel()}/5`
            : "";
      const valueRect = index === 0 ? layout.soundValueRect : index === 1 ? layout.musicValueRect : null;
      this.drawSettingsRowCard(ctx, rect, OPTIONS_MENU[index], valueText, selected, valueRect);

      if (index === 0 || index === 1) {
        const minusRect = index === 0 ? layout.soundMinusRect : layout.musicMinusRect;
        const plusRect = index === 0 ? layout.soundPlusRect : layout.musicPlusRect;
        this.drawSettingsAdjustButton(ctx, minusRect, "-", selected);
        this.drawSettingsAdjustButton(ctx, plusRect, "+", selected);
      }
    });

    if (this.notice.length > 0) {
      this.drawMainNotice(ctx, layout.noticeRect, this.notice, layout.noticeFontSize);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.restore();
  }

  drawOverlayTitleCard(ctx, rect, label) {
    ctx.fillStyle = "rgba(3, 16, 30, 0.5)";
    fillRoundedRect(
      ctx,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      Math.max(10, Math.round(rect.h * 0.3)),
    );
    ctx.strokeStyle = "rgba(167, 204, 247, 0.66)";
    ctx.lineWidth = Math.max(2, Math.round(rect.h * 0.08));
    strokeRoundedRect(
      ctx,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      Math.max(10, Math.round(rect.h * 0.3)),
    );

    ctx.fillStyle = "#e8f2ff";
    ctx.font = `${Math.round(clampNumber(rect.h * 0.43, 11, 44))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  drawMenuCard(ctx, rect, selected) {
    ctx.fillStyle = selected ? "#425f82" : "#f7f8fc";
    ctx.fillRect(rect.x + 1, rect.y + 1, rect.w, rect.h);
    ctx.fillStyle = selected ? "#355170" : "#e9edf5";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = selected ? "#1e334e" : "#5d6a7c";
    ctx.lineWidth = 1;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }

  drawSettingsRowCard(ctx, rect, label, valueText, selected, valueRect = null) {
    const radius = Math.max(10, Math.round(rect.h * 0.24));

    ctx.fillStyle = selected ? "rgba(84, 120, 173, 0.88)" : "rgba(18, 35, 59, 0.8)";
    fillRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
    ctx.strokeStyle = selected ? "#b1ccff" : "rgba(120, 162, 214, 0.72)";
    ctx.lineWidth = Math.max(2, Math.round(rect.h * 0.07));
    strokeRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);

    ctx.fillStyle = selected ? "#f6fbff" : "#dcecff";
    ctx.font = `${Math.round(clampNumber(rect.h * 0.38, 9, 42))}px monospace`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(label, rect.x + Math.round(rect.w * 0.045), rect.y + rect.h / 2 + 0.5);

    if (valueText.length > 0) {
      const chipRect = valueRect ?? {
        x: rect.x + rect.w - Math.round(clampNumber(rect.w * 0.38, 112, 360)),
        y: rect.y + Math.round(clampNumber(rect.h * 0.14, 6, 16)),
        w: Math.round(clampNumber(rect.w * 0.15, 54, 168)),
        h: Math.round(clampNumber(rect.h * 0.72, 28, rect.h - 6)),
      };
      const chipRadius = Math.max(8, Math.round(chipRect.h * 0.24));

      ctx.fillStyle = selected ? "rgba(10, 27, 46, 0.82)" : "rgba(8, 21, 37, 0.75)";
      fillRoundedRect(ctx, chipRect.x, chipRect.y, chipRect.w, chipRect.h, chipRadius);
      ctx.strokeStyle = selected ? "rgba(196, 220, 255, 0.9)" : "rgba(130, 168, 224, 0.76)";
      ctx.lineWidth = Math.max(2, Math.round(chipRect.h * 0.08));
      strokeRoundedRect(ctx, chipRect.x, chipRect.y, chipRect.w, chipRect.h, chipRadius);

      ctx.fillStyle = "#f3f9ff";
      ctx.font = `${Math.round(clampNumber(chipRect.h * 0.42, 9, 36))}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(valueText, chipRect.x + chipRect.w / 2, chipRect.y + chipRect.h / 2 + 0.5);
    }
  }

  drawSettingsAdjustButton(ctx, rect, label, selectedRow) {
    const radius = Math.max(8, Math.round(rect.h * 0.3));
    ctx.fillStyle = selectedRow ? "rgba(15, 32, 54, 0.95)" : "rgba(10, 24, 42, 0.85)";
    fillRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
    ctx.strokeStyle = selectedRow ? "rgba(177, 205, 255, 0.9)" : "rgba(122, 162, 221, 0.78)";
    ctx.lineWidth = Math.max(2, Math.round(rect.h * 0.09));
    strokeRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);

    ctx.fillStyle = "#f4f9ff";
    ctx.font = `${Math.round(clampNumber(rect.h * 0.52, 10, 40))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 0.5);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  drawGmAuthWindow(ctx) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;
    const layout = getGmAuthLayout(canvasWidth, canvasHeight);
    const masked = this.gmPasswordBuffer.length > 0 ? "*".repeat(this.gmPasswordBuffer.length) : "____";

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (
      this.homeBackgroundImage &&
      this.homeBackgroundImage.complete &&
      this.homeBackgroundImage.naturalWidth > 0
    ) {
      drawImageCover(ctx, this.homeBackgroundImage, 0, 0, canvasWidth, canvasHeight);
    } else {
      ctx.fillStyle = "#0f1116";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    this.drawMainBanner(ctx, layout.bannerRect);
    this.drawOverlayTitleCard(ctx, layout.titleRect, "GM-EDIT");

    this.drawSettingsRowCard(ctx, layout.passwordCardRect, "PASSWORD", "", true);
    const { x: inputX, y: inputY, w: inputW, h: inputH } = layout.passwordInputRect;

    ctx.fillStyle = "rgba(8, 21, 37, 0.75)";
    fillRoundedRect(ctx, inputX, inputY, inputW, inputH, Math.max(8, Math.round(inputH * 0.24)));
    ctx.strokeStyle = "rgba(130, 168, 224, 0.8)";
    ctx.lineWidth = Math.max(2, Math.round(inputH * 0.08));
    strokeRoundedRect(ctx, inputX, inputY, inputW, inputH, Math.max(8, Math.round(inputH * 0.24)));

    ctx.fillStyle = "#f3f9ff";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(clampNumber(inputH * 0.42, 10, 42))}px monospace`;
    ctx.fillText(masked, inputX + Math.round(clampNumber(inputW * 0.06, 8, 24)), inputY + inputH / 2 + 0.5);

    this.drawSettingsAdjustButton(ctx, layout.confirmRect, "CONFERMA", true);
    this.drawSettingsAdjustButton(ctx, layout.backRect, "INDIETRO", false);

    if (this.notice.length > 0) {
      this.drawMainNotice(ctx, layout.noticeRect, this.notice, layout.noticeFontSize);
    }

    if (this.gmAuthStatus.length > 0) {
      this.drawMainNotice(ctx, layout.statusRect, this.gmAuthStatus, layout.noticeFontSize);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.restore();
  }

  drawGmEditWindow(ctx) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;
    const layout = getGmEditLayout(canvasWidth, canvasHeight);
    const debugEnabled = this.game.getDebugOverlayEnabled();

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (
      this.homeBackgroundImage &&
      this.homeBackgroundImage.complete &&
      this.homeBackgroundImage.naturalWidth > 0
    ) {
      drawImageCover(ctx, this.homeBackgroundImage, 0, 0, canvasWidth, canvasHeight);
    } else {
      ctx.fillStyle = "#0f1116";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    this.drawMainBanner(ctx, layout.bannerRect);
    this.drawOverlayTitleCard(ctx, layout.titleRect, "GM-EDIT");

    layout.rowRects.forEach((rect, index) => {
      const entry = GM_EDIT_MENU[index];
      if (!entry) {
        return;
      }
      const selected = this.gmEditIndex === index;
      const label = entry.id === "debug" ? "DEBUG MODE" : entry.label;
      this.drawSettingsRowCard(ctx, rect, label, "", selected);

      if (entry.id === "debug") {
        this.drawDebugToggleSwitch(ctx, layout.debugToggleRect, debugEnabled, selected);
      }
    });

    if (this.notice.length > 0) {
      this.drawMainNotice(ctx, layout.noticeRect, this.notice, layout.noticeFontSize);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.restore();
  }

  drawDebugToggleSwitch(ctx, rect, isOn, selected) {
    if (!rect) {
      return;
    }

    const radius = Math.round(rect.h / 2);
    ctx.fillStyle = isOn ? "rgba(72, 204, 124, 0.95)" : "rgba(50, 62, 82, 0.92)";
    fillRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
    ctx.strokeStyle = selected ? "rgba(196, 220, 255, 0.95)" : "rgba(130, 168, 224, 0.76)";
    ctx.lineWidth = Math.max(2, Math.round(rect.h * 0.09));
    strokeRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);

    const knobSize = Math.max(12, Math.round(rect.h * 0.78));
    const knobMargin = Math.round((rect.h - knobSize) / 2);
    const knobX = isOn ? rect.x + rect.w - knobSize - knobMargin : rect.x + knobMargin;
    const knobY = rect.y + knobMargin;
    ctx.fillStyle = "#f7fbff";
    fillRoundedRect(ctx, knobX, knobY, knobSize, knobSize, Math.round(knobSize / 2));
    ctx.strokeStyle = "rgba(31, 51, 76, 0.7)";
    ctx.lineWidth = Math.max(1, Math.round(knobSize * 0.08));
    strokeRoundedRect(ctx, knobX, knobY, knobSize, knobSize, Math.round(knobSize / 2));
  }

  drawGmClassesEditorModal(ctx) {
    if (!this.gmClassesEditor) {
      return;
    }

    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;
    const layout = getGmClassesEditorLayout(
      canvasWidth,
      canvasHeight,
      this.gmClassesEditor,
      this.gmClassesRowOffset,
      this.gmClassesSelection,
    );
    const activeClassIndex = clampNumber(
      this.gmClassesSelection.classIndex,
      0,
      Math.max(0, this.gmClassesEditor.classIds.length - 1),
    );

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.fillStyle = "rgba(2, 10, 18, 0.58)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const panelRadius = Math.max(14, Math.round(layout.panelRect.h * 0.03));
    ctx.fillStyle = "rgba(8, 21, 37, 0.9)";
    fillRoundedRect(
      ctx,
      layout.panelRect.x,
      layout.panelRect.y,
      layout.panelRect.w,
      layout.panelRect.h,
      panelRadius,
    );
    ctx.strokeStyle = "rgba(167, 204, 247, 0.86)";
    ctx.lineWidth = Math.max(2, Math.round(layout.panelRect.h * 0.006));
    strokeRoundedRect(
      ctx,
      layout.panelRect.x,
      layout.panelRect.y,
      layout.panelRect.w,
      layout.panelRect.h,
      panelRadius,
    );

    this.drawOverlayTitleCard(ctx, layout.titleRect, "EDIT CLASSES");

    ctx.fillStyle = "rgba(5, 15, 26, 0.78)";
    fillRoundedRect(
      ctx,
      layout.classTabsRect.x,
      layout.classTabsRect.y,
      layout.classTabsRect.w,
      layout.classTabsRect.h,
      Math.max(8, Math.round(layout.classTabsRect.h * 0.2)),
    );
    ctx.strokeStyle = "rgba(130, 168, 224, 0.7)";
    ctx.lineWidth = Math.max(1, Math.round(layout.classTabsRect.h * 0.04));
    strokeRoundedRect(
      ctx,
      layout.classTabsRect.x,
      layout.classTabsRect.y,
      layout.classTabsRect.w,
      layout.classTabsRect.h,
      Math.max(8, Math.round(layout.classTabsRect.h * 0.2)),
    );

    layout.classTabRects.forEach((tab) => {
      const selected = tab.classIndex === activeClassIndex;
      ctx.fillStyle = selected ? "rgba(77, 117, 172, 0.96)" : "rgba(11, 26, 45, 0.88)";
      fillRoundedRect(
        ctx,
        tab.rect.x,
        tab.rect.y,
        tab.rect.w,
        tab.rect.h,
        Math.max(6, Math.round(tab.rect.h * 0.26)),
      );
      ctx.strokeStyle = selected ? "rgba(188, 217, 255, 0.95)" : "rgba(105, 145, 199, 0.66)";
      ctx.lineWidth = Math.max(1, Math.round(tab.rect.h * 0.08));
      strokeRoundedRect(
        ctx,
        tab.rect.x,
        tab.rect.y,
        tab.rect.w,
        tab.rect.h,
        Math.max(6, Math.round(tab.rect.h * 0.26)),
      );

      ctx.fillStyle = "#eff7ff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `${Math.round(clampNumber(tab.rect.h * 0.5, 13, 38))}px monospace`;
      ctx.fillText(tab.label, tab.rect.x + tab.rect.w / 2, tab.rect.y + tab.rect.h / 2 + 0.5);
    });

    ctx.fillStyle = "rgba(5, 15, 26, 0.78)";
    fillRoundedRect(
      ctx,
      layout.tableRect.x,
      layout.tableRect.y,
      layout.tableRect.w,
      layout.tableRect.h,
      Math.max(8, Math.round(layout.tableRect.h * 0.02)),
    );
    ctx.strokeStyle = "rgba(130, 168, 224, 0.7)";
    ctx.lineWidth = Math.max(1, Math.round(layout.tableRect.h * 0.004));
    strokeRoundedRect(
      ctx,
      layout.tableRect.x,
      layout.tableRect.y,
      layout.tableRect.w,
      layout.tableRect.h,
      Math.max(8, Math.round(layout.tableRect.h * 0.02)),
    );

    const headerFont = Math.round(clampNumber(layout.headerRect.h * 0.5, 15, 44));
    ctx.fillStyle = "rgba(15, 32, 54, 0.95)";
    fillRoundedRect(
      ctx,
      layout.headerRect.x,
      layout.headerRect.y,
      layout.headerRect.w,
      layout.headerRect.h,
      Math.max(6, Math.round(layout.headerRect.h * 0.22)),
    );
    ctx.strokeStyle = "rgba(177, 205, 255, 0.8)";
    ctx.lineWidth = Math.max(1, Math.round(layout.headerRect.h * 0.06));
    strokeRoundedRect(
      ctx,
      layout.headerRect.x,
      layout.headerRect.y,
      layout.headerRect.w,
      layout.headerRect.h,
      Math.max(6, Math.round(layout.headerRect.h * 0.22)),
    );

    ctx.fillStyle = "#e8f2ff";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = `${headerFont}px monospace`;
    ctx.fillText(
      "FIELD",
      layout.fieldHeaderRect.x + layout.fieldHeaderRect.w / 2,
      layout.fieldHeaderRect.y + layout.fieldHeaderRect.h / 2 + 0.5,
    );
    const activeClassLabel = this.gmClassesEditor.classIds[activeClassIndex] ?? `CLASS ${activeClassIndex + 1}`;
    ctx.fillText(
      truncate(activeClassLabel.toUpperCase(), 18),
      layout.valueHeaderRect.x + layout.valueHeaderRect.w / 2,
      layout.valueHeaderRect.y + layout.valueHeaderRect.h / 2 + 0.5,
    );

    layout.visibleRowRects.forEach((rowInfo) => {
      const { rowIndex, rowRect, fieldRect, valueRect } = rowInfo;
      const isStriped = rowIndex % 2 === 1;
      const rowData = this.gmClassesEditor.rows[rowIndex];
      ctx.fillStyle = isStriped ? "rgba(14, 27, 45, 0.75)" : "rgba(8, 20, 35, 0.72)";
      fillRoundedRect(ctx, rowRect.x, rowRect.y, rowRect.w, rowRect.h, Math.max(4, Math.round(rowRect.h * 0.18)));

      ctx.fillStyle = "#d3e8ff";
      ctx.textAlign = "left";
      ctx.font = `${Math.round(clampNumber(rowRect.h * 0.5, 13, 38))}px monospace`;
      ctx.fillText(
        truncate(rowData?.label ?? "", 16),
        fieldRect.x + Math.round(clampNumber(fieldRect.w * 0.06, 6, 18)),
        fieldRect.y + fieldRect.h / 2 + 0.5,
      );

      const isSelected =
        this.gmClassesSelection.row === rowIndex && this.gmClassesSelection.classIndex === activeClassIndex;
      ctx.fillStyle = isSelected ? "rgba(77, 117, 172, 0.94)" : "rgba(11, 26, 45, 0.88)";
      fillRoundedRect(
        ctx,
        valueRect.x,
        valueRect.y,
        valueRect.w,
        valueRect.h,
        Math.max(4, Math.round(valueRect.h * 0.18)),
      );
      ctx.strokeStyle = isSelected ? "rgba(188, 217, 255, 0.95)" : "rgba(105, 145, 199, 0.66)";
      ctx.lineWidth = Math.max(1, Math.round(valueRect.h * 0.06));
      strokeRoundedRect(
        ctx,
        valueRect.x,
        valueRect.y,
        valueRect.w,
        valueRect.h,
        Math.max(4, Math.round(valueRect.h * 0.18)),
      );

      ctx.fillStyle = "#eff7ff";
      ctx.textAlign = "center";
      ctx.font = `${Math.round(clampNumber(valueRect.h * 0.5, 13, 38))}px monospace`;
      ctx.fillText(
        truncate(this.gmClassesEditor.rows[rowIndex]?.values[activeClassIndex] ?? "", 24),
        valueRect.x + valueRect.w / 2,
        valueRect.y + valueRect.h / 2 + 0.5,
      );
    });

    if (layout.scrollUpRect && layout.scrollDownRect) {
      this.drawSettingsAdjustButton(ctx, layout.scrollUpRect, "UP", true);
      this.drawSettingsAdjustButton(ctx, layout.scrollDownRect, "DN", true);
    }

    this.drawSettingsAdjustButton(ctx, layout.cancelRect, "ANNULLA", false);
    this.drawSettingsAdjustButton(ctx, layout.confirmRect, "CONFERMA", true);

    ctx.fillStyle = "#d6e8ff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(clampNumber(layout.hintRect.h * 0.48, 11, 28))}px monospace`;
    ctx.fillText(
      "TOCCA UNA CELLA PER MODIFICARE",
      layout.hintRect.x + layout.hintRect.w / 2,
      layout.hintRect.y + layout.hintRect.h / 2 + 0.5,
    );

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.restore();
  }

  drawNotice(ctx, text) {
    const safeText = String(text ?? "").trim();
    if (safeText.length === 0) {
      return;
    }

    const panelX = 8;
    const panelW = GAME_CONFIG.width - 16;
    const fontSize = 8;
    const lineHeight = 10;
    const padX = 6;
    const padY = 5;
    const textMaxWidth = Math.max(28, panelW - (padX + 6) * 2);
    const lines = wrapTextByWidth(ctx, safeText, textMaxWidth, fontSize, 3);
    const panelH = Math.max(22, lines.length * lineHeight + padY * 2);
    const panelY = GAME_CONFIG.height - 8 - panelH;

    this.drawPanel(ctx, panelX, panelY, panelW, panelH);
    ctx.fillStyle = PALETTE.uiText;
    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = "top";
    const textX = panelX + 6;
    let textY = panelY + padY;
    lines.forEach((line) => {
      ctx.fillText(line, textX, textY);
      textY += lineHeight;
    });
  }

  drawPanel(ctx, x, y, w, h, fillColor = PALETTE.uiPanel) {
    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(x + 2, y + 2, w, h);
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.uiBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }

  drawCursor(ctx, x, y, color = PALETTE.uiText) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4, y + 3);
    ctx.lineTo(x, y + 6);
    ctx.closePath();
    ctx.fill();
  }
}

function getBaseMenuPanelLayout() {
  return {
    panelX: 8,
    panelY: 32,
    panelW: GAME_CONFIG.width - 16,
    panelH: 124,
  };
}

function createMenuRows(rowCount, rowHeight = 20, rowGap = 4) {
  const base = getBaseMenuPanelLayout();
  const rowX = base.panelX + 8;
  const rowW = base.panelW - 16;
  const startY = base.panelY + 20;

  return Array.from({ length: rowCount }, (_, index) => ({
    x: rowX,
    y: startY + index * (rowHeight + rowGap),
    w: rowW,
    h: rowHeight,
  }));
}

function getMainMenuLayout(
  surfaceWidth = GAME_CONFIG.width,
  surfaceHeight = GAME_CONFIG.height,
  hasSavedProgress = false,
) {
  const sidePadding = Math.round(clampNumber(surfaceWidth * 0.05, 10, 80));
  const topInset = Math.round(clampNumber(surfaceHeight * 0.04, 12, 120));

  const bannerRect = getHomeBannerRect(surfaceWidth, surfaceHeight);

  const primaryMaxW = Math.max(
    150,
    Math.min(surfaceWidth - sidePadding * 2, Math.floor(bannerRect.w * 0.88)),
  );
  const primaryW = Math.round(clampNumber(bannerRect.w * 0.62, 140, primaryMaxW));
  const primaryH = Math.round(clampNumber(surfaceHeight * 0.13, 68, 260));
  const baseSettingsSize = clampNumber(Math.min(surfaceWidth, surfaceHeight) * 0.18, 68, 240);
  const settingsSize = Math.round(clampNumber(baseSettingsSize * 1.3, 88, 312));
  const buttonGap = Math.round(clampNumber(surfaceHeight * 0.028, 12, 56));

  const primaryRect = {
    x: Math.floor((surfaceWidth - primaryW) / 2),
    y: 0,
    w: primaryW,
    h: primaryH,
  };

  const noticeW = surfaceWidth - sidePadding * 2;
  const noticeH = Math.round(clampNumber(surfaceHeight * 0.055, 18, 54));
  const minPrimaryY = bannerRect.y + bannerRect.h + 18;
  const maxPrimaryY =
    surfaceHeight - topInset - noticeH - 14 - (settingsSize + buttonGap);
  const safeMaxPrimaryY = Math.max(minPrimaryY, maxPrimaryY);
  const primaryY = Math.round(
    clampNumber(surfaceHeight * 0.5 - primaryH / 2, minPrimaryY, safeMaxPrimaryY),
  );
  primaryRect.y = primaryY;

  const settingsRect = {
    x: Math.floor((surfaceWidth - settingsSize) / 2),
    y: primaryRect.y + primaryRect.h + buttonGap,
    w: settingsSize,
    h: settingsSize,
  };

  const noticeRect = {
    x: sidePadding,
    y: surfaceHeight - topInset - noticeH,
    w: noticeW,
    h: noticeH,
  };

  return {
    hasSavedProgress,
    primaryRect,
    settingsRect,
    bannerRect,
    noticeRect,
    sidePadding,
    topInset,
    noticeFontSize: Math.round(clampNumber(surfaceHeight * 0.023, 6, 34)),
    itemRects: [primaryRect, settingsRect],
  };
}

function getAuthMenuLayout(
  surfaceWidth = GAME_CONFIG.width,
  surfaceHeight = GAME_CONFIG.height,
  showExternalAction = false,
) {
  const sidePadding = Math.round(clampNumber(surfaceWidth * 0.06, 12, 90));
  const topInset = Math.round(clampNumber(surfaceHeight * 0.04, 12, 120));
  const bannerRect = getHomeBannerRect(surfaceWidth, surfaceHeight);

  const titleW = Math.round(clampNumber(surfaceWidth * 0.5, 140, surfaceWidth - sidePadding * 2));
  const titleH = Math.round(clampNumber(surfaceHeight * 0.06, 22, 72));
  const titleRect = {
    x: Math.floor((surfaceWidth - titleW) / 2),
    y: bannerRect.y + bannerRect.h + Math.round(clampNumber(surfaceHeight * 0.02, 8, 26)),
    w: titleW,
    h: titleH,
  };

  const loginW = Math.round(clampNumber(surfaceWidth * 0.84, 220, surfaceWidth - sidePadding * 2));
  const loginH = Math.round(clampNumber(surfaceHeight * 0.11, 52, 130));
  const externalW = Math.round(clampNumber(loginW * 0.8, 170, loginW));
  const externalH = Math.round(clampNumber(surfaceHeight * 0.078, 36, 94));
  const actionGap = Math.round(clampNumber(surfaceHeight * 0.018, 8, 22));
  const actionStackH = loginH + (showExternalAction ? actionGap + externalH : 0);

  const noticeH = Math.round(clampNumber(surfaceHeight * 0.055, 18, 54));
  const noticeRect = {
    x: sidePadding,
    y: surfaceHeight - topInset - noticeH,
    w: surfaceWidth - sidePadding * 2,
    h: noticeH,
  };

  const minActionsY = titleRect.y + titleRect.h + Math.round(clampNumber(surfaceHeight * 0.03, 10, 28));
  const maxActionsY = noticeRect.y - Math.round(clampNumber(surfaceHeight * 0.03, 10, 34)) - actionStackH;
  const safeMaxActionsY = Math.max(minActionsY, maxActionsY);
  const actionsY = Math.round(
    clampNumber(surfaceHeight * 0.53 - actionStackH / 2, minActionsY, safeMaxActionsY),
  );

  const loginRect = {
    x: Math.floor((surfaceWidth - loginW) / 2),
    y: actionsY,
    w: loginW,
    h: loginH,
  };
  const externalActionRect = showExternalAction
    ? {
        x: Math.floor((surfaceWidth - externalW) / 2),
        y: loginRect.y + loginRect.h + actionGap,
        w: externalW,
        h: externalH,
      }
    : null;

  return {
    bannerRect,
    titleRect,
    loginRect,
    externalActionRect,
    noticeRect,
    noticeFontSize: Math.round(clampNumber(surfaceHeight * 0.023, 6, 34)),
  };
}

function createUiImage(relativePath) {
  if (typeof Image === "undefined") {
    return null;
  }

  const imageUrl = buildVersionedAssetUrl(relativePath);

  const image = new Image();
  image.decoding = "async";
  image.src = imageUrl.toString();
  return image;
}

function buildVersionedAssetUrl(relativePath) {
  const version = new URL(import.meta.url).searchParams.get("v");
  const assetUrl = new URL(relativePath, import.meta.url);
  if (version) {
    assetUrl.searchParams.set("v", version);
  }
  return assetUrl;
}

function drawImageCover(ctx, image, targetX, targetY, targetW, targetH) {
  const sourceW = image.naturalWidth || image.width;
  const sourceH = image.naturalHeight || image.height;
  if (sourceW <= 0 || sourceH <= 0) {
    return;
  }

  const scale = Math.max(targetW / sourceW, targetH / sourceH);
  const drawW = sourceW * scale;
  const drawH = sourceH * scale;
  const offsetX = targetX + (targetW - drawW) / 2;
  const offsetY = targetY + (targetH - drawH) / 2;
  ctx.drawImage(image, offsetX, offsetY, drawW, drawH);
}

function drawImageContain(ctx, image, targetX, targetY, targetW, targetH) {
  const sourceW = image.naturalWidth || image.width;
  const sourceH = image.naturalHeight || image.height;
  if (sourceW <= 0 || sourceH <= 0) {
    return;
  }

  const scale = Math.min(targetW / sourceW, targetH / sourceH);
  const drawW = sourceW * scale;
  const drawH = sourceH * scale;
  const offsetX = targetX + (targetW - drawW) / 2;
  const offsetY = targetY + (targetH - drawH) / 2;
  ctx.drawImage(image, offsetX, offsetY, drawW, drawH);
}

function fillRoundedRect(ctx, x, y, w, h, radius) {
  buildRoundedRectPath(ctx, x, y, w, h, radius);
  ctx.fill();
}

function strokeRoundedRect(ctx, x, y, w, h, radius) {
  buildRoundedRectPath(ctx, x, y, w, h, radius);
  ctx.stroke();
}

function buildRoundedRectPath(ctx, x, y, w, h, radius) {
  const safeRadius = clampNumber(radius, 0, Math.min(w, h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + w - safeRadius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + safeRadius);
  ctx.lineTo(x + w, y + h - safeRadius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - safeRadius, y + h);
  ctx.lineTo(x + safeRadius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function getSlotsMenuLayout(slotCount) {
  const base = getBaseMenuPanelLayout();
  return {
    ...base,
    rowRects: createMenuRows(slotCount + 1, 20, 4),
  };
}

function getOptionsMenuLayout(surfaceWidth = GAME_CONFIG.width, surfaceHeight = GAME_CONFIG.height) {
  const sidePadding = Math.round(clampNumber(surfaceWidth * 0.06, 12, 90));
  const topInset = Math.round(clampNumber(surfaceHeight * 0.04, 12, 120));

  const bannerRect = getHomeBannerRect(surfaceWidth, surfaceHeight);

  const titleW = Math.round(clampNumber(surfaceWidth * 0.5, 140, surfaceWidth - sidePadding * 2));
  const titleH = Math.round(clampNumber(surfaceHeight * 0.06, 22, 72));
  const titleRect = {
    x: Math.floor((surfaceWidth - titleW) / 2),
    y: bannerRect.y + bannerRect.h + Math.round(clampNumber(surfaceHeight * 0.02, 8, 26)),
    w: titleW,
    h: titleH,
  };

  const rowW = Math.round(clampNumber(surfaceWidth * 0.9, 230, surfaceWidth - sidePadding * 2));
  const rowH = Math.round(clampNumber(surfaceHeight * 0.102, 40, 132));
  const rowGap = Math.round(clampNumber(surfaceHeight * 0.022, 10, 36));
  const rowsHeight = rowH * OPTIONS_MENU.length + rowGap * (OPTIONS_MENU.length - 1);
  const rowsStartY = Math.round(
    clampNumber(
      surfaceHeight * 0.53 - rowsHeight / 2,
      titleRect.y + titleRect.h + Math.round(clampNumber(surfaceHeight * 0.02, 10, 24)),
      surfaceHeight * 0.72,
    ),
  );

  const rowRects = Array.from({ length: OPTIONS_MENU.length }, (_, index) => ({
    x: Math.floor((surfaceWidth - rowW) / 2),
    y: rowsStartY + index * (rowH + rowGap),
    w: rowW,
    h: rowH,
  }));

  const controlW = Math.round(clampNumber(rowH * 0.9, 32, 100));
  const controlH = Math.round(clampNumber(rowH * 0.76, 28, 84));
  const valueW = Math.round(clampNumber(rowW * 0.16, 66, 172));
  const valueH = controlH;
  const controlGap = Math.round(clampNumber(rowW * 0.016, 6, 18));
  const controlsRightPadding = Math.round(clampNumber(rowW * 0.028, 8, 24));

  const createControlsForRow = (rowRect) => {
    const controlsTotalW = controlW * 2 + valueW + controlGap * 2;
    const controlsStartX = rowRect.x + rowRect.w - controlsRightPadding - controlsTotalW;
    const baseY = rowRect.y + Math.floor((rowRect.h - controlH) / 2);
    const minusRect = {
      x: controlsStartX,
      y: baseY,
      w: controlW,
      h: controlH,
    };
    const valueRect = {
      x: minusRect.x + minusRect.w + controlGap,
      y: rowRect.y + Math.floor((rowRect.h - valueH) / 2),
      w: valueW,
      h: valueH,
    };
    const plusRect = {
      x: valueRect.x + valueRect.w + controlGap,
      y: baseY,
      w: controlW,
      h: controlH,
    };
    return { minusRect, valueRect, plusRect };
  };

  const soundControls = createControlsForRow(rowRects[0]);
  const musicControls = createControlsForRow(rowRects[1]);

  const noticeW = surfaceWidth - sidePadding * 2;
  const noticeH = Math.round(clampNumber(surfaceHeight * 0.055, 18, 54));
  const noticeRect = {
    x: sidePadding,
    y: surfaceHeight - topInset - noticeH,
    w: noticeW,
    h: noticeH,
  };

  return {
    bannerRect,
    titleRect,
    rowRects,
    soundMinusRect: soundControls.minusRect,
    soundValueRect: soundControls.valueRect,
    soundPlusRect: soundControls.plusRect,
    musicMinusRect: musicControls.minusRect,
    musicValueRect: musicControls.valueRect,
    musicPlusRect: musicControls.plusRect,
    noticeRect,
    noticeFontSize: Math.round(clampNumber(surfaceHeight * 0.023, 6, 34)),
  };
}

function getGmAuthLayout(surfaceWidth = GAME_CONFIG.width, surfaceHeight = GAME_CONFIG.height) {
  const sidePadding = Math.round(clampNumber(surfaceWidth * 0.06, 12, 90));
  const topInset = Math.round(clampNumber(surfaceHeight * 0.04, 12, 120));

  const bannerRect = getHomeBannerRect(surfaceWidth, surfaceHeight);

  const titleW = Math.round(clampNumber(surfaceWidth * 0.56, 156, surfaceWidth - sidePadding * 2));
  const titleH = Math.round(clampNumber(surfaceHeight * 0.06, 24, 72));
  const titleRect = {
    x: Math.floor((surfaceWidth - titleW) / 2),
    y: bannerRect.y + bannerRect.h + Math.round(clampNumber(surfaceHeight * 0.02, 8, 26)),
    w: titleW,
    h: titleH,
  };

  const passwordW = Math.round(clampNumber(surfaceWidth * 0.9, 240, surfaceWidth - sidePadding * 2));
  const passwordH = Math.round(clampNumber(surfaceHeight * 0.22, 96, 280));
  const passwordCardRect = {
    x: Math.floor((surfaceWidth - passwordW) / 2),
    y: Math.round(
      clampNumber(
        surfaceHeight * 0.45 - passwordH / 2,
        titleRect.y + titleRect.h + 12,
        surfaceHeight * 0.66,
      ),
    ),
    w: passwordW,
    h: passwordH,
  };

  const inputInsetX = Math.round(clampNumber(passwordCardRect.w * 0.045, 12, 40));
  const inputInsetY = Math.round(clampNumber(passwordCardRect.h * 0.44, 24, 88));
  const inputW = passwordCardRect.w - inputInsetX * 2;
  const inputH = Math.round(clampNumber(passwordCardRect.h * 0.38, 24, 110));
  const passwordInputRect = {
    x: passwordCardRect.x + inputInsetX,
    y: passwordCardRect.y + inputInsetY,
    w: inputW,
    h: inputH,
  };

  const actionGap = Math.round(clampNumber(surfaceHeight * 0.014, 6, 18));
  const actionW = Math.round(clampNumber(passwordCardRect.w * 0.45, 94, 280));
  const actionH = Math.round(clampNumber(surfaceHeight * 0.066, 30, 78));
  const actionsY = passwordCardRect.y + passwordCardRect.h + actionGap;
  const confirmRect = {
    x: passwordCardRect.x + passwordCardRect.w - actionW,
    y: actionsY,
    w: actionW,
    h: actionH,
  };
  const backRect = {
    x: passwordCardRect.x,
    y: actionsY,
    w: actionW,
    h: actionH,
  };

  const noticeW = surfaceWidth - sidePadding * 2;
  const noticeH = Math.round(clampNumber(surfaceHeight * 0.055, 18, 54));
  const statusRect = {
    x: sidePadding,
    y: actionsY + actionH + actionGap,
    w: noticeW,
    h: noticeH,
  };
  const noticeRect = {
    x: sidePadding,
    y: surfaceHeight - topInset - noticeH,
    w: noticeW,
    h: noticeH,
  };

  return {
    bannerRect,
    titleRect,
    passwordCardRect,
    passwordInputRect,
    confirmRect,
    backRect,
    statusRect,
    noticeRect,
    noticeFontSize: Math.round(clampNumber(surfaceHeight * 0.023, 6, 34)),
  };
}

function getGmEditLayout(surfaceWidth = GAME_CONFIG.width, surfaceHeight = GAME_CONFIG.height) {
  const sidePadding = Math.round(clampNumber(surfaceWidth * 0.06, 12, 90));
  const topInset = Math.round(clampNumber(surfaceHeight * 0.04, 12, 120));

  const bannerRect = getHomeBannerRect(surfaceWidth, surfaceHeight);

  const titleW = Math.round(clampNumber(surfaceWidth * 0.48, 140, surfaceWidth - sidePadding * 2));
  const titleH = Math.round(clampNumber(surfaceHeight * 0.06, 24, 72));
  const titleRect = {
    x: Math.floor((surfaceWidth - titleW) / 2),
    y: bannerRect.y + bannerRect.h + Math.round(clampNumber(surfaceHeight * 0.02, 8, 26)),
    w: titleW,
    h: titleH,
  };

  const noticeW = surfaceWidth - sidePadding * 2;
  const noticeH = Math.round(clampNumber(surfaceHeight * 0.055, 18, 54));
  const noticeRect = {
    x: sidePadding,
    y: surfaceHeight - topInset - noticeH,
    w: noticeW,
    h: noticeH,
  };

  const rowW = Math.round(clampNumber(surfaceWidth * 0.9, 230, surfaceWidth - sidePadding * 2));
  const rowGap = Math.round(clampNumber(surfaceHeight * 0.012, 6, 18));
  const rowsStartY = titleRect.y + titleRect.h + Math.round(clampNumber(surfaceHeight * 0.02, 10, 24));
  const rowsCount = GM_EDIT_MENU.length;
  const maxRowsArea = Math.max(
    rowsCount * 30,
    noticeRect.y - rowsStartY - rowGap * (rowsCount - 1) - Math.round(clampNumber(surfaceHeight * 0.018, 8, 28)),
  );
  const rowH = Math.round(clampNumber(maxRowsArea / rowsCount, 30, 98));
  const rowRects = Array.from({ length: rowsCount }, (_, index) => ({
    x: Math.floor((surfaceWidth - rowW) / 2),
    y: rowsStartY + index * (rowH + rowGap),
    w: rowW,
    h: rowH,
  }));
  const debugRowRect = rowRects[0] ?? null;
  const debugToggleRect = debugRowRect
    ? {
        w: Math.round(clampNumber(debugRowRect.w * 0.19, 74, 200)),
        h: Math.round(clampNumber(debugRowRect.h * 0.58, 24, 74)),
        x: 0,
        y: 0,
      }
    : null;
  if (debugToggleRect) {
    debugToggleRect.x =
      debugRowRect.x +
      debugRowRect.w -
      debugToggleRect.w -
      Math.round(clampNumber(debugRowRect.w * 0.03, 8, 24));
    debugToggleRect.y = debugRowRect.y + Math.floor((debugRowRect.h - debugToggleRect.h) / 2);
  }

  return {
    bannerRect,
    titleRect,
    rowRects,
    debugToggleRect,
    noticeRect,
    noticeFontSize: Math.round(clampNumber(surfaceHeight * 0.023, 6, 34)),
  };
}

function getGmClassesEditorLayout(
  surfaceWidth = GAME_CONFIG.width,
  surfaceHeight = GAME_CONFIG.height,
  editor = null,
  rowOffset = 0,
  selection = { row: 0, classIndex: 0 },
) {
  const classCount = Math.max(1, editor?.classIds?.length ?? 0);
  const rowCount = Math.max(0, editor?.rows?.length ?? 0);
  const selectedClassIndex = Math.round(clampNumber(selection?.classIndex ?? 0, 0, classCount - 1));

  const outerPad = Math.round(clampNumber(Math.min(surfaceWidth, surfaceHeight) * 0.02, 8, 20));
  const panelW = Math.round(clampNumber(surfaceWidth * 0.96, 280, surfaceWidth - outerPad * 2));
  const panelH = Math.round(clampNumber(surfaceHeight * 0.84, 320, surfaceHeight - outerPad * 2));
  const panelRect = {
    x: Math.floor((surfaceWidth - panelW) / 2),
    y: Math.floor((surfaceHeight - panelH) / 2),
    w: panelW,
    h: panelH,
  };

  const innerPad = Math.round(clampNumber(panelW * 0.026, 8, 24));
  const verticalGap = Math.round(clampNumber(panelH * 0.018, 6, 16));
  const titleH = Math.round(clampNumber(panelH * 0.11, 40, 92));
  const titleRect = {
    x: panelRect.x + innerPad,
    y: panelRect.y + innerPad,
    w: panelRect.w - innerPad * 2,
    h: titleH,
  };

  const classTabsH = Math.round(clampNumber(panelH * 0.09, 34, 84));
  const classTabsRect = {
    x: panelRect.x + innerPad,
    y: titleRect.y + titleRect.h + verticalGap,
    w: panelRect.w - innerPad * 2,
    h: classTabsH,
  };
  const tabsInnerPad = Math.round(clampNumber(classTabsRect.w * 0.016, 4, 12));
  const tabGap = Math.round(clampNumber(classTabsRect.w * 0.012, 3, 10));
  const tabsAreaW = classTabsRect.w - tabsInnerPad * 2 - tabGap * Math.max(0, classCount - 1);
  const tabW = Math.max(46, Math.floor(tabsAreaW / classCount));
  const tabH = classTabsRect.h - tabsInnerPad * 2;
  const classTabRects = Array.from({ length: classCount }, (_, classIndex) => ({
    classIndex,
    label: truncate((editor?.classIds?.[classIndex] ?? `CLASS ${classIndex + 1}`).toUpperCase(), 12),
    rect: {
      x: classTabsRect.x + tabsInnerPad + classIndex * (tabW + tabGap),
      y: classTabsRect.y + tabsInnerPad,
      w: tabW,
      h: tabH,
    },
  }));

  const buttonH = Math.round(clampNumber(panelH * 0.088, 32, 78));
  const buttonGap = Math.round(clampNumber(panelW * 0.03, 8, 24));
  const buttonW = Math.round((panelRect.w - innerPad * 2 - buttonGap) / 2);
  const buttonY = panelRect.y + panelRect.h - innerPad - buttonH;
  const cancelRect = {
    x: panelRect.x + innerPad,
    y: buttonY,
    w: buttonW,
    h: buttonH,
  };
  const confirmRect = {
    x: cancelRect.x + buttonW + buttonGap,
    y: buttonY,
    w: buttonW,
    h: buttonH,
  };

  const hintH = Math.round(clampNumber(panelH * 0.052, 18, 42));
  const hintRect = {
    x: panelRect.x + innerPad,
    y: cancelRect.y - verticalGap - hintH,
    w: panelRect.w - innerPad * 2,
    h: hintH,
  };

  const tableRect = {
    x: panelRect.x + innerPad,
    y: classTabsRect.y + classTabsRect.h + verticalGap,
    w: panelRect.w - innerPad * 2,
    h: Math.max(100, hintRect.y - verticalGap - (classTabsRect.y + classTabsRect.h + verticalGap)),
  };
  const tableInnerPad = Math.round(clampNumber(tableRect.w * 0.014, 4, 12));
  const headerH = Math.round(clampNumber(tableRect.h * 0.13, 34, 88));
  const rowGap = Math.round(clampNumber(tableRect.h * 0.009, 2, 8));
  const tableInnerX = tableRect.x + tableInnerPad;
  const tableInnerW = tableRect.w - tableInnerPad * 2;
  const colGap = Math.round(clampNumber(tableInnerW * 0.01, 2, 10));
  const maxFieldW = Math.max(94, tableInnerW - 120);
  const fieldColW = Math.round(clampNumber(tableInnerW * 0.38, 94, maxFieldW));
  const valueColW = Math.max(80, tableInnerW - fieldColW - colGap);
  const headerY = tableRect.y + tableInnerPad;
  const fieldHeaderRect = { x: tableInnerX, y: headerY, w: fieldColW, h: headerH };
  const valueHeaderRect = {
    x: fieldHeaderRect.x + fieldColW + colGap,
    y: headerY,
    w: valueColW,
    h: headerH,
  };
  const headerRect = {
    x: tableInnerX,
    y: headerY,
    w: fieldColW + colGap + valueColW,
    h: headerH,
  };

  const availableRowsH = Math.max(24, tableRect.h - tableInnerPad * 2 - headerH - rowGap);
  const rowH = Math.round(clampNumber(tableRect.h * 0.12, 34, 84));
  const maxVisibleRows = Math.max(1, Math.floor((availableRowsH + rowGap) / (rowH + rowGap)));
  const visibleRows = Math.max(1, Math.min(rowCount || 1, maxVisibleRows));
  const maxOffset = Math.max(0, rowCount - visibleRows);
  const safeOffset = Math.round(clampNumber(rowOffset, 0, maxOffset));
  const rowsStartY = headerY + headerH + rowGap;

  const visibleRowRects = [];
  const valueCellRects = [];
  for (let visibleIndex = 0; visibleIndex < visibleRows; visibleIndex += 1) {
    const rowIndex = safeOffset + visibleIndex;
    if (rowIndex >= rowCount) {
      break;
    }
    const rowY = rowsStartY + visibleIndex * (rowH + rowGap);
    const rowRect = {
      x: tableInnerX,
      y: rowY,
      w: headerRect.w,
      h: rowH,
    };
    const fieldRect = {
      x: rowRect.x,
      y: rowRect.y,
      w: fieldColW,
      h: rowRect.h,
    };
    const valueRect = {
      x: valueHeaderRect.x,
      y: rowRect.y + 1,
      w: valueHeaderRect.w,
      h: rowRect.h - 2,
    };
    valueCellRects.push({
      rowIndex,
      classIndex: selectedClassIndex,
      rect: valueRect,
    });
    visibleRowRects.push({
      rowIndex,
      rowRect,
      fieldRect,
      valueRect,
      selected:
        selection &&
        selection.row === rowIndex &&
        selectedClassIndex === selection.classIndex,
    });
  }

  const needsScroll = rowCount > visibleRows;
  const scrollW = Math.round(clampNumber(tableRect.w * 0.09, 44, 92));
  const scrollH = Math.round(clampNumber(tableRect.h * 0.08, 24, 54));
  const scrollUpRect = needsScroll
    ? {
        x: tableRect.x + tableRect.w - scrollW - tableInnerPad,
        y: tableRect.y + tableInnerPad,
        w: scrollW,
        h: scrollH,
      }
    : null;
  const scrollDownRect = needsScroll
    ? {
        x: scrollUpRect.x,
        y: tableRect.y + tableRect.h - tableInnerPad - scrollH,
        w: scrollW,
        h: scrollH,
      }
    : null;

  return {
    panelRect,
    titleRect,
    classTabsRect,
    classTabRects,
    tableRect,
    headerRect,
    fieldHeaderRect,
    valueHeaderRect,
    visibleRows,
    rowOffset: safeOffset,
    selectedClassIndex,
    visibleRowRects,
    valueCellRects,
    cancelRect,
    confirmRect,
    hintRect,
    scrollUpRect,
    scrollDownRect,
  };
}

function parseSimpleDelimitedTable(text) {
  if (typeof text !== "string") {
    return { ok: false, error: "Formato tabella non valido." };
  }

  const normalizedText = text.replace(/\r/g, "").trim();
  if (normalizedText.length === 0) {
    return { ok: false, error: "Tabella vuota." };
  }

  const lines = normalizedText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) {
    return { ok: false, error: "Tabella incompleta." };
  }

  const separator = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(separator).map((header) => sanitizeTableCellText(header));
  const hasInvalidHeader = headers.some((header) => header.length === 0);
  if (hasInvalidHeader) {
    return { ok: false, error: "Intestazione tabella non valida." };
  }

  const normalizedHeaders = headers.map((header) => header.toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(separator);
    const row = {};
    headers.forEach((header, index) => {
      const value = sanitizeTableCellText(values[index] ?? "");
      row[header] = value;
      row[header.toLowerCase()] = value;
    });
    return row;
  });

  return {
    ok: true,
    headers: normalizedHeaders,
    rows,
  };
}

function buildDelimitedTable(headers, rows) {
  const safeHeaders = headers.map((header) => sanitizeTableCellText(header));
  const headerLine = safeHeaders.join("\t");
  const bodyLines = rows.map((row) =>
    safeHeaders.map((header) => sanitizeTableCellText(row[header])).join("\t"),
  );
  return [headerLine, ...bodyLines].join("\n");
}

function sanitizeTableCellText(value) {
  return String(value ?? "")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\t/g, " ")
    .trim();
}

function normalizeToggleText(value, fallback = "false") {
  const normalized = sanitizeTableCellText(value).toLowerCase();
  if (["1", "true", "yes", "on", "si"].includes(normalized)) {
    return "true";
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return "false";
  }

  return sanitizeTableCellText(fallback).toLowerCase() === "true" ? "true" : "false";
}

function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function formatPlayTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function truncate(text, maxLen) {
  if (text.length <= maxLen) {
    return text;
  }

  return `${text.slice(0, maxLen - 1)}.`;
}

function wrapTextByWidth(ctx, text, maxWidth, fontSize, maxLines = 3) {
  const safeText = String(text ?? "").trim();
  if (safeText.length === 0) {
    return [""];
  }

  ctx.save();
  ctx.font = `${Math.max(8, Math.round(fontSize))}px monospace`;

  const words = safeText.split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";

  const pushCurrentLine = () => {
    if (currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = "";
    }
  };

  const fitWordChunks = (word) => {
    const chunks = [];
    let chunk = "";
    for (let index = 0; index < word.length; index += 1) {
      const char = word[index];
      const candidate = chunk + char;
      if (ctx.measureText(candidate).width <= maxWidth || chunk.length === 0) {
        chunk = candidate;
      } else {
        chunks.push(chunk);
        chunk = char;
      }
    }
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    return chunks;
  };

  words.forEach((word) => {
    const candidate = currentLine.length > 0 ? `${currentLine} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      return;
    }

    if (currentLine.length > 0) {
      pushCurrentLine();
    }

    if (ctx.measureText(word).width <= maxWidth) {
      currentLine = word;
      return;
    }

    const chunks = fitWordChunks(word);
    chunks.forEach((chunk, chunkIndex) => {
      if (chunkIndex < chunks.length - 1) {
        lines.push(chunk);
      } else {
        currentLine = chunk;
      }
    });
  });

  pushCurrentLine();
  const safeLines = lines.length > 0 ? lines : [safeText];
  if (safeLines.length <= maxLines) {
    ctx.restore();
    return safeLines;
  }

  const trimmed = safeLines.slice(0, maxLines);
  const lastIndex = trimmed.length - 1;
  let lastLine = trimmed[lastIndex];
  while (lastLine.length > 1 && ctx.measureText(`${lastLine}...`).width > maxWidth) {
    lastLine = lastLine.slice(0, -1);
  }
  trimmed[lastIndex] = `${lastLine}...`;
  ctx.restore();
  return trimmed;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getHomeBannerRect(surfaceWidth = GAME_CONFIG.width, surfaceHeight = GAME_CONFIG.height) {
  const sidePadding = Math.round(clampNumber(surfaceWidth * 0.05, 10, 80));
  const topInset = Math.round(clampNumber(surfaceHeight * 0.04, 12, 120));
  const bannerW = Math.round(clampNumber(surfaceWidth * 0.8, 205, surfaceWidth - sidePadding * 2));
  const bannerH = Math.round(clampNumber(surfaceHeight * 0.177, 88, 335));
  return {
    x: Math.floor((surfaceWidth - bannerW) / 2),
    y: topInset,
    w: bannerW,
    h: bannerH,
  };
}
