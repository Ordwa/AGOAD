import { Scene } from "../core/Scene.js";
import { GAME_CONFIG, PLAYER_CONFIG } from "../data/constants.js";

const PROFILE_THEME = Object.freeze({
  panelTop: "rgba(30, 48, 76, 0.9)",
  panelBottom: "rgba(12, 24, 42, 0.9)",
  panelSelectedTop: "rgba(62, 90, 132, 0.92)",
  panelSelectedBottom: "rgba(31, 50, 78, 0.92)",
  panelBorder: "#d79a4a",
  panelInnerBorder: "#40230e",
  panelShadow: "rgba(0, 0, 0, 0.48)",
  textPrimary: "#f6ecd2",
  textSecondary: "#d7c89e",
  rowSelected: "rgba(214, 154, 73, 0.22)",
  rowDivider: "rgba(215, 154, 74, 0.35)",
  notice: "#ffd9a8",
});

const INVENTORY_PANEL_ITEMS = "items";
const INVENTORY_PANEL_SKILLS = "skills";

export class ProfileScene extends Scene {
  constructor(game) {
    super(game);
    this.returnScene = "world";
    this.returnPayload = {};
    this.view = "profile";
    this.time = 0;
    this.inventoryIndex = 0;
    this.skillIndex = 0;
    this.inventoryPanel = INVENTORY_PANEL_ITEMS;
    this.inventoryNotice = "";
    this.uiBackgroundImage = createUiImage("../assets/UI/UI_background.png");
  }

  onEnter(payload = {}) {
    this.returnScene = payload.returnScene ?? "world";
    this.returnPayload = payload.returnPayload ?? {};
    this.view = normalizeView(payload.view);
    this.time = 0;
    this.inventoryIndex = 0;
    this.skillIndex = 0;
    this.inventoryPanel = INVENTORY_PANEL_ITEMS;
    this.inventoryNotice = "";
  }

