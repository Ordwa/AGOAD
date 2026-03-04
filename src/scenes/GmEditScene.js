import { Scene } from "../core/Scene.js";
import { GAME_CONFIG } from "../data/constants.js";

const GM_EDIT_THEME = Object.freeze({
  panelTop: "rgba(30, 48, 76, 0.9)",
  panelBottom: "rgba(12, 24, 42, 0.9)",
  panelBorder: "#d79a4a",
  panelInnerBorder: "#40230e",
  textPrimary: "#f6ecd2",
  textSecondary: "#d7c89e",
});

const MAX_GM_ROWS = 2;
const GM_ROW_HEIGHT = 31;
const GM_ROW_START_Y = 34;
const GM_ACTION_CONTROL = Object.freeze({ x: 186, w: 64, h: 16, yOffset: 7 });

export class GmEditScene extends Scene {
  constructor(game) {
    super(game);

    this.returnScene = "settings";
    this.returnPayload = {};
    this.selectedIndex = 0;
    this.statusMessage = "";
    this.actionBusy = false;
    this.uiBackgroundImage = createUiImage("../assets/UI/UI_background.png");

    this.pointerEventsBound = false;
    this.activePointerId = null;
    this.pointerStart = null;
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerCancel.bind(this);
  }

  onEnter(payload = {}) {
    this.returnScene = payload.returnScene ?? "settings";
    this.returnPayload = payload.returnPayload ?? {};
    this.selectedIndex = 0;
    this.statusMessage = "";
    this.actionBusy = false;
    this.bindPointerEvents();
  }

  onExit() {
    this.unbindPointerEvents();
    this.pointerStart = null;
    this.activePointerId = null;
  }

