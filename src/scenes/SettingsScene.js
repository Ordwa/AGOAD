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

const ROW_KEYS = Object.freeze(["sound", "music", "debug"]);

export class SettingsScene extends Scene {
  constructor(game) {
    super(game);
    this.returnScene = "start";
    this.returnPayload = {};
    this.selectedIndex = 0;
    this.uiBackgroundImage = createUiImage("../assets/UI/UI_background.png");
  }

  onEnter(payload = {}) {
    this.returnScene = payload.returnScene ?? "start";
    this.returnPayload = payload.returnPayload ?? {};
    this.selectedIndex = 0;
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
      visibleTabIds: ["settings", "profile", "bag", "slot_b"],
      activeTabId: "settings",
    };
  }

  closeFromNavbar() {
    this.closeScene();
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

    if (selectedKey === "debug") {
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
    ctx.restore();
  }

  closeScene() {
    this.game.changeScene(this.returnScene, this.returnPayload);
  }

  drawRows(ctx) {
    const rows = [
      { id: "sound", label: "SOUND", value: this.game.getSoundLevel() },
      { id: "music", label: "MUSIC", value: this.game.getMusicLevel() },
      { id: "debug", label: "DEBUG", value: this.game.getDebugOverlayEnabled() ? 1 : 0 },
    ];

    const rowHeight = 38;
    const startY = 44;
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

      if (row.id === "debug") {
        this.drawToggle(ctx, row.value > 0, 188, y + 8, 64, 18);
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

  drawToggle(ctx, enabled, x, y, width, height) {
    this.drawPanel(ctx, x, y, width, height, { inset: true });
    ctx.fillStyle = enabled ? SETTINGS_THEME.toggleOn : SETTINGS_THEME.toggleOff;
    ctx.fillRect(x + 3, y + 3, width - 6, height - 6);
    ctx.fillStyle = enabled ? "#16351e" : "#1d2431";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(enabled ? "ON" : "OFF", x + Math.round(width * 0.5), y + Math.round(height * 0.5) + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  drawPanel(ctx, x, y, w, h, { selected = false, inset = false } = {}) {
    const radius = inset ? 4 : 6;
    const top = selected ? SETTINGS_THEME.panelSelectedTop : SETTINGS_THEME.panelTop;
    const bottom = selected ? SETTINGS_THEME.panelSelectedBottom : SETTINGS_THEME.panelBottom;

    ctx.fillStyle = SETTINGS_THEME.panelShadow;
    ctx.fillRect(x + 2, y + 2, w, h);

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
