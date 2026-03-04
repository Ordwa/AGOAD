import { Scene } from "../core/Scene.js";
import { GAME_CONFIG, PLAYER_CONFIG } from "../data/constants.js";
import { AUTO_SAVE_TRIGGER } from "../data/autoSave.js";
import { MAP_LAYOUT, WORLD_MAP_ASSET_PATH } from "../data/map.js";
import { clamp, pickRandom, randomInt } from "../utils/math.js";

const MAIN_OPTIONS = ["COMBATTI", "BORSA", "ABILITA'", "FUGA"];

const BATTLEFIELD_BASE_BOTTOM = 124;
const MESSAGE_BOX_HEIGHT = 40;
const INVENTORY_PANEL_PAD = 10;
const PLAYER_BASE_HEIGHT = 30;
const COMMAND_BUTTON_HALF_W = 38;
const COMMAND_BUTTON_HALF_H = 22;
const PLAYER_IDLE_FRAME_COUNT = 4;
const PLAYER_IDLE_FPS = 5;
let ACTIVE_BATTLE_LOGICAL_HEIGHT = GAME_CONFIG.height;

export class BattleScene extends Scene {
  constructor(game) {
    super(game);

    this.enemy = null;

    this.currentMessage = "";
    this.messageQueue = [];
    this.onMessagesDone = null;

    this.phase = "messages";
    this.mainMenuIndex = 0;
    this.fightMenuIndex = 0;
    this.skillMenuIndex = 0;
    this.bagMenuIndex = 0;
    this.entryPopup = null;

    this.enemyDisplayHp = 0;
    this.playerDisplayHp = 0;
    this.hpAnimation = null;
    this.enemySkipTurns = 0;

    this.floatTimer = 0;
    this.uiBackgroundImage = createUiImage("../assets/UI/UI_background.png");
    this.playerBattleSpriteImage = createUiImage("../assets/entity/character_animation_idle_r.png");
    this.playerBattleFrames = [];
    this.playerBattleFramesReady = false;
    this.worldMapBackdropImage = createUiImage(WORLD_MAP_ASSET_PATH);
    this.encounterTileX = null;
    this.encounterTileY = null;
    this.layout = getBattleLayout(GAME_CONFIG.height);
    this.battleBackdropCanvas = null;
    this.battleBackdropHeight = 0;
    this.battleBackdropBottom = 0;

    this.pointerEventsBound = false;
    this.onPointerDown = this.onPointerDown.bind(this);
  }

  onEnter(payload = {}) {
    if (payload.resume) {
      this.entryPopup = null;
      this.bindPointerEvents();
      return;
    }

    const encounterTileX = Number(payload.encounterTileX);
    const encounterTileY = Number(payload.encounterTileY);
    this.encounterTileX = Number.isFinite(encounterTileX) ? encounterTileX : null;
    this.encounterTileY = Number.isFinite(encounterTileY) ? encounterTileY : null;

    const mapAssetPath = String(payload.mapAssetPath ?? "").trim();
    if (mapAssetPath) {
      this.worldMapBackdropImage = createUiImage(mapAssetPath);
    }

    const enemyPool = this.game.getEnemies();
    const enemyTemplate =
      pickRandom(enemyPool) ?? {
        id: "fallback",
        name: "Dummy",
        maxHp: 12,
        attackMin: 2,
        attackMax: 4,
        speed: 3,
        colorA: "#a0a0a0",
        colorB: "#707070",
      };
    this.enemy = {
      ...enemyTemplate,
      hp: enemyTemplate.maxHp,
      speed: clamp(enemyTemplate.speed ?? 3, 1, 5),
    };
    this.trackEncounterProgress(this.enemy.id);

    this.phase = "messages";
    this.mainMenuIndex = 0;
    this.fightMenuIndex = 0;
    this.skillMenuIndex = 0;
    this.bagMenuIndex = 0;
    this.entryPopup = null;

    this.currentMessage = "";
    this.messageQueue.length = 0;
    this.onMessagesDone = null;

    this.enemyDisplayHp = this.enemy.maxHp;
    this.playerDisplayHp = this.game.state.player.hp;
    this.hpAnimation = null;
    this.enemySkipTurns = 0;

    this.floatTimer = 0;
    this.layout = getBattleLayout(GAME_CONFIG.height);
    this.ensureBattleBackdrop(this.layout.logicalHeight, this.layout.battlefieldBottom);
    this.ensurePlayerBattleFrames();
    this.bindPointerEvents();

    this.queueMessages([`Un ${this.enemy.name} selvatico appare!`], () => {
      this.phase = "menu-main";
    });
  }

  onExit() {
    this.unbindPointerEvents();
  }

