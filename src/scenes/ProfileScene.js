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
const VIEW_PROFILE = "profile";
const VIEW_INVENTORY = "inventory";
const VIEW_SKILLS = "skills";
const PROFILE_TOP_Y = 62;
const PROFILE_INFO_HEIGHT = 64;
const PROFILE_PROGRESS_HEIGHT = PROFILE_INFO_HEIGHT;
const INVENTORY_LAYOUT = Object.freeze({
  containerX: 6,
  containerY: 62,
  containerW: GAME_CONFIG.width - 12,
  containerBottomPad: 4,
  tabsX: 12,
  tabsGap: 2,
  tabsH: 26,
  tabsTopPad: 4,
  listX: 10,
  listW: GAME_CONFIG.width - 20,
  listGapFromTabs: 4,
  listBottomPad: 4,
  rowHeight: 46,
  descMaxLines: 3,
});
let ACTIVE_UI_LOGICAL_HEIGHT = GAME_CONFIG.height;

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
    this.inventoryScrollY = {
      [INVENTORY_PANEL_ITEMS]: 0,
      [INVENTORY_PANEL_SKILLS]: 0,
    };
    this.uiBackgroundImage = createUiImage("../assets/UI/UI_background.png");
    this.goldenCoinImage = createUiImage("../assets/UI/UI_golden_coin.png");
    this.playerIdleImage = createUiImage("../assets/entity/character_animation_idle_r.png");
    this.playerIdleFrames = [];
    this.playerIdleFramesReady = false;

    this.pointerEventsBound = false;
    this.activePointerId = null;
    this.pointerStart = null;
    this.pointerLastScenePoint = null;
    this.pointerDidMove = false;
    this.pointerDragMode = "";
    this.pointerDragAccumulator = 0;
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onPointerCancel = this.onPointerCancel.bind(this);
  }

  onEnter(payload = {}) {
    this.returnScene = payload.returnScene ?? "world";
    this.returnPayload = payload.returnPayload ?? {};
    this.view = normalizeView(payload.view);
    this.time = 0;
    this.inventoryIndex = 0;
    this.skillIndex = 0;
    this.inventoryPanel = resolveListPanelForView(this.view, payload.panel);
    this.inventoryNotice = "";
    this.inventoryScrollY[INVENTORY_PANEL_ITEMS] = 0;
    this.inventoryScrollY[INVENTORY_PANEL_SKILLS] = 0;
    this.pointerLastScenePoint = null;
    this.pointerDidMove = false;
    this.pointerDragMode = "";
    this.pointerDragAccumulator = 0;
    this.bindPointerEvents();
    this.ensurePlayerIdleFrames();
  }

  onExit() {
    this.unbindPointerEvents();
    this.activePointerId = null;
    this.pointerStart = null;
    this.pointerLastScenePoint = null;
    this.pointerDidMove = false;
    this.pointerDragMode = "";
    this.pointerDragAccumulator = 0;
  }

  update(dt, input) {
    this.time += dt;
    this.ensurePlayerIdleFrames();

    if (input.wasPressed("profile")) {
      if (this.view === VIEW_PROFILE) {
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
      if (this.view === VIEW_INVENTORY) {
        this.closeScene();
        return;
      }

      this.game.changeScene("inventory", {
        returnScene: this.returnScene,
        returnPayload: this.returnPayload,
      });
      return;
    }

    if (input.wasPressed("skills")) {
      if (this.view === VIEW_SKILLS) {
        this.closeScene();
        return;
      }

      this.game.changeScene("skills", {
        returnScene: this.returnScene,
        returnPayload: this.returnPayload,
      });
      return;
    }

    if (isListViewValue(this.view) && this.updateInventoryInput(input)) {
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

    ACTIVE_UI_LOGICAL_HEIGHT = computeUiLogicalHeight(canvasWidth, canvasHeight);
    const scale = Math.max(
      0.01,
      Math.min(canvasWidth / GAME_CONFIG.width, canvasHeight / ACTIVE_UI_LOGICAL_HEIGHT),
    );
    const offsetX = Math.floor((canvasWidth - GAME_CONFIG.width * scale) * 0.5);
    const offsetY = Math.floor((canvasHeight - ACTIVE_UI_LOGICAL_HEIGHT * scale) * 0.5);

    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    if (this.view === VIEW_PROFILE) {
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
    const sceneHeight = ACTIVE_UI_LOGICAL_HEIGHT;

    const encounterCount = Array.isArray(progress.encounteredEnemyIds)
      ? progress.encounteredEnemyIds.length
      : 0;
    const battlesWon = progress.battlesWon ?? 0;
    const playTime = formatPlayTime(progress.playTimeSeconds ?? 0);

    const outerPad = 8;
    const splitGap = 4;
    const topRowWidth = GAME_CONFIG.width - outerPad * 2;
    const halfWidth = Math.floor((topRowWidth - splitGap) * 0.5);
    const infoX = outerPad;
    const infoY = PROFILE_TOP_Y;
    const infoW = halfWidth;
    const infoH = PROFILE_INFO_HEIGHT;
    const progressX = infoX + infoW + splitGap;
    const progressW = GAME_CONFIG.width - outerPad - progressX;
    const progressH = PROFILE_PROGRESS_HEIGHT;
    const progressY = PROFILE_TOP_Y;
    const equipTopGap = 8;
    const equipY = infoY + infoH + equipTopGap;
    const equipSize = Math.min(
      GAME_CONFIG.width - 16,
      Math.max(36, Math.floor(sceneHeight - equipY - 6)),
    );
    const equipX = Math.floor((GAME_CONFIG.width - equipSize) * 0.5);
    this.drawPanel(ctx, equipX, equipY, equipSize, equipSize);
    this.drawPanel(ctx, infoX, infoY, infoW, infoH);
    this.drawPanel(ctx, progressX, progressY, progressW, progressH);
    const infoTitleHeight = 14;
    const infoStatsHeight = 44;
    const infoTitleY = infoY + 2;
    const infoStatsY = infoTitleY + infoTitleHeight + 2;
    this.drawPanel(ctx, infoX + 6, infoTitleY, infoW - 12, infoTitleHeight, { inset: true });
    this.drawPanel(ctx, infoX + 6, infoStatsY, infoW - 12, infoStatsHeight, { inset: true });

    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    ctx.fillStyle = PROFILE_THEME.textPrimary;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      String(player.pgTitle ?? "Goblin").toUpperCase(),
      infoX + Math.round(infoW * 0.5),
      infoTitleY + Math.floor(infoTitleHeight * 0.5),
    );
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    this.drawStatBar(
      ctx,
      {
        x: infoX + 10,
        y: infoStatsY + 3,
        width: infoW - 24,
        label: "HP",
        color: "#5ad07a",
      },
      player.hp,
      player.maxHp,
    );

    this.drawStatBar(
      ctx,
      {
        x: infoX + 10,
        y: infoStatsY + 18,
        width: infoW - 24,
        label: "MP",
        color: "#63b9f0",
      },
      player.mana,
      player.maxMana,
    );

    this.drawSpeedBar(
      ctx,
      { x: infoX + 10, y: infoStatsY + 33, width: infoW - 24, label: "SP" },
      player.speed ?? 0,
    );

    ctx.fillStyle = PROFILE_THEME.textPrimary;
    this.drawProgressRow(ctx, progressX, progressY + 8, progressW, "Mostri incontrati", `${encounterCount}`);
    this.drawProgressRow(ctx, progressX, progressY + 22, progressW, "Mostri sconfitti", `${battlesWon}`);
    this.drawProgressRow(ctx, progressX, progressY + 36, progressW, "Tempo di vita", playTime);

    const navGap = 6;
    const navPad = 6;
    const navButtonWidth = Math.floor((GAME_CONFIG.width - navPad * 2 - navGap * 4) / 5);
    const coinCounterWidth = navButtonWidth + 28;
    this.drawCoinCounter(ctx, {
      x: equipX + equipSize - coinCounterWidth - 2,
      y: equipY + 2,
    });

    this.drawEquipmentSection(ctx, { x: equipX, y: equipY, w: equipSize, h: equipSize });
  }

  drawInventoryView(ctx) {
    const layout = getInventoryLayout({ showTabs: false });
    const activePanel = this.getActiveListPanel();
    this.inventoryPanel = activePanel;

    this.drawPanel(
      ctx,
      layout.container.x,
      layout.container.y,
      layout.container.w,
      layout.container.h,
    );

    ctx.font = "8px monospace";
    ctx.textBaseline = "top";

    if (activePanel === INVENTORY_PANEL_ITEMS) {
      this.drawInventoryItemsPanel(ctx, layout);
    } else {
      this.drawInventorySkillsPanel(ctx, layout);
    }
  }

  updateInventoryInput(input) {
    const activePanel = this.getActiveListPanel();
    this.inventoryPanel = activePanel;

    if (activePanel === INVENTORY_PANEL_SKILLS) {
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
        this.ensureSelectionVisible(activePanel, this.skillIndex);
        return true;
      }

      if (input.wasPressed("down")) {
        this.skillIndex = (this.skillIndex + 1) % skills.length;
        this.ensureSelectionVisible(activePanel, this.skillIndex);
        return true;
      }

      if (input.wasPressed("confirm")) {
        const selectedSkill = skills[this.skillIndex];
        if (selectedSkill) {
          this.showInventoryNotice(
            `${selectedSkill.label} | MP ${selectedSkill.manaCost ?? 0}`,
          );
        }
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
      this.ensureSelectionVisible(activePanel, this.inventoryIndex);
      return true;
    }

    if (input.wasPressed("down")) {
      this.inventoryIndex = (this.inventoryIndex + 1) % inventoryItems.length;
      this.ensureSelectionVisible(activePanel, this.inventoryIndex);
      return true;
    }

    if (input.wasPressed("confirm")) {
      this.useSelectedInventoryItem(inventoryItems[this.inventoryIndex]);
      return true;
    }

    return false;
  }

  getActiveListPanel() {
    return resolveListPanelForView(this.view, this.inventoryPanel);
  }

  switchInventoryPanel(nextPanel) {
    const panel = nextPanel === INVENTORY_PANEL_SKILLS ? INVENTORY_PANEL_SKILLS : INVENTORY_PANEL_ITEMS;
    if (this.inventoryPanel === panel) {
      return;
    }
    this.inventoryPanel = panel;
    this.inventoryNotice = "";
  }

  getInventoryScroll(panel) {
    const key = panel === INVENTORY_PANEL_SKILLS ? INVENTORY_PANEL_SKILLS : INVENTORY_PANEL_ITEMS;
    return Number(this.inventoryScrollY[key]) || 0;
  }

  setInventoryScroll(panel, value) {
    const key = panel === INVENTORY_PANEL_SKILLS ? INVENTORY_PANEL_SKILLS : INVENTORY_PANEL_ITEMS;
    const safeValue = Number(value) || 0;
    const maxScroll = getInventoryMaxScrollByPanel(this, key);
    this.inventoryScrollY[key] = Math.max(0, Math.min(maxScroll, safeValue));
  }

  ensureSelectionVisible(panel, index) {
    const rowLayout = getInventoryRowsLayout(panel);
    const targetTop = index * rowLayout.rowHeight;
    const targetBottom = targetTop + rowLayout.rowHeight;
    const currentScroll = this.getInventoryScroll(panel);
    const viewportBottom = currentScroll + rowLayout.listH;

    if (targetTop < currentScroll) {
      this.setInventoryScroll(panel, targetTop);
      return;
    }

    if (targetBottom > viewportBottom) {
      this.setInventoryScroll(panel, targetBottom - rowLayout.listH);
    }
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
    canvas.addEventListener("pointermove", this.onPointerMove);
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
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.pointerEventsBound = false;
  }

  onPointerDown(event) {
    if (!isListViewValue(this.view)) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    this.activePointerId = event.pointerId;
    this.pointerStart = { x: event.clientX, y: event.clientY };
    this.pointerDidMove = false;
    this.pointerDragAccumulator = 0;
    this.pointerLastScenePoint = this.resolveScenePointFromPointer(event);
    const activePanel = this.getActiveListPanel();
    const layout = getInventoryLayout({ showTabs: false });
    this.inventoryPanel = activePanel;
    this.pointerDragMode =
      this.pointerLastScenePoint &&
      pointInRect(this.pointerLastScenePoint, getInventoryListRect(activePanel, layout))
        ? "list"
        : "tap";
    this.game.canvas.setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event) {
    if (this.activePointerId !== event.pointerId || !this.pointerStart || !isListViewValue(this.view)) {
      return;
    }

    const point = this.resolveScenePointFromPointer(event);
    if (!point) {
      return;
    }

    const travelX = event.clientX - this.pointerStart.x;
    const travelY = event.clientY - this.pointerStart.y;
    if (Math.hypot(travelX, travelY) > 10) {
      this.pointerDidMove = true;
    }

    if (this.pointerDragMode === "list" && this.pointerLastScenePoint) {
      const deltaY = point.y - this.pointerLastScenePoint.y;
      this.applyInventoryDrag(deltaY);
    }

    this.pointerLastScenePoint = point;
  }

  onPointerUp(event) {
    if (this.activePointerId !== event.pointerId || !this.pointerStart) {
      return;
    }

    const deltaX = event.clientX - this.pointerStart.x;
    const deltaY = event.clientY - this.pointerStart.y;
    const moved = this.pointerDidMove || Math.hypot(deltaX, deltaY) > 10;
    this.pointerStart = null;
    this.activePointerId = null;
    this.pointerLastScenePoint = null;
    this.pointerDidMove = false;
    this.pointerDragMode = "";
    this.pointerDragAccumulator = 0;
    this.game.canvas.releasePointerCapture?.(event.pointerId);

    if (moved || !isListViewValue(this.view)) {
      return;
    }

    const point = this.resolveScenePointFromPointer(event);
    if (!point) {
      return;
    }

    this.handleInventoryTap(point);
  }

  onPointerCancel(event) {
    if (this.activePointerId !== event.pointerId) {
      return;
    }

    this.pointerStart = null;
    this.activePointerId = null;
    this.pointerLastScenePoint = null;
    this.pointerDidMove = false;
    this.pointerDragMode = "";
    this.pointerDragAccumulator = 0;
    this.game.canvas.releasePointerCapture?.(event.pointerId);
  }

  applyInventoryDrag(deltaY) {
    if (!Number.isFinite(deltaY) || Math.abs(deltaY) < 0.25) {
      return;
    }

    const maxScroll = getInventoryMaxScrollByPanel(this, this.inventoryPanel);
    if (maxScroll <= 0) {
      return;
    }

    const nextScroll = this.getInventoryScroll(this.inventoryPanel) - deltaY;
    this.setInventoryScroll(this.inventoryPanel, nextScroll);
  }

  shiftInventorySelection(delta) {
    const shift = Math.trunc(delta);
    if (shift === 0) {
      return;
    }

    if (this.inventoryPanel === INVENTORY_PANEL_SKILLS) {
      const skills = this.getPlayerSkills();
      if (skills.length <= 0) {
        return;
      }
      this.skillIndex = Math.max(0, Math.min(skills.length - 1, this.skillIndex + shift));
      return;
    }

    const items = this.getInventoryItems();
    if (items.length <= 0) {
      return;
    }
    this.inventoryIndex = Math.max(0, Math.min(items.length - 1, this.inventoryIndex + shift));
  }

  handleInventoryTap(point) {
    const layout = getInventoryLayout({ showTabs: false });
    if (!layout.showTabs) {
      return;
    }

    const tabRects = getInventoryTabRects(layout);
    if (pointInRect(point, tabRects.items)) {
      this.switchInventoryPanel(INVENTORY_PANEL_ITEMS);
      return;
    }

    if (pointInRect(point, tabRects.skills)) {
      this.switchInventoryPanel(INVENTORY_PANEL_SKILLS);
    }
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
    const logicalHeight = computeUiLogicalHeight(canvas.width, canvas.height);
    ACTIVE_UI_LOGICAL_HEIGHT = logicalHeight;
    const scale = Math.max(
      0.01,
      Math.min(canvas.width / GAME_CONFIG.width, canvas.height / logicalHeight),
    );
    const offsetX = (canvas.width - GAME_CONFIG.width * scale) * 0.5;
    const offsetY = (canvas.height - logicalHeight * scale) * 0.5;
    const sceneX = (canvasX - offsetX) / scale;
    const sceneY = (canvasY - offsetY) / scale;
    if (sceneX < 0 || sceneY < 0 || sceneX > GAME_CONFIG.width || sceneY > logicalHeight) {
      return null;
    }

    return { x: sceneX, y: sceneY };
  }

  drawInventoryPanelTabs(ctx, layout) {
    const tabRects = getInventoryTabRects(layout);
    const leftTabRect = tabRects.items;
    const rightTabRect = tabRects.skills;

    this.drawPanel(ctx, leftTabRect.x, leftTabRect.y, leftTabRect.w, leftTabRect.h, {
      selected: this.inventoryPanel === INVENTORY_PANEL_ITEMS,
    });
    this.drawPanel(ctx, rightTabRect.x, rightTabRect.y, rightTabRect.w, rightTabRect.h, {
      selected: this.inventoryPanel === INVENTORY_PANEL_SKILLS,
    });

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "8px monospace";
    ctx.fillStyle =
      this.inventoryPanel === INVENTORY_PANEL_ITEMS
        ? PROFILE_THEME.textPrimary
        : PROFILE_THEME.textSecondary;
    ctx.fillText(
      "OGGETTI",
      leftTabRect.x + Math.round(leftTabRect.w * 0.5),
      leftTabRect.y + Math.round(leftTabRect.h * 0.5) + 1,
    );

    ctx.fillStyle =
      this.inventoryPanel === INVENTORY_PANEL_SKILLS
        ? PROFILE_THEME.textPrimary
        : PROFILE_THEME.textSecondary;
    ctx.fillText(
      "ABILITA'",
      rightTabRect.x + Math.round(rightTabRect.w * 0.5),
      rightTabRect.y + Math.round(rightTabRect.h * 0.5) + 1,
    );

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  drawInventoryItemsPanel(ctx, layout) {
    const inventoryItems = this.getInventoryItems();

    if (inventoryItems.length === 0) {
      ctx.fillStyle = PROFILE_THEME.textPrimary;
      ctx.fillText("(vuoto)", layout.list.x + 4, layout.list.y + 4);
      return;
    }

    if (this.inventoryIndex >= inventoryItems.length) {
      this.inventoryIndex = inventoryItems.length - 1;
    }

    const rowLayout = getInventoryRowsLayout(INVENTORY_PANEL_ITEMS, layout);
    const rowHeight = rowLayout.rowHeight;
    this.setInventoryScroll(INVENTORY_PANEL_ITEMS, this.getInventoryScroll(INVENTORY_PANEL_ITEMS));
    const scrollY = this.getInventoryScroll(INVENTORY_PANEL_ITEMS);

    ctx.save();
    ctx.beginPath();
    ctx.rect(rowLayout.x, rowLayout.y, rowLayout.w, rowLayout.listH);
    ctx.clip();

    inventoryItems.forEach((item, itemIndex) => {
      const rowY = rowLayout.y + itemIndex * rowHeight - scrollY;
      if (rowY + rowHeight < rowLayout.y || rowY > rowLayout.y + rowLayout.listH) {
        return;
      }
      const isSelected = itemIndex === this.inventoryIndex;
      this.drawPanel(ctx, rowLayout.x, rowY, rowLayout.w, rowHeight - 4, {
        selected: isSelected,
        inset: true,
      });

      const descLines = splitTextIntoLines(
        sanitizeDescriptionText(item.description),
        31,
        INVENTORY_LAYOUT.descMaxLines,
      ).map((line) => sanitizeDescriptionText(line));
      ctx.fillStyle = PROFILE_THEME.textPrimary;
      ctx.fillText(truncate(item.label, 16), 22, rowY + 5);
      ctx.textAlign = "right";
      ctx.fillText(`x${String(item.quantity)}`, GAME_CONFIG.width - 16, rowY + 5);
      ctx.textAlign = "left";
      ctx.fillStyle = PROFILE_THEME.textSecondary;
      descLines.forEach((line, lineIndex) => {
        ctx.fillText(line, 22, rowY + 17 + lineIndex * 9);
      });
    });
    ctx.restore();
  }

  drawInventorySkillsPanel(ctx, layout) {
    const skills = this.getPlayerSkills();
    if (skills.length <= 0) {
      this.drawPanel(ctx, layout.list.x, layout.list.y, layout.list.w, layout.list.h, {
        inset: true,
      });
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = PROFILE_THEME.textPrimary;
      ctx.fillText(
        "Nessuna abilita' appresa.",
        Math.round(GAME_CONFIG.width * 0.5),
        layout.list.y + Math.round(layout.list.h * 0.5),
      );
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      return;
    }

    if (this.skillIndex >= skills.length) {
      this.skillIndex = skills.length - 1;
    }

    const rowLayout = getInventoryRowsLayout(INVENTORY_PANEL_SKILLS, layout);
    const rowHeight = rowLayout.rowHeight;
    this.setInventoryScroll(INVENTORY_PANEL_SKILLS, this.getInventoryScroll(INVENTORY_PANEL_SKILLS));
    const scrollY = this.getInventoryScroll(INVENTORY_PANEL_SKILLS);

    ctx.save();
    ctx.beginPath();
    ctx.rect(rowLayout.x, rowLayout.y, rowLayout.w, rowLayout.listH);
    ctx.clip();

    skills.forEach((skill, skillIndex) => {
      const rowY = rowLayout.y + skillIndex * rowHeight - scrollY;
      if (rowY + rowHeight < rowLayout.y || rowY > rowLayout.y + rowLayout.listH) {
        return;
      }
      const isSelected = skillIndex === this.skillIndex;
      this.drawPanel(ctx, rowLayout.x, rowY, rowLayout.w, rowHeight - 4, {
        selected: isSelected,
        inset: true,
      });

      const descLines = splitTextIntoLines(
        sanitizeDescriptionText(skill.description ?? ""),
        31,
        INVENTORY_LAYOUT.descMaxLines,
      ).map((line) => sanitizeDescriptionText(line));
      ctx.fillStyle = PROFILE_THEME.textPrimary;
      ctx.fillText(truncate(skill.label, 16), 22, rowY + 5);
      ctx.textAlign = "right";
      ctx.fillText(`MP ${skill.manaCost ?? 0}`, GAME_CONFIG.width - 16, rowY + 5);
      ctx.textAlign = "left";
      ctx.fillStyle = PROFILE_THEME.textSecondary;
      descLines.forEach((line, lineIndex) => {
        ctx.fillText(line, 22, rowY + 17 + lineIndex * 9);
      });
    });
    ctx.restore();
  }

  drawCoinCounter(ctx, position = null) {
    const layout = getInventoryLayout();
    const coins = Math.max(0, Math.floor(Number(this.game.state.progress?.coins) || 0));
    const navGap = 6;
    const navPad = 6;
    const navButtonWidth = Math.floor((GAME_CONFIG.width - navPad * 2 - navGap * 4) / 5);
    const counterWidth = navButtonWidth + 28;
    const counterHeight = 36;
    const hasCustomPosition =
      position &&
      Number.isFinite(position.x) &&
      Number.isFinite(position.y);
    const counterX = hasCustomPosition
      ? Math.round(position.x)
      : GAME_CONFIG.width - navPad - navButtonWidth;
    const counterY = hasCustomPosition
      ? Math.round(position.y)
      : Math.max(22, layout.container.y - 18);
    this.drawPanel(ctx, counterX, counterY, counterWidth, counterHeight, { inset: true });
    const iconSize = 32;
    const centerY = counterY + Math.round(counterHeight * 0.5);
    drawCoinAsset(
      ctx,
      this.goldenCoinImage,
      counterX + 4,
      centerY - Math.floor(iconSize * 0.5),
      iconSize,
    );
    ctx.fillStyle = PROFILE_THEME.textPrimary;
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(coins), counterX + counterWidth - 6, centerY);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
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

    const labelWidth = 10;
    const barX = config.x + labelWidth + 2;
    const barY = config.y;
    const barW = Math.max(20, config.width - labelWidth - 2);
    const barH = 10;
    const centerY = barY + Math.floor(barH * 0.5);

    ctx.font = "7px monospace";
    ctx.fillStyle = PROFILE_THEME.textSecondary;
    ctx.textBaseline = "middle";
    ctx.fillText(`${config.label}`, config.x, centerY);

    this.drawPanel(ctx, barX, barY, barW, barH, { inset: true });

    ctx.fillStyle = config.color;
    ctx.fillRect(barX + 2, barY + 2, Math.max(0, Math.floor((barW - 4) * ratio)), barH - 4);

    ctx.fillStyle = "#101010";
    ctx.font = "7px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${safeValue}/${safeMax}`, barX + Math.floor(barW * 0.5), centerY);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  drawSpeedBar(ctx, config, speedValue) {
    const safeSpeed = Math.max(0, Math.min(5, Math.floor(Number(speedValue) || 0)));

    const labelWidth = 10;
    const barX = config.x + labelWidth + 2;
    const barY = config.y;
    const barW = Math.max(20, config.width - labelWidth - 2);
    const barH = 10;
    const centerY = barY + Math.floor(barH * 0.5);
    const totalSquares = 5;
    const gap = 2;

    ctx.font = "7px monospace";
    ctx.fillStyle = PROFILE_THEME.textSecondary;
    ctx.textBaseline = "middle";
    ctx.fillText(`${config.label}`, config.x, centerY);

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

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  drawProgressRow(ctx, panelX, rowY, panelWidth, label, value) {
    ctx.fillStyle = PROFILE_THEME.textPrimary;
    ctx.textAlign = "left";
    ctx.fillText(label, panelX + 10, rowY);
    ctx.textAlign = "right";
    ctx.fillText(value, panelX + panelWidth - 10, rowY);
    ctx.textAlign = "left";
  }

  drawEquipmentSection(ctx, rect) {
    ctx.fillStyle = PROFILE_THEME.textPrimary;
    ctx.font = "8px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("EQUIPAGGIAMENTO", rect.x + 8, rect.y + 8);

    const innerPad = 8;
    const targetSlotSize = 40;
    const minHorizontalGap = 8;
    const contentTop = rect.y + 20;
    const contentBottom = rect.y + rect.h - innerPad;
    const contentHeight = Math.max(20, contentBottom - contentTop);
    const maxSlotByWidth = Math.floor((rect.w - innerPad * 2 - minHorizontalGap) / 2);
    const maxSlotByHeight = Math.floor(contentHeight / 2);
    const slotSize = Math.max(12, Math.min(targetSlotSize, maxSlotByWidth, maxSlotByHeight));
    const remainingHeight = Math.max(0, contentHeight - slotSize * 2);
    const slotVerticalGap = Math.min(12, remainingHeight);
    const slotStackHeight = slotSize * 2 + slotVerticalGap;
    const topY = contentTop + Math.floor((contentHeight - slotStackHeight) * 0.5);
    const bottomY = topY + slotSize + slotVerticalGap;
    const leftX = rect.x + innerPad;
    const rightX = rect.x + rect.w - slotSize - innerPad;

    this.drawPanel(ctx, leftX, topY, slotSize, slotSize, { inset: true });
    this.drawPanel(ctx, rightX, topY, slotSize, slotSize, { inset: true });
    this.drawPanel(ctx, leftX, bottomY, slotSize, slotSize, { inset: true });
    this.drawPanel(ctx, rightX, bottomY, slotSize, slotSize, { inset: true });

    this.drawPlayerIdleSprite(ctx, {
      x: rect.x + Math.round(rect.w * 0.5),
      y: rect.y + Math.round(rect.h * 0.5),
      maxHeight: Math.max(12, Math.floor((rect.h - 12) * 0.34)),
    });
  }

  drawPlayerIdleSprite(ctx, { x, y, maxHeight = 34 } = {}) {
    const fallbackImage = this.playerIdleImage;
    const frameCount = Math.max(1, this.playerIdleFrames.length || 4);
    const frameIndex = Math.floor(this.time * 6) % frameCount;
    const maskedFrame = this.playerIdleFrames[frameIndex] ?? null;

    let sourceImage = maskedFrame;
    let sourceX = 0;
    let sourceWidth = maskedFrame?.width ?? 0;
    let sourceHeight = maskedFrame?.height ?? 0;

    if (!sourceImage) {
      if (
        !fallbackImage ||
        !fallbackImage.complete ||
        fallbackImage.naturalWidth <= 0 ||
        fallbackImage.naturalHeight <= 0
      ) {
        return;
      }
      sourceImage = fallbackImage;
      sourceWidth = Math.max(1, Math.floor(fallbackImage.naturalWidth / 4));
      sourceHeight = Math.max(1, fallbackImage.naturalHeight);
      sourceX = frameIndex * sourceWidth;
    }

    const drawHeight = Math.max(36, Math.floor(maxHeight));
    const drawWidth = Math.max(12, Math.floor((drawHeight * sourceWidth) / sourceHeight));
    const drawX = Math.round(x - drawWidth * 0.5);
    const drawY = Math.round(y - drawHeight * 0.5);
    ctx.imageSmoothingEnabled = false;

    if (maskedFrame) {
      ctx.drawImage(sourceImage, drawX, drawY, drawWidth, drawHeight);
      return;
    }

    ctx.drawImage(sourceImage, sourceX, 0, sourceWidth, sourceHeight, drawX, drawY, drawWidth, drawHeight);
  }

  ensurePlayerIdleFrames() {
    if (this.playerIdleFramesReady) {
      return;
    }

    if (!isUiImageUsable(this.playerIdleImage)) {
      return;
    }

    const frameCount = 4;
    const frameWidth = Math.max(1, Math.floor((this.playerIdleImage.naturalWidth || this.playerIdleImage.width) / frameCount));
    const frameHeight = Math.max(1, this.playerIdleImage.naturalHeight || this.playerIdleImage.height);
    this.playerIdleFrames = buildMaskedSpriteFrames(this.playerIdleImage, {
      frameWidth,
      frameHeight,
      frameCount,
    });
    this.playerIdleFramesReady = true;
  }

  drawPanel(ctx, x, y, w, h, { selected = false, inset = false } = {}) {
    const radius = inset ? 4 : 6;
    const top = PROFILE_THEME.panelTop;
    const bottom = PROFILE_THEME.panelBottom;

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

}

function normalizeView(value) {
  if (value === VIEW_INVENTORY) {
    return VIEW_INVENTORY;
  }
  if (value === VIEW_SKILLS) {
    return VIEW_SKILLS;
  }
  return VIEW_PROFILE;
}

function normalizeInventoryPanel(value) {
  return value === INVENTORY_PANEL_SKILLS ? INVENTORY_PANEL_SKILLS : INVENTORY_PANEL_ITEMS;
}

function isListViewValue(view) {
  return view === VIEW_INVENTORY || view === VIEW_SKILLS;
}

function resolveListPanelForView(view, fallbackPanel) {
  if (view === VIEW_SKILLS) {
    return INVENTORY_PANEL_SKILLS;
  }
  if (view === VIEW_INVENTORY) {
    return INVENTORY_PANEL_ITEMS;
  }
  return normalizeInventoryPanel(fallbackPanel);
}

function truncate(text, maxLen) {
  if (text.length <= maxLen) {
    return text;
  }

  return `${text.slice(0, maxLen - 1)}.`;
}

function sanitizeDescriptionText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\.+$/g, "");
}

function splitTextIntoLines(text, maxLen, maxLines = 2) {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    return [""];
  }

  const words = normalized.split(" ");
  const lines = [];
  let currentLine = "";

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const candidate = currentLine.length === 0 ? word : `${currentLine} ${word}`;
    if (candidate.length <= maxLen) {
      currentLine = candidate;
      continue;
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
      if (lines.length >= maxLines) {
        break;
      }
      currentLine = word;
      continue;
    }

    lines.push(truncate(word, maxLen));
    if (lines.length >= maxLines) {
      break;
    }
    currentLine = "";
  }

  if (lines.length < maxLines && currentLine.length > 0) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  if (lines.length === maxLines && words.length > 0) {
    const usedChars = lines.join(" ").length;
    if (normalized.length > usedChars) {
      lines[maxLines - 1] = truncate(lines[maxLines - 1], maxLen);
    }
  }

  return lines;
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

