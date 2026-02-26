import { Scene } from "../core/Scene.js";
import { GAME_CONFIG, PALETTE } from "../data/constants.js";
import { downloadTextFile, pickTextFile } from "../utils/fileTransfer.js";
import { verifyGmEditPassword } from "../utils/security.js";

const MAIN_OPTIONS = ["CONTINUE", "NEW GAME", "SETTINGS"];
const OPTIONS_MENU = ["SOUND", "MUSIC", "GM-EDIT", "INDIETRO"];
const GM_EDIT_MENU = [
  { id: "debug", label: "DEBUG MODE" },
  { id: "export_classes", label: "EXPORT CLASSES" },
  { id: "import_classes", label: "IMPORT CLASSES" },
  { id: "export_enemies", label: "EXPORT ENEMIES" },
  { id: "import_enemies", label: "IMPORT ENEMIES" },
  { id: "back", label: "INDIETRO" },
];
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
    this.gmAuthToken = 0;
    this.gmActionBusy = false;
    this.gmActionToken = 0;
    this.notice = "";
    this.pointerEventsBound = false;
    this.activePointerId = null;
    this.pointerStart = null;
    this.tapQueue = [];
    this.pendingMainOptionIndex = null;
    this.pendingMainActionTimer = 0;
    this.homeBackgroundImage = createUiImage("../assets/UI_startscene_background.png");
    this.homeContinueButtonImage = createUiImage("../assets/UI_button_continue.png");
    this.homeNewGameButtonImage = createUiImage("../assets/UI_button_new_game.png");
    this.homeSettingsButtonImage = createUiImage("../assets/UI_button_settings.png");
    this.homeTitleBannerImage = createUiImage("../assets/UI_title_banner.png");

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerCancel.bind(this);
  }

  onEnter() {
    this.time = 0;
    this.mode = "main";
    this.mainIndex = 0;
    this.slotIndex = 0;
    this.optionsIndex = 0;
    this.gmEditIndex = 0;
    this.gmPasswordBuffer = "";
    this.gmAuthStatus = "";
    this.gmAuthToken += 1;
    this.gmActionBusy = false;
    this.gmActionToken += 1;
    this.notice = "";
    this.activePointerId = null;
    this.pointerStart = null;
    this.tapQueue.length = 0;
    this.pendingMainOptionIndex = null;
    this.pendingMainActionTimer = 0;
    this.game.input.setTextCapture(false);
    this.syncDocumentMode();
    this.bindPointerEvents();
  }

  onExit() {
    this.gmAuthToken += 1;
    this.gmActionToken += 1;
    this.gmActionBusy = false;
    this.activePointerId = null;
    this.pointerStart = null;
    this.tapQueue.length = 0;
    this.pendingMainOptionIndex = null;
    this.pendingMainActionTimer = 0;
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

    const tapPoint =
      this.mode === "main" || this.mode === "options"
        ? this.screenToCanvasPoint(event.clientX, event.clientY)
        : this.screenToGamePoint(event.clientX, event.clientY);
    if (tapPoint) {
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
      }
    });
  }

  updateMainMenu(input) {
    if (this.areMainMenuButtonsLoading()) {
      return;
    }

    if (this.pendingMainOptionIndex !== null) {
      return;
    }

    if (input.wasPressed("up")) {
      this.mainIndex = (this.mainIndex + MAIN_OPTIONS.length - 1) % MAIN_OPTIONS.length;
      return;
    }

    if (input.wasPressed("down")) {
      this.mainIndex = (this.mainIndex + 1) % MAIN_OPTIONS.length;
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
      return;
    }

    if (input.wasPressed("down")) {
      this.optionsIndex = (this.optionsIndex + 1) % OPTIONS_MENU.length;
      return;
    }

    if (input.wasPressed("back")) {
      this.mode = "main";
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

  activateMainOption(index) {
    this.mainIndex = index;
    if (this.pendingMainOptionIndex !== null) {
      return;
    }
    this.pendingMainOptionIndex = index;
    this.pendingMainActionTimer = MAIN_BUTTON_PRESS_ANIMATION_SECONDS;
  }

  executeMainOption(index) {
    this.mainIndex = index;

    if (this.mainIndex === 0) {
      const hasAnySave = this.game.getSaveSlots().some((slot) => Boolean(slot));
      if (!hasAnySave) {
        this.notice = "Nessun salvataggio disponibile.";
        return;
      }

      this.mode = "slots";
      this.slotIndex = 0;
      this.notice = "";
      return;
    }

    if (this.mainIndex === 1) {
      this.game.resetState();
      this.game.changeScene("setup");
      return;
    }

    if (this.mainIndex === 2) {
      this.mode = "options";
      this.optionsIndex = 0;
      this.notice = "";
      return;
    }

    this.mode = "options";
    this.optionsIndex = 0;
    this.notice = "";
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

    if (this.optionsIndex === 0) {
      this.shiftSoundLevel(1);
      return;
    }

    if (this.optionsIndex === 1) {
      this.shiftMusicLevel(1);
      return;
    }

    if (this.optionsIndex === 2) {
      this.enterGmAuthMode();
      return;
    }

    this.mode = "main";
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

    const layout = getMainMenuLayout(this.game.canvas.width, this.game.canvas.height);
    const tappedIndex = layout.itemRects.findIndex((rect) => pointInRect(tapPoint, rect));
    if (tappedIndex < 0) {
      return;
    }

    this.activateMainOption(tappedIndex);
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

  updateGmAuthMenu(input) {
    const typedChars = input.consumeTypedChars();
    typedChars.forEach((char) => {
      if (this.gmPasswordBuffer.length >= MAX_GM_PASSWORD_LENGTH) {
        return;
      }

      if (!/^[a-zA-Z0-9]$/.test(char)) {
        return;
      }

      this.gmPasswordBuffer += char;
    });

    const backspaceCount = input.consumeBackspaceCount();
    if (backspaceCount > 0) {
      this.gmPasswordBuffer = this.gmPasswordBuffer.slice(
        0,
        Math.max(0, this.gmPasswordBuffer.length - backspaceCount),
      );
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
          this.gmPasswordBuffer = "";
          this.gmAuthStatus = "";
          this.gmEditIndex = 0;
          this.notice = "";
          this.mode = "gm-edit";
          this.game.input.setTextCapture(false);
          return;
        }

        this.gmPasswordBuffer = "";
        this.gmAuthStatus = "Password errata.";
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
  }

  leaveGmAuthMode(nextMode = "options") {
    this.mode = nextMode;
    this.gmPasswordBuffer = "";
    this.gmAuthStatus = "";
    this.gmAuthToken += 1;
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

    if (selected.id === "export_classes") {
      const tableText = this.game.exportClassesAsTable();
      downloadTextFile("classes.tsv", tableText);
      this.notice = "Export classes completato.";
      return;
    }

    if (selected.id === "import_classes") {
      this.startGmImport("classes");
      return;
    }

    if (selected.id === "export_enemies") {
      const tableText = this.game.exportEnemiesAsTable();
      downloadTextFile("enemies.tsv", tableText);
      this.notice = "Export enemies completato.";
      return;
    }

    if (selected.id === "import_enemies") {
      this.startGmImport("enemies");
      return;
    }

    this.mode = "options";
  }

  startGmImport(target) {
    if (this.gmActionBusy) {
      return;
    }

    const actionToken = this.gmActionToken + 1;
    this.gmActionToken = actionToken;
    this.notice = "Seleziona un file tabella.";

    pickTextFile()
      .then((text) => {
        if (this.gmActionToken !== actionToken) {
          return;
        }

        if (!text) {
          this.notice = "Import annullato: nessun file selezionato.";
          return;
        }

        this.gmActionBusy = true;
        const result =
          target === "classes"
            ? this.game.importClassesFromTable(text)
            : this.game.importEnemiesFromTable(text);

        if (!result.ok) {
          this.notice = `Import fallito: ${result.error}`;
          return;
        }

        const saveResult = this.game.saveGmDataChanges();
        if (!saveResult.ok) {
          this.game.discardUnsavedGmDataChanges();
          this.notice = `Import annullato: ${saveResult.error} Ripristino automatico eseguito.`;
          return;
        }

        const targetLabel = target === "classes" ? "classes" : "enemies";
        this.notice = `Import ${targetLabel}: ${result.count} record salvati.`;
      })
      .catch((error) => {
        if (this.gmActionToken !== actionToken) {
          return;
        }
        const reason = error instanceof Error && error.message ? error.message : "errore sconosciuto";
        this.notice = `Import annullato: ${reason}`;
      })
      .finally(() => {
        if (this.gmActionToken !== actionToken) {
          return;
        }
        this.gmActionBusy = false;
      });
  }

  render(ctx) {
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

    this.drawBackground(ctx);
    this.drawTitle(ctx);

    if (this.mode === "slots") {
      this.drawSlotsMenu(ctx);
    }

    if (this.notice.length > 0) {
      this.drawNotice(ctx, this.notice);
    }
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
    ctx.fillText("BROWSER RPG", 14, 14);
    ctx.font = "7px monospace";
    ctx.fillText("MOBILE MENU", GAME_CONFIG.width - 82, 15);
  }

  drawMainMenu(ctx) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;
    const layout = getMainMenuLayout(canvasWidth, canvasHeight);

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

    this.drawMainAssetButton(
      ctx,
      layout.continueRect,
      this.homeContinueButtonImage,
      this.mainIndex === 0,
      "CONTINUE",
      this.pendingMainOptionIndex === 0,
    );
    this.drawMainAssetButton(
      ctx,
      layout.newGameRect,
      this.homeNewGameButtonImage,
      this.mainIndex === 1,
      "NEW GAME",
      this.pendingMainOptionIndex === 1,
    );
    this.drawMainAssetButton(
      ctx,
      layout.settingsRect,
      this.homeSettingsButtonImage,
      this.mainIndex === 2,
      "SETTINGS",
      this.pendingMainOptionIndex === 2,
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
    const hintWidth = Math.round(clampNumber(layout.continueRect.w * 0.52, 120, layout.continueRect.w));
    const hintHeight = Math.round(clampNumber(layout.continueRect.h * 0.36, 20, 72));
    const x = Math.floor((this.game.canvas.width - hintWidth) / 2);
    const y = Math.floor(layout.continueRect.y + (layout.continueRect.h - hintHeight) / 2);
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
    const radius = Math.max(8, Math.round(rect.h * 0.22));
    ctx.fillStyle = "rgba(3, 16, 30, 0.68)";
    fillRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
    ctx.strokeStyle = "rgba(167, 204, 247, 0.72)";
    ctx.lineWidth = Math.max(2, Math.round(rect.h * 0.08));
    strokeRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);

    ctx.fillStyle = "#e6f1ff";
    ctx.font = `${fontSize}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(truncate(text, 52), rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
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
      this.drawSettingsRowCard(ctx, rect, OPTIONS_MENU[index], valueText, selected);

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

  drawSettingsRowCard(ctx, rect, label, valueText, selected) {
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
      const chipW = Math.round(clampNumber(rect.w * 0.15, 54, 168));
      const chipH = Math.round(clampNumber(rect.h * 0.72, 28, rect.h - 6));
      const chipX = rect.x + rect.w - chipW - Math.round(rect.w * 0.19);
      const chipY = rect.y + Math.floor((rect.h - chipH) / 2);
      const chipRadius = Math.max(8, Math.round(chipH * 0.24));

      ctx.fillStyle = selected ? "rgba(10, 27, 46, 0.82)" : "rgba(8, 21, 37, 0.75)";
      fillRoundedRect(ctx, chipX, chipY, chipW, chipH, chipRadius);
      ctx.strokeStyle = selected ? "rgba(196, 220, 255, 0.9)" : "rgba(130, 168, 224, 0.76)";
      ctx.lineWidth = Math.max(2, Math.round(chipH * 0.08));
      strokeRoundedRect(ctx, chipX, chipY, chipW, chipH, chipRadius);

      ctx.fillStyle = "#f3f9ff";
      ctx.font = `${Math.round(clampNumber(chipH * 0.42, 9, 36))}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(valueText, chipX + chipW / 2, chipY + chipH / 2 + 0.5);
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
    const inputInsetX = Math.round(clampNumber(layout.passwordCardRect.w * 0.045, 12, 40));
    const inputInsetY = Math.round(clampNumber(layout.passwordCardRect.h * 0.44, 24, 88));
    const inputW = layout.passwordCardRect.w - inputInsetX * 2;
    const inputH = Math.round(clampNumber(layout.passwordCardRect.h * 0.38, 24, 110));
    const inputX = layout.passwordCardRect.x + inputInsetX;
    const inputY = layout.passwordCardRect.y + inputInsetY;

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

    this.drawSettingsRowCard(
      ctx,
      layout.statusRect,
      this.gmAuthStatus || "A CONFERMA",
      "",
      false,
    );
    this.drawSettingsRowCard(ctx, layout.hintRect, "B ANNULLA   ABC/CANC INPUT", "", false);

    if (this.notice.length > 0) {
      this.drawMainNotice(ctx, layout.noticeRect, this.notice, layout.noticeFontSize);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.restore();
  }

  drawGmEditWindow(ctx) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;
    const layout = getGmEditLayout(canvasWidth, canvasHeight);

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
      const valueText = entry.id === "debug" ? (this.game.getDebugOverlayEnabled() ? "ON" : "OFF") : "";
      const label = entry.id === "debug" ? "DEBUG MODE" : entry.label;
      this.drawSettingsRowCard(ctx, rect, label, valueText, selected);
    });

    this.drawSettingsRowCard(
      ctx,
      layout.helpRect,
      this.gmActionBusy ? "OPERAZIONE IN CORSO..." : "A SELEZIONA",
      "B INDIETRO",
      false,
    );

    if (this.notice.length > 0) {
      this.drawMainNotice(ctx, layout.noticeRect, this.notice, layout.noticeFontSize);
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.restore();
  }

  drawNotice(ctx, text) {
    this.drawPanel(ctx, 8, GAME_CONFIG.height - 30, GAME_CONFIG.width - 16, 22);
    ctx.fillStyle = PALETTE.uiText;
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.fillText(truncate(text, 40), 14, GAME_CONFIG.height - 23);
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

function getMainMenuLayout(surfaceWidth = GAME_CONFIG.width, surfaceHeight = GAME_CONFIG.height) {
  const sidePadding = Math.round(clampNumber(surfaceWidth * 0.05, 10, 80));
  const topInset = Math.round(clampNumber(surfaceHeight * 0.04, 12, 120));

  const bannerW = Math.round(clampNumber(surfaceWidth * 0.9, 220, surfaceWidth - sidePadding * 2));
  const bannerH = Math.round(clampNumber(surfaceHeight * 0.21, 100, 380));
  const bannerRect = {
    x: Math.floor((surfaceWidth - bannerW) / 2),
    y: topInset,
    w: bannerW,
    h: bannerH,
  };

  const newGameW = Math.round(clampNumber(surfaceWidth * 0.72, 190, surfaceWidth - sidePadding * 2));
  const continueW = Math.round(clampNumber(newGameW * 1.3, 250, surfaceWidth - sidePadding * 2));
  const newGameH = Math.round(clampNumber(surfaceHeight * 0.11, 54, 260));
  const continueH = Math.round(clampNumber(newGameH * 1.3, 74, 340));
  const baseSettingsSize = clampNumber(Math.min(surfaceWidth, surfaceHeight) * 0.18, 68, 240);
  const settingsSize = Math.round(clampNumber(baseSettingsSize * 1.3, 88, 312));
  const buttonGap = Math.round(clampNumber(surfaceHeight * 0.028, 12, 56));

  const continueRect = {
    x: Math.floor((surfaceWidth - continueW) / 2),
    y: 0,
    w: continueW,
    h: continueH,
  };

  const noticeW = surfaceWidth - sidePadding * 2;
  const noticeH = Math.round(clampNumber(surfaceHeight * 0.055, 18, 54));
  const minContinueY = bannerRect.y + bannerRect.h + 18;
  const maxContinueY =
    surfaceHeight - topInset - noticeH - 14 - (newGameH + buttonGap + settingsSize + buttonGap);
  const safeMaxContinueY = Math.max(minContinueY, maxContinueY);
  const continueY = Math.round(
    clampNumber(surfaceHeight * 0.5 - continueH / 2, minContinueY, safeMaxContinueY),
  );
  continueRect.y = continueY;

  const newGameRect = {
    x: Math.floor((surfaceWidth - newGameW) / 2),
    y: continueRect.y + continueRect.h + buttonGap,
    w: newGameW,
    h: newGameH,
  };

  const settingsRect = {
    x: Math.floor((surfaceWidth - settingsSize) / 2),
    y: newGameRect.y + newGameRect.h + buttonGap,
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
    continueRect,
    newGameRect,
    settingsRect,
    bannerRect,
    noticeRect,
    sidePadding,
    topInset,
    noticeFontSize: Math.round(clampNumber(surfaceHeight * 0.023, 6, 34)),
    itemRects: [continueRect, newGameRect, settingsRect],
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

  const bannerW = Math.round(clampNumber(surfaceWidth * 0.82, 220, surfaceWidth - sidePadding * 2));
  const bannerH = Math.round(clampNumber(surfaceHeight * 0.16, 74, 260));
  const bannerRect = {
    x: Math.floor((surfaceWidth - bannerW) / 2),
    y: topInset,
    w: bannerW,
    h: bannerH,
  };

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
  const controlGap = Math.round(clampNumber(rowW * 0.016, 6, 18));
  const controlsRightPadding = Math.round(clampNumber(rowW * 0.028, 8, 24));

  const createControlsForRow = (rowRect) => {
    const plusRect = {
      x: rowRect.x + rowRect.w - controlsRightPadding - controlW,
      y: rowRect.y + Math.floor((rowRect.h - controlH) / 2),
      w: controlW,
      h: controlH,
    };
    const minusRect = {
      x: plusRect.x - controlGap - controlW,
      y: plusRect.y,
      w: controlW,
      h: controlH,
    };
    return { minusRect, plusRect };
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
    soundPlusRect: soundControls.plusRect,
    musicMinusRect: musicControls.minusRect,
    musicPlusRect: musicControls.plusRect,
    noticeRect,
    noticeFontSize: Math.round(clampNumber(surfaceHeight * 0.023, 6, 34)),
  };
}

function getGmAuthLayout(surfaceWidth = GAME_CONFIG.width, surfaceHeight = GAME_CONFIG.height) {
  const sidePadding = Math.round(clampNumber(surfaceWidth * 0.06, 12, 90));
  const topInset = Math.round(clampNumber(surfaceHeight * 0.04, 12, 120));

  const bannerW = Math.round(clampNumber(surfaceWidth * 0.82, 220, surfaceWidth - sidePadding * 2));
  const bannerH = Math.round(clampNumber(surfaceHeight * 0.16, 74, 260));
  const bannerRect = {
    x: Math.floor((surfaceWidth - bannerW) / 2),
    y: topInset,
    w: bannerW,
    h: bannerH,
  };

  const titleW = Math.round(clampNumber(surfaceWidth * 0.56, 156, surfaceWidth - sidePadding * 2));
  const titleH = Math.round(clampNumber(surfaceHeight * 0.06, 24, 72));
  const titleRect = {
    x: Math.floor((surfaceWidth - titleW) / 2),
    y: bannerRect.y + bannerRect.h + Math.round(clampNumber(surfaceHeight * 0.02, 8, 26)),
    w: titleW,
    h: titleH,
  };

  const passwordW = Math.round(clampNumber(surfaceWidth * 0.9, 240, surfaceWidth - sidePadding * 2));
  const passwordH = Math.round(clampNumber(surfaceHeight * 0.18, 74, 240));
  const passwordCardRect = {
    x: Math.floor((surfaceWidth - passwordW) / 2),
    y: titleRect.y + titleRect.h + Math.round(clampNumber(surfaceHeight * 0.02, 10, 30)),
    w: passwordW,
    h: passwordH,
  };

  const statusW = passwordW;
  const statusH = Math.round(clampNumber(surfaceHeight * 0.075, 30, 96));
  const statusRect = {
    x: passwordCardRect.x,
    y: passwordCardRect.y + passwordCardRect.h + Math.round(clampNumber(surfaceHeight * 0.014, 8, 22)),
    w: statusW,
    h: statusH,
  };

  const hintW = passwordW;
  const hintH = Math.round(clampNumber(surfaceHeight * 0.075, 30, 96));
  const hintRect = {
    x: passwordCardRect.x,
    y: statusRect.y + statusRect.h + Math.round(clampNumber(surfaceHeight * 0.012, 6, 20)),
    w: hintW,
    h: hintH,
  };

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
    passwordCardRect,
    statusRect,
    hintRect,
    noticeRect,
    noticeFontSize: Math.round(clampNumber(surfaceHeight * 0.023, 6, 34)),
  };
}

function getGmEditLayout(surfaceWidth = GAME_CONFIG.width, surfaceHeight = GAME_CONFIG.height) {
  const sidePadding = Math.round(clampNumber(surfaceWidth * 0.06, 12, 90));
  const topInset = Math.round(clampNumber(surfaceHeight * 0.04, 12, 120));

  const bannerW = Math.round(clampNumber(surfaceWidth * 0.82, 220, surfaceWidth - sidePadding * 2));
  const bannerH = Math.round(clampNumber(surfaceHeight * 0.16, 74, 260));
  const bannerRect = {
    x: Math.floor((surfaceWidth - bannerW) / 2),
    y: topInset,
    w: bannerW,
    h: bannerH,
  };

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
  const helpGap = Math.round(clampNumber(surfaceHeight * 0.016, 8, 24));
  const helpH = Math.round(clampNumber(surfaceHeight * 0.085, 34, 120));
  const rowsStartY = titleRect.y + titleRect.h + Math.round(clampNumber(surfaceHeight * 0.02, 10, 24));
  const rowsCount = GM_EDIT_MENU.length;
  const maxRowsArea = Math.max(
    rowsCount * 30,
    noticeRect.y - helpGap - helpH - rowsStartY - rowGap * (rowsCount - 1),
  );
  const rowH = Math.round(clampNumber(maxRowsArea / rowsCount, 30, 98));
  const rowRects = Array.from({ length: rowsCount }, (_, index) => ({
    x: Math.floor((surfaceWidth - rowW) / 2),
    y: rowsStartY + index * (rowH + rowGap),
    w: rowW,
    h: rowH,
  }));

  const lastRowBottom = rowRects[rowRects.length - 1].y + rowH;
  const helpRect = {
    x: rowRects[0].x,
    y: lastRowBottom + helpGap,
    w: rowW,
    h: helpH,
  };

  return {
    bannerRect,
    titleRect,
    rowRects,
    helpRect,
    noticeRect,
    noticeFontSize: Math.round(clampNumber(surfaceHeight * 0.023, 6, 34)),
  };
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

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