  update(dt, input) {
    this.floatTimer += dt;
    this.ensurePlayerBattleFrames();

    if (this.phase === "anim-enemy" || this.phase === "anim-player") {
      this.updateHpAnimation(dt);
      return;
    }

    if (this.phase === "messages") {
      if (input.wasPressed("confirm")) {
        this.advanceMessage();
      }
      return;
    }

    if (this.phase === "menu-main") {
      this.updateMainMenu(input);
      return;
    }

    if (this.phase === "menu-fight") {
      this.updateFightMenu(input);
      return;
    }

    if (this.phase === "menu-skills") {
      this.updateSkillsMenu(input);
      return;
    }

    if (this.phase === "menu-bag") {
      this.updateBagMenu(input);
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
    this.pointerEventsBound = false;
  }

  onPointerDown(event) {
    const point = this.resolvePointerScenePoint(event);
    if (!point) {
      return;
    }

    event.preventDefault();

    const canvas = this.game?.canvas;
    const logicalHeight =
      canvas instanceof HTMLCanvasElement
        ? computeBattleLogicalHeight(canvas.width, canvas.height)
        : ACTIVE_BATTLE_LOGICAL_HEIGHT;
    const layout = getBattleLayout(logicalHeight);
    this.layout = layout;
    if (this.phase === "messages") {
      this.advanceMessage();
      return;
    }

    if (this.phase === "menu-main") {
      const pressedOptionIndex = getMainOptionIndexAtPoint(
        point.x,
        point.y,
        layout.commandPoints,
        layout.commandHalfW,
        layout.commandHalfH,
      );
      if (pressedOptionIndex >= 0) {
        this.mainMenuIndex = pressedOptionIndex;
        this.selectMainOption();
      }
      return;
    }

    if (this.phase === "menu-fight" && isInsideRect(point.x, point.y, layout.messageBox)) {
      this.performAttack();
      return;
    }

    if (this.phase === "menu-bag") {
      this.handleBattleListPointerTap("bag", point);
      return;
    }

    if (this.phase === "menu-skills") {
      this.handleBattleListPointerTap("skills", point);
    }
  }

  resolvePointerScenePoint(event) {
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
    const logicalHeight = computeBattleLogicalHeight(canvas.width, canvas.height);
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

  handleBattleListPointerTap(listType, point) {
    const entries = listType === "skills" ? this.getSkillMenuEntries() : this.getBattleInventoryEntries();
    if (entries.length <= 0) {
      this.entryPopup = null;
      this.phase = "menu-main";
      return;
    }

    const selectedIndex = listType === "skills" ? this.skillMenuIndex : this.bagMenuIndex;
    const layout = this.layout ?? getBattleLayout(ACTIVE_BATTLE_LOGICAL_HEIGHT);
    const listLayout = getBattleListLayout(layout.inventoryPanel, entries.length, selectedIndex);
    const backRect = getBattleOverlayBackRect(layout.inventoryPanel);

    if (isInsideRect(point.x, point.y, backRect)) {
      this.entryPopup = null;
      this.phase = "menu-main";
      return;
    }

    if (this.entryPopup) {
      this.handleEntryPopupPointerTap(point, listLayout);
      return;
    }

    const hitIndex = getListEntryIndexAtPoint(point, listLayout, entries.length);
    if (hitIndex < 0) {
      return;
    }

    if (listType === "skills") {
      this.skillMenuIndex = hitIndex;
    } else {
      this.bagMenuIndex = hitIndex;
    }

    this.openBattleEntryPopup(listType, entries[hitIndex]);
  }

  handleEntryPopupPointerTap(point, listLayout) {
    const popupLayout = this.getEntryPopupLayout(listLayout);
    if (!popupLayout || !this.entryPopup) {
      return;
    }

    if (!isInsideRect(point.x, point.y, popupLayout.frameRect)) {
      this.entryPopup = null;
      return;
    }

    if (!this.entryPopup.canUse) {
      this.entryPopup = null;
      return;
    }

    if (isInsideRect(point.x, point.y, popupLayout.cancelRect)) {
      this.entryPopup.confirmIndex = 1;
      this.entryPopup = null;
      return;
    }

    if (isInsideRect(point.x, point.y, popupLayout.confirmRect)) {
      this.entryPopup.confirmIndex = 0;
      this.confirmBattleEntryPopup();
    }
  }

  getEntryPopupLayout(listLayout = null) {
    const layout = this.layout ?? getBattleLayout(ACTIVE_BATTLE_LOGICAL_HEIGHT);
    const panel = layout.inventoryPanel;
    const fallbackListLayout = getBattleListLayout(panel, 1, 0);
    const resolvedListLayout = listLayout ?? fallbackListLayout;
    const popupW = panel.w - 22;
    const popupH = 78;
    const popupX = panel.x + Math.floor((panel.w - popupW) * 0.5);
    const popupY = clamp(
      resolvedListLayout.y + Math.floor((resolvedListLayout.h - popupH) * 0.5),
      panel.y + 34,
      panel.y + panel.h - popupH - 10,
    );
    const buttonGap = 6;
    const buttonW = Math.floor((popupW - 24 - buttonGap) * 0.5);
    const buttonH = 16;
    const buttonY = popupY + popupH - buttonH - 8;
    const buttonX = popupX + 12;
    return {
      frameRect: { x: popupX, y: popupY, w: popupW, h: popupH },
      confirmRect: { x: buttonX, y: buttonY, w: buttonW, h: buttonH },
      cancelRect: { x: buttonX + buttonW + buttonGap, y: buttonY, w: buttonW, h: buttonH },
      singleRect: { x: buttonX, y: buttonY, w: popupW - 24, h: buttonH },
    };
  }

  openBattleEntryPopup(source, entry) {
    if (!entry) {
      return;
    }

    this.entryPopup = {
      source,
      entryId: String(entry.id ?? ""),
      title: String(entry.label ?? "SELEZIONE"),
      description: String(entry.description ?? "").trim(),
      canUse: entry.usableInBattle !== false,
      confirmIndex: 0,
    };
  }

  updateEntryPopupInput(input) {
    if (!this.entryPopup) {
      return false;
    }

    if (input.wasPressed("back")) {
      this.entryPopup = null;
      return true;
    }

    if (!this.entryPopup.canUse) {
      if (
        input.wasPressed("confirm") ||
        input.wasPressed("left") ||
        input.wasPressed("right") ||
        input.wasPressed("up") ||
        input.wasPressed("down")
      ) {
        this.entryPopup = null;
      }
      return true;
    }

    if (input.wasPressed("left") || input.wasPressed("up")) {
      this.entryPopup.confirmIndex = 0;
      return true;
    }

    if (input.wasPressed("right") || input.wasPressed("down")) {
      this.entryPopup.confirmIndex = 1;
      return true;
    }

    if (input.wasPressed("confirm")) {
      if (this.entryPopup.confirmIndex === 0) {
        this.confirmBattleEntryPopup();
      } else {
        this.entryPopup = null;
      }
      return true;
    }

    return true;
  }

  confirmBattleEntryPopup() {
    if (!this.entryPopup) {
      return;
    }

    const popup = { ...this.entryPopup };
    this.entryPopup = null;

    if (!popup.canUse) {
      return;
    }

    if (popup.source === "bag") {
      this.useBattleItem(popup.entryId);
      return;
    }

    this.performSpecialAction(popup.entryId);
  }

  ensurePlayerBattleFrames() {
    if (this.playerBattleFramesReady) {
      return;
    }

    const image = this.playerBattleSpriteImage;
    if (!isUiImageUsable(image)) {
      return;
    }

    const frameWidth = Math.max(1, Math.floor((image.naturalWidth || image.width) / PLAYER_IDLE_FRAME_COUNT));
    const frameHeight = Math.max(1, image.naturalHeight || image.height);
    const frames = buildMaskedSpriteFrames(image, {
      frameWidth,
      frameHeight,
      frameCount: PLAYER_IDLE_FRAME_COUNT,
    });
    if (frames.length > 0) {
      this.playerBattleFrames = frames;
      this.playerBattleFramesReady = true;
    }
  }

  trackEncounterProgress(enemyId) {
    const progress = this.game.state.progress;
    progress.battlesTotal = (progress.battlesTotal ?? 0) + 1;

    if (!Array.isArray(progress.encounteredEnemyIds)) {
      progress.encounteredEnemyIds = [];
    }

    if (!progress.encounteredEnemyIds.includes(enemyId)) {
      progress.encounteredEnemyIds.push(enemyId);
    }
  }

  updateMainMenu(input) {
    const directionLinks = [
      { up: 0, down: 3, left: 2, right: 1 },
      { up: 0, down: 3, left: 0, right: 1 },
      { up: 0, down: 3, left: 2, right: 0 },
      { up: 0, down: 3, left: 2, right: 1 },
    ];
    const currentLinks = directionLinks[this.mainMenuIndex] ?? directionLinks[0];

    if (input.wasPressed("up")) {
      this.mainMenuIndex = currentLinks.up;
      return;
    }

    if (input.wasPressed("down")) {
      this.mainMenuIndex = currentLinks.down;
      return;
    }

    if (input.wasPressed("left")) {
      this.mainMenuIndex = currentLinks.left;
      return;
    }

    if (input.wasPressed("right")) {
      this.mainMenuIndex = currentLinks.right;
      return;
    }

    if (input.wasPressed("confirm")) {
      this.selectMainOption();
    }
  }

  updateFightMenu(input) {
    if (input.wasPressed("confirm")) {
      this.performAttack();
      return;
    }

    if (input.wasPressed("back")) {
      this.phase = "menu-main";
    }
  }

  updateSkillsMenu(input) {
    const entries = this.getSkillMenuEntries();
    if (entries.length === 0) {
      this.entryPopup = null;
      this.phase = "menu-main";
      return;
    }

    if (this.skillMenuIndex >= entries.length) {
      this.skillMenuIndex = 0;
    }

    if (this.updateEntryPopupInput(input)) {
      return;
    }

    if (input.wasPressed("up")) {
      this.skillMenuIndex = (this.skillMenuIndex + entries.length - 1) % entries.length;
      return;
    }

    if (input.wasPressed("down")) {
      this.skillMenuIndex = (this.skillMenuIndex + 1) % entries.length;
      return;
    }

    if (input.wasPressed("confirm") || input.wasPressed("right")) {
      const selected = entries[this.skillMenuIndex];
      this.openBattleEntryPopup("skills", selected);
      return;
    }

    if (input.wasPressed("back")) {
      this.entryPopup = null;
      this.phase = "menu-main";
    }
  }

  updateBagMenu(input) {
    const entries = this.getBattleInventoryEntries();
    if (entries.length === 0) {
      this.phase = "menu-main";
      return;
    }

    if (this.bagMenuIndex >= entries.length) {
      this.bagMenuIndex = 0;
    }

    if (this.updateEntryPopupInput(input)) {
      return;
    }

    if (input.wasPressed("back")) {
      this.entryPopup = null;
      this.phase = "menu-main";
      return;
    }

    if (input.wasPressed("up")) {
      this.bagMenuIndex = (this.bagMenuIndex + entries.length - 1) % entries.length;
      return;
    }

    if (input.wasPressed("down")) {
      this.bagMenuIndex = (this.bagMenuIndex + 1) % entries.length;
      return;
    }

    if (input.wasPressed("confirm")) {
      const selected = entries[this.bagMenuIndex];
      this.openBattleEntryPopup("bag", selected);
    }
  }

  selectMainOption() {
    this.entryPopup = null;
    if (this.mainMenuIndex === 0) {
      this.performAttack();
      return;
    }

    if (this.mainMenuIndex === 1) {
      this.phase = "menu-bag";
      this.bagMenuIndex = 0;
      this.entryPopup = null;
      return;
    }

    if (this.mainMenuIndex === 2) {
      this.phase = "menu-skills";
      this.skillMenuIndex = 0;
      this.entryPopup = null;
      return;
    }

    this.performRun();
  }

  getFightOptions() {
    return [{ id: "attack", label: "ATTACK" }];
  }

  getSkillOptions() {
    const player = this.game.state.player;
    const skillEntries = Object.values(this.game.state.skills ?? {});
    return skillEntries
      .filter((skill) => skill && typeof skill === "object")
      .map((skill) => ({
        id: String(skill.id ?? ""),
        label: String(skill.label ?? "SKILL").toUpperCase(),
        manaCost: Math.max(0, Number(skill.manaCost) || 0),
        manaLeft: player.mana ?? 0,
        description: String(skill.description ?? ""),
        priority: Boolean(skill.priority),
        usableInBattle: skill.usableInBattle !== false,
      }));
  }

  getSkillMenuEntries() {
    return this.getSkillOptions().map((skill) => ({
      ...skill,
    }));
  }

  getBattleInventoryEntries() {
    return Object.values(this.game.state.inventory).map((item) => ({
      ...item,
      usableInBattle: item?.usableInBattle !== false,
    }));
  }

  useBattleItem(itemId) {
    const item = this.findInventoryItemById(itemId);
    if (!item) {
      this.queueMessages(["Oggetto non trovato."], () => {
        this.phase = "menu-bag";
      });
      return;
    }

    if (!item.usableInBattle) {
      this.queueMessages(["Questo oggetto non puo' essere usato in battaglia."], () => {
        this.phase = "menu-bag";
      });
      return;
    }

    if (item.id === "life_potion") {
      this.performLifePotionTurn();
      return;
    }

    if (item.id === "mana_potion") {
      this.performManaPotionTurn();
      return;
    }

    this.queueMessages(["Effetto oggetto non ancora disponibile."], () => {
      this.phase = "menu-bag";
    });
  }

  performAttack() {
    this.resolveTurn((done) => {
      const enemyDamage = this.rollPlayerAttackDamage();

      this.applyDamageToEnemy(enemyDamage, `${this.game.state.player.name} attacca ${this.enemy.name}.`, {
        onEnemyDefeated: () => {
          this.handleVictory();
          done({ battleEnded: true });
        },
        onEnemyAlive: () => {
          done();
        },
      });
    });
  }

  performSpecialAction(skillId) {
    const selectedSkill = this.getSkillOptions().find((skill) => skill.id === skillId);
    if (!selectedSkill) {
      this.queueMessages(["Abilita' non disponibile."], () => {
        this.phase = "menu-main";
      });
      return;
    }

    if (selectedSkill.usableInBattle === false) {
      this.queueMessages(["Questa abilita' non puo' essere usata in battaglia."], () => {
        this.phase = "menu-skills";
      });
      return;
    }

    if (selectedSkill.id === "shield_bash") {
      this.performShieldBashTurn(selectedSkill);
      return;
    }

    if (selectedSkill.id === "arcane_heal") {
      this.performMageHealTurn(selectedSkill);
      return;
    }

    if (selectedSkill.id === "shadow_escape") {
      this.performRogueEscapeTurn(selectedSkill);
      return;
    }

    this.queueMessages(["Abilita' non disponibile."], () => {
      this.phase = "menu-main";
    });
  }

  performShieldBashTurn(skill) {
    const manaCost = Math.max(0, Number(skill?.manaCost) || 0);

    this.resolveTurn((done) => {
      if (!this.consumePlayerMana(manaCost)) {
        this.queueMessages(["Mana insufficiente."], () => {
          done({ actionCancelled: true, keepMenuPhase: "menu-skills" });
        });
        return;
      }

      this.enemySkipTurns += 1;
      const enemyDamage = this.rollPlayerAttackDamage();

      this.applyDamageToEnemy(enemyDamage, `${this.game.state.player.name} carica con lo scudo.`, {
        onEnemyDefeated: () => {
          this.handleVictory();
          done({ battleEnded: true });
        },
        onEnemyAlive: () => {
          done();
        },
      });
    });
  }

  performMageHealTurn(skill) {
    const manaCost = Math.max(0, Number(skill?.manaCost) || 0);

    this.resolveTurn((done) => {
      const player = this.game.state.player;
      if (player.hp >= player.maxHp) {
        this.queueMessages(["Sei gia' al massimo della vita."], () => {
          done({ actionCancelled: true, keepMenuPhase: "menu-skills" });
        });
        return;
      }

      if (!this.consumePlayerMana(manaCost)) {
        this.queueMessages(["Mana insufficiente."], () => {
          done({ actionCancelled: true, keepMenuPhase: "menu-skills" });
        });
        return;
      }

      const targetHp = clamp(player.hp + PLAYER_CONFIG.healAmount, 0, player.maxHp);
      player.hp = targetHp;

      this.startHpAnimation("player", targetHp, () => {
        this.queueMessages(["Cura Arcana ripristina le tue energie."], () => {
          done();
        });
      });
    });
  }

  performRogueEscapeTurn(skill) {
    const manaCost = Math.max(0, Number(skill?.manaCost) || 0);
    const hasPriority = Boolean(skill?.priority);

    this.resolveTurn(
      (done) => {
        if (!this.consumePlayerMana(manaCost)) {
          this.queueMessages(["Mana insufficiente."], () => {
            done({ actionCancelled: true, keepMenuPhase: "menu-skills" });
          });
          return;
        }

        this.queueMessages(["Fuga Garantita attivata."], () => {
          this.exitToWorld(undefined, {}, { result: "escaped_skill" });
          done({ sceneChanged: true, battleEnded: true });
        });
      },
      "menu-main",
      { priority: hasPriority },
    );
  }

  performLifePotionTurn() {
    this.resolveTurn((done) => {
      const player = this.game.state.player;
      const lifePotion = this.findInventoryItemById("life_potion");

      if (!lifePotion || lifePotion.quantity <= 0) {
        this.queueMessages(["Nessuna Life Potion disponibile."], () => {
          done({ actionCancelled: true, keepMenuPhase: "menu-bag" });
        });
        return;
      }

      if (player.hp >= player.maxHp) {
        this.queueMessages(["Sei gia' al massimo della vita."], () => {
          done({ actionCancelled: true, keepMenuPhase: "menu-bag" });
        });
        return;
      }

      const targetHp = clamp(player.hp + PLAYER_CONFIG.healAmount, 0, player.maxHp);
      player.hp = targetHp;
      lifePotion.quantity -= 1;

      this.startHpAnimation("player", targetHp, () => {
        this.queueMessages(["Usi una Life Potion e recuperi energie."], () => {
          done();
        });
      });
    });
  }

  performManaPotionTurn() {
    this.resolveTurn((done) => {
      const player = this.game.state.player;
      const manaPotion = this.findInventoryItemById("mana_potion");

      if (!manaPotion || manaPotion.quantity <= 0) {
        this.queueMessages(["Nessuna Mana Potion disponibile."], () => {
          done({ actionCancelled: true, keepMenuPhase: "menu-bag" });
        });
        return;
      }

      if ((player.mana ?? 0) >= player.maxMana) {
        this.queueMessages(["Il mana e' gia' al massimo."], () => {
          done({ actionCancelled: true, keepMenuPhase: "menu-bag" });
        });
        return;
      }

      player.mana = clamp(player.mana + PLAYER_CONFIG.manaPotionAmount, 0, player.maxMana);
      manaPotion.quantity -= 1;

      this.queueMessages(["Usi una Mana Potion e recuperi mana."], () => {
        done();
      });
    });
  }

  findInventoryItemById(itemId) {
    return Object.values(this.game.state.inventory).find((item) => item.id === itemId) ?? null;
  }

  consumePlayerMana(cost) {
    const player = this.game.state.player;
    if ((player.mana ?? 0) < cost) {
      return false;
    }

    player.mana = clamp(player.mana - cost, 0, player.maxMana);
    return true;
  }

  rollPlayerAttackDamage() {
    const player = this.game.state.player;
    return randomInt(player.attackMin, player.attackMax);
  }

  applyDamageToEnemy(damage, actionMessage, { onEnemyDefeated, onEnemyAlive }) {
    const enemyTargetHp = clamp(this.enemy.hp - damage, 0, this.enemy.maxHp);
    this.enemy.hp = enemyTargetHp;

    this.startHpAnimation("enemy", enemyTargetHp, () => {
      if (enemyTargetHp <= 0) {
        this.queueMessages([actionMessage, `${this.enemy.name} e' stato sconfitto!`], onEnemyDefeated);
        return;
      }

      this.queueMessages([actionMessage], onEnemyAlive);
    });
  }

  performRun() {
    this.resolveTurn((done) => {
      if ((this.enemy.speed ?? 3) >= 5) {
        this.queueMessages(["Il nemico e' troppo veloce: non puoi fuggire."], () => {
          done();
        });
        return;
      }

      const escaped = Math.random() < 0.6;
      if (escaped) {
        this.queueMessages(["Riesci a fuggire dalla battaglia."], () => {
          this.exitToWorld(undefined, {}, { result: "escaped_run" });
          done({ sceneChanged: true, battleEnded: true });
        });
        return;
      }

      this.queueMessages(["Non riesci a fuggire!"], () => {
        done();
      });
    });
  }

  resolveTurn(action, defaultPhase = "menu-main", options = {}) {
    const playerActsFirst = this.isPlayerActingFirst(options);

    if (playerActsFirst) {
      action((result = {}) => {
        this.handlePlayerActionResult(result, defaultPhase, true);
      });
      return;
    }

    this.runEnemyTurn(() => {
      if (this.game.state.player.hp <= 0) {
        return;
      }

      action((result = {}) => {
        this.handlePlayerActionResult(result, defaultPhase, false);
      });
    });
  }

  handlePlayerActionResult(result, defaultPhase, playerWasFirst) {
    if (result.sceneChanged || result.battleEnded) {
      return;
    }

    if (result.actionCancelled) {
      this.phase = result.keepMenuPhase ?? defaultPhase;
      return;
    }

    if (!playerWasFirst) {
      this.phase = defaultPhase;
      return;
    }

    this.runEnemyTurn(() => {
      this.phase = defaultPhase;
    });
  }

  isPlayerActingFirst({ priority = false } = {}) {
    if (priority) {
      return true;
    }

    const playerSpeed = clamp(this.game.state.player.speed ?? 3, 1, 5);
    const enemySpeed = clamp(this.enemy.speed ?? 3, 1, 5);
    return playerSpeed >= enemySpeed;
  }

  runEnemyTurn(onDone) {
    if (this.enemySkipTurns > 0) {
      this.enemySkipTurns -= 1;
      this.queueMessages([`${this.enemy.name} e' stordito e non riesce ad agire.`], onDone);
      return;
    }

    const player = this.game.state.player;
    const enemyDamage = randomInt(this.enemy.attackMin, this.enemy.attackMax);
    const playerTargetHp = clamp(player.hp - enemyDamage, 0, player.maxHp);

    this.queueMessages([`${this.enemy.name} ti attacca.`], () => {
      player.hp = playerTargetHp;

      this.startHpAnimation("player", playerTargetHp, () => {
        if (playerTargetHp <= 0) {
          this.queueMessages(["Non hai piu' forze."], () => this.handleDefeat());
          return;
        }

        onDone();
      });
    });
  }

  startHpAnimation(target, toHp, onDone) {
    const fromHp = target === "enemy" ? this.enemyDisplayHp : this.playerDisplayHp;

    if (Math.abs(fromHp - toHp) < 0.01) {
      onDone();
      return;
    }

    this.hpAnimation = {
      target,
      toHp,
      speed: 35,
      onDone,
    };

    this.phase = target === "enemy" ? "anim-enemy" : "anim-player";
  }

  updateHpAnimation(dt) {
    if (!this.hpAnimation) {
      return;
    }

    const { target, toHp, speed, onDone } = this.hpAnimation;
    const currentHp = target === "enemy" ? this.enemyDisplayHp : this.playerDisplayHp;

    const delta = speed * dt;
    let nextHp = currentHp;

    if (currentHp < toHp) {
      nextHp = Math.min(currentHp + delta, toHp);
    } else {
      nextHp = Math.max(currentHp - delta, toHp);
    }

    if (target === "enemy") {
      this.enemyDisplayHp = nextHp;
    } else {
      this.playerDisplayHp = nextHp;
    }

    if (Math.abs(nextHp - toHp) > 0.01) {
      return;
    }

    if (target === "enemy") {
      this.enemyDisplayHp = toHp;
    } else {
      this.playerDisplayHp = toHp;
    }

    this.hpAnimation = null;
    onDone();
  }

  handleVictory() {
    this.game.state.progress.battlesWon += 1;
    this.exitToWorld(undefined, {}, { result: "victory" });
  }

  handleDefeat() {
    this.exitToWorld(undefined, {
      resetToSpawn: true,
      safeSteps: 5,
    }, {
      result: "defeat",
    });
  }

  queueMessages(messages, onDone = null) {
    const sanitizedMessages = Array.isArray(messages)
      ? messages
          .map((message) => String(message ?? "").trim())
          .filter((message) => message.length > 0)
      : [];
    if (sanitizedMessages.length <= 0) {
      this.currentMessage = "";
      this.messageQueue.length = 0;
      this.onMessagesDone = null;
      if (typeof onDone === "function") {
        onDone();
      } else {
        this.phase = "menu-main";
      }
      return;
    }

    this.entryPopup = null;
    this.messageQueue = [...sanitizedMessages];
    this.currentMessage = this.messageQueue.shift() ?? "";
    this.onMessagesDone = onDone;
    this.phase = "messages";
  }

  advanceMessage() {
    if (this.messageQueue.length > 0) {
      this.currentMessage = this.messageQueue.shift();
      return;
    }

    this.currentMessage = "";
    const callback = this.onMessagesDone;
    this.onMessagesDone = null;

    if (callback) {
      callback();
      return;
    }

    this.phase = "menu-main";
  }

  exitToWorld(message, overrides = {}, autoSavePayload = {}) {
    const payload = {
      safeSteps: 2,
      ...overrides,
    };

    if (typeof message === "string" && message.length > 0) {
      payload.message = message;
    }

    this.triggerAutoSave(
      AUTO_SAVE_TRIGGER.BATTLE_END,
      {
        scene: "battle",
        enemyId: this.enemy?.id ?? null,
        result: autoSavePayload.result ?? "ended",
        ...autoSavePayload,
      },
      { immediate: true },
    );

    this.game.changeScene("world", payload);
  }

  render(ctx) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#05070a";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ACTIVE_BATTLE_LOGICAL_HEIGHT = computeBattleLogicalHeight(canvasWidth, canvasHeight);
    const scale = Math.max(
      0.01,
      Math.min(canvasWidth / GAME_CONFIG.width, canvasHeight / ACTIVE_BATTLE_LOGICAL_HEIGHT),
    );
    const offsetX = Math.floor((canvasWidth - GAME_CONFIG.width * scale) * 0.5);
    const offsetY = Math.floor((canvasHeight - ACTIVE_BATTLE_LOGICAL_HEIGHT * scale) * 0.5);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    this.layout = getBattleLayout(ACTIVE_BATTLE_LOGICAL_HEIGHT);

    this.drawBattlefield(ctx);
    this.drawEnemySprite(ctx);
    this.drawPlayerSprite(ctx);
    this.drawStatusPanels(ctx);
    this.drawBottomInterface(ctx);
    this.drawDebugOverlay(ctx);
    ctx.restore();
  }

  ensureBattleBackdrop(logicalHeight = GAME_CONFIG.height, battlefieldBottom = BATTLEFIELD_BASE_BOTTOM) {
    if (
      this.battleBackdropCanvas &&
      this.battleBackdropHeight === logicalHeight &&
      this.battleBackdropBottom === battlefieldBottom
    ) {
      return;
    }

    if (typeof document === "undefined") {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = GAME_CONFIG.width;
    canvas.height = logicalHeight;
    const buffer = canvas.getContext("2d");
    if (!buffer) {
      return;
    }

    const backgroundGradient = buffer.createLinearGradient(0, 0, 0, logicalHeight);
    backgroundGradient.addColorStop(0, "#141922");
    backgroundGradient.addColorStop(0.45, "#1a2029");
    backgroundGradient.addColorStop(1, "#1a231f");
    buffer.fillStyle = backgroundGradient;
    buffer.fillRect(0, 0, GAME_CONFIG.width, logicalHeight);

    // Upper cave wall bricks.
    for (let y = 0; y < 62; y += 7) {
      for (let x = 0; x < GAME_CONFIG.width; x += 11) {
        const seed = deterministicHash(x, y);
        const brickW = 8 + (seed % 4);
        const brickH = 5 + ((seed >> 3) % 3);
        const jitterX = (seed % 3) - 1;
        const jitterY = ((seed >> 5) % 3) - 1;
        const tone = 26 + (seed % 20);
        buffer.fillStyle = `rgb(${tone}, ${tone + 3}, ${tone + 6})`;
        buffer.fillRect(x + jitterX, y + jitterY, brickW, brickH);
      }
    }

    // Stone floor with deterministic cobbles.
    for (let y = 56; y < logicalHeight + 8; y += 7) {
      const rowOffset = Math.floor((y / 7) % 2) * 6;
      for (let x = -6 + rowOffset; x < GAME_CONFIG.width + 6; x += 12) {
        const seed = deterministicHash(x * 3, y * 5);
        const radiusX = 5 + (seed % 3);
        const radiusY = 2 + ((seed >> 2) % 3);
        const centerX = x + 6 + ((seed >> 4) % 3) - 1;
        const centerY = y + 3 + ((seed >> 6) % 3) - 1;
        const tone = 42 + (seed % 26);
        buffer.fillStyle = `rgb(${tone}, ${tone + 7}, ${tone + 2})`;
        buffer.beginPath();
        buffer.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        buffer.fill();
      }
    }

    // Dark side walls.
    const sideGradient = buffer.createLinearGradient(0, 0, 32, 0);
    sideGradient.addColorStop(0, "rgba(8, 10, 14, 0.95)");
    sideGradient.addColorStop(1, "rgba(8, 10, 14, 0)");
    buffer.fillStyle = sideGradient;
    buffer.fillRect(0, 0, 36, battlefieldBottom);
    buffer.save();
    buffer.translate(GAME_CONFIG.width, 0);
    buffer.scale(-1, 1);
    buffer.fillRect(0, 0, 36, battlefieldBottom);
    buffer.restore();

    this.battleBackdropCanvas = canvas;
    this.battleBackdropHeight = logicalHeight;
    this.battleBackdropBottom = battlefieldBottom;
  }

  drawBattlefield(ctx) {
    const layout = this.layout ?? getBattleLayout(ACTIVE_BATTLE_LOGICAL_HEIGHT);
    const hasMapBackdrop = this.drawEncounterMapBackdrop(ctx, layout);
    if (!hasMapBackdrop) {
      this.ensureBattleBackdrop(layout.logicalHeight, layout.battlefieldBottom);
      if (this.battleBackdropCanvas) {
        ctx.drawImage(this.battleBackdropCanvas, 0, 0);
      } else {
        ctx.fillStyle = "#11161e";
        ctx.fillRect(0, 0, GAME_CONFIG.width, layout.logicalHeight);
      }

      this.drawTorch(ctx, 236, 22, this.floatTimer * 9);
      this.drawTorch(ctx, 254, 18, this.floatTimer * 9 + 1.6);
    }

    const depthGradient = ctx.createLinearGradient(0, 0, 0, layout.battlefieldBottom + 24);
    depthGradient.addColorStop(0, hasMapBackdrop ? "rgba(5, 8, 12, 0.24)" : "rgba(4, 6, 10, 0.3)");
    depthGradient.addColorStop(1, hasMapBackdrop ? "rgba(4, 8, 12, 0.72)" : "rgba(4, 6, 10, 0.6)");
    ctx.fillStyle = depthGradient;
    ctx.fillRect(0, 0, GAME_CONFIG.width, layout.logicalHeight);

    const vignette = ctx.createRadialGradient(
      GAME_CONFIG.width * 0.5,
      layout.battlefieldBottom * 0.52,
      36,
      GAME_CONFIG.width * 0.5,
      layout.battlefieldBottom * 0.5,
      168,
    );
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    vignette.addColorStop(1, hasMapBackdrop ? "rgba(0, 0, 0, 0.58)" : "rgba(0, 0, 0, 0.66)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, GAME_CONFIG.width, layout.logicalHeight);
  }

  drawEncounterMapBackdrop(ctx, layout) {
    const image = this.worldMapBackdropImage;
    if (!isUiImageUsable(image)) {
      return false;
    }

    const sourceW = image.naturalWidth || image.width;
    const sourceH = image.naturalHeight || image.height;
    if (sourceW <= 0 || sourceH <= 0) {
      return false;
    }

    const tileSize = Math.max(1, MAP_LAYOUT?.tileSize ?? 64);
    const focusTileX = Number.isFinite(this.encounterTileX) ? this.encounterTileX : (MAP_LAYOUT?.cols ?? 0) * 0.5;
    const focusTileY = Number.isFinite(this.encounterTileY) ? this.encounterTileY : (MAP_LAYOUT?.rows ?? 0) * 0.5;
    const focusX = (focusTileX + 0.5) * tileSize;
    const focusY = (focusTileY + 0.5) * tileSize;

    const targetRatio = GAME_CONFIG.width / Math.max(1, layout.logicalHeight);
    const baseViewW = tileSize * 8.8;
    const viewW = clamp(baseViewW, sourceW * 0.22, sourceW);
    const viewH = clamp(viewW / targetRatio, sourceH * 0.22, sourceH);
    const sourceX = clamp(Math.round(focusX - viewW * 0.5), 0, Math.max(0, sourceW - viewW));
    const sourceY = clamp(Math.round(focusY - viewH * 0.5), 0, Math.max(0, sourceH - viewH));

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      Math.round(viewW),
      Math.round(viewH),
      0,
      0,
      GAME_CONFIG.width,
      layout.logicalHeight,
    );
    return true;
  }

  drawTorch(ctx, x, y, flickerSeed) {
    const flicker = 1 + Math.sin(flickerSeed) * 0.08 + Math.sin(flickerSeed * 1.7) * 0.05;
    const glow = ctx.createRadialGradient(x, y, 1, x, y, 26 * flicker);
    glow.addColorStop(0, "rgba(255, 212, 124, 0.5)");
    glow.addColorStop(1, "rgba(255, 149, 52, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 28, y - 26, 56, 52);

    ctx.fillStyle = "#46301e";
    ctx.fillRect(x - 1, y + 4, 3, 12);
    ctx.fillStyle = "#8d6a46";
    ctx.fillRect(x - 2, y + 2, 5, 3);

    ctx.fillStyle = "#ffd682";
    ctx.fillRect(x - 1, y - 4, 3, 5);
    ctx.fillStyle = "#ff9d3d";
    ctx.fillRect(x, y - 3, 1, 4);
  }

  drawEnemySprite(ctx) {
    const layout = this.layout ?? getBattleLayout(ACTIVE_BATTLE_LOGICAL_HEIGHT);
    const bob = Math.sin(this.floatTimer * 4) * 1.2;
    const primaryX = Math.round(layout.enemyPrimaryAnchor.x - 13);
    const primaryY = Math.round(layout.enemyPrimaryAnchor.y - 28 + bob);
    const secondaryX = Math.round(layout.enemySecondaryAnchor.x - 12);
    const secondaryY = Math.round(layout.enemySecondaryAnchor.y - 27 + bob * 0.65);

    this.drawSkeletonFighter(ctx, secondaryX, secondaryY, {
      alpha: 0.72,
      shieldTint: "#6f5331",
      bladeTint: "#8f9199",
    });
    this.drawSkeletonFighter(ctx, primaryX, primaryY, {
      alpha: 1,
      shieldTint: "#a17239",
      bladeTint: "#c7c9d1",
    });
  }

  drawSkeletonFighter(ctx, x, y, { alpha = 1, shieldTint = "#8d6537", bladeTint = "#b7bcc8" } = {}) {
    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.fillStyle = "#1e1f26";
    ctx.fillRect(x + 8, y + 18, 10, 11);
    ctx.fillRect(x + 4, y + 28, 7, 9);
    ctx.fillRect(x + 15, y + 28, 7, 9);

    ctx.fillStyle = "#8f8774";
    ctx.fillRect(x + 8, y + 4, 10, 9);
    ctx.fillRect(x + 9, y + 13, 8, 6);
    ctx.fillStyle = "#3a3d44";
    ctx.fillRect(x + 6, y + 15, 14, 3);

    ctx.fillStyle = "#111317";
    ctx.fillRect(x + 10, y + 7, 2, 2);
    ctx.fillRect(x + 14, y + 7, 2, 2);
    ctx.fillRect(x + 11, y + 10, 4, 1);

    ctx.fillStyle = "#2a2d34";
    ctx.fillRect(x + 2, y + 17, 5, 3);
    ctx.fillRect(x + 18, y + 17, 5, 3);

    // Sword arm and blade.
    ctx.fillStyle = "#4c3221";
    ctx.fillRect(x + 2, y + 17, 4, 2);
    ctx.fillStyle = bladeTint;
    ctx.fillRect(x - 1, y + 10, 6, 2);
    ctx.fillRect(x + 1, y + 8, 2, 5);

    // Shield.
    ctx.fillStyle = shieldTint;
    ctx.fillRect(x + 20, y + 15, 8, 8);
    ctx.fillStyle = "rgba(255, 225, 164, 0.35)";
    ctx.fillRect(x + 22, y + 17, 3, 3);

    ctx.restore();
  }

  drawPlayerSprite(ctx) {
    const layout = this.layout ?? getBattleLayout(ACTIVE_BATTLE_LOGICAL_HEIGHT);
    const sourceImage = this.playerBattleSpriteImage;
    const maskedFrames = this.playerBattleFramesReady ? this.playerBattleFrames : [];
    const idleBob = Math.sin(this.floatTimer * 4.2) * 0.6;
    const targetHeight = clamp(
      Math.round((layout.battlefieldBottom / BATTLEFIELD_BASE_BOTTOM) * PLAYER_BASE_HEIGHT),
      26,
      38,
    );
    let targetWidth = targetHeight;
    const frameIndex = Math.floor(this.floatTimer * PLAYER_IDLE_FPS) % PLAYER_IDLE_FRAME_COUNT;

    if (maskedFrames.length > 0) {
      const frame = maskedFrames[frameIndex % maskedFrames.length];
      const frameWidth = Math.max(1, frame.width || frame.naturalWidth || 0);
      const frameHeight = Math.max(1, frame.height || frame.naturalHeight || 0);
      targetWidth = Math.max(16, Math.round(targetHeight * (frameWidth / frameHeight)));
      const drawX = Math.round(layout.playerAnchor.x - targetWidth * 0.5);
      const drawY = Math.round(layout.playerAnchor.y - targetHeight + idleBob);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(frame, drawX, drawY, targetWidth, targetHeight);
      return;
    }

    if (sourceImage && sourceImage.complete && sourceImage.naturalWidth > 0) {
      const frameWidth = Math.max(1, Math.floor(sourceImage.naturalWidth / PLAYER_IDLE_FRAME_COUNT));
      const frameHeight = Math.max(1, sourceImage.naturalHeight);
      const sourceX = frameIndex * frameWidth;
      targetWidth = Math.max(16, Math.round(targetHeight * (frameWidth / frameHeight)));
      const drawX = Math.round(layout.playerAnchor.x - targetWidth * 0.5);
      const drawY = Math.round(layout.playerAnchor.y - targetHeight + idleBob);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        sourceImage,
        sourceX,
        0,
        frameWidth,
        frameHeight,
        drawX,
        drawY,
        targetWidth,
        targetHeight,
      );
      return;
    }

    const drawX = Math.round(layout.playerAnchor.x - targetWidth * 0.5);
    const drawY = Math.round(layout.playerAnchor.y - targetHeight + idleBob);
    this.drawFallbackGoblin(ctx, drawX, drawY);
  }

  drawFallbackGoblin(ctx, x, y) {
    const scale = 0.94;
    const draw = (offsetX, offsetY, width, height, color) => {
      ctx.fillStyle = color;
      ctx.fillRect(
        x + Math.round(offsetX * scale),
        y + Math.round(offsetY * scale),
        Math.max(1, Math.round(width * scale)),
        Math.max(1, Math.round(height * scale)),
      );
    };

    draw(9, 8, 10, 10, "#65b53e");
    draw(6, 9, 4, 4, "#65b53e");
    draw(18, 9, 4, 4, "#65b53e");
    draw(8, 18, 12, 8, "#5b4129");
    draw(8, 26, 4, 4, "#29421f");
    draw(16, 26, 4, 4, "#29421f");
    draw(20, 15, 5, 2, "#cfd2d8");
    draw(23, 13, 2, 3, "#cfd2d8");
  }

  drawStatusPanels(ctx) {
    const enemyHp = Math.max(0, Math.round(this.enemyDisplayHp));
    const playerHp = Math.max(0, Math.round(this.playerDisplayHp));
    const playerMana = Math.max(0, Math.round(this.game.state.player.mana ?? 0));
    const playerMaxMana = Math.max(1, this.game.state.player.maxMana ?? 1);

    this.drawBattleStatusCard(ctx, {
      x: 8,
      y: 6,
      w: 124,
      h: 32,
      title: String(this.game.state.player.name ?? "Goblin").toUpperCase(),
      hp: playerHp,
      maxHp: this.game.state.player.maxHp,
      mp: playerMana,
      maxMp: playerMaxMana,
      isEnemy: false,
    });
    this.drawBattleStatusCard(ctx, {
      x: 138,
      y: 6,
      w: 124,
      h: 26,
      title: String(this.enemy.name ?? "Nemico").toUpperCase(),
      hp: enemyHp,
      maxHp: this.enemy.maxHp,
      mp: null,
      maxMp: null,
      isEnemy: true,
    });
  }

  drawBattleStatusCard(ctx, config) {
    const gradient = ctx.createLinearGradient(config.x, config.y, config.x, config.y + config.h);
    gradient.addColorStop(0, "rgba(30, 48, 76, 0.92)");
    gradient.addColorStop(1, "rgba(12, 24, 42, 0.92)");
    ctx.fillStyle = gradient;
    ctx.fillRect(config.x, config.y, config.w, config.h);
    ctx.strokeStyle = "#d79a4a";
    ctx.lineWidth = 2;
    ctx.strokeRect(config.x, config.y, config.w, config.h);
    ctx.strokeStyle = "#40230e";
    ctx.lineWidth = 1;
    ctx.strokeRect(config.x + 1, config.y + 1, config.w - 2, config.h - 2);

    ctx.fillStyle = "#f6ecd2";
    ctx.font = "7px monospace";
    ctx.textBaseline = "top";
    ctx.fillText(truncateLabel(config.title, 14), config.x + 5, config.y + 4);

    this.drawStatusBar(ctx, {
      x: config.x + 5,
      y: config.y + 13,
      w: config.w - 10,
      label: "HP",
      value: config.hp,
      maxValue: config.maxHp,
      color: config.isEnemy ? "#d06756" : "#57c86f",
    });

    if (!config.isEnemy && config.mp !== null && config.maxMp !== null) {
      this.drawStatusBar(ctx, {
        x: config.x + 5,
        y: config.y + 22,
        w: config.w - 10,
        label: "MP",
        value: config.mp,
        maxValue: config.maxMp,
        color: "#67b9f4",
      });
    }
  }

  drawStatusBar(ctx, config) {
    const maxValue = Math.max(1, Number(config.maxValue) || 1);
    const value = clamp(Number(config.value) || 0, 0, maxValue);
    const ratio = value / maxValue;

    ctx.fillStyle = "#d8dfce";
    ctx.fillRect(config.x, config.y, config.w, 6);
    ctx.strokeStyle = "#2e3a2c";
    ctx.lineWidth = 1;
    ctx.strokeRect(config.x, config.y, config.w, 6);
    ctx.fillStyle = config.color;
    ctx.fillRect(config.x + 1, config.y + 1, Math.floor((config.w - 2) * ratio), 4);

    ctx.fillStyle = "#0f1116";
    ctx.font = "6px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(config.label, config.x + 2, config.y);
    ctx.textAlign = "right";
    ctx.fillText(`${Math.round(value)}/${maxValue}`, config.x + config.w - 2, config.y);
    ctx.textAlign = "left";
  }

  drawBottomInterface(ctx) {
    if (this.phase === "messages") {
      this.drawFullMessageBox(ctx, this.currentMessage, true);
      return;
    }

    if (this.phase === "menu-bag") {
      this.drawBattleInventoryScreen(ctx);
      return;
    }

    if (this.phase === "menu-skills") {
      this.drawBattleSkillsScreen(ctx);
      return;
    }

    if (this.phase === "menu-main") {
      this.drawMainMenu(ctx);
      return;
    }

    if (this.phase === "menu-fight") {
      this.drawFightMenu(ctx);
      return;
    }
  }

  drawFullMessageBox(ctx, text, showPrompt = false) {
    const layout = this.layout ?? getBattleLayout(ACTIVE_BATTLE_LOGICAL_HEIGHT);
    const box = layout.messageBox;
    const gradient = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
    gradient.addColorStop(0, "rgba(30, 48, 76, 0.92)");
    gradient.addColorStop(1, "rgba(12, 24, 42, 0.92)");
    ctx.fillStyle = gradient;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeStyle = "#d79a4a";
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.strokeStyle = "#40230e";
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x + 1, box.y + 1, box.w - 2, box.h - 2);

    ctx.fillStyle = "#f6ecd2";
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";

    const lines = wrapText(text, 40);
    lines.slice(0, 3).forEach((line, index) => {
      ctx.fillText(line, box.x + 8, box.y + 8 + index * 10);
    });

    if (showPrompt) {
      this.drawAdvancePrompt(ctx, box.x + box.w - 12, box.y + 28);
    }
  }

  drawMainMenu(ctx) {
    const layout = this.layout ?? getBattleLayout(ACTIVE_BATTLE_LOGICAL_HEIGHT);
    const colors = ["#8a211d", "#5f401f", "#203f7a", "#8d6a1b"];
    MAIN_OPTIONS.forEach((label, index) => {
      const center = layout.commandPoints[index];
      this.drawDiamondCommandButton(
        ctx,
        center.x,
        center.y,
        layout.commandHalfW,
        layout.commandHalfH,
        label,
        colors[index],
        this.mainMenuIndex === index,
        index,
      );
    });
  }

  drawDiamondCommandButton(ctx, cx, cy, halfW, halfH, label, colorBase, selected, iconIndex) {
    const topColor = brightenHex(colorBase, selected ? 34 : 20);
    const bottomColor = darkenHex(colorBase, selected ? 24 : 34);
    const gradient = ctx.createLinearGradient(cx, cy - halfH, cx, cy + halfH);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, bottomColor);

    ctx.beginPath();
    ctx.moveTo(cx, cy - halfH);
    ctx.lineTo(cx + halfW, cy);
    ctx.lineTo(cx, cy + halfH);
    ctx.lineTo(cx - halfW, cy);
    ctx.closePath();

    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = selected ? "#ffd37d" : "#b58140";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (selected) {
      ctx.strokeStyle = "rgba(255, 223, 143, 0.45)";
      ctx.lineWidth = 5;
      ctx.stroke();
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - halfH + 3);
    ctx.lineTo(cx + halfW - 3, cy);
    ctx.lineTo(cx, cy + halfH - 3);
    ctx.lineTo(cx - halfW + 3, cy);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.fillRect(cx - halfW, cy, halfW * 2, halfH);
    ctx.restore();

    this.drawCommandIcon(ctx, cx, cy - 5, iconIndex, selected);

    ctx.fillStyle = "#f6ecd2";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx, cy + 7);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  drawCommandIcon(ctx, x, y, iconIndex, selected) {
    switch (iconIndex) {
      case 0: {
        ctx.strokeStyle = selected ? "#f5f9ff" : "#d9dce5";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 5, y + 4);
        ctx.lineTo(x + 1, y - 2);
        ctx.moveTo(x + 5, y + 4);
        ctx.lineTo(x - 1, y - 2);
        ctx.stroke();
        break;
      }
      case 1: {
        ctx.fillStyle = "#a06c39";
        ctx.fillRect(x - 5, y - 1, 10, 7);
        ctx.fillStyle = "#d79a4a";
        ctx.fillRect(x - 4, y, 8, 1);
        break;
      }
      case 2: {
        const orbGlow = ctx.createRadialGradient(x, y + 1, 1, x, y + 1, 7);
        orbGlow.addColorStop(0, "rgba(189, 241, 255, 0.95)");
        orbGlow.addColorStop(1, "rgba(96, 158, 255, 0)");
        ctx.fillStyle = orbGlow;
        ctx.fillRect(x - 7, y - 6, 14, 14);
        ctx.fillStyle = "#b8f5ff";
        ctx.fillRect(x - 1, y, 3, 3);
        break;
      }
      default: {
        ctx.fillStyle = "#f0d76b";
        ctx.fillRect(x - 1, y - 2, 3, 7);
        ctx.fillRect(x - 4, y + 0, 3, 2);
        ctx.fillRect(x + 2, y + 0, 3, 2);
        ctx.fillRect(x - 3, y + 5, 2, 3);
        ctx.fillRect(x + 1, y + 5, 2, 3);
      }
    }
  }

  drawFightMenu(ctx) {
    this.drawFullMessageBox(ctx, this.getPromptText(), false);
  }

  getPromptText() {
    if (this.phase === "menu-skills") {
      return "Scegli un'abilita'.";
    }

    return "Scegli un'azione.";
  }

  drawBattleInventoryScreen(ctx) {
    const entries = this.getBattleInventoryEntries();
    this.drawBattleSelectionScreen(ctx, {
      mode: "bag",
      title: "BORSA",
      entries,
      selectedIndex: this.bagMenuIndex,
    });
  }

  drawBattleSkillsScreen(ctx) {
    const entries = this.getSkillMenuEntries();
    this.drawBattleSelectionScreen(ctx, {
      mode: "skills",
      title: "ABILITA'",
      entries,
      selectedIndex: this.skillMenuIndex,
    });
  }

  drawBattleSelectionScreen(ctx, { mode, title, entries, selectedIndex }) {
    const layout = this.layout ?? getBattleLayout(ACTIVE_BATTLE_LOGICAL_HEIGHT);
    const panel = layout.inventoryPanel;
    const listLayout = getBattleListLayout(panel, entries.length, selectedIndex);
    this.drawUiWindowBackground(ctx);
    this.drawModalPanel(ctx, panel.x, panel.y, panel.w, panel.h);
    this.drawModalPanel(ctx, panel.x + 8, panel.y + 6, panel.w - 16, 16);

    ctx.fillStyle = "#f6ecd2";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(title, panel.x + Math.round(panel.w * 0.5), panel.y + 14);

    const backRect = getBattleOverlayBackRect(panel);
    this.drawActionChip(ctx, "<-", backRect.x, backRect.y, backRect.w, backRect.h, false);

    ctx.font = "7px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    const visibleEntries = entries.slice(listLayout.windowStart, listLayout.windowStart + listLayout.maxVisible);
    visibleEntries.forEach((entry, localIndex) => {
      const absoluteIndex = listLayout.windowStart + localIndex;
      const rowY = listLayout.y + localIndex * listLayout.rowHeight;
      const rowH = listLayout.rowHeight - 3;
      const rowX = listLayout.x;
      const rowW = listLayout.w;
      const selected = absoluteIndex === selectedIndex;
      this.drawModalPanel(ctx, rowX, rowY, rowW, rowH);

      if (!selected) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
        ctx.fillRect(rowX + 1, rowY + 1, rowW - 2, rowH - 2);
      }

      if (selected) {
        ctx.strokeStyle = "rgba(255, 219, 144, 0.95)";
        ctx.lineWidth = 2;
        ctx.strokeRect(rowX + 1, rowY + 1, rowW - 2, rowH - 2);
      }

      const entryLabel = truncateLabel(entry.label, 16);
      const statText =
        mode === "skills"
          ? `MP ${entry.manaCost ?? 0}`
          : `x${Math.max(0, Number(entry.quantity) || 0)}`;

      ctx.fillStyle = "#f6ecd2";
      ctx.fillText(entryLabel, rowX + 8, rowY + 4);
      if (statText) {
        ctx.textAlign = "right";
        ctx.fillText(statText, rowX + rowW - 8, rowY + 4);
        ctx.textAlign = "left";
      }

      const description = String(entry.description ?? "").trim();
      if (description.length > 0) {
        const lines = wrapText(description, 36).slice(0, 1);
        ctx.fillStyle = "#d7c89e";
        lines.forEach((line, lineIndex) => {
          ctx.fillText(line, rowX + 8, rowY + 14 + lineIndex * 8);
        });
      }

      if (entry.usableInBattle === false) {
        ctx.textAlign = "right";
        ctx.fillStyle = "#f3b19f";
        ctx.fillText("NON USABILE", rowX + rowW - 8, rowY + rowH - 9);
        ctx.textAlign = "left";
      }
    });

    if (this.entryPopup) {
      this.drawBattleEntryPopup(ctx, listLayout);
    }
  }

  drawBattleEntryPopup(ctx, listLayout) {
    if (!this.entryPopup) {
      return;
    }
    const popupLayout = this.getEntryPopupLayout(listLayout);
    if (!popupLayout) {
      return;
    }
    const popup = this.entryPopup;
    ctx.fillStyle = "#00000099";
    ctx.fillRect(0, 0, GAME_CONFIG.width, ACTIVE_BATTLE_LOGICAL_HEIGHT);
    this.drawModalPanel(
      ctx,
      popupLayout.frameRect.x,
      popupLayout.frameRect.y,
      popupLayout.frameRect.w,
      popupLayout.frameRect.h,
    );

    ctx.fillStyle = "#f6ecd2";
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.fillText(popup.title, popupLayout.frameRect.x + 8, popupLayout.frameRect.y + 6);

    const detailText = popup.canUse
      ? popup.description.length > 0
        ? popup.description
        : "Usare in battaglia?"
      : popup.description.length > 0
        ? `${popup.description}. Non usabile in battaglia.`
        : "Questo elemento non puo' essere usato in battaglia";
    const lines = wrapText(detailText, 40).slice(0, 3);
    ctx.fillStyle = "#d7c89e";
    lines.forEach((line, index) => {
      ctx.fillText(line, popupLayout.frameRect.x + 8, popupLayout.frameRect.y + 18 + index * 8);
    });

    if (!popup.canUse) {
      this.drawActionChip(
        ctx,
        "CHIUDI",
        popupLayout.singleRect.x,
        popupLayout.singleRect.y,
        popupLayout.singleRect.w,
        popupLayout.singleRect.h,
        true,
      );
      return;
    }

    this.drawActionChip(
      ctx,
      "USA",
      popupLayout.confirmRect.x,
      popupLayout.confirmRect.y,
      popupLayout.confirmRect.w,
      popupLayout.confirmRect.h,
      popup.confirmIndex === 0,
    );
    this.drawActionChip(
      ctx,
      "ANNULLA",
      popupLayout.cancelRect.x,
      popupLayout.cancelRect.y,
      popupLayout.cancelRect.w,
      popupLayout.cancelRect.h,
      popup.confirmIndex === 1,
    );
  }

  drawUiWindowBackground(ctx) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
    ctx.fillRect(0, 0, GAME_CONFIG.width, ACTIVE_BATTLE_LOGICAL_HEIGHT);
  }

  drawModalPanel(ctx, x, y, w, h) {
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, "rgba(30, 48, 76, 0.95)");
    gradient.addColorStop(1, "rgba(12, 24, 42, 0.95)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#d79a4a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = "#40230e";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  drawActionChip(ctx, label, x, y, width, height, selected = false) {
    this.drawModalPanel(ctx, x, y, width, height);
    ctx.fillStyle = selected ? "rgba(31, 69, 110, 0.95)" : "rgba(14, 36, 61, 0.9)";
    ctx.fillRect(x + 2, y + 2, width - 4, height - 4);
    ctx.fillStyle = "#f6ecd2";
    ctx.font = "7px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(label ?? "OK"), x + Math.round(width * 0.5), y + Math.round(height * 0.5) + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
  }

  drawDebugOverlay(ctx) {
    if (!this.game.getDebugOverlayEnabled()) {
      return;
    }

    if (!this.enemy) {
      return;
    }

    const playerSpeed = clamp(this.game.state.player.speed ?? 3, 1, 5);
    const enemySpeed = clamp(this.enemy.speed ?? 3, 1, 5);
    const panelW = 84;
    const panelH = 24;
    const panelX = GAME_CONFIG.width - panelW - 4;
    const panelY = 4;

    ctx.fillStyle = "#000000aa";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = "#ffffff";
    ctx.font = "6px monospace";
    ctx.textBaseline = "top";
    ctx.fillText(`P SPD: ${playerSpeed}`, panelX + 4, panelY + 4);
    ctx.fillText(`E SPD: ${enemySpeed}`, panelX + 4, panelY + 12);
  }

  drawAdvancePrompt(ctx, x, y) {
    const blinkOn = Math.floor(this.floatTimer * 2.4) % 2 === 0;
    if (!blinkOn) {
      return;
    }

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x + 6, y + 6);
    ctx.lineTo(x, y + 10);
    ctx.closePath();
    ctx.fill();
  }

  drawCursor(ctx, x, y) {
    ctx.fillStyle = "#f6ecd2";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4, y + 3);
    ctx.lineTo(x, y + 6);
    ctx.closePath();
    ctx.fill();
  }
}

