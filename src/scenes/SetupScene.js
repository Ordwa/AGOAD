import { Scene } from "../core/Scene.js";
import { GAME_CONFIG } from "../data/constants.js";
import { applyClassToPlayer } from "../data/classes.js";

const MAX_NAME_LENGTH = 12;

export class SetupScene extends Scene {
  constructor(game) {
    super(game);
    this.step = "name";
    this.nameBuffer = "";
    this.classIndex = 0;
    this.infoText = "";
    this.timer = 0;
    this.uiBackgroundImage = createUiImage("../assets/UI_startscene_background.png");
    this.titleBannerImage = createUiImage("../assets/UI_title_banner.png");
  }

  onEnter() {
    this.game.syncPlayerClassData();
    const player = this.game.state.player;
    const classes = this.getAvailableClasses();
    this.step = "name";
    this.nameBuffer = (player.name ?? "").slice(0, MAX_NAME_LENGTH);
    this.classIndex = this.getCurrentClassIndex(player.classId, classes);
    this.infoText = "";
    this.timer = 0;
    this.game.input.setTextCapture(true);
  }

  onExit() {
    this.game.input.setTextCapture(false);
  }

  update(dt, input) {
    this.timer += dt;

    if (this.step === "name") {
      this.updateNameStep(input);
      return;
    }

    this.updateClassStep(input);
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
      const trimmed = this.nameBuffer.trim();
      if (trimmed.length === 0) {
        this.infoText = "Inserisci un nome per continuare.";
        return;
      }

      this.nameBuffer = trimmed;
      this.infoText = "";
      this.step = "class";
      return;
    }

