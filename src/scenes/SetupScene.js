import { Scene } from "../core/Scene.js";
import { GAME_CONFIG } from "../data/constants.js";

const MAX_NAME_LENGTH = 12;
const SETUP_TAP_MAX_DISTANCE = 12;

export class SetupScene extends Scene {
  constructor(game) {
    super(game);
    this.step = "name";
    this.nameBuffer = "";
    this.infoText = "";
    this.timer = 0;
    this.uiBackgroundImage = createUiImage("../assets/UI/UI_background.png");
    this.titleBannerImage = createUiImage("../assets/UI/UI_title_banner.png");

    this.pointerEventsBound = false;
    this.activePointerId = null;
    this.pointerStart = null;
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerCancel.bind(this);
  }

  onEnter() {
    this.game.syncPlayerClassData();
    const player = this.game.state.player;
    this.step = "name";
    this.nameBuffer = (player.name ?? "").slice(0, MAX_NAME_LENGTH);
    this.infoText = "";
    this.timer = 0;
    this.game.input.setTextCapture(true);
    this.bindPointerEvents();
  }

  onExit() {
    this.game.input.setTextCapture(false);
    this.unbindPointerEvents();
    this.pointerStart = null;
    this.activePointerId = null;
  }

  update(dt, input) {
    this.timer += dt;

    if (!this.areCoreUiAssetsReady()) {
      input.consumeTypedChars();
      input.consumeBackspaceCount();
      return;
    }

    this.updateNameStep(input);
  }

  updateNameStep(input) {
    const typedChars = input.consumeTypedChars();
    typedChars.forEach((char) => {
      if (this.nameBuffer.length >= MAX_NAME_LENGTH) {
        return;
      }

      if (!/^[a-zA-Z0-9]$/.test(char)) {
        return;
      }

      this.nameBuffer += char;
    });

    const backspaceCount = input.consumeBackspaceCount();
    if (backspaceCount > 0) {
      this.nameBuffer = this.nameBuffer.slice(0, Math.max(0, this.nameBuffer.length - backspaceCount));
    }

    if (input.wasPressed("confirm")) {
      this.submitName();
    }

    if (input.wasPressed("back")) {
      this.handleBackAction();
    }
  }

  render(ctx) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;
    if (!this.areCoreUiAssetsReady()) {
      this.drawUiLoadingScreen(ctx, canvasWidth, canvasHeight);
      return;
    }

