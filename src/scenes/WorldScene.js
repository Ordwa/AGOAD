import { Scene } from "../core/Scene.js";
import { GAME_CONFIG } from "../data/constants.js";

const DEFAULT_NOTICE = "WORLD SCENE IN REBUILD.";
const WORLD_HINT = "SCENA MONDO AZZERATA. QUI RICOSTRUIAMO IL GAMEPLAY.";
const CONTROLS_HINT = "P: PROFILE  I: BAG  BACK: HOME";

export class WorldScene extends Scene {
  constructor(game) {
    super(game);
    this.time = 0;
    this.notice = DEFAULT_NOTICE;
    this.noticeTimer = 0;
    this.uiBackgroundImage = createUiImage("../assets/UI_startscene_background.png");
    this.titleBannerImage = createUiImage("../assets/UI_title_banner.png");
  }

  onEnter(payload = {}) {
    this.time = 0;
    this.noticeTimer = 0;
    this.notice =
      typeof payload.message === "string" && payload.message.trim().length > 0
        ? payload.message.trim()
        : DEFAULT_NOTICE;
  }

  update(dt, input) {
    this.time += dt;

    if (!this.areCoreUiAssetsReady()) {
      return;
    }

    if (this.noticeTimer > 0) {
      this.noticeTimer = Math.max(0, this.noticeTimer - dt);
      if (this.noticeTimer === 0 && this.notice !== DEFAULT_NOTICE) {
        this.notice = DEFAULT_NOTICE;
      }
    }

    if (input.wasPressed("profile")) {
      this.game.changeScene("profile", {
        returnScene: "world",
        view: "profile",
      });
      return;
    }

    if (input.wasPressed("inventory")) {
      this.game.changeScene("profile", {
        returnScene: "world",
        view: "inventory",
      });
      return;
    }

    if (input.wasPressed("back")) {
      this.game.changeScene("start");
      return;
    }

    if (input.wasPressed("confirm")) {
      this.notice = "SCAFFOLD MONDO PRONTO.";
      this.noticeTimer = 1.2;
    }
  }

  render(ctx) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;

    if (!this.areCoreUiAssetsReady()) {
      this.drawUiLoadingScreen(ctx, canvasWidth, canvasHeight);
      return;
    }

    const layout = getWorldScaffoldLayout(canvasWidth, canvasHeight);
    this.drawBackground(ctx, canvasWidth, canvasHeight);
    this.drawBanner(ctx, layout.bannerRect);
    this.drawInfoCard(ctx, layout.infoRect, "WORLD", WORLD_HINT, true);
    this.drawInfoCard(ctx, layout.controlsRect, "INPUT", CONTROLS_HINT, false);
    this.drawNotice(ctx, layout.noticeRect, this.notice, layout.noticeFontSize);
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
    const spinAngle = (this.time * Math.PI * 2) / 0.9;

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

  drawBackground(ctx, surfaceWidth, surfaceHeight) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (isUiImageUsable(this.uiBackgroundImage)) {
      drawImageCover(ctx, this.uiBackgroundImage, 0, 0, surfaceWidth, surfaceHeight);
    } else {
      ctx.fillStyle = "#0f1116";
      ctx.fillRect(0, 0, surfaceWidth, surfaceHeight);
    }