function computeUiLogicalHeight(canvasWidth, canvasHeight) {
  const safeWidth = Math.max(1, Number(canvasWidth) || GAME_CONFIG.width);
  const safeHeight = Math.max(1, Number(canvasHeight) || GAME_CONFIG.height);
  return Math.max(GAME_CONFIG.height, Math.round((safeHeight * GAME_CONFIG.width) / safeWidth));
}

function getInventoryLayout({ showTabs = false } = {}) {
  const containerX = INVENTORY_LAYOUT.containerX;
  const containerY = INVENTORY_LAYOUT.containerY;
  const containerW = INVENTORY_LAYOUT.containerW;
  const containerH = Math.max(
    60,
    Math.floor(ACTIVE_UI_LOGICAL_HEIGHT - containerY - INVENTORY_LAYOUT.containerBottomPad),
  );

  const tabsX = INVENTORY_LAYOUT.tabsX;
  const tabsY = containerY + INVENTORY_LAYOUT.tabsTopPad;
  const tabsGap = INVENTORY_LAYOUT.tabsGap;
  const tabsHeight = showTabs ? INVENTORY_LAYOUT.tabsH : 0;
  const tabsTotalWidth = GAME_CONFIG.width - tabsX * 2;
  const tabWidth = Math.floor((tabsTotalWidth - tabsGap) / 2);

  const listX = INVENTORY_LAYOUT.listX;
  const listY = tabsY + tabsHeight + (showTabs ? INVENTORY_LAYOUT.listGapFromTabs : 0);
  const listW = INVENTORY_LAYOUT.listW;
  const listBottom = containerY + containerH - INVENTORY_LAYOUT.listBottomPad;
  const listH = Math.max(20, listBottom - listY);

  return {
    showTabs,
    container: {
      x: containerX,
      y: containerY,
      w: containerW,
      h: containerH,
    },
    tabs: {
      x: tabsX,
      y: tabsY,
      h: tabsHeight,
      gap: tabsGap,
      tabWidth,
    },
    list: {
      x: listX,
      y: listY,
      w: listW,
      h: listH,
    },
  };
}