    const layout = getSetupLayout(canvasWidth, canvasHeight);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawBackground(ctx, canvasWidth, canvasHeight);
    this.drawTitle(ctx, layout);
    this.drawNamePanel(ctx, layout);
    this.drawActionButtons(ctx, layout);
    ctx.restore();
  }

  submitName() {
    const trimmed = this.nameBuffer.trim();
    if (trimmed.length === 0) {
      this.infoText = "Inserisci un nome per continuare.";
      return;
    }

    this.nameBuffer = trimmed;
    this.game.state.player.name = this.nameBuffer;
    this.game.syncPlayerClassData();
    this.game.changeScene("world", {
      resetToSpawn: true,
      safeSteps: 5,
      saveAfterEnter: true,
      dialogId: "intro",
      message: `${this.nameBuffer} il GOBLIN e' pronto all'avventura.`,
    });
  }

  handleBackAction() {
    this.game.changeScene("start");
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
      this.pointerEventsBound = false;
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

    event.preventDefault();
    this.activePointerId = event.pointerId;
    this.pointerStart = { x: event.clientX, y: event.clientY };
    this.game.canvas.setPointerCapture?.(event.pointerId);
  }

  onPointerUp(event) {
    if (this.activePointerId !== event.pointerId || !this.pointerStart) {
      return;
    }

    event.preventDefault();

    const deltaX = event.clientX - this.pointerStart.x;
    const deltaY = event.clientY - this.pointerStart.y;
    const moved = Math.hypot(deltaX, deltaY) > SETUP_TAP_MAX_DISTANCE;

    this.pointerStart = null;
    this.activePointerId = null;
    this.game.canvas.releasePointerCapture?.(event.pointerId);

    if (moved) {
      return;
    }

    const point = this.resolvePointerCanvasPoint(event);
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

  resolvePointerCanvasPoint(event) {
    const canvas = this.game?.canvas;
    if (!(canvas instanceof HTMLCanvasElement)) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) {
      return null;
    }

    return { x, y };
  }

  handleTap(point) {
    if (!this.areCoreUiAssetsReady()) {
      return;
    }

    const canvas = this.game?.canvas;
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }
    const layout = getSetupLayout(canvas.width, canvas.height);
    const buttons = layout.actionButtons;
    if (pointInRect(point, buttons.back)) {
      this.handleBackAction();
      return;
    }
    if (pointInRect(point, buttons.confirm)) {
      this.submitName();
    }
  }

  getCoreUiImages() {
    return [this.uiBackgroundImage, this.titleBannerImage];
  }

  areCoreUiAssetsReady() {
    return this.getCoreUiImages().every((image) => isUiImageSettled(image));
  }

  drawUiLoadingScreen(ctx, surfaceWidth, surfaceHeight) {
    const spinnerSize = Math.round(clampNumber(Math.min(surfaceWidth, surfaceHeight) * 0.13, 28, 86));
    const spinnerStroke = Math.max(4, Math.round(spinnerSize * 0.13));
    const spinnerRadius = Math.round((spinnerSize - spinnerStroke) / 2);
    const centerX = Math.round(surfaceWidth * 0.5);
    const centerY = Math.round(surfaceHeight * 0.5);
    const spinAngle = (this.timer * Math.PI * 2) / 0.9;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#0f1116";
    ctx.fillRect(0, 0, surfaceWidth, surfaceHeight);

    ctx.beginPath();
    ctx.arc(centerX, centerY, spinnerRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(130, 168, 224, 0.26)";
    ctx.lineWidth = spinnerStroke;
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, spinnerRadius, spinAngle, spinAngle + Math.PI * 1.45);
    ctx.strokeStyle = "#b1ccff";
    ctx.lineWidth = spinnerStroke;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
  }

  drawBackground(ctx, surfaceWidth = GAME_CONFIG.width, surfaceHeight = GAME_CONFIG.height) {
    if (isUiImageUsable(this.uiBackgroundImage)) {
      drawImageCover(ctx, this.uiBackgroundImage, 0, 0, surfaceWidth, surfaceHeight);
      return;
    }

    ctx.fillStyle = "#0f1116";
    ctx.fillRect(0, 0, surfaceWidth, surfaceHeight);
  }

  drawTitle(ctx, layout) {
    if (isUiImageUsable(this.titleBannerImage)) {
      drawImageCover(
        ctx,
        this.titleBannerImage,
        layout.bannerRect.x,
        layout.bannerRect.y,
        layout.bannerRect.w,
        layout.bannerRect.h,
      );
      return;
    }

    this.drawSetupCard(ctx, layout.bannerRect, false);
  }

  drawNamePanel(ctx, layout) {
    this.drawSetupCard(ctx, layout.nameRect, this.step === "name");

    ctx.fillStyle = "#e6f2ff";
    ctx.font = `${Math.round(clampNumber(layout.nameRect.h * 0.2, 10, 30))}px monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      "NOME PERSONAGGIO",
      layout.nameRect.x + Math.round(clampNumber(layout.nameRect.w * 0.05, 10, 34)),
      layout.nameRect.y + Math.round(clampNumber(layout.nameRect.h * 0.11, 8, 20)),
    );

    const fieldRect = layout.nameFieldRect;
    ctx.fillStyle = "rgba(8, 21, 37, 0.82)";
    fillRoundedRect(
      ctx,
      fieldRect.x,
      fieldRect.y,
      fieldRect.w,
      fieldRect.h,
      Math.max(8, Math.round(fieldRect.h * 0.23)),
    );
    ctx.strokeStyle = "#d79a4a";
    ctx.lineWidth = Math.max(2, Math.round(fieldRect.h * 0.08));
    strokeRoundedRect(
      ctx,
      fieldRect.x,
      fieldRect.y,
      fieldRect.w,
      fieldRect.h,
      Math.max(8, Math.round(fieldRect.h * 0.23)),
    );
    ctx.strokeStyle = "#40230e";
    ctx.lineWidth = 1;
    strokeRoundedRect(
      ctx,
      fieldRect.x + 1,
      fieldRect.y + 1,
      fieldRect.w - 2,
      fieldRect.h - 2,
      Math.max(7, Math.round(fieldRect.h * 0.22)),
    );

    const displayName = this.nameBuffer.length > 0 ? this.nameBuffer : "____";
    ctx.fillStyle = "#f3f9ff";
    ctx.font = `${Math.round(clampNumber(fieldRect.h * 0.42, 12, 38))}px monospace`;
    ctx.textBaseline = "middle";
    const textX = fieldRect.x + Math.round(clampNumber(fieldRect.w * 0.04, 8, 24));
    const textY = fieldRect.y + fieldRect.h / 2 + 0.5;
    ctx.fillText(displayName, textX, textY);

    if (this.step === "name" && Math.floor(this.timer * 2) % 2 === 0) {
      const cursorX = textX + this.nameBuffer.length * Math.round(clampNumber(fieldRect.h * 0.26, 8, 26));
      ctx.fillRect(cursorX, fieldRect.y + fieldRect.h - Math.round(clampNumber(fieldRect.h * 0.28, 5, 16)), Math.max(6, Math.round(fieldRect.h * 0.16)), Math.max(2, Math.round(fieldRect.h * 0.07)));
    }

    if (this.infoText) {
      ctx.fillStyle = "#ffd2d6";
      ctx.font = `${Math.round(clampNumber(layout.nameRect.h * 0.14, 9, 24))}px monospace`;
      ctx.textBaseline = "top";
      const infoY = Math.min(
        layout.actionButtons.back.y - Math.round(clampNumber(layout.nameRect.h * 0.2, 14, 30)),
        fieldRect.y + fieldRect.h + Math.round(clampNumber(layout.nameRect.h * 0.05, 4, 10)),
      );
      ctx.fillText(
        this.infoText,
        layout.nameRect.x + Math.round(clampNumber(layout.nameRect.w * 0.05, 10, 34)),
        infoY,
      );
    }
  }

  drawActionButtons(ctx, layout) {
    const backRect = layout.actionButtons.back;
    const confirmRect = layout.actionButtons.confirm;
    this.drawSetupOptionRow(ctx, backRect, "INDIETRO", false);
    this.drawSetupOptionRow(ctx, confirmRect, "AVANTI", true);
  }

  drawClassPanel(ctx, layout) {
    this.drawSetupCard(ctx, layout.classRect, false);
    ctx.fillStyle = "#e6f2ff";
    ctx.font = `${Math.round(clampNumber(layout.classRect.h * 0.1, 10, 28))}px monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      "PROFILO GOBLIN",
      layout.classRect.x + Math.round(clampNumber(layout.classRect.w * 0.04, 10, 28)),
      layout.classRect.y + Math.round(clampNumber(layout.classRect.h * 0.06, 8, 18)),
    );

    const desc =
      "Tutti i goblin hanno statistiche base uguali. Migliora il personaggio con equipaggiamenti e abilita'.";
    const descFont = Math.round(clampNumber(layout.classRect.h * 0.09, 10, 22));
    const maxChars = Math.max(20, Math.floor((layout.classRect.w - 20) / Math.max(6, descFont * 0.56)));
    const descriptionLines = wrapClassText(desc, maxChars).slice(0, 4);
    ctx.fillStyle = "#eaf5ff";
    ctx.font = `${descFont}px monospace`;
    ctx.textBaseline = "top";
    descriptionLines.forEach((line, index) => {
      ctx.fillText(
        line,
        layout.classRect.x + Math.round(clampNumber(layout.classRect.w * 0.05, 10, 24)),
        layout.classRect.y +
          Math.round(clampNumber(layout.classRect.h * 0.24, 28, 88)) +
          index * Math.round(descFont * 1.25),
      );
    });

    const chipGap = Math.round(clampNumber(layout.classRect.w * 0.02, 6, 14));
    const chipW = Math.floor((layout.classRect.w - chipGap * 4) / 3);
    const chipH = Math.round(clampNumber(layout.classRect.h * 0.18, 24, 48));
    const statsY =
      layout.classRect.y + layout.classRect.h - chipH - Math.round(clampNumber(layout.classRect.h * 0.08, 10, 26));
    const stats = ["HP 30", "MP 30", "SP 3"];

    stats.forEach((stat, index) => {
      const chipX = layout.classRect.x + chipGap + index * (chipW + chipGap);
      this.drawSetupStatChip(ctx, { x: chipX, y: statsY, w: chipW, h: chipH }, stat);
    });
  }

  drawFooter(ctx, layout) {
    this.drawSetupCard(ctx, layout.footerRect, false);
    ctx.fillStyle = "#e6f2ff";
    ctx.font = `${Math.round(clampNumber(layout.footerRect.h * 0.36, 10, 30))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
      "A CONFERMA   B INDIETRO   ABC/CANC PER NOME",
      layout.footerRect.x + layout.footerRect.w / 2,
      layout.footerRect.y + layout.footerRect.h / 2 + 0.5,
    );
  }

  drawSetupCard(ctx, rect, selected = false) {
    const radius = Math.max(10, Math.round(rect.h * 0.2));
    const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    if (selected) {
      gradient.addColorStop(0, "rgba(62, 90, 132, 0.92)");
      gradient.addColorStop(1, "rgba(31, 50, 78, 0.92)");
    } else {
      gradient.addColorStop(0, "rgba(30, 48, 76, 0.9)");
      gradient.addColorStop(1, "rgba(12, 24, 42, 0.9)");
    }

    ctx.fillStyle = gradient;
    fillRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
    ctx.strokeStyle = "#d79a4a";
    ctx.lineWidth = 2;
    strokeRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
    ctx.strokeStyle = "#40230e";
    ctx.lineWidth = 1;
    strokeRoundedRect(ctx, rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, Math.max(8, radius - 1));
  }

  drawSetupOptionRow(ctx, rect, label, selected) {
    const radius = Math.max(8, Math.round(rect.h * 0.24));
    ctx.fillStyle = selected ? "rgba(14, 30, 50, 0.92)" : "rgba(8, 21, 37, 0.72)";
    fillRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
    ctx.strokeStyle = selected ? "rgba(177, 205, 255, 0.9)" : "rgba(122, 162, 221, 0.7)";
    ctx.lineWidth = Math.max(2, Math.round(rect.h * 0.09));
    strokeRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);

    ctx.fillStyle = selected ? "#f7fbff" : "#dcecff";
    ctx.font = `${Math.round(clampNumber(rect.h * 0.45, 10, 30))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 0.5);
  }

  drawSetupStatChip(ctx, rect, label) {
    const radius = Math.max(8, Math.round(rect.h * 0.25));
    ctx.fillStyle = "rgba(8, 21, 37, 0.76)";
    fillRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
    ctx.strokeStyle = "rgba(130, 168, 224, 0.76)";
    ctx.lineWidth = Math.max(2, Math.round(rect.h * 0.08));
    strokeRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);

    ctx.fillStyle = "#f3f9ff";
    ctx.font = `${Math.round(clampNumber(rect.h * 0.38, 9, 24))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 0.5);
  }
}

function wrapClassText(text, maxChars) {
  const words = String(text ?? "")
    .split(" ")
    .flatMap((word) => {
      if (word.length <= maxChars) {
        return [word];
      }

      const chunks = [];
      for (let i = 0; i < word.length; i += maxChars) {
        chunks.push(word.slice(i, i + maxChars));
      }
      return chunks;
    });
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine.length === 0 ? word : `${currentLine} ${word}`;
    if (candidate.length <= maxChars) {
      currentLine = candidate;
      return;
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    currentLine = word;
  });

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

function getSetupLayout(surfaceWidth = GAME_CONFIG.width, surfaceHeight = GAME_CONFIG.height) {
  const sidePadding = Math.round(clampNumber(surfaceWidth * 0.06, 12, 90));
  const verticalGap = Math.round(clampNumber(surfaceHeight * 0.02, 10, 30));

  const bannerRect = getHomeBannerRect(surfaceWidth, surfaceHeight);

  const cardW = Math.round(clampNumber(surfaceWidth * 0.9, 240, surfaceWidth - sidePadding * 2));
  const nameH = Math.round(clampNumber(surfaceHeight * 0.24, 96, 250));
  const centeredNameY = Math.floor((surfaceHeight - nameH) * 0.5);
  const minNameY = bannerRect.y + bannerRect.h + verticalGap;
  const nameY = Math.max(minNameY, centeredNameY);
  const nameRect = {
    x: Math.floor((surfaceWidth - cardW) / 2),
    y: nameY,
    w: cardW,
    h: nameH,
  };

  const fieldInsetX = Math.round(clampNumber(nameRect.w * 0.045, 10, 34));
  const fieldInsetY = Math.round(clampNumber(nameRect.h * 0.2, 16, 58));
  const fieldW = nameRect.w - fieldInsetX * 2;

  const actionGap = Math.round(clampNumber(nameRect.w * 0.02, 6, 10));
  const actionHeight = Math.round(clampNumber(nameRect.h * 0.36, 30, 64));
  const actionWidth = Math.floor((fieldW - actionGap) * 0.5);
  const actionY = nameRect.y + nameRect.h - actionHeight - Math.round(clampNumber(nameRect.h * 0.05, 4, 10));
  const actionStartX = nameRect.x + fieldInsetX;
  const maxFieldH = Math.max(24, actionY - (nameRect.y + fieldInsetY) - 8);
  const fieldH = Math.round(clampNumber(nameRect.h * 0.36, 28, maxFieldH));
  const nameFieldRect = {
    x: nameRect.x + fieldInsetX,
    y: nameRect.y + fieldInsetY,
    w: fieldW,
    h: fieldH,
  };
  const actionButtons = {
    back: {
      x: actionStartX,
      y: actionY,
      w: actionWidth,
      h: actionHeight,
    },
    confirm: {
      x: actionStartX + actionWidth + actionGap,
      y: actionY,
      w: actionWidth,
      h: actionHeight,
    },
  };

  return {
    bannerRect,
    nameRect,
    nameFieldRect,
    actionButtons,
  };
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function createUiImage(relativePath) {
  if (typeof Image === "undefined") {
    return null;
  }

  const imageUrl = buildVersionedAssetUrl(relativePath);
  const image = new Image();
  image.decoding = "async";
  image.__agoadLoadState = "loading";
  image.addEventListener("load", () => {
    image.__agoadLoadState = "ready";
  });
  image.addEventListener("error", () => {
    image.__agoadLoadState = "error";
  });
  image.src = imageUrl.toString();
  return image;
}

function isUiImageUsable(image) {
  return Boolean(image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
}

function isUiImageSettled(image) {
  if (!image) {
    return true;
  }

  if (image.__agoadLoadState === "ready" || image.__agoadLoadState === "error") {
    return true;
  }

  if (!image.complete) {
    return false;
  }

  image.__agoadLoadState = isUiImageUsable(image) ? "ready" : "error";
  return true;
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
