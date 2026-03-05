import { Scene } from "../core/Scene.js";
import { GAME_CONFIG } from "../data/constants.js";

const SETTINGS_THEME = Object.freeze({
  panelTop: "rgba(30, 48, 76, 0.9)",
  panelBottom: "rgba(12, 24, 42, 0.9)",
  panelSelectedTop: "rgba(62, 90, 132, 0.92)",
  panelSelectedBottom: "rgba(31, 50, 78, 0.92)",
  panelBorder: "#d79a4a",
  panelInnerBorder: "#40230e",
  panelShadow: "rgba(0, 0, 0, 0.48)",
  textPrimary: "#f6ecd2",
  textSecondary: "#d7c89e",
  sliderBg: "rgba(15, 26, 44, 0.9)",
  sliderFill: "#6cb9f4",
  toggleOff: "#5b6575",
  toggleOn: "#6fd17e",
});

const ROW_KEYS = Object.freeze(["sound", "music", "gm_edit", "debug_mode", "logout", "clear_data"]);
const SETTINGS_ROW_HEIGHT = 31;
const SETTINGS_ROW_START_Y = 24;
const SETTINGS_ACTION_CONTROL = Object.freeze({ x: 186, yOffset: 7, w: 64, h: 16 });
const SETTINGS_SLIDER_CONTROL = Object.freeze({ x: 126, yOffset: 8, w: 124, h: 14 });
let ACTIVE_SETTINGS_LOGICAL_HEIGHT = GAME_CONFIG.height;
let ACTIVE_SETTINGS_ROW_START_Y = SETTINGS_ROW_START_Y;

export class SettingsScene extends Scene {
  constructor(game) {
    super(game);
    this.returnScene = "start";
    this.returnPayload = {};
    this.selectedIndex = 0;
    this.gmEditStatus = "";
    this.actionBusy = false;
    this.clearDataPopup = null;
    this.uiBackgroundImage = createUiImage("../assets/UI/UI_background.png");

    this.pointerEventsBound = false;
    this.activePointerId = null;
    this.pointerStart = null;
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerCancel.bind(this);
  }

  onEnter(payload = {}) {
    this.returnScene = payload.returnScene ?? "start";
    this.returnPayload = payload.returnPayload ?? {};
    this.selectedIndex = 0;
    this.gmEditStatus = "";
    this.actionBusy = false;
    this.clearDataPopup = null;
    this.bindPointerEvents();
  }

  onExit() {
    this.unbindPointerEvents();
    this.pointerStart = null;
    this.activePointerId = null;
    this.clearDataPopup = null;
  }

  getNavbarLayout() {
    if (this.returnScene === "start") {
      return {
        visible: true,
        topbarVisible: true,
        controlsVisible: false,
        visibleTabIds: ["slot_b"],
        activeTabId: "slot_b",
      };
    }

    return {
      visible: true,
      topbarVisible: true,
      controlsVisible: false,
      visibleTabIds: ["settings", "profile", "bag", "slot_a", "slot_b"],
      activeTabId: "settings",
    };
  }

  closeFromNavbar() {
    this.closeScene();
  }

  bindPointerEvents() {
    if (this.pointerEventsBound) {
      return;
    }

    const canvas = this.game?.canvas;
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
    this.pointerEventsBound = true;
  }

