import { Scene } from "../core/Scene.js";
import { GAME_CONFIG, PALETTE, PLAYER_CONFIG } from "../data/constants.js";

export class ProfileScene extends Scene {
  constructor(game) {
    super(game);
    this.returnScene = "world";
    this.returnPayload = {};
    this.view = "profile";
    this.time = 0;
    this.inventoryIndex = 0;
    this.inventoryNotice = "";
    this.uiBackgroundImage = createUiImage("../assets/UI_startscene_background.png");
  }

  onEnter(payload = {}) {
    this.returnScene = payload.returnScene ?? "world";
    this.returnPayload = payload.returnPayload ?? {};
    this.view = normalizeView(payload.view);
    this.time = 0;
    this.inventoryIndex = 0;
    this.inventoryNotice = "";
  }

  update(dt, input) {
    this.time += dt;

    if (input.wasPressed("profile")) {
      if (this.view === "profile") {
        this.closeScene();
        return;
      }

      this.view = "profile";
      this.inventoryNotice = "";
      return;
    }

    if (input.wasPressed("inventory")) {
      if (this.view === "inventory") {
        this.closeScene();
        return;
      }

      this.view = "inventory";
      return;
    }

    if (this.view === "inventory" && this.updateInventoryInput(input)) {
      return;
    }

    if (input.wasPressed("back")) {
      this.closeScene();
    }
  }