  update(dt, input) {
    this.time += dt;

    if (input.wasPressed("profile")) {
      if (this.view === "profile") {
        this.closeScene();
        return;
      }

      this.game.changeScene("profile", {
        returnScene: this.returnScene,
        returnPayload: this.returnPayload,
      });
      return;
    }

    if (input.wasPressed("inventory")) {
      if (this.view === "inventory") {
        this.closeScene();
        return;
      }

      this.game.changeScene("inventory", {
        returnScene: this.returnScene,
        returnPayload: this.returnPayload,
      });
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

    if (this.view === "profile") {
      this.drawProfileView(ctx);
      ctx.restore();
      return;
    }

    this.drawInventoryView(ctx);
    ctx.restore();
  }

  drawBackground(ctx, width = GAME_CONFIG.width, height = GAME_CONFIG.height) {
    if (
      this.uiBackgroundImage &&
      this.uiBackgroundImage.complete &&
      this.uiBackgroundImage.naturalWidth > 0
    ) {
      drawImageCover(ctx, this.uiBackgroundImage, 0, 0, width, height);
    } else {
      ctx.fillStyle = "#0f1116";
      ctx.fillRect(0, 0, width, height);
    }
  }

  drawProfileView(ctx) {
    const player = this.game.state.player;
    const progress = this.game.state.progress;

    const encounterCount = Array.isArray(progress.encounteredEnemyIds)
      ? progress.encounteredEnemyIds.length
      : 0;
    const battlesWon = progress.battlesWon ?? 0;
    const playTime = formatPlayTime(progress.playTimeSeconds ?? 0);

    this.drawPanel(ctx, 6, 30, 90, 84);
    this.drawPanel(ctx, 100, 30, GAME_CONFIG.width - 106, 84);
    this.drawPanel(ctx, 6, 118, GAME_CONFIG.width - 12, 56);

    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    ctx.fillStyle = PROFILE_THEME.textSecondary;
    ctx.fillText(player.name.toUpperCase(), 14, 34);

    this.drawPanel(ctx, 16, 44, 70, 60, { inset: true });

    const bob = Math.sin(this.time * 4) * 1;
    this.drawLargePlayerSprite(ctx, 35, 56 + bob);

    ctx.fillStyle = PROFILE_THEME.textPrimary;
    ctx.fillText(String(player.pgTitle ?? "Goblin").toUpperCase(), 108, 40);

    this.drawStatBar(
      ctx,
      {
        x: 108,
        y: 56,
        width: 126,
        label: "HP",
        color: "#5ad07a",
      },
      player.hp,
      player.maxHp,
    );

    this.drawStatBar(
      ctx,
      {
        x: 108,
        y: 80,
        width: 126,
        label: "MP",
        color: "#63b9f0",
      },
      player.mana,
      player.maxMana,
    );

    this.drawSpeedBar(ctx, { x: 108, y: 104, width: 126, label: "SP" }, player.speed ?? 0);

    ctx.fillStyle = PROFILE_THEME.textPrimary;
    ctx.fillText("PROGRESSO", 14, 122);
    ctx.fillText(`Mostri incontrati: ${encounterCount}`, 14, 136);
    ctx.fillText(`Mostri sconfitti: ${battlesWon}`, 14, 148);
    ctx.fillText(`Tempo di vita: ${playTime}`, 142, 136);
  }

  drawInventoryView(ctx) {
    this.drawCoinCounter(ctx);
    this.drawPanel(ctx, 6, 46, GAME_CONFIG.width - 12, 128);

    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    this.drawInventoryPanelTabs(ctx);

    if (this.inventoryPanel === INVENTORY_PANEL_ITEMS) {
      this.drawInventoryItemsPanel(ctx);
    } else {
      this.drawInventorySkillsPanel(ctx);
    }

    if (this.inventoryNotice.length > 0) {
      this.drawPanel(ctx, 10, 157, GAME_CONFIG.width - 20, 14, { inset: true });
      ctx.fillStyle = PROFILE_THEME.notice;
      ctx.fillText(truncate(this.inventoryNotice, 40), 14, 160);
    }
  }

  updateInventoryInput(input) {
    if (input.wasPressed("left") || input.wasPressed("right")) {
      this.inventoryPanel =
        this.inventoryPanel === INVENTORY_PANEL_ITEMS
          ? INVENTORY_PANEL_SKILLS
          : INVENTORY_PANEL_ITEMS;
      this.inventoryNotice = "";
      return true;
    }

    if (this.inventoryPanel === INVENTORY_PANEL_SKILLS) {
      const skills = this.getPlayerSkills();
      if (skills.length <= 0) {
        if (input.wasPressed("confirm")) {
          this.showInventoryNotice("Nessuna abilita' disponibile.");
          return true;
        }
        return false;
      }

      if (this.skillIndex >= skills.length) {
        this.skillIndex = skills.length - 1;
      }

      if (input.wasPressed("up")) {
        this.skillIndex = (this.skillIndex + skills.length - 1) % skills.length;
        return true;
      }

      if (input.wasPressed("down")) {
        this.skillIndex = (this.skillIndex + 1) % skills.length;
        return true;
      }

      if (input.wasPressed("confirm")) {
        this.showInventoryNotice("Le abilita' si usano in battaglia.");
        return true;
      }
      return false;
    }

    const inventoryItems = this.getInventoryItems();
    if (inventoryItems.length === 0) {
      if (input.wasPressed("confirm")) {
        this.showInventoryNotice("Inventario vuoto.");
        return true;
      }
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

  drawInventoryPanelTabs(ctx) {
    const tabsY = 50;
    const tabsHeight = 20;
    const tabsGap = 6;
    const totalWidth = GAME_CONFIG.width - 24;
    const tabWidth = Math.floor((totalWidth - tabsGap) / 2);
    const leftTabX = 12;
    const rightTabX = leftTabX + tabWidth + tabsGap;

    this.drawPanel(ctx, leftTabX, tabsY, tabWidth, tabsHeight, {
      selected: this.inventoryPanel === INVENTORY_PANEL_ITEMS,
    });
    this.drawPanel(ctx, rightTabX, tabsY, tabWidth, tabsHeight, {
      selected: this.inventoryPanel === INVENTORY_PANEL_SKILLS,
    });

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "8px monospace";
    ctx.fillStyle =
      this.inventoryPanel === INVENTORY_PANEL_ITEMS
        ? PROFILE_THEME.textPrimary
        : PROFILE_THEME.textSecondary;
    ctx.fillText("OGGETTI", leftTabX + Math.round(tabWidth * 0.5), tabsY + Math.round(tabsHeight * 0.5) + 1);

    ctx.fillStyle =
      this.inventoryPanel === INVENTORY_PANEL_SKILLS
        ? PROFILE_THEME.textPrimary
        : PROFILE_THEME.textSecondary;
    ctx.fillText(
      "ABILITA'",
      rightTabX + Math.round(tabWidth * 0.5),
      tabsY + Math.round(tabsHeight * 0.5) + 1,
    );

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  drawInventoryItemsPanel(ctx) {
    const inventoryItems = this.getInventoryItems();

    if (inventoryItems.length === 0) {
      ctx.fillStyle = PROFILE_THEME.textPrimary;
      ctx.fillText("(vuoto)", 14, 82);
      return;
    }

    if (this.inventoryIndex >= inventoryItems.length) {
      this.inventoryIndex = inventoryItems.length - 1;
    }

    const maxVisible = 4;
    const windowStart = clampIndexWindow(this.inventoryIndex, inventoryItems.length, maxVisible);
    const visibleItems = inventoryItems.slice(windowStart, windowStart + maxVisible);
    const rowStartY = 74;
    const rowHeight = 20;

    visibleItems.forEach((item, visibleIndex) => {
      const itemIndex = windowStart + visibleIndex;
      const rowY = rowStartY + visibleIndex * rowHeight;
      const isSelected = itemIndex === this.inventoryIndex;
      this.drawPanel(ctx, 10, rowY, GAME_CONFIG.width - 20, rowHeight - 2, { selected: isSelected, inset: true });

      if (isSelected) {
        this.drawCursor(ctx, 14, rowY + 7);
      }

      const desc = truncate(`${item.description}`, 31);
      ctx.fillStyle = PROFILE_THEME.textPrimary;
      ctx.fillText(truncate(item.label, 12), 22, rowY + 3);
      ctx.textAlign = "right";
      ctx.fillText(`x${String(item.quantity)}`, GAME_CONFIG.width - 16, rowY + 3);
      ctx.textAlign = "left";
      ctx.fillStyle = PROFILE_THEME.textSecondary;
      ctx.fillText(desc, 22, rowY + 11);
    });
  }

  drawInventorySkillsPanel(ctx) {
    const skills = this.getPlayerSkills();
    if (skills.length <= 0) {
      this.drawPanel(ctx, 10, 74, GAME_CONFIG.width - 20, 86, { inset: true });
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = PROFILE_THEME.textPrimary;
      ctx.fillText("Nessuna abilita' appresa.", Math.round(GAME_CONFIG.width * 0.5), 108);
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      return;
    }

    if (this.skillIndex >= skills.length) {
      this.skillIndex = skills.length - 1;
    }

    const maxVisible = 4;
    const windowStart = clampIndexWindow(this.skillIndex, skills.length, maxVisible);
    const visibleSkills = skills.slice(windowStart, windowStart + maxVisible);
    const rowStartY = 74;
    const rowHeight = 20;

    visibleSkills.forEach((skill, visibleIndex) => {
      const skillIndex = windowStart + visibleIndex;
      const rowY = rowStartY + visibleIndex * rowHeight;
      const isSelected = skillIndex === this.skillIndex;
      this.drawPanel(ctx, 10, rowY, GAME_CONFIG.width - 20, rowHeight - 2, { selected: isSelected, inset: true });

      if (isSelected) {
        this.drawCursor(ctx, 14, rowY + 7);
      }

      ctx.fillStyle = PROFILE_THEME.textPrimary;
      ctx.fillText(truncate(skill.label, 17), 22, rowY + 3);
      ctx.textAlign = "right";
      ctx.fillText(`MP ${skill.manaCost ?? 0}`, GAME_CONFIG.width - 16, rowY + 3);
      ctx.textAlign = "left";
      ctx.fillStyle = PROFILE_THEME.textSecondary;
      ctx.fillText(truncate(`${skill.description ?? ""}`, 31), 22, rowY + 11);
    });

    ctx.fillStyle = PROFILE_THEME.textSecondary;
    ctx.fillText("In battaglia: menu SKILLS", 14, 157);
  }

  drawCoinCounter(ctx) {
    const coins = Math.max(0, Math.floor(Number(this.game.state.progress?.coins) || 0));
    this.drawPanel(ctx, 6, 30, GAME_CONFIG.width - 12, 14, { inset: true });
    drawCoinIcon(ctx, 14, 33);
    ctx.fillStyle = PROFILE_THEME.textPrimary;
    ctx.font = "8px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`MONETE ${coins}`, 30, 33);
  }

  getPlayerSkills() {
    const rawSkills = Object.values(this.game.state.skills ?? {});
    return rawSkills
      .filter((skill) => skill && typeof skill === "object")
      .map((skill) => ({
        id: String(skill.id ?? ""),
        label: String(skill.label ?? "ABILITA'"),
        description: String(skill.description ?? ""),
        manaCost: Math.max(0, Number(skill.manaCost) || 0),
      }));
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

    ctx.fillStyle = PROFILE_THEME.textSecondary;
    ctx.fillText(`${config.label}`, config.x, config.y);

    const barX = config.x + 22;
    const barY = config.y;
    const barW = config.width - 44;
    const barH = 8;

    this.drawPanel(ctx, barX, barY, barW, barH, { inset: true });

    ctx.fillStyle = config.color;
    ctx.fillRect(barX + 2, barY + 2, Math.max(0, Math.floor((barW - 4) * ratio)), barH - 4);

    ctx.fillStyle = PROFILE_THEME.textPrimary;
    ctx.fillText(`${safeValue}/${safeMax}`, barX + barW + 4, config.y);
  }

  drawSpeedBar(ctx, config, speedValue) {
    const safeSpeed = Math.max(0, Math.min(5, Math.floor(Number(speedValue) || 0)));

    ctx.fillStyle = PROFILE_THEME.textSecondary;
    ctx.fillText(`${config.label}`, config.x, config.y);

    const barX = config.x + 22;
    const barY = config.y;
    const barW = config.width - 44;
    const barH = 8;
    const totalSquares = 5;
    const gap = 2;

    this.drawPanel(ctx, barX, barY, barW, barH, { inset: true });

    const innerWidth = barW - 4;
    const squareWidth = Math.max(3, Math.floor((innerWidth - gap * (totalSquares - 1)) / totalSquares));
    const startX = barX + 2;
    const y = barY + 2;
    const h = barH - 4;

    for (let index = 0; index < totalSquares; index += 1) {
      const x = startX + index * (squareWidth + gap);
      ctx.fillStyle = index < safeSpeed ? "#f0c97d" : "rgba(68, 80, 101, 0.95)";
      ctx.fillRect(x, y, squareWidth, h);
    }

    ctx.fillStyle = PROFILE_THEME.textPrimary;
    ctx.fillText(`${safeSpeed}/5`, barX + barW + 4, config.y);
  }

  drawPanel(ctx, x, y, w, h, { selected = false, inset = false } = {}) {
    const radius = inset ? 4 : 6;
    const top = selected ? PROFILE_THEME.panelSelectedTop : PROFILE_THEME.panelTop;
    const bottom = selected ? PROFILE_THEME.panelSelectedBottom : PROFILE_THEME.panelBottom;

    ctx.fillStyle = PROFILE_THEME.panelShadow;
    ctx.fillRect(x + 2, y + 2, w, h);

    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    fillRoundedRect(ctx, x, y, w, h, radius);

    ctx.strokeStyle = PROFILE_THEME.panelBorder;
    ctx.lineWidth = 2;
    strokeRoundedRect(ctx, x, y, w, h, radius);

    ctx.strokeStyle = PROFILE_THEME.panelInnerBorder;
    ctx.lineWidth = 1;
    strokeRoundedRect(ctx, x + 1, y + 1, w - 2, h - 2, Math.max(3, radius - 1));
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
    ctx.fillStyle = "#e2b36a";
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

function clampIndexWindow(selectedIndex, totalItems, maxVisible) {
  const safeTotal = Math.max(0, Math.floor(totalItems) || 0);
  const safeVisible = Math.max(1, Math.floor(maxVisible) || 1);
  const safeIndex = Math.max(0, Math.min(Math.floor(selectedIndex) || 0, Math.max(0, safeTotal - 1)));
  const maxStart = Math.max(0, safeTotal - safeVisible);
  const centered = safeIndex - Math.floor(safeVisible / 2);
  return Math.max(0, Math.min(centered, maxStart));
}

function drawCoinIcon(ctx, x, y) {
  ctx.fillStyle = "#f3cf76";
  ctx.fillRect(x + 0, y + 3, 4, 3);
  ctx.fillRect(x + 4, y + 2, 4, 3);
  ctx.fillRect(x + 8, y + 3, 4, 3);
  ctx.fillStyle = "#8f6525";
  ctx.fillRect(x + 1, y + 4, 2, 1);
  ctx.fillRect(x + 5, y + 3, 2, 1);
  ctx.fillRect(x + 9, y + 4, 2, 1);
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
