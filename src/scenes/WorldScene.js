import { Scene } from "../core/Scene.js";

// WorldScene renders only the in-game content shown inside the console screen window.
export class WorldScene extends Scene {
  constructor(game) {
    super(game);
    this.time = 0;
    this.uiBackgroundImage = createUiImage("../assets/UI_startscene_background.png");
  }

  onEnter() {
    this.time = 0;
  }

  update(dt, input) {
    this.time += dt;

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
      this.game.changeScene("start", { startMode: "main" });
    }
  }

  render(ctx) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;

    if (!isUiImageSettled(this.uiBackgroundImage)) {
      drawLoading(ctx, canvasWidth, canvasHeight, this.time);
      return;
    }

    drawWorldScreenContent(ctx, canvasWidth, canvasHeight, this.uiBackgroundImage);
  }
}

function drawLoading(ctx, width, height, time) {
  const spinnerSize = Math.round(clampNumber(Math.min(width, height) * 0.13, 28, 86));
  const spinnerStroke = Math.max(4, Math.round(spinnerSize * 0.13));
  const spinnerRadius = Math.round((spinnerSize - spinnerStroke) / 2);
  const centerX = Math.round(width * 0.5);
  const centerY = Math.round(height * 0.5);
  const spinAngle = (time * Math.PI * 2) / 0.9;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#0f1116";
  ctx.fillRect(0, 0, width, height);

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

function drawWorldScreenContent(ctx, width, height, backgroundImage) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (isUiImageUsable(backgroundImage)) {
    drawImageCover(ctx, backgroundImage, 0, 0, width, height);
  } else {
    ctx.fillStyle = "#0f1116";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