function getInventoryTabRects(layout = getInventoryLayout({ showTabs: false })) {
  return {
    items: {
      x: layout.tabs.x,
      y: layout.tabs.y,
      w: layout.tabs.tabWidth,
      h: layout.tabs.h,
    },
    skills: {
      x: layout.tabs.x + layout.tabs.tabWidth + layout.tabs.gap,
      y: layout.tabs.y,
      w: layout.tabs.tabWidth,
      h: layout.tabs.h,
    },
  };
}

function getInventoryRowsLayout(panel, layout = getInventoryLayout({ showTabs: false })) {
  return {
    x: layout.list.x,
    y: layout.list.y,
    w: layout.list.w,
    listH: layout.list.h,
    rowHeight: INVENTORY_LAYOUT.rowHeight,
  };
}

function getInventoryListRect(panel, layout = getInventoryLayout({ showTabs: false })) {
  const rowLayout = getInventoryRowsLayout(panel, layout);
  return {
    x: rowLayout.x,
    y: rowLayout.y,
    w: rowLayout.w,
    h: rowLayout.listH,
  };
}

function getInventoryMaxScrollByPanel(scene, panel, layout = getInventoryLayout({ showTabs: false })) {
  const rowLayout = getInventoryRowsLayout(panel, layout);
  const totalItems =
    panel === INVENTORY_PANEL_SKILLS
      ? scene.getPlayerSkills().length
      : scene.getInventoryItems().length;
  return Math.max(0, totalItems * rowLayout.rowHeight - rowLayout.listH);
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

function isUiImageUsable(image) {
  return Boolean(image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
}

function buildMaskedSpriteFrames(sourceImage, { frameWidth, frameHeight, frameCount }) {
  if (typeof document === "undefined") {
    return [];
  }

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = sourceImage.naturalWidth || sourceImage.width;
  sourceCanvas.height = sourceImage.naturalHeight || sourceImage.height;
  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) {
    return [];
  }
  sourceContext.drawImage(sourceImage, 0, 0);

  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = frameWidth;
  frameCanvas.height = frameHeight;
  const frameContext = frameCanvas.getContext("2d");
  if (!frameContext) {
    return [];
  }

  const frames = [];
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const sourceX = frameIndex * frameWidth;
    if (sourceX >= sourceCanvas.width) {
      break;
    }

    frameContext.clearRect(0, 0, frameWidth, frameHeight);
    frameContext.drawImage(
      sourceCanvas,
      sourceX,
      0,
      frameWidth,
      frameHeight,
      0,
      0,
      frameWidth,
      frameHeight,
    );

    const imageData = frameContext.getImageData(0, 0, frameWidth, frameHeight);
    maskFrameBackground(imageData.data, frameWidth, frameHeight);

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = frameWidth;
    outputCanvas.height = frameHeight;
    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) {
      continue;
    }

    outputContext.putImageData(imageData, 0, 0);
    frames.push(outputCanvas);
  }

  return frames;
}