  render(ctx) {
    this.drawBackground(ctx);

    if (this.view === "profile") {
      this.drawProfileView(ctx);
      return;
    }

    this.drawInventoryView(ctx);
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

  drawProfileView(ctx) {
    const player = this.game.state.player;
    const progress = this.game.state.progress;

    const encounterCount = Array.isArray(progress.encounteredEnemyIds)
      ? progress.encounteredEnemyIds.length
      : 0;
    const battlesTotal = progress.battlesTotal ?? 0;
    const playTime = formatPlayTime(progress.playTimeSeconds ?? 0);

    this.drawPanel(ctx, 6, 6, GAME_CONFIG.width - 12, 20);
    this.drawPanel(ctx, 6, 30, 90, 82);
    this.drawPanel(ctx, 100, 30, GAME_CONFIG.width - 106, 82);
    this.drawPanel(ctx, 6, 116, GAME_CONFIG.width - 12, 58);

    ctx.fillStyle = PALETTE.uiText;
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";

    ctx.fillText(player.name.toUpperCase(), 14, 12);
    ctx.fillText("PROGRESSO", 14, 122);

    ctx.fillStyle = "#dee7f6";
    ctx.fillRect(18, 45, 66, 52);

    const bob = Math.sin(this.time * 4) * 1;
    this.drawLargePlayerSprite(ctx, 33, 52 + bob);

    ctx.fillStyle = PALETTE.uiText;
    ctx.fillText(`Classe: ${player.className}`, 108, 40);

    this.drawStatBar(
      ctx,
      {
        x: 108,
        y: 56,
        width: 126,
        label: "HP",
        color: "#4dc06e",
      },
      player.hp,
      player.maxHp,
    );

    this.drawStatBar(
      ctx,
      {
        x: 108,
        y: 76,
        width: 126,
        label: "MP",
        color: "#57a7d8",
      },
      player.mana,
      player.maxMana,
    );

    ctx.fillText(`Passi: ${progress.totalSteps}`, 14, 134);
    ctx.fillText(`Combattimenti: ${battlesTotal}`, 14, 146);
    ctx.fillText(`Encounter: ${encounterCount}`, 144, 134);
    ctx.fillText(`Tempo: ${playTime}`, 144, 146);
  }

  drawInventoryView(ctx) {
    const inventoryItems = this.getInventoryItems();

    this.drawPanel(ctx, 6, 6, GAME_CONFIG.width - 12, 20);
    this.drawPanel(ctx, 6, 30, GAME_CONFIG.width - 12, 144);

    ctx.fillStyle = PALETTE.uiText;
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.fillText("INVENTARIO", 14, 12);

    ctx.fillText("Oggetto", 12, 38);
    ctx.fillText("Qt", 108, 38);
    ctx.fillText("Descrizione", 134, 38);

    if (inventoryItems.length === 0) {
      ctx.fillText("(vuoto)", 12, 50);
      return;
    }

    if (this.inventoryIndex >= inventoryItems.length) {
      this.inventoryIndex = inventoryItems.length - 1;
    }

    inventoryItems.slice(0, 9).forEach((item, index) => {
      const y = 50 + index * 12;
      const desc = truncate(`${item.description}`, 16);

      if (index === this.inventoryIndex) {
        this.drawCursor(ctx, 12, y + 1);
      }

      ctx.fillText(item.label, 20, y);
      ctx.fillText(String(item.quantity), 108, y);
      ctx.fillText(desc, 134, y);
    });

    if (this.inventoryNotice.length > 0) {
      ctx.fillText(truncate(this.inventoryNotice, 41), 12, 160);
    }
  }

  updateInventoryInput(input) {
    const inventoryItems = this.getInventoryItems();
    if (inventoryItems.length === 0) {
      return false;
    }

    if (this.inventoryIndex >= inventoryItems.length) {
      this.inventoryIndex = inventoryItems.length - 1;
    }

    if (input.wasPressed("up")) {
      this.inventoryIndex = (this.inventoryIndex + inventoryItems.length - 1) % inventoryItems.length;
      return true;
    }

    if (input.wasPressed("down")) {
      this.inventoryIndex = (this.inventoryIndex + 1) % inventoryItems.length;
      return true;
    }

    if (input.wasPressed("confirm")) {
      this.useSelectedInventoryItem(inventoryItems[this.inventoryIndex]);
      return true;
    }

    return false;
  }

  getInventoryItems() {
    return Object.values(this.game.state.inventory);
  }

  useSelectedInventoryItem(item) {
    if (!item) {
      return;
    }

    const player = this.game.state.player;

    if (item.id === "life_potion") {
      if (item.quantity <= 0) {
        this.showInventoryNotice("Nessuna Life Potion disponibile.");
        return;
      }

      if (player.hp >= player.maxHp) {
        this.showInventoryNotice("HP gia' al massimo.");
        return;
      }

      player.hp = Math.min(player.maxHp, player.hp + PLAYER_CONFIG.healAmount);
      item.quantity -= 1;
      this.showInventoryNotice("Usi una Life Potion.");
      return;
    }

    if (item.id === "mana_potion") {
      if (item.quantity <= 0) {
        this.showInventoryNotice("Nessuna Mana Potion disponibile.");
        return;
      }

      if ((player.mana ?? 0) >= player.maxMana) {
        this.showInventoryNotice("MP gia' al massimo.");
        return;
      }

      player.mana = Math.min(player.maxMana, (player.mana ?? 0) + PLAYER_CONFIG.manaPotionAmount);
      item.quantity -= 1;
      this.showInventoryNotice("Usi una Mana Potion.");
      return;
    }

    if (item.id === "amulet") {
      const lastRestPoint = this.game.state.progress.lastRestPoint;
      if (!lastRestPoint) {
        this.showInventoryNotice("Nessun letto registrato.");
        return;
      }

      this.game.changeScene("world", {
        resetToLastRest: true,
        safeSteps: 5,
        message: "L'Amulet ti riporta all'ultimo letto.",
      });
      return;
    }

    this.showInventoryNotice("Oggetto non utilizzabile ora.");
  }

  showInventoryNotice(message) {
    this.inventoryNotice = message;
  }

  closeScene() {
    this.game.changeScene(this.returnScene, this.returnPayload);
  }

  drawStatBar(ctx, config, value, maxValue) {
    const safeMax = Math.max(1, Number(maxValue) || 0);
    const safeValue = Math.max(0, Math.min(safeMax, Math.round(Number(value) || 0)));
    const ratio = safeValue / safeMax;

    ctx.fillStyle = PALETTE.uiText;
    ctx.fillText(`${config.label}`, config.x, config.y);

    const barX = config.x + 18;
    const barY = config.y;
    const barW = config.width - 36;
    const barH = 8;

    ctx.fillStyle = "#ced8c4";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeStyle = "#4a5f46";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle = config.color;
    ctx.fillRect(barX + 1, barY + 1, Math.floor((barW - 2) * ratio), barH - 2);

    ctx.fillStyle = PALETTE.uiText;
    ctx.fillText(`${safeValue}/${safeMax}`, config.x, config.y + 9);
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

  drawLargePlayerSprite(ctx, x, y) {
    ctx.fillStyle = "#8f1f2f";
    ctx.fillRect(x + 8, y + 0, 18, 7);
    ctx.fillStyle = "#f4d7ae";
    ctx.fillRect(x + 10, y + 7, 14, 8);
    ctx.fillStyle = "#d8474d";
    ctx.fillRect(x + 7, y + 15, 20, 10);
    ctx.fillStyle = "#304c8f";
    ctx.fillRect(x + 8, y + 25, 7, 6);
    ctx.fillRect(x + 19, y + 25, 7, 6);
    ctx.fillStyle = "#102245";
    ctx.fillRect(x + 5, y + 17, 2, 4);
    ctx.fillRect(x + 27, y + 17, 2, 4);
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

function normalizeView(value) {
  return value === "inventory" ? "inventory" : "profile";
}

function truncate(text, maxLen) {
  if (text.length <= maxLen) {
    return text;
  }

  return `${text.slice(0, maxLen - 1)}.`;
}

function formatPlayTime(seconds) {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
