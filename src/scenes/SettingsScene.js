import { Scene } from "../core/Scene.js";
import { GAME_CONFIG } from "../data/constants.js";
import { verifyGmEditPassword } from "../utils/security.js";

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

const ROW_KEYS = Object.freeze(["sound", "music", "gm_edit", "debug_mode"]);
const SETTINGS_ROW_HEIGHT = 30;
const SETTINGS_ROW_START_Y = 38;
const MAX_GM_PASSWORD_LENGTH = 20;

export class SettingsScene extends Scene {
  constructor(game) {
    super(game);
    this.returnScene = "start";
    this.returnPayload = {};
    this.selectedIndex = 0;
    this.gmEditStatus = "";
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
    this.bindPointerEvents();
  }

  onExit() {
    this.unbindPointerEvents();
    this.pointerStart = null;
    this.activePointerId = null;
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
    const scale = Math.max(0.01, Math.min(canvas.width / GAME_CONFIG.width, canvas.height / GAME_CONFIG.height));
    const offsetX = (canvas.width - GAME_CONFIG.width * scale) * 0.5;
    const offsetY = (canvas.height - GAME_CONFIG.height * scale) * 0.5;
    const sceneX = (canvasX - offsetX) / scale;
    const sceneY = (canvasY - offsetY) / scale;
    if (sceneX < 0 || sceneY < 0 || sceneX > GAME_CONFIG.width || sceneY > GAME_CONFIG.height) {
      return null;
    }

    return { x: sceneX, y: sceneY };
  }

  handleSettingsTap(point) {
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

    if (selectedKey === "debug_mode") {
      if (input.wasPressed("left") || input.wasPressed("right") || input.wasPressed("confirm")) {
        this.game.toggleDebugOverlay();
      }
    }
  }

  render(ctx) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawBackground(ctx, canvasWidth, canvasHeight);

    const scale = Math.max(0.01, Math.min(canvasWidth / GAME_CONFIG.width, canvasHeight / GAME_CONFIG.height));
    const offsetX = Math.floor((canvasWidth - GAME_CONFIG.width * scale) * 0.5);
    const offsetY = Math.floor((canvasHeight - GAME_CONFIG.height * scale) * 0.5);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    this.drawPanel(ctx, 6, 32, GAME_CONFIG.width - 12, 142, { selected: true });
    this.drawRows(ctx);
    this.drawStatus(ctx);
    ctx.restore();
  }

  closeScene() {
    this.game.changeScene(this.returnScene, this.returnPayload);
  }

  async openGmEdit() {
    if (typeof window === "undefined" || typeof window.prompt !== "function") {
      this.gmEditStatus = "GM-EDIT non disponibile qui.";
      return;
    }

    const rawPassword = window.prompt("Inserisci password GM-EDIT", "");
    if (rawPassword === null) {
      this.gmEditStatus = "";
      return;
    }

    const password = String(rawPassword ?? "").slice(0, MAX_GM_PASSWORD_LENGTH).trim();
    if (password.length === 0) {
      this.gmEditStatus = "Password richiesta.";
      return;
    }

    this.gmEditStatus = "Verifica in corso...";
    try {
      const isValid = await verifyGmEditPassword(password);
      if (!isValid) {
        this.gmEditStatus = "Password errata.";
        return;
      }
      this.gmEditStatus = "Accesso GM-EDIT autorizzato.";
    } catch {
      this.gmEditStatus = "Verifica non disponibile.";
    }
  }

  drawRows(ctx) {
    const rows = [
      { id: "sound", label: "SOUND", value: this.game.getSoundLevel() },
      { id: "music", label: "MUSIC", value: this.game.getMusicLevel() },
      { id: "gm_edit", label: "GM-EDIT", valueLabel: "APRI" },
      { id: "debug_mode", label: "DEBUG MODE", value: this.game.getDebugOverlayEnabled() ? 1 : 0 },
    ];

    const rowHeight = SETTINGS_ROW_HEIGHT;
    const startY = SETTINGS_ROW_START_Y;
    rows.forEach((row, rowIndex) => {
      const y = startY + rowIndex * rowHeight;
      this.drawPanel(ctx, 12, y, GAME_CONFIG.width - 24, rowHeight - 4, {
        selected: rowIndex === this.selectedIndex,
      });

      ctx.fillStyle = SETTINGS_THEME.textPrimary;
      ctx.font = "8px monospace";
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillText(row.label, 20, y + 7);

      if (row.id === "gm_edit") {
        this.drawActionChip(ctx, row.valueLabel ?? "APRI", 184, y + 4, 68, 18, rowIndex === this.selectedIndex);
        return;
      }

      if (row.id === "debug_mode") {
        this.drawDebugModeSwitch(ctx, row.value > 0, 184, y + 4, 68, 18, rowIndex === this.selectedIndex);
        return;
      }

      this.drawSlider(ctx, row.value, 5, 128, y + 8, 124, 16);
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
    ctx.font = "8px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText(`${value}/${maxValue}`, x + width - 4, y + 3);
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
    ctx.font = "8px monospace";
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

    ctx.fillStyle = SETTINGS_THEME.textSecondary;
    ctx.font = "7px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(message, 12, 176);
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
  const startY = SETTINGS_ROW_START_Y;
  const rows = [];

  for (let index = 0; index < ROW_KEYS.length; index += 1) {
    const y = startY + rowHeight * index;
    const rowId = ROW_KEYS[index];
    const valueRect =
      rowId === "sound" || rowId === "music"
        ? { x: 128, y: y + 8, w: 124, h: 16 }
        : { x: 184, y: y + 4, w: 68, h: 18 };
    rows.push({
      id: rowId,
      rowRect: { x: 12, y, w: GAME_CONFIG.width - 24, h: rowHeight - 4 },
      valueRect,
    });
  }

  return rows;
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