function computeBattleLogicalHeight(canvasWidth, canvasHeight) {
  const safeWidth = Math.max(1, Number(canvasWidth) || GAME_CONFIG.width);
  const safeHeight = Math.max(1, Number(canvasHeight) || GAME_CONFIG.height);
  return Math.max(GAME_CONFIG.height, Math.round((safeHeight * GAME_CONFIG.width) / safeWidth));
}

function getBattleLayout(logicalHeight = GAME_CONFIG.height) {
  const safeHeight = Math.max(GAME_CONFIG.height, Math.round(Number(logicalHeight) || GAME_CONFIG.height));
  const messageBoxY = safeHeight - MESSAGE_BOX_HEIGHT - 8;
  const battlefieldBottom = clamp(
    BATTLEFIELD_BASE_BOTTOM + Math.round((safeHeight - GAME_CONFIG.height) * 0.58),
    112,
    messageBoxY - 8,
  );
  const menuCenterY = clamp(messageBoxY - 4, battlefieldBottom - 4, safeHeight - 28);

  return {
    logicalHeight: safeHeight,
    battlefieldBottom,
    messageBox: {
      x: 8,
      y: messageBoxY,
      w: GAME_CONFIG.width - 16,
      h: MESSAGE_BOX_HEIGHT,
    },
    inventoryPanel: {
      x: INVENTORY_PANEL_PAD,
      y: 16,
      w: GAME_CONFIG.width - INVENTORY_PANEL_PAD * 2,
      h: safeHeight - 22,
    },
    enemyPrimaryAnchor: {
      x: 192,
      y: battlefieldBottom - 54,
    },
    enemySecondaryAnchor: {
      x: 228,
      y: battlefieldBottom - 52,
    },
    playerAnchor: {
      x: 60,
      y: battlefieldBottom - 10,
    },
    commandHalfW: COMMAND_BUTTON_HALF_W,
    commandHalfH: COMMAND_BUTTON_HALF_H,
    commandPoints: [
      { x: 135, y: menuCenterY - 24 },
      { x: 170, y: menuCenterY },
      { x: 100, y: menuCenterY },
      { x: 135, y: menuCenterY + 24 },
    ],
  };
}