    if (input.wasPressed("back")) {
      if (this.nameBuffer.length === 0) {
        this.game.changeScene("start");
        return;
      }

      this.nameBuffer = this.nameBuffer.slice(0, -1);
    }
  }

  updateClassStep(input) {
    const classes = this.getAvailableClasses();
    if (classes.length === 0) {
      return;
    }

    input.consumeTypedChars();
    input.consumeBackspaceCount();

    if (input.wasPressed("up")) {
      this.classIndex = (this.classIndex + classes.length - 1) % classes.length;
      return;
    }

    if (input.wasPressed("down")) {
      this.classIndex = (this.classIndex + 1) % classes.length;
      return;
    }

    if (input.wasPressed("back")) {
      this.step = "name";
      return;
    }

    if (input.wasPressed("confirm")) {
      const selectedClass = classes[this.classIndex];
      applyClassToPlayer(this.game.state.player, selectedClass, this.nameBuffer);
      this.game.changeScene("world", {
        resetToSpawn: true,
        safeSteps: 5,
        saveAfterEnter: true,
        message: `${this.nameBuffer} il ${selectedClass.label} e' pronto all'avventura.`,
      });
    }
  }

  getCurrentClassIndex(classId, classes = this.getAvailableClasses()) {
    const index = classes.findIndex((classData) => classData.id === classId);
    return index >= 0 ? index : 0;
  }

  getAvailableClasses() {
    return this.game.getClasses();
  }

  render(ctx) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;
    const layout = getSetupLayout(canvasWidth, canvasHeight);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawBackground(ctx, canvasWidth, canvasHeight);
    this.drawTitle(ctx, layout);
    this.drawNamePanel(ctx, layout);
    this.drawClassPanel(ctx, layout);
    this.drawFooter(ctx, layout);
    ctx.restore();
  }

  drawBackground(ctx, surfaceWidth = GAME_CONFIG.width, surfaceHeight = GAME_CONFIG.height) {
    if (
      this.uiBackgroundImage &&
      this.uiBackgroundImage.complete &&
      this.uiBackgroundImage.naturalWidth > 0
    ) {
      drawImageCover(ctx, this.uiBackgroundImage, 0, 0, surfaceWidth, surfaceHeight);
      return;
    }

    ctx.fillStyle = "#0f1116";
    ctx.fillRect(0, 0, surfaceWidth, surfaceHeight);
  }

  drawTitle(ctx, layout) {
    if (
      this.titleBannerImage &&
      this.titleBannerImage.complete &&
      this.titleBannerImage.naturalWidth > 0
    ) {
      drawImageCover(
        ctx,
        this.titleBannerImage,
        layout.bannerRect.x,
        layout.bannerRect.y,
        layout.bannerRect.w,
        layout.bannerRect.h,
      );
    } else {
      this.drawSetupCard(ctx, layout.bannerRect, false);
    }

    this.drawSetupCard(ctx, layout.titleRect, false);
    ctx.fillStyle = "#f3f9ff";
    ctx.font = `${Math.round(clampNumber(layout.titleRect.h * 0.4, 12, 40))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("NEW GAME", layout.titleRect.x + layout.titleRect.w / 2, layout.titleRect.y + layout.titleRect.h / 2);
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
    ctx.fillStyle = "rgba(8, 21, 37, 0.75)";
    fillRoundedRect(
      ctx,
      fieldRect.x,
      fieldRect.y,
      fieldRect.w,
      fieldRect.h,
      Math.max(8, Math.round(fieldRect.h * 0.23)),
    );
    ctx.strokeStyle = "rgba(130, 168, 224, 0.82)";
    ctx.lineWidth = Math.max(2, Math.round(fieldRect.h * 0.08));
    strokeRoundedRect(
      ctx,
      fieldRect.x,
      fieldRect.y,
      fieldRect.w,
      fieldRect.h,
      Math.max(8, Math.round(fieldRect.h * 0.23)),
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
      ctx.fillText(
        this.infoText,
        layout.nameRect.x + Math.round(clampNumber(layout.nameRect.w * 0.05, 10, 34)),
        layout.nameRect.y + layout.nameRect.h - Math.round(clampNumber(layout.nameRect.h * 0.24, 16, 44)),
      );
    }
  }

  drawClassPanel(ctx, layout) {
    const classes = this.getAvailableClasses();
    if (classes.length === 0) {
      return;
    }

    const safeIndex = Math.min(this.classIndex, classes.length - 1);
    this.classIndex = safeIndex;
    const selectedClass = classes[safeIndex];

    this.drawSetupCard(ctx, layout.classRect, this.step === "class");
    ctx.fillStyle = "#e6f2ff";
    ctx.font = `${Math.round(clampNumber(layout.classRect.h * 0.1, 10, 28))}px monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(
      "SCEGLI LA CLASSE",
      layout.classRect.x + Math.round(clampNumber(layout.classRect.w * 0.04, 10, 28)),
      layout.classRect.y + Math.round(clampNumber(layout.classRect.h * 0.06, 8, 18)),
    );

    const listRect = layout.classListRect;
    const listGap = Math.round(clampNumber(listRect.h * 0.04, 6, 20));
    const rowH = Math.floor((listRect.h - listGap * (classes.length - 1)) / classes.length);

    classes.forEach((classData, index) => {
      const rowRect = {
        x: listRect.x,
        y: listRect.y + index * (rowH + listGap),
        w: listRect.w,
        h: rowH,
      };
      const selected = this.step === "class" && index === this.classIndex;
      this.drawSetupOptionRow(ctx, rowRect, classData.label, selected);
    });

    const detailsRect = layout.classDetailsRect;
    this.drawSetupCard(ctx, detailsRect, false);

    const desc = selectedClass.description ?? "Nessuna descrizione.";
    const descFont = Math.round(clampNumber(detailsRect.h * 0.11, 10, 24));
    const maxChars = Math.max(16, Math.floor((detailsRect.w - 20) / Math.max(6, descFont * 0.56)));
    const descriptionLines = wrapClassText(desc, maxChars).slice(0, 3);

    ctx.fillStyle = "#eaf5ff";
    ctx.font = `${descFont}px monospace`;
    ctx.textBaseline = "top";
    descriptionLines.forEach((line, index) => {
      ctx.fillText(
        line,
        detailsRect.x + Math.round(clampNumber(detailsRect.w * 0.06, 10, 24)),
        detailsRect.y + Math.round(clampNumber(detailsRect.h * 0.12, 8, 20)) + index * Math.round(descFont * 1.25),
      );
    });

    const statsY = detailsRect.y + detailsRect.h - Math.round(clampNumber(detailsRect.h * 0.3, 24, 72));
    const chipGap = Math.round(clampNumber(detailsRect.w * 0.025, 6, 18));
    const chipW = Math.floor((detailsRect.w - chipGap * 4) / 3);
    const chipH = Math.round(clampNumber(detailsRect.h * 0.2, 24, 68));
    const stats = [
      `HP ${selectedClass.maxHp}`,
      `ATK ${selectedClass.attackMin}-${selectedClass.attackMax}`,
      `MP ${selectedClass.maxMana}`,
    ];

    stats.forEach((stat, index) => {
      const chipX = detailsRect.x + chipGap + index * (chipW + chipGap);
      this.drawSetupStatChip(ctx, { x: chipX, y: statsY, w: chipW, h: chipH }, stat);
    });
  }

  drawFooter(ctx, layout) {
    this.drawSetupCard(ctx, layout.footerRect, false);
    ctx.fillStyle = "#e6f2ff";
    ctx.font = `${Math.round(clampNumber(layout.footerRect.h * 0.36, 10, 30))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (this.step === "name") {
      ctx.fillText(
        "A CONFERMA   ABC/CANC PER NOME",
        layout.footerRect.x + layout.footerRect.w / 2,
        layout.footerRect.y + layout.footerRect.h / 2 + 0.5,
      );
      return;
    }

    ctx.fillText(
      "A CONFERMA   B INDIETRO",
      layout.footerRect.x + layout.footerRect.w / 2,
      layout.footerRect.y + layout.footerRect.h / 2 + 0.5,
    );
  }

  drawSetupCard(ctx, rect, selected = false) {
    const radius = Math.max(10, Math.round(rect.h * 0.2));
    ctx.fillStyle = selected ? "rgba(84, 120, 173, 0.88)" : "rgba(18, 35, 59, 0.8)";
    fillRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
    ctx.strokeStyle = selected ? "#b1ccff" : "rgba(120, 162, 214, 0.72)";
    ctx.lineWidth = Math.max(2, Math.round(rect.h * 0.08));
    strokeRoundedRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
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
  const topInset = Math.round(clampNumber(surfaceHeight * 0.04, 12, 120));
  const verticalGap = Math.round(clampNumber(surfaceHeight * 0.02, 10, 30));

  const bannerRect = getHomeBannerRect(surfaceWidth, surfaceHeight);

  const titleW = Math.round(clampNumber(surfaceWidth * 0.56, 160, surfaceWidth - sidePadding * 2));
  const titleH = Math.round(clampNumber(surfaceHeight * 0.06, 24, 72));
  const titleRect = {
    x: Math.floor((surfaceWidth - titleW) / 2),
    y: bannerRect.y + bannerRect.h + verticalGap,
    w: titleW,
    h: titleH,
  };

  const cardW = Math.round(clampNumber(surfaceWidth * 0.9, 240, surfaceWidth - sidePadding * 2));
  const nameH = Math.round(clampNumber(surfaceHeight * 0.18, 86, 250));
  const nameRect = {
    x: Math.floor((surfaceWidth - cardW) / 2),
    y: titleRect.y + titleRect.h + verticalGap,
    w: cardW,
    h: nameH,
  };

  const fieldInsetX = Math.round(clampNumber(nameRect.w * 0.045, 10, 34));
  const fieldInsetY = Math.round(clampNumber(nameRect.h * 0.38, 30, 92));
  const fieldW = nameRect.w - fieldInsetX * 2;
  const fieldH = Math.round(clampNumber(nameRect.h * 0.38, 30, 110));
  const nameFieldRect = {
    x: nameRect.x + fieldInsetX,
    y: nameRect.y + fieldInsetY,
    w: fieldW,
    h: fieldH,
  };

  const footerH = Math.round(clampNumber(surfaceHeight * 0.075, 30, 92));
  const footerRect = {
    x: nameRect.x,
    y: surfaceHeight - topInset - footerH,
    w: cardW,
    h: footerH,
  };

  const classY = nameRect.y + nameRect.h + verticalGap;
  const classMaxH = Math.max(90, footerRect.y - verticalGap - classY);
  const classH = Math.round(clampNumber(surfaceHeight * 0.34, 120, classMaxH));
  const classRect = {
    x: nameRect.x,
    y: classY,
    w: cardW,
    h: classH,
  };

  const classContentTop = classRect.y + Math.round(clampNumber(classRect.h * 0.2, 32, 90));
  const classContentH = classRect.h - (classContentTop - classRect.y) - Math.round(clampNumber(classRect.h * 0.08, 10, 30));
  const classListW = Math.round(clampNumber(classRect.w * 0.34, 88, classRect.w * 0.45));
  const classListRect = {
    x: classRect.x + Math.round(clampNumber(classRect.w * 0.04, 8, 24)),
    y: classContentTop,
    w: classListW,
    h: classContentH,
  };
  const detailsX = classListRect.x + classListRect.w + Math.round(clampNumber(classRect.w * 0.03, 8, 22));
  const detailsW = classRect.x + classRect.w - Math.round(clampNumber(classRect.w * 0.04, 8, 24)) - detailsX;
  const classDetailsRect = {
    x: detailsX,
    y: classContentTop,
    w: detailsW,
    h: classContentH,
  };

  return {
    bannerRect,
    titleRect,
    nameRect,
    nameFieldRect,
    classRect,
    classListRect,
    classDetailsRect,
    footerRect,
  };
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getHomeBannerRect(surfaceWidth = GAME_CONFIG.width, surfaceHeight = GAME_CONFIG.height) {
  const sidePadding = Math.round(clampNumber(surfaceWidth * 0.05, 10, 80));
  const topInset = Math.round(clampNumber(surfaceHeight * 0.04, 12, 120));
  const bannerW = Math.round(clampNumber(surfaceWidth * 0.774, 198, surfaceWidth - sidePadding * 2));
  const bannerH = Math.round(clampNumber(surfaceHeight * 0.171, 83, 324));
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