function maskFrameBackground(pixelData, width, height) {
  const backgroundSamples = collectBorderColorSamples(pixelData, width, height);
  if (backgroundSamples.length <= 0) {
    return;
  }

  const backgroundMinDistance = 20;
  const totalPixels = width * height;
  const queue = new Uint32Array(totalPixels);
  const visited = new Uint8Array(totalPixels);
  let queueHead = 0;
  let queueTail = 0;

  const tryQueuePixel = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) {
      return;
    }

    const dataOffset = pixelIndex * 4;
    const alpha = pixelData[dataOffset + 3];
    if (alpha <= 0) {
      visited[pixelIndex] = 1;
      return;
    }

    const minDistance = getMinColorDistance(pixelData, dataOffset, backgroundSamples);
    if (minDistance > backgroundMinDistance) {
      return;
    }

    visited[pixelIndex] = 1;
    queue[queueTail] = pixelIndex;
    queueTail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    tryQueuePixel(x, 0);
    tryQueuePixel(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    tryQueuePixel(0, y);
    tryQueuePixel(width - 1, y);
  }

  while (queueHead < queueTail) {
    const pixelIndex = queue[queueHead];
    queueHead += 1;
    const x = pixelIndex % width;
    const y = (pixelIndex - x) / width;
    const dataOffset = pixelIndex * 4;
    pixelData[dataOffset + 3] = 0;

    tryQueuePixel(x + 1, y);
    tryQueuePixel(x - 1, y);
    tryQueuePixel(x, y + 1);
    tryQueuePixel(x, y - 1);
  }
}

