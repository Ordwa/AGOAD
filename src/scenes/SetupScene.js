import { Scene } from "../core/Scene.js";
import { GAME_CONFIG, PALETTE } from "../data/constants.js";
import { applyClassToPlayer } from "../data/classes.js";

const MAX_NAME_LENGTH = 12;
const FIELD = {
  x: 14,
  y: 48,
  w: GAME_CONFIG.width - 28,
  h: 18,
};

export class SetupScene extends Scene {
  constructor(game) {
    super(game);
    this.step = "name";
    this.nameBuffer = "";
    this.classIndex = 0;
    this.infoText = "";
    this.timer = 0;
    this.uiBackgroundImage = createUiImage("../assets/UI_startscene_background.png");
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
    this.drawBackground(ctx);
    this.drawTitle(ctx);
    this.drawNamePanel(ctx);
    this.drawClassPanel(ctx);
    this.drawFooter(ctx);
  }

  drawBackground(ctx) {
    if (
      this.uiBackgroundImage &&
      this.uiBackgroundImage.complete &&
      this.uiBackgroundImage.naturalWidth > 0
    ) {
      drawImageCover(ctx, this.uiBackgroundImage, 0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
      return;
    }

    ctx.fillStyle = "#0f1116";
    ctx.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
  }

  drawTitle(ctx) {
    this.drawPanel(ctx, 6, 6, GAME_CONFIG.width - 12, 20);
    ctx.fillStyle = PALETTE.uiText;
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.fillText("NUOVA AVVENTURA", 14, 12);
  }

  drawNamePanel(ctx) {
    this.drawPanel(ctx, 6, 30, GAME_CONFIG.width - 12, 44);

    ctx.fillStyle = PALETTE.uiText;
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.fillText("NOME PERSONAGGIO", 14, 36);

    ctx.fillStyle = "#e9eff3";
    ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
    ctx.strokeStyle = "#4a5665";
    ctx.lineWidth = 1;
    ctx.strokeRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);

    const displayName = this.nameBuffer.length > 0 ? this.nameBuffer : "____";
    ctx.fillStyle = "#1f2233";
    ctx.fillText(displayName, FIELD.x + 6, FIELD.y + 6);

    if (this.step === "name" && Math.floor(this.timer * 2) % 2 === 0) {
      const cursorX = FIELD.x + 6 + this.nameBuffer.length * 8;
      ctx.fillRect(cursorX, FIELD.y + 14, 6, 1);
    }

    if (this.infoText) {
      ctx.fillStyle = "#8f2d35";
      ctx.fillText(this.infoText, 14, 68);
    }
  }

  drawClassPanel(ctx) {
    const classes = this.getAvailableClasses();
    if (classes.length === 0) {
      return;
    }

    const safeIndex = Math.min(this.classIndex, classes.length - 1);
    this.classIndex = safeIndex;
    const selectedClass = classes[safeIndex];
    const panelY = 78;

    this.drawPanel(ctx, 6, panelY, GAME_CONFIG.width - 12, 74);
    ctx.fillStyle = PALETTE.uiText;
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.fillText("SCEGLI LA CLASSE", 14, panelY + 6);

    classes.forEach((classData, index) => {
      const y = panelY + 20 + index * 12;
      if (this.step === "class" && index === this.classIndex) {
        this.drawCursor(ctx, 14, y + 1);
      }

      ctx.fillStyle = index === this.classIndex ? "#1f2233" : "#4e5766";
      ctx.fillText(classData.label, 22, y);
    });

    ctx.fillStyle = "#1f2233";
    ctx.fillText(`HP ${selectedClass.maxHp}`, 14, panelY + 58);
    ctx.fillText(`ATK ${selectedClass.attackMin}-${selectedClass.attackMax}`, 52, panelY + 58);
    ctx.fillText(`MP ${selectedClass.maxMana}`, 112, panelY + 58);

    const rightAreaX = 120;
    const rightAreaW = 128;
    const infoX = rightAreaX + 2;
    const description = selectedClass.description ?? "Nessuna descrizione.";
    const descriptionLines = wrapClassText(description, 16);

    const descBoxX = rightAreaX;
    const descBoxY = panelY + 18;
    const descBoxW = 58;
    const descBoxH = 34;

    ctx.fillStyle = "#e9eff3";
    ctx.fillRect(descBoxX, descBoxY, descBoxW, descBoxH);
    ctx.strokeStyle = "#4a5665";
    ctx.lineWidth = 1;
    ctx.strokeRect(descBoxX, descBoxY, descBoxW, descBoxH);

    ctx.fillStyle = "#1f2233";
    ctx.font = "6px monospace";
    descriptionLines.slice(0, 4).forEach((line, index) => {
      ctx.fillText(line, infoX, panelY + 22 + index * 7);
    });
    ctx.font = "8px monospace";

    const slotW = 62;
    const slotX = descBoxX + descBoxW + Math.floor((rightAreaW - descBoxW - slotW) / 2);
    const slotY = panelY + 16;
    const slotH = 56;

    ctx.fillStyle = "#e9eff3";
    ctx.fillRect(slotX, slotY, slotW, slotH);
    ctx.strokeStyle = "#4a5665";
    ctx.lineWidth = 1;
    ctx.strokeRect(slotX, slotY, slotW, slotH);

    ctx.fillStyle = "#4e5766";
    ctx.textAlign = "center";
    ctx.fillText("SPRITE", slotX + slotW / 2, slotY + 21);
    ctx.fillText("SLOT", slotX + slotW / 2, slotY + 31);
    ctx.textAlign = "left";
  }

  drawFooter(ctx) {
    this.drawPanel(ctx, 6, 156, GAME_CONFIG.width - 12, 18);
    ctx.fillStyle = PALETTE.uiText;
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";

    if (this.step === "name") {
      ctx.fillText("A conferma", 14, 162);
      ctx.fillText("ABC/CANC per nome", 132, 162);
      return;
    }

    ctx.fillText("A conferma", 14, 162);
    ctx.fillText("B indietro", 132, 162);
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

  drawCursor(ctx, x, y) {
    ctx.fillStyle = "#2c2d36";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4, y + 3);
    ctx.lineTo(x, y + 6);
    ctx.closePath();
    ctx.fill();
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