    const overlayAlpha = 0.24 + Math.sin(this.time * 0.6) * 0.02;
    ctx.fillStyle = `rgba(5, 13, 24, ${clampNumber(overlayAlpha, 0.18, 0.3)})`;
    ctx.fillRect(0, 0, surfaceWidth, surfaceHeight);
    ctx.restore();
  }

  drawBanner(ctx, rect) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (isUiImageUsable(this.titleBannerImage)) {
      drawImageCover(ctx, this.titleBannerImage, rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
  }

  drawInfoCard(ctx, rect, title, body, selected) {
    const radius = Math.max(10, Math.round(rect.h * 0.22));
    const insetX = Math.round(clampNumber(rect.w * 0.05, 10, 28));
    const titleFont = Math.round(clampNumber(rect.h * 0.22, 11, 38));
    const bodyFont = Math.round(clampNumber(rect.h * 0.2, 10, 34));

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = selected ? "rgba(70, 106, 158, 0.86)" : "rgba(14, 31, 52, 0.84)";
    fillRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
    ctx.strokeStyle = selected ? "rgba(190, 217, 255, 0.9)" : "rgba(122, 162, 214, 0.74)";
    ctx.lineWidth = Math.max(2, Math.round(rect.h * 0.07));
    strokeRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);

    ctx.fillStyle = "#f2f8ff";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `${titleFont}px monospace`;
    ctx.fillText(title, rect.x + insetX, rect.y + Math.round(rect.h * 0.14));

    ctx.fillStyle = "#dcecff";
    ctx.font = `${bodyFont}px monospace`;
    const bodyY = rect.y + Math.round(rect.h * 0.42);
    const lines = wrapTextByWidth(ctx, body, rect.w - insetX * 2, bodyFont, 3);
    const lineHeight = Math.round(bodyFont * 1.2);
    lines.forEach((line, index) => {
      ctx.fillText(line, rect.x + insetX, bodyY + index * lineHeight);
    });
    ctx.restore();
  }

  drawNotice(ctx, rect, text, fontSize) {
    const safeText = String(text ?? "").trim();
    if (safeText.length === 0) {
      return;
    }

    const safeFont = Math.max(8, Math.round(fontSize));
    const lineHeight = Math.round(safeFont * 1.18);
    const padX = Math.round(clampNumber(rect.w * 0.04, 10, 30));
    const padY = Math.round(clampNumber(rect.h * 0.2, 8, 20));
    const lines = wrapTextByWidth(ctx, safeText, rect.w - padX * 2, safeFont, 3);
    const dynamicH = Math.max(rect.h, lines.length * lineHeight + padY * 2);
    const dynamicRect = {
      x: rect.x,
      y: rect.y + rect.h - dynamicH,
      w: rect.w,
      h: dynamicH,
    };
    const radius = Math.max(8, Math.round(dynamicRect.h * 0.22));

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "rgba(4, 14, 25, 0.74)";
    fillRoundedRect(ctx, dynamicRect.x, dynamicRect.y, dynamicRect.w, dynamicRect.h, radius);
    ctx.strokeStyle = "rgba(167, 204, 247, 0.76)";
    ctx.lineWidth = Math.max(2, Math.round(dynamicRect.h * 0.08));
    strokeRoundedRect(ctx, dynamicRect.x, dynamicRect.y, dynamicRect.w, dynamicRect.h, radius);

    ctx.fillStyle = "#e8f2ff";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `${safeFont}px monospace`;
    let y = dynamicRect.y + Math.round((dynamicRect.h - lines.length * lineHeight) / 2);
    const x = dynamicRect.x + padX;
    lines.forEach((line) => {
      ctx.fillText(line, x, y);
      y += lineHeight;
    });
    ctx.restore();
  }
}

function getWorldScaffoldLayout(surfaceWidth = GAME_CONFIG.width, surfaceHeight = GAME_CONFIG.height) {
  const sidePadding = Math.round(clampNumber(surfaceWidth * 0.06, 12, 90));
  const topInset = Math.round(clampNumber(surfaceHeight * 0.04, 12, 120));
  const verticalGap = Math.round(clampNumber(surfaceHeight * 0.024, 10, 34));
  const bannerRect = getHomeBannerRect(surfaceWidth, surfaceHeight);

  const cardW = Math.round(clampNumber(surfaceWidth * 0.88, 220, surfaceWidth - sidePadding * 2));
  const infoH = Math.round(clampNumber(surfaceHeight * 0.19, 88, 220));
  const controlsH = Math.round(clampNumber(surfaceHeight * 0.13, 62, 144));
  const infoStartY = bannerRect.y + bannerRect.h + Math.round(clampNumber(surfaceHeight * 0.03, 14, 38));

  const infoRect = {
    x: Math.floor((surfaceWidth - cardW) / 2),
    y: infoStartY,
    w: cardW,
    h: infoH,
  };

  const controlsRect = {
    x: infoRect.x,
    y: infoRect.y + infoRect.h + verticalGap,
    w: cardW,
    h: controlsH,
  };

  const noticeH = Math.round(clampNumber(surfaceHeight * 0.055, 18, 54));
  const noticeRect = {
    x: sidePadding,
    y: surfaceHeight - topInset - noticeH,
    w: surfaceWidth - sidePadding * 2,
    h: noticeH,
  };

  return {
    bannerRect,
    infoRect,
    controlsRect,
    noticeRect,
    noticeFontSize: Math.round(clampNumber(surfaceHeight * 0.023, 8, 34)),
  };
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

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function wrapTextByWidth(ctx, text, maxWidth, fontSize, maxLines) {
  const safeText = String(text ?? "").trim();
  if (safeText.length === 0) {
    return [];
  }

  const words = safeText.split(/\s+/);
  const lines = [];
  const previousFont = ctx.font;
  ctx.font = `${fontSize}px monospace`;

  let current = "";
  words.forEach((word) => {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      return;
    }

    if (current.length > 0) {
      lines.push(current);
    }
    current = word;
  });

  if (current.length > 0) {
    lines.push(current);
  }
  ctx.font = previousFont;

  if (lines.length <= maxLines) {
    return lines;
  }
  const truncated = lines.slice(0, maxLines);
  const last = truncated[maxLines - 1];
  truncated[maxLines - 1] = last.length > 1 ? `${last.slice(0, -1)}.` : ".";
  return truncated;
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

function buildVersionedAssetUrl(relativePath) {
  const version = new URL(import.meta.url).searchParams.get("v");
  const assetUrl = new URL(relativePath, import.meta.url);
  if (version) {
    assetUrl.searchParams.set("v", version);
  }
  return assetUrl;
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