  unbindPointerEvents() {
    if (!this.pointerEventsBound) {
      return;
    }

    const canvas = this.game?.canvas;
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }

    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.pointerEventsBound = false;
  }

  onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    this.activePointerId = event.pointerId;
    this.pointerStart = { x: event.clientX, y: event.clientY };
    this.game.canvas.setPointerCapture?.(event.pointerId);
  }

  onPointerUp(event) {
    if (this.activePointerId !== event.pointerId || !this.pointerStart) {
      return;
    }

    const deltaX = event.clientX - this.pointerStart.x;
    const deltaY = event.clientY - this.pointerStart.y;
    const moved = Math.hypot(deltaX, deltaY) > 10;

    this.pointerStart = null;
    this.activePointerId = null;
    this.game.canvas.releasePointerCapture?.(event.pointerId);

    if (moved) {
      return;
    }

    const point = this.resolveScenePointFromPointer(event);
    if (!point) {
      return;
    }

    this.handleSettingsTap(point);
  }

  onPointerCancel(event) {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.pointerStart = null;
    this.activePointerId = null;
    this.game.canvas.releasePointerCapture?.(event.pointerId);
  }

  resolveScenePointFromPointer(event) {
    const canvas = this.game?.canvas;
    if (!(canvas instanceof HTMLCanvasElement)) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const canvasX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const canvasY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const logicalHeight = computeSettingsLogicalHeight(canvas.width, canvas.height);
    ACTIVE_SETTINGS_ROW_START_Y = computeSettingsRowStartY(logicalHeight);
    const scale = Math.max(0.01, Math.min(canvas.width / GAME_CONFIG.width, canvas.height / logicalHeight));
    const offsetX = (canvas.width - GAME_CONFIG.width * scale) * 0.5;
    const offsetY = (canvas.height - logicalHeight * scale) * 0.5;
    const sceneX = (canvasX - offsetX) / scale;
    const sceneY = (canvasY - offsetY) / scale;
    if (sceneX < 0 || sceneY < 0 || sceneX > GAME_CONFIG.width || sceneY > logicalHeight) {
      return null;
    }

    return { x: sceneX, y: sceneY };
  }

  handleSettingsTap(point) {
    if (this.clearDataPopup) {
      this.handleClearDataPopupTap(point);
      return;
    }

    const rowRects = getSettingsRowRects();
    for (let rowIndex = 0; rowIndex < rowRects.length; rowIndex += 1) {
      const row = rowRects[rowIndex];
      if (!pointInRect(point, row.rowRect)) {
        continue;
      }

      this.selectedIndex = rowIndex;
      if (row.id === "gm_edit") {
        this.openGmEdit();
        return;
      }

      if (row.id === "logout") {
        this.startLogoutFlow();
        return;
      }

      if (row.id === "clear_data") {
        this.openClearDataPopup();
        return;
      }

      if (row.id === "debug_mode") {
        this.game.toggleDebugOverlay();
        return;
      }

      if (pointInRect(point, row.valueRect)) {
        const sliderRatio = clamp((point.x - row.valueRect.x) / row.valueRect.w, 0, 1);
        const nextValue = Math.round(sliderRatio * 5);
        if (row.id === "sound") {
          this.game.setSoundLevel(nextValue);
        } else {
          this.game.setMusicLevel(nextValue);
        }
        return;
      }

      const delta = point.x < row.valueRect.x + row.valueRect.w * 0.5 ? -1 : 1;
      if (row.id === "sound") {
        this.game.shiftSoundLevel(delta);
      } else {
        this.game.shiftMusicLevel(delta);
      }
      return;
    }
  }

  update(_dt, input) {
    if (this.clearDataPopup) {
      this.updateClearDataPopup(input);
      return;
    }

    if (input.wasPressed("back")) {
      this.closeScene();
      return;
    }

    if (input.wasPressed("up")) {
      this.selectedIndex = (this.selectedIndex + ROW_KEYS.length - 1) % ROW_KEYS.length;
      return;
    }

    if (input.wasPressed("down")) {
      this.selectedIndex = (this.selectedIndex + 1) % ROW_KEYS.length;
      return;
    }

    const selectedKey = ROW_KEYS[this.selectedIndex];
    if (selectedKey === "sound") {
      if (input.wasPressed("left")) {
        this.game.shiftSoundLevel(-1);
        return;
      }
      if (input.wasPressed("right")) {
        this.game.shiftSoundLevel(1);
        return;
      }
    }

    if (selectedKey === "music") {
      if (input.wasPressed("left")) {
        this.game.shiftMusicLevel(-1);
        return;
      }
      if (input.wasPressed("right")) {
        this.game.shiftMusicLevel(1);
        return;
      }
    }

    if (selectedKey === "gm_edit") {
      if (input.wasPressed("confirm")) {
        this.openGmEdit();
      }
      return;
    }

    if (selectedKey === "logout") {
      if (input.wasPressed("confirm")) {
        this.startLogoutFlow();
      }
      return;
    }

    if (selectedKey === "clear_data") {
      if (input.wasPressed("confirm")) {
        this.openClearDataPopup();
      }
      return;
    }

    if (selectedKey === "debug_mode") {
      if (input.wasPressed("left") || input.wasPressed("right") || input.wasPressed("confirm")) {
        this.game.toggleDebugOverlay();
      }
    }
  }

  render(ctx) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;
    ACTIVE_SETTINGS_LOGICAL_HEIGHT = computeSettingsLogicalHeight(canvasWidth, canvasHeight);
    ACTIVE_SETTINGS_ROW_START_Y = computeSettingsRowStartY(ACTIVE_SETTINGS_LOGICAL_HEIGHT);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawBackground(ctx, canvasWidth, canvasHeight);

    const scale = Math.max(
      0.01,
      Math.min(canvasWidth / GAME_CONFIG.width, canvasHeight / ACTIVE_SETTINGS_LOGICAL_HEIGHT),
    );
    const offsetX = Math.floor((canvasWidth - GAME_CONFIG.width * scale) * 0.5);
    const offsetY = Math.floor((canvasHeight - ACTIVE_SETTINGS_LOGICAL_HEIGHT * scale) * 0.5);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    const panelPaddingY = 8;
    const rowsHeight = ROW_KEYS.length * SETTINGS_ROW_HEIGHT;
    const panelY = Math.max(6, ACTIVE_SETTINGS_ROW_START_Y - panelPaddingY);
    const panelHeight = rowsHeight + panelPaddingY * 2;
    this.drawPanel(ctx, 6, panelY, GAME_CONFIG.width - 12, panelHeight, { selected: true });
    this.drawRows(ctx);
    this.drawStatus(ctx);
    this.drawClearDataPopup(ctx);
    ctx.restore();
  }

  closeScene() {
    this.game.changeScene(this.returnScene, this.returnPayload);
  }

  openGmEdit() {
    if (this.actionBusy) {
      return;
    }
    this.gmEditStatus = "";
    this.game.changeScene("gm_edit", {
      returnScene: "settings",
      returnPayload: {
        returnScene: this.returnScene,
        returnPayload: this.returnPayload,
      },
    });
  }

  startLogoutFlow() {
    if (this.actionBusy) {
      return;
    }

    this.actionBusy = true;
    this.gmEditStatus = "Logout in corso...";
    this.game
      .signOutAccount()
      .then((result) => {
        if (!result.ok) {
          this.gmEditStatus = result.error ?? this.game.getLastSyncError() ?? "Logout fallito.";
          return;
        }

        this.game.changeScene("start", { startMode: "auth" });
      })
      .catch((error) => {
        this.gmEditStatus = error instanceof Error ? error.message : "Logout fallito.";
      })
      .finally(() => {
        this.actionBusy = false;
      });
  }

  startClearDataFlow() {
    if (this.actionBusy) {
      return;
    }

    this.clearDataPopup = null;
    this.actionBusy = true;
    this.gmEditStatus = "Cancellazione dati in corso...";
    this.game
      .clearProfileProgress()
      .then((result) => {
        if (!result.ok) {
          this.gmEditStatus = result.error ?? "Cancellazione dati fallita.";
          return;
        }

        this.game.changeScene("start", { startMode: "main" });
      })
      .catch((error) => {
        this.gmEditStatus = error instanceof Error ? error.message : "Cancellazione dati fallita.";
      })
      .finally(() => {
        this.actionBusy = false;
      });
  }

  openClearDataPopup() {
    if (this.actionBusy) {
      return;
    }

    this.clearDataPopup = {
      confirmIndex: 1,
    };
  }

  updateClearDataPopup(input) {
    if (!this.clearDataPopup) {
      return;
    }

    if (input.wasPressed("back")) {
      this.clearDataPopup = null;
      return;
    }

    if (input.wasPressed("left") || input.wasPressed("up")) {
      this.clearDataPopup.confirmIndex = 0;
      return;
    }

    if (input.wasPressed("right") || input.wasPressed("down")) {
      this.clearDataPopup.confirmIndex = 1;
      return;
    }

    if (!input.wasPressed("confirm")) {
      return;
    }

    if (this.clearDataPopup.confirmIndex === 0) {
      this.startClearDataFlow();
      return;
    }

    this.clearDataPopup = null;
  }

  getClearDataPopupLayout() {
    const popupW = GAME_CONFIG.width - 40;
    const popupH = 78;
    const popupX = Math.floor((GAME_CONFIG.width - popupW) * 0.5);
    const popupY = Math.floor((ACTIVE_SETTINGS_LOGICAL_HEIGHT - popupH) * 0.5);
    const buttonGap = 6;
    const buttonW = Math.floor((popupW - 24 - buttonGap) * 0.5);
    const buttonH = 16;
    const buttonY = popupY + popupH - buttonH - 8;
    const buttonX = popupX + 12;
    return {
      frameRect: { x: popupX, y: popupY, w: popupW, h: popupH },
      confirmRect: { x: buttonX, y: buttonY, w: buttonW, h: buttonH },
      cancelRect: { x: buttonX + buttonW + buttonGap, y: buttonY, w: buttonW, h: buttonH },
    };
  }

  handleClearDataPopupTap(point) {
    if (!this.clearDataPopup) {
      return;
    }

    const popupLayout = this.getClearDataPopupLayout();
    if (!popupLayout) {
      return;
    }

    if (!pointInRect(point, popupLayout.frameRect)) {
      this.clearDataPopup = null;
      return;
    }

    if (pointInRect(point, popupLayout.cancelRect)) {
      this.clearDataPopup.confirmIndex = 1;
      this.clearDataPopup = null;
      return;
    }

    if (pointInRect(point, popupLayout.confirmRect)) {
      this.clearDataPopup.confirmIndex = 0;
      this.startClearDataFlow();
    }
  }

  drawRows(ctx) {
    const rows = [
      { id: "sound", label: "SOUND", value: this.game.getSoundLevel() },
      { id: "music", label: "MUSIC", value: this.game.getMusicLevel() },
      { id: "gm_edit", label: "GM-EDIT", valueLabel: "APRI" },
      { id: "debug_mode", label: "DEBUG MODE", value: this.game.getDebugOverlayEnabled() ? 1 : 0 },
      { id: "logout", label: "LOGOUT", valueLabel: "ESCI" },
      { id: "clear_data", label: "CANCELLA DATI", valueLabel: "ELIMINA" },
    ];

    const rowHeight = SETTINGS_ROW_HEIGHT;
    const startY = ACTIVE_SETTINGS_ROW_START_Y;
    rows.forEach((row, rowIndex) => {
      const y = startY + rowIndex * rowHeight;
      this.drawPanel(ctx, 12, y, GAME_CONFIG.width - 24, rowHeight - 2, {
        selected: rowIndex === this.selectedIndex,
      });

      ctx.fillStyle = SETTINGS_THEME.textPrimary;
      ctx.font = "8px monospace";
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillText(row.label, 20, y + Math.floor((rowHeight - 8) * 0.5));

      const valueRect = getRowControlRect(row.id, y);

      if (row.id === "gm_edit") {
        this.drawActionChip(
          ctx,
          row.valueLabel ?? "APRI",
          valueRect.x,
          valueRect.y,
          valueRect.w,
          valueRect.h,
          rowIndex === this.selectedIndex,
        );
        return;
      }

      if (row.id === "debug_mode") {
        this.drawDebugModeSwitch(
          ctx,
          row.value > 0,
          valueRect.x,
          valueRect.y,
          valueRect.w,
          valueRect.h,
          rowIndex === this.selectedIndex,
        );
        return;
      }

      if (row.id === "logout" || row.id === "clear_data") {
        this.drawActionChip(
          ctx,
          row.valueLabel ?? "APRI",
          valueRect.x,
          valueRect.y,
          valueRect.w,
          valueRect.h,
          rowIndex === this.selectedIndex,
        );
        return;
      }

      this.drawSlider(ctx, row.value, 5, valueRect.x, valueRect.y, valueRect.w, valueRect.h);
    });
  }

  drawSlider(ctx, value, maxValue, x, y, width, height) {
    const ratio = Math.max(0, Math.min(1, (Number(value) || 0) / Math.max(1, maxValue)));
    this.drawPanel(ctx, x, y, width, height, { inset: true });

    ctx.fillStyle = SETTINGS_THEME.sliderBg;
    ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
    ctx.fillStyle = SETTINGS_THEME.sliderFill;
    ctx.fillRect(x + 3, y + 3, Math.floor((width - 6) * ratio), height - 6);

    ctx.fillStyle = SETTINGS_THEME.textPrimary;
    ctx.font = "7px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`${value}/${maxValue}`, x + width - 3, y + 2);
    ctx.textAlign = "left";
  }

  drawDebugModeSwitch(ctx, enabled, x, y, width, height, selected = false) {
    const radius = Math.round(height / 2);
    ctx.fillStyle = enabled ? SETTINGS_THEME.toggleOn : SETTINGS_THEME.toggleOff;
    fillRoundedRect(ctx, x, y, width, height, radius);
    ctx.strokeStyle = selected ? "rgba(188, 217, 255, 0.95)" : "rgba(130, 168, 224, 0.76)";
    ctx.lineWidth = 2;
    strokeRoundedRect(ctx, x, y, width, height, radius);

    const knobSize = Math.max(10, Math.round(height * 0.74));
    const knobMargin = Math.round((height - knobSize) / 2);
    const knobX = enabled ? x + width - knobSize - knobMargin : x + knobMargin;
    const knobY = y + knobMargin;
    ctx.fillStyle = "#f7fbff";
    fillRoundedRect(ctx, knobX, knobY, knobSize, knobSize, Math.round(knobSize / 2));
    ctx.strokeStyle = "rgba(31, 51, 76, 0.7)";
    ctx.lineWidth = 1;
    strokeRoundedRect(ctx, knobX, knobY, knobSize, knobSize, Math.round(knobSize / 2));
  }

  drawActionChip(ctx, label, x, y, width, height, selected = false) {
    this.drawPanel(ctx, x, y, width, height, { inset: true });
    ctx.fillStyle = selected ? "rgba(31, 69, 110, 0.95)" : "rgba(14, 36, 61, 0.9)";
    fillRoundedRect(ctx, x + 3, y + 3, width - 6, height - 6, 4);
    ctx.fillStyle = "#f6ecd2";
    ctx.font = "7px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(label ?? "APRI"), x + Math.round(width * 0.5), y + Math.round(height * 0.5) + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  drawStatus(ctx) {
    const message = String(this.gmEditStatus ?? "").trim();
    if (!message) {
      return;
    }

    const boxX = 12;
    const boxY = Math.max(6, ACTIVE_SETTINGS_ROW_START_Y - 18);
    const boxW = GAME_CONFIG.width - 24;
    const boxH = 16;
    this.drawPanel(ctx, boxX, boxY, boxW, boxH, { inset: true });

    ctx.fillStyle = SETTINGS_THEME.textSecondary;
    ctx.font = "7px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const maxChars = Math.max(14, Math.floor((boxW - 12) / 4.6));
    const clippedMessage =
      message.length > maxChars ? `${message.slice(0, Math.max(0, maxChars - 3))}...` : message;
    ctx.fillText(clippedMessage, boxX + Math.floor(boxW * 0.5), boxY + Math.floor(boxH * 0.5) + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  drawClearDataPopup(ctx) {
    if (!this.clearDataPopup) {
      return;
    }

    const popupLayout = this.getClearDataPopupLayout();
    if (!popupLayout) {
      return;
    }

    ctx.fillStyle = "#00000099";
    ctx.fillRect(0, 0, GAME_CONFIG.width, ACTIVE_SETTINGS_LOGICAL_HEIGHT);
    this.drawBattleStylePanel(
      ctx,
      popupLayout.frameRect.x,
      popupLayout.frameRect.y,
      popupLayout.frameRect.w,
      popupLayout.frameRect.h,
    );

    ctx.fillStyle = "#f6ecd2";
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText("CANCELLA DATI", popupLayout.frameRect.x + 8, popupLayout.frameRect.y + 6);

    const lines = wrapText("Questa azione elimina tutti i progressi. Confermi?", 40).slice(0, 3);
    ctx.fillStyle = "#d7c89e";
    lines.forEach((line, index) => {
      ctx.fillText(line, popupLayout.frameRect.x + 8, popupLayout.frameRect.y + 18 + index * 8);
    });

    this.drawBattleStyleActionChip(
      ctx,
      "ELIMINA",
      popupLayout.confirmRect.x,
      popupLayout.confirmRect.y,
      popupLayout.confirmRect.w,
      popupLayout.confirmRect.h,
      this.clearDataPopup.confirmIndex === 0,
    );
    this.drawBattleStyleActionChip(
      ctx,
      "ANNULLA",
      popupLayout.cancelRect.x,
      popupLayout.cancelRect.y,
      popupLayout.cancelRect.w,
      popupLayout.cancelRect.h,
      this.clearDataPopup.confirmIndex === 1,
    );
  }

  drawBattleStylePanel(ctx, x, y, w, h) {
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, "rgba(30, 48, 76, 0.95)");
    gradient.addColorStop(1, "rgba(12, 24, 42, 0.95)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#d79a4a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = "#40230e";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  drawBattleStyleActionChip(ctx, label, x, y, width, height, selected = false) {
    this.drawBattleStylePanel(ctx, x, y, width, height);
    ctx.fillStyle = selected ? "rgba(31, 69, 110, 0.95)" : "rgba(14, 36, 61, 0.9)";
    ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
    ctx.fillStyle = "#f6ecd2";
    ctx.font = "7px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(label ?? "OK"), x + Math.round(width * 0.5), y + Math.round(height * 0.5) + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  drawPanel(ctx, x, y, w, h, { selected = false, inset = false } = {}) {
    const radius = inset ? 4 : 6;
    const top = SETTINGS_THEME.panelTop;
    const bottom = SETTINGS_THEME.panelBottom;

    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    fillRoundedRect(ctx, x, y, w, h, radius);

    ctx.strokeStyle = SETTINGS_THEME.panelBorder;
    ctx.lineWidth = 2;
    strokeRoundedRect(ctx, x, y, w, h, radius);

    ctx.strokeStyle = SETTINGS_THEME.panelInnerBorder;
    ctx.lineWidth = 1;
    strokeRoundedRect(ctx, x + 1, y + 1, w - 2, h - 2, Math.max(3, radius - 1));
  }

  drawBackground(ctx, width, height) {
    if (
      this.uiBackgroundImage &&
      this.uiBackgroundImage.complete &&
      this.uiBackgroundImage.naturalWidth > 0
    ) {
      drawImageCover(ctx, this.uiBackgroundImage, 0, 0, width, height);
      return;
    }

    ctx.fillStyle = "#0f1116";
    ctx.fillRect(0, 0, width, height);
  }
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

function fillRoundedRect(ctx, x, y, w, h, radius) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function strokeRoundedRect(ctx, x, y, w, h, radius) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.stroke();
}

function getSettingsRowRects() {
  const rowHeight = SETTINGS_ROW_HEIGHT;
  const startY = ACTIVE_SETTINGS_ROW_START_Y;
  const rows = [];

  for (let index = 0; index < ROW_KEYS.length; index += 1) {
    const y = startY + rowHeight * index;
    const rowId = ROW_KEYS[index];
    const valueRect = getRowControlRect(rowId, y);
    rows.push({
      id: rowId,
      rowRect: { x: 12, y, w: GAME_CONFIG.width - 24, h: rowHeight - 2 },
      valueRect,
    });
  }

  return rows;
}

function getRowControlRect(rowId, rowY) {
  if (rowId === "sound" || rowId === "music") {
    return {
      x: SETTINGS_SLIDER_CONTROL.x,
      y: rowY + SETTINGS_SLIDER_CONTROL.yOffset,
      w: SETTINGS_SLIDER_CONTROL.w,
      h: SETTINGS_SLIDER_CONTROL.h,
    };
  }

  return {
    x: SETTINGS_ACTION_CONTROL.x,
    y: rowY + SETTINGS_ACTION_CONTROL.yOffset,
    w: SETTINGS_ACTION_CONTROL.w,
    h: SETTINGS_ACTION_CONTROL.h,
  };
}

function pointInRect(point, rect) {
  if (!point || !rect) {
    return false;
  }

  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function computeSettingsLogicalHeight(canvasWidth, canvasHeight) {
  const safeWidth = Math.max(1, Number(canvasWidth) || GAME_CONFIG.width);
  const safeHeight = Math.max(1, Number(canvasHeight) || GAME_CONFIG.height);
  return Math.max(GAME_CONFIG.height, Math.round((safeHeight * GAME_CONFIG.width) / safeWidth));
}

function computeSettingsRowStartY(logicalHeight) {
  const safeHeight = Math.max(GAME_CONFIG.height, Number(logicalHeight) || GAME_CONFIG.height);
  const rowsHeight = ROW_KEYS.length * SETTINGS_ROW_HEIGHT;
  return Math.max(SETTINGS_ROW_START_Y, Math.floor((safeHeight - rowsHeight) * 0.5));
}

function wrapText(text, maxCharsPerLine) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length <= 0) {
    return [""];
  }

  const words = normalized.split(" ");
  const lines = [];
  let currentLine = "";
  words.forEach((word) => {
    const candidate = currentLine.length > 0 ? `${currentLine} ${word}` : word;
    if (candidate.length > maxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }
    currentLine = candidate;
  });

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}