function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= maxChars) {
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

  return lines;
}

function truncateLabel(text, maxLen) {
  if (text.length <= maxLen) {
    return text;
  }

  return `${text.slice(0, maxLen - 1)}.`;
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

function buildMaskedSpriteFrames(sourceImage, { frameWidth, frameHeight, frameCount } = {}) {
  if (typeof document === "undefined") {
    return [];
  }

  const sourceWidth = sourceImage.naturalWidth || sourceImage.width;
  const sourceHeight = sourceImage.naturalHeight || sourceImage.height;
  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    frameWidth <= 0 ||
    frameHeight <= 0
  ) {
    return [];
  }

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;
  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) {
    return [];
  }
  sourceContext.drawImage(sourceImage, 0, 0);

  const safeFrameCount = clampNumber(Math.floor(frameCount ?? 1), 1, 32);
  const frames = [];
  for (let frameIndex = 0; frameIndex < safeFrameCount; frameIndex += 1) {
    const sourceX = frameIndex * frameWidth;
    if (sourceX >= sourceCanvas.width) {
      break;
    }

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = frameWidth;
    outputCanvas.height = frameHeight;
    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) {
      continue;
    }

    outputContext.imageSmoothingEnabled = false;
    outputContext.drawImage(
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
    frames.push(outputCanvas);
  }

  return frames;
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function isUiImageUsable(image) {
  return Boolean(
    image &&
      image.complete &&
      (image.naturalWidth || image.width || 0) > 0 &&
      (image.naturalHeight || image.height || 0) > 0,
  );
}