  getNavbarLayout() {
    const settingsReturnScene = String(this.returnPayload?.returnScene ?? "").trim();
    if (settingsReturnScene === "start") {
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

    this.handleTap(point);
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

  handleTap(point) {
    const rows = this.getRows();
    const rowRects = getRowRects(rows.length);
    for (let index = 0; index < rowRects.length; index += 1) {
      const row = rowRects[index];
      if (!pointInRect(point, row.rowRect)) {
        continue;
      }

      this.selectedIndex = index;
      this.activateRow(rows[index]);
      return;
    }
  }

  getRows() {
    return [
      { id: "collimap", label: "COLLIMAP", valueLabel: "APRI" },
      { id: "cutscene_tool", label: "CUTSCENE TOOL", valueLabel: "APRI" },
    ];
  }

  update(_dt, input) {
    const rows = this.getRows();
    if (rows.length <= 0) {
      if (input.wasPressed("back")) {
        this.closeScene();
      }
      return;
    }

    this.selectedIndex = Math.max(0, Math.min(rows.length - 1, this.selectedIndex));

    if (input.wasPressed("back")) {
      this.closeScene();
      return;
    }

    if (input.wasPressed("up")) {
      this.selectedIndex = (this.selectedIndex + rows.length - 1) % rows.length;
      return;
    }

    if (input.wasPressed("down")) {
      this.selectedIndex = (this.selectedIndex + 1) % rows.length;
      return;
    }

    if (input.wasPressed("confirm")) {
      this.activateRow(rows[this.selectedIndex]);
    }
  }

  activateRow(row) {
    if (!row || this.actionBusy) {
      return;
    }

    if (row.id === "collimap") {
      this.openCollimap();
      return;
    }

    if (row.id === "cutscene_tool") {
      this.openCutsceneTool();
    }
  }

  openCollimap() {
    if (typeof window === "undefined") {
      this.statusMessage = "Apertura ColliMap non disponibile qui.";
      return;
    }

    const targetUrl = new URL("./collimap.html", window.location.href).toString();
    try {
      const popup = typeof window.open === "function"
        ? window.open(targetUrl, "_blank", "noopener,noreferrer")
        : null;

      if (!popup) {
        this.statusMessage = "Popup bloccato: consenti popup per aprire ColliMap.";
        return;
      }

      if (typeof popup.focus === "function") {
        popup.focus();
      }
      this.statusMessage = "ColliMap aperto in una nuova scheda.";
    } catch {
      this.statusMessage = "Impossibile aprire ColliMap.";
    }
  }

  openCutsceneTool() {
    if (typeof window === "undefined") {
      this.statusMessage = "Apertura Cutscene Tool non disponibile qui.";
      return;
    }

    const targetUrl = new URL("./cutscene-tool.html", window.location.href).toString();
    try {
      const popup = typeof window.open === "function"
        ? window.open(targetUrl, "_blank", "noopener,noreferrer")
        : null;

      if (!popup) {
        this.statusMessage = "Popup bloccato: consenti popup per aprire Cutscene Tool.";
        return;
      }

      if (typeof popup.focus === "function") {
        popup.focus();
      }
      this.statusMessage = "Cutscene Tool aperto in una nuova scheda.";
    } catch {
      this.statusMessage = "Impossibile aprire Cutscene Tool.";
    }
  }

  closeScene() {
    this.game.changeScene(this.returnScene, this.returnPayload);
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

    const panelY = 26;
    const panelHeight = GAME_CONFIG.height - panelY - 6;
    this.drawPanel(ctx, 6, panelY, GAME_CONFIG.width - 12, panelHeight, { selected: true });
    this.drawRows(ctx);
    this.drawStatus(ctx);
    ctx.restore();
  }

  drawRows(ctx) {
    const rows = this.getRows();
    if (rows.length <= 0) {
      return;
    }

    for (let index = 0; index < MAX_GM_ROWS; index += 1) {
      const y = GM_ROW_START_Y + index * GM_ROW_HEIGHT;
      const row = rows[index];
      if (!row) {
        this.drawPanel(ctx, 12, y, GAME_CONFIG.width - 24, GM_ROW_HEIGHT - 2, { inset: true });
        continue;
      }

      const selected = index === this.selectedIndex;
      this.drawPanel(ctx, 12, y, GAME_CONFIG.width - 24, GM_ROW_HEIGHT - 2, {
        selected,
      });

      ctx.fillStyle = GM_EDIT_THEME.textPrimary;
      ctx.font = "8px monospace";
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillText(row.label, 20, y + Math.floor((GM_ROW_HEIGHT - 8) * 0.5));

      const controlY = y + GM_ACTION_CONTROL.yOffset;
      this.drawActionChip(
        ctx,
        row.valueLabel ?? "APRI",
        GM_ACTION_CONTROL.x,
        controlY,
        GM_ACTION_CONTROL.w,
        GM_ACTION_CONTROL.h,
        selected,
      );
    }
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
    const message = String(this.statusMessage ?? "").trim();
    if (!message) {
      return;
    }

    ctx.fillStyle = GM_EDIT_THEME.textSecondary;
    ctx.font = "7px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(message, 12, GAME_CONFIG.height - 2);
  }

  drawPanel(ctx, x, y, w, h, { inset = false } = {}) {
    const radius = inset ? 4 : 6;
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, GM_EDIT_THEME.panelTop);
    gradient.addColorStop(1, GM_EDIT_THEME.panelBottom);
    ctx.fillStyle = gradient;
    fillRoundedRect(ctx, x, y, w, h, radius);

    ctx.strokeStyle = GM_EDIT_THEME.panelBorder;
    ctx.lineWidth = 2;
    strokeRoundedRect(ctx, x, y, w, h, radius);

    ctx.strokeStyle = GM_EDIT_THEME.panelInnerBorder;
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

function getRowRects(rowCount) {
  const rows = [];
  const safeCount = Math.max(0, Math.min(MAX_GM_ROWS, Number(rowCount) || 0));
  for (let index = 0; index < safeCount; index += 1) {
    const y = GM_ROW_START_Y + GM_ROW_HEIGHT * index;
    rows.push({
      rowRect: { x: 12, y, w: GAME_CONFIG.width - 24, h: GM_ROW_HEIGHT - 2 },
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