function collectBorderColorSamples(pixelData, width, height) {
  const samples = [];
  const seen = new Set();

  const addSampleAt = (x, y, { preferBackground = true } = {}) => {
    const safeX = clampNumber(Math.floor(x), 0, width - 1);
    const safeY = clampNumber(Math.floor(y), 0, height - 1);
    const dataOffset = (safeY * width + safeX) * 4;
    const alpha = pixelData[dataOffset + 3];
    if (alpha <= 0) {
      return;
    }

    const r = pixelData[dataOffset];
    const g = pixelData[dataOffset + 1];
    const b = pixelData[dataOffset + 2];

    if (preferBackground) {
      if (b < g + 8 || b < r + 12) {
        return;
      }
      const brightness = (r + g + b) / 3;
      if (brightness < 96) {
        return;
      }
    }

    const dedupeKey = `${r >> 3}:${g >> 3}:${b >> 3}`;
    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    samples.push({ r, g, b });
  };

  for (let x = 0; x < width; x += 1) {
    addSampleAt(x, 0, { preferBackground: true });
    addSampleAt(x, height - 1, { preferBackground: true });
  }
  for (let y = 0; y < height; y += 1) {
    addSampleAt(0, y, { preferBackground: true });
    addSampleAt(width - 1, y, { preferBackground: true });
  }

  if (samples.length > 0) {
    return samples;
  }

  for (let x = 0; x < width; x += 1) {
    addSampleAt(x, 0, { preferBackground: false });
    addSampleAt(x, height - 1, { preferBackground: false });
  }
  for (let y = 0; y < height; y += 1) {
    addSampleAt(0, y, { preferBackground: false });
    addSampleAt(width - 1, y, { preferBackground: false });
  }

  return samples;
}

function getMinColorDistance(pixelData, dataOffset, colorSamples) {
  const r = pixelData[dataOffset];
  const g = pixelData[dataOffset + 1];
  const b = pixelData[dataOffset + 2];

  let minDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < colorSamples.length; index += 1) {
    const sample = colorSamples[index];
    const distance = Math.abs(r - sample.r) + Math.abs(g - sample.g) + Math.abs(b - sample.b);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance;
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
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

function drawCoinAsset(ctx, image, x, y, size = 8) {
  if (isUiImageUsable(image)) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, Math.round(x), Math.round(y), size, size);
    return;
  }

  drawCoinIcon(ctx, x, y);
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