function isInsideRect(x, y, rect) {
  if (!rect || typeof rect !== "object") {
    return false;
  }

  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function getMainOptionIndexAtPoint(x, y, commandPoints, halfW, halfH) {
  if (!Array.isArray(commandPoints)) {
    return -1;
  }

  return commandPoints.findIndex((center) =>
    isPointInsideDiamond(x, y, center?.x ?? 0, center?.y ?? 0, halfW, halfH),
  );
}

function isPointInsideDiamond(x, y, centerX, centerY, halfW, halfH) {
  const safeHalfW = Math.max(1, Number(halfW) || 1);
  const safeHalfH = Math.max(1, Number(halfH) || 1);
  const normalizedX = Math.abs(x - centerX) / safeHalfW;
  const normalizedY = Math.abs(y - centerY) / safeHalfH;
  return normalizedX + normalizedY <= 1;
}

function getBattleListLayout(panel, totalEntries, selectedIndex) {
  const rowHeight = 30;
  const x = panel.x + 8;
  const y = panel.y + 26;
  const w = panel.w - 16;
  const h = Math.max(24, panel.h - 56);
  const maxVisible = Math.max(2, Math.floor(h / rowHeight));
  const windowStart = computeListWindowStart(totalEntries, selectedIndex, maxVisible);
  return {
    x,
    y,
    w,
    h,
    rowHeight,
    maxVisible,
    windowStart,
  };
}

function getBattleOverlayBackRect(panel) {
  const width = 30;
  const height = 30;
  const x = panel.x + panel.w - width - 8;
  const y = panel.y + 2;
  return { x, y, w: width, h: height };
}

function getListEntryIndexAtPoint(point, listLayout, totalEntries) {
  if (!point || !listLayout) {
    return -1;
  }

  if (!isInsideRect(point.x, point.y, { x: listLayout.x, y: listLayout.y, w: listLayout.w, h: listLayout.h })) {
    return -1;
  }

  const relativeY = point.y - listLayout.y;
  const rowIndex = Math.floor(relativeY / listLayout.rowHeight);
  if (rowIndex < 0 || rowIndex >= listLayout.maxVisible) {
    return -1;
  }

  const absoluteIndex = listLayout.windowStart + rowIndex;
  if (absoluteIndex < 0 || absoluteIndex >= totalEntries) {
    return -1;
  }

  return absoluteIndex;
}

function computeListWindowStart(totalItems, selectedIndex, maxVisible) {
  const safeTotal = Math.max(0, Math.floor(totalItems));
  const safeVisible = Math.max(1, Math.floor(maxVisible));
  if (safeTotal <= safeVisible) {
    return 0;
  }

  const safeSelected = clamp(Math.floor(selectedIndex), 0, safeTotal - 1);
  const half = Math.floor(safeVisible * 0.5);
  const minStart = 0;
  const maxStart = safeTotal - safeVisible;
  return clamp(safeSelected - half, minStart, maxStart);
}

function deterministicHash(x, y) {
  let value = Math.floor(x) * 374761393 + Math.floor(y) * 668265263;
  value = (value ^ (value >> 13)) * 1274126177;
  return Math.abs(value ^ (value >> 16));
}

function brightenHex(hexColor, amount) {
  return adjustHexColor(hexColor, Math.abs(amount));
}

function darkenHex(hexColor, amount) {
  return adjustHexColor(hexColor, -Math.abs(amount));
}

function adjustHexColor(hexColor, delta) {
  const match = String(hexColor ?? "").trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) {
    return "#4f4f4f";
  }

  const raw = match[1];
  const r = clamp(parseInt(raw.slice(0, 2), 16) + delta, 0, 255);
  const g = clamp(parseInt(raw.slice(2, 4), 16) + delta, 0, 255);
  const b = clamp(parseInt(raw.slice(4, 6), 16) + delta, 0, 255);
  return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`;
}

function toHexChannel(value) {
  const safe = clamp(Math.round(value), 0, 255);
  return safe.toString(16).padStart(2, "0");
}
