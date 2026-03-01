import { Scene } from "../core/Scene.js";
import { GAME_CONFIG, PLAYER_CONFIG } from "../data/constants.js";
import { AUTO_SAVE_TRIGGER } from "../data/autoSave.js";
import { clamp, pickRandom, randomInt } from "../utils/math.js";

const MAIN_OPTIONS = ["FIGHT", "BAG", "SKILLS", "RUN"];

const BOTTOM_UI_Y = GAME_CONFIG.height - 52;
const PROMPT_BOX = {
  x: 6,
  y: BOTTOM_UI_Y + 4,
  w: 148,
  h: 44,
};
const COMMAND_BOX = {
  x: 158,
  y: BOTTOM_UI_Y + 4,
  w: 106,
  h: 44,
};
const FULL_MESSAGE_BOX = {
  x: 6,
  y: BOTTOM_UI_Y + 4,
  w: GAME_CONFIG.width - 12,
  h: 44,
};
const INVENTORY_PANEL = {
  x: 12,
  y: 18,
  w: GAME_CONFIG.width - 24,
  h: GAME_CONFIG.height - 36,
};
const ENEMY_GROUND = { x: 196, y: 60, rx: 35, ry: 11 };
const PLAYER_GROUND = { x: 76, y: 108, rx: 45, ry: 14 };
const ENEMY_SPRITE = { w: 34, h: 26 };
const PLAYER_SPRITE = { w: 26, h: 40 };

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
    this.skillDescriptionPopupOpen = false;

    this.enemyDisplayHp = 0;
    this.playerDisplayHp = 0;
    this.hpAnimation = null;
    this.enemySkipTurns = 0;

    this.floatTimer = 0;
    this.uiBackgroundImage = createUiImage("../assets/UI/UI_background.png");
  }

  onEnter(payload = {}) {
    if (payload.resume) {
      return;
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
    this.skillDescriptionPopupOpen = false;

    this.currentMessage = "";
    this.messageQueue.length = 0;
    this.onMessagesDone = null;

    this.enemyDisplayHp = this.enemy.maxHp;
    this.playerDisplayHp = this.game.state.player.hp;
    this.hpAnimation = null;
    this.enemySkipTurns = 0;

    this.floatTimer = 0;

    this.queueMessages([`Un ${this.enemy.name} selvatico appare!`], () => {
      this.phase = "menu-main";
    });
  }

  update(dt, input) {
    this.floatTimer += dt;

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
    if (input.wasPressed("up") && this.mainMenuIndex >= 2) {
      this.mainMenuIndex -= 2;
      return;
    }

    if (input.wasPressed("down") && this.mainMenuIndex <= 1) {
      this.mainMenuIndex += 2;
      return;
    }

    if (input.wasPressed("left") && this.mainMenuIndex % 2 === 1) {
      this.mainMenuIndex -= 1;
      return;
    }

    if (input.wasPressed("right") && this.mainMenuIndex % 2 === 0) {
      this.mainMenuIndex += 1;
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
      this.skillDescriptionPopupOpen = false;
      this.phase = "menu-main";
      return;
    }

    if (this.skillMenuIndex >= entries.length) {
      this.skillMenuIndex = 0;
    }

    if (this.skillDescriptionPopupOpen) {
      if (input.wasPressed("left") || input.wasPressed("back")) {
        this.skillDescriptionPopupOpen = false;
      }
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

    if (input.wasPressed("right")) {
      const selected = entries[this.skillMenuIndex];
      if (selected && !selected.isBack) {
        this.skillDescriptionPopupOpen = true;
      }
      return;
    }

    if (input.wasPressed("confirm")) {
      const selected = entries[this.skillMenuIndex];
      if (!selected || selected.isBack) {
        this.skillDescriptionPopupOpen = false;
        this.phase = "menu-main";
        return;
      }

      this.performSpecialAction(selected.id);
      return;
    }

    if (input.wasPressed("back")) {
      this.skillDescriptionPopupOpen = false;
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

    if (input.wasPressed("back")) {
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
      if (!selected || selected.isBack) {
        this.phase = "menu-main";
        return;
      }

      this.useBattleItem(selected.id);
    }
  }

  selectMainOption() {
    if (this.mainMenuIndex === 0) {
      this.phase = "menu-fight";
      this.fightMenuIndex = 0;
      return;
    }

    if (this.mainMenuIndex === 1) {
      this.phase = "menu-bag";
      this.bagMenuIndex = 0;
      return;
    }

    if (this.mainMenuIndex === 2) {
      this.phase = "menu-skills";
      this.skillMenuIndex = 0;
      this.skillDescriptionPopupOpen = false;
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
      .filter((skill) => skill && typeof skill === "object" && skill.usableInBattle !== false)
      .map((skill) => ({
        id: String(skill.id ?? ""),
        label: String(skill.label ?? "SKILL").toUpperCase(),
        manaCost: Math.max(0, Number(skill.manaCost) || 0),
        manaLeft: player.mana ?? 0,
        description: String(skill.description ?? ""),
        priority: Boolean(skill.priority),
      }));
  }

  getSkillMenuEntries() {
    const skills = this.getSkillOptions().map((skill) => ({
      ...skill,
      isBack: false,
    }));

    return [
      ...skills,
      {
        id: "back",
        label: "INDIETRO",
        description: "",
        manaCost: 0,
        manaLeft: 0,
        isBack: true,
      },
    ];
  }

  getBattleInventoryEntries() {
    const items = Object.values(this.game.state.inventory).map((item) => ({
      ...item,
      isBack: false,
    }));

    return [
      ...items,
      {
        id: "back",
        label: "INDIETRO",
        description: "",
        quantity: 0,
        isBack: true,
      },
    ];
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
    this.messageQueue = [...messages];
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
    this.drawBattlefield(ctx);
    this.drawEnemySprite(ctx);
    this.drawPlayerSprite(ctx);
    this.drawStatusPanels(ctx);
    this.drawBottomInterface(ctx);
    this.drawDebugOverlay(ctx);
  }

  drawBattlefield(ctx) {
    ctx.fillStyle = "#b8e0ff";
    ctx.fillRect(0, 0, GAME_CONFIG.width, 44);

    ctx.fillStyle = "#8ecf6f";
    ctx.fillRect(0, 44, GAME_CONFIG.width, BOTTOM_UI_Y - 44);

    ctx.fillStyle = "#7cbe60";
    for (let y = 46; y < BOTTOM_UI_Y; y += 8) {
      ctx.fillRect(0, y, GAME_CONFIG.width, 2);
    }

    ctx.fillStyle = "#74b454";
    ctx.beginPath();
    ctx.ellipse(ENEMY_GROUND.x, ENEMY_GROUND.y, ENEMY_GROUND.rx, ENEMY_GROUND.ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(
      PLAYER_GROUND.x,
      PLAYER_GROUND.y,
      PLAYER_GROUND.rx,
      PLAYER_GROUND.ry,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  drawEnemySprite(ctx) {
    const bob = Math.sin(this.floatTimer * 4) * 1.2;
    const x = Math.round(ENEMY_GROUND.x - ENEMY_SPRITE.w / 2);
    const y = Math.round(ENEMY_GROUND.y - ENEMY_SPRITE.h + bob);

    ctx.fillStyle = this.enemy.colorB;
    ctx.fillRect(x + 3, y + 11, 28, 15);

    ctx.fillStyle = this.enemy.colorA;
    ctx.fillRect(x + 6, y + 3, 22, 11);
    ctx.fillRect(x + 0, y + 12, 10, 9);
    ctx.fillRect(x + 24, y + 12, 10, 9);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 12, y + 8, 2, 2);
    ctx.fillRect(x + 19, y + 8, 2, 2);
  }

  drawPlayerSprite(ctx) {
    const x = Math.round(PLAYER_GROUND.x - PLAYER_SPRITE.w / 2);
    const y = Math.round(PLAYER_GROUND.y - PLAYER_SPRITE.h);

    ctx.fillStyle = "#8f1f2f";
    ctx.fillRect(x + 9, y + 3, 16, 9);
    ctx.fillStyle = "#f4d7ae";
    ctx.fillRect(x + 11, y + 12, 12, 10);
    ctx.fillStyle = "#d8474d";
    ctx.fillRect(x + 8, y + 22, 18, 12);
    ctx.fillStyle = "#304c8f";
    ctx.fillRect(x + 8, y + 34, 7, 6);
    ctx.fillRect(x + 19, y + 34, 7, 6);
  }

  drawStatusPanels(ctx) {
    const enemyHp = Math.max(0, Math.round(this.enemyDisplayHp));
    const playerHp = Math.max(0, Math.round(this.playerDisplayHp));

    this.drawEnemyStatusPanel(ctx, 12, 10, 108, 34, enemyHp);
    this.drawPlayerStatusPanel(ctx, 152, 84, 106, 36, playerHp);
  }

  drawEnemyStatusPanel(ctx, x, y, w, h, hp) {
    ctx.fillStyle = "#efefdc";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#3f4a3d";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#2a2f2a";
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.fillText(this.enemy.name, x + 6, y + 6);
    ctx.fillText("HP", x + 6, y + 18);

    this.drawHpBar(ctx, x + 24, y + 18, w - 30, hp, this.enemy.maxHp);

    ctx.fillStyle = "#2a2f2a";
    ctx.fillText(`${hp}/${this.enemy.maxHp}`, x + 24, y + 26);
  }

  drawPlayerStatusPanel(ctx, x, y, w, h, hp) {
    const player = this.game.state.player;

    ctx.fillStyle = "#efefdc";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#3f4a3d";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#2a2f2a";
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.fillText(player.name.toUpperCase(), x + 6, y + 6);
    ctx.fillText("HP", x + 6, y + 18);

    this.drawHpBar(ctx, x + 24, y + 18, w - 30, hp, player.maxHp);

    ctx.fillStyle = "#2a2f2a";
    ctx.fillText(`${hp}/${player.maxHp}`, x + 24, y + 26);
  }

  drawHpBar(ctx, x, y, width, hp, maxHp) {
    const ratio = clamp(hp / maxHp, 0, 1);

    ctx.fillStyle = "#ced8c4";
    ctx.fillRect(x, y, width, 7);
    ctx.strokeStyle = "#4a5f46";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, 7);

    ctx.fillStyle = ratio > 0.35 ? "#4dc06e" : "#d9b84c";
    ctx.fillRect(x + 1, y + 1, Math.floor((width - 2) * ratio), 5);
  }

  drawBottomInterface(ctx) {
    if (this.phase === "messages") {
      this.drawFullMessageBox(ctx, this.currentMessage);
      return;
    }

    if (this.phase === "menu-bag") {
      this.drawBattleInventoryScreen(ctx);
      return;
    }

    if (this.phase === "anim-enemy" || this.phase === "anim-player") {
      this.drawPromptBox(ctx, "...");
      this.drawCommandBoxShell(ctx);
      return;
    }

    this.drawPromptBox(ctx, this.getPromptText());

    if (this.phase === "menu-main") {
      this.drawMainMenu(ctx);
      return;
    }

    if (this.phase === "menu-fight") {
      this.drawFightMenu(ctx);
      return;
    }

    if (this.phase === "menu-skills") {
      this.drawBattleSkillsScreen(ctx);
      return;
    }

    this.drawCommandBoxShell(ctx);
  }

  getPromptText() {
    if (this.phase === "menu-fight") {
      return "Scegli ATTACK.";
    }

    if (this.phase === "menu-skills") {
      return "Scegli una skill.";
    }

    const trainerName = this.game.state.player.name.toUpperCase();
    return `What will ${trainerName} do?`;
  }

  drawPromptBox(ctx, text) {
    ctx.fillStyle = "#2b4d68";
    ctx.fillRect(PROMPT_BOX.x, PROMPT_BOX.y, PROMPT_BOX.w, PROMPT_BOX.h);
    ctx.strokeStyle = "#f3f0d9";
    ctx.lineWidth = 2;
    ctx.strokeRect(PROMPT_BOX.x, PROMPT_BOX.y, PROMPT_BOX.w, PROMPT_BOX.h);

    ctx.fillStyle = "#ffffff";
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";

    const lines = wrapText(text, 23);
    lines.slice(0, 3).forEach((line, index) => {
      ctx.fillText(line, PROMPT_BOX.x + 8, PROMPT_BOX.y + 8 + index * 10);
    });
  }

  drawFullMessageBox(ctx, text) {
    ctx.fillStyle = "#2b4d68";
    ctx.fillRect(FULL_MESSAGE_BOX.x, FULL_MESSAGE_BOX.y, FULL_MESSAGE_BOX.w, FULL_MESSAGE_BOX.h);
    ctx.strokeStyle = "#f3f0d9";
    ctx.lineWidth = 2;
    ctx.strokeRect(FULL_MESSAGE_BOX.x, FULL_MESSAGE_BOX.y, FULL_MESSAGE_BOX.w, FULL_MESSAGE_BOX.h);

    ctx.fillStyle = "#ffffff";
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";

    const lines = wrapText(text, 42);
    lines.slice(0, 3).forEach((line, index) => {
      ctx.fillText(line, FULL_MESSAGE_BOX.x + 8, FULL_MESSAGE_BOX.y + 8 + index * 10);
    });

    this.drawAdvancePrompt(ctx, FULL_MESSAGE_BOX.x + FULL_MESSAGE_BOX.w - 12, FULL_MESSAGE_BOX.y + 32);
  }

  drawCommandBoxShell(ctx) {
    ctx.fillStyle = "#f0efe2";
    ctx.fillRect(COMMAND_BOX.x, COMMAND_BOX.y, COMMAND_BOX.w, COMMAND_BOX.h);
    ctx.strokeStyle = "#3d3f52";
    ctx.lineWidth = 2;
    ctx.strokeRect(COMMAND_BOX.x, COMMAND_BOX.y, COMMAND_BOX.w, COMMAND_BOX.h);
  }

  drawMainMenu(ctx) {
    this.drawCommandBoxShell(ctx);

    const positions = [
      { x: COMMAND_BOX.x + 12, y: COMMAND_BOX.y + 8 },
      { x: COMMAND_BOX.x + 58, y: COMMAND_BOX.y + 8 },
      { x: COMMAND_BOX.x + 12, y: COMMAND_BOX.y + 24 },
      { x: COMMAND_BOX.x + 58, y: COMMAND_BOX.y + 24 },
    ];

    ctx.fillStyle = "#2c2d36";
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";

    MAIN_OPTIONS.forEach((label, index) => {
      const pos = positions[index];
      if (this.mainMenuIndex === index) {
        this.drawCursor(ctx, pos.x - 7, pos.y + 1);
      }
      ctx.fillText(label, pos.x, pos.y);
    });
  }

  drawFightMenu(ctx) {
    this.drawCommandBoxShell(ctx);

    const fightOptions = this.getFightOptions();

    ctx.fillStyle = "#2c2d36";
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";

    fightOptions.forEach((option, index) => {
      const y = COMMAND_BOX.y + 8 + index * 16;
      if (this.fightMenuIndex === index) {
        this.drawCursor(ctx, COMMAND_BOX.x + 6, y + 1);
      }
      ctx.fillText(option.label, COMMAND_BOX.x + 14, y);
    });
  }

  drawSkillsMenu(ctx) {
    this.drawCommandBoxShell(ctx);

    const skills = this.getSkillOptions();

    ctx.fillStyle = "#2c2d36";
    ctx.font = "6px monospace";
    ctx.textBaseline = "top";

    skills.forEach((skill, index) => {
      const y = COMMAND_BOX.y + 8 + index * 16;
      if (this.skillMenuIndex === index) {
        this.drawCursor(ctx, COMMAND_BOX.x + 6, y + 1);
      }

      const manaInfo = `${skill.manaCost}/${skill.manaLeft}`;
      const manaInfoWidth = ctx.measureText(manaInfo).width;
      const labelMaxChars = 13;
      const label = truncateLabel(skill.label, labelMaxChars);
      const manaX = COMMAND_BOX.x + COMMAND_BOX.w - 8 - manaInfoWidth;

      ctx.fillText(label, COMMAND_BOX.x + 14, y + 1);
      ctx.fillText(manaInfo, manaX, y + 1);
    });
  }

  drawBattleInventoryScreen(ctx) {
    const entries = this.getBattleInventoryEntries();

    this.drawUiWindowBackground(ctx);

    ctx.fillStyle = "#f0efe2";
    ctx.fillRect(INVENTORY_PANEL.x, INVENTORY_PANEL.y, INVENTORY_PANEL.w, INVENTORY_PANEL.h);
    ctx.strokeStyle = "#3d3f52";
    ctx.lineWidth = 2;
    ctx.strokeRect(INVENTORY_PANEL.x, INVENTORY_PANEL.y, INVENTORY_PANEL.w, INVENTORY_PANEL.h);

    ctx.fillStyle = "#2c2d36";
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";

    ctx.fillText("INVENTARIO", INVENTORY_PANEL.x + 8, INVENTORY_PANEL.y + 8);
    ctx.fillText("Oggetto", INVENTORY_PANEL.x + 8, INVENTORY_PANEL.y + 24);
    ctx.fillText("Qt", INVENTORY_PANEL.x + 94, INVENTORY_PANEL.y + 24);
    ctx.fillText("Descrizione", INVENTORY_PANEL.x + 122, INVENTORY_PANEL.y + 24);

    entries.forEach((entry, index) => {
      const y = INVENTORY_PANEL.y + 36 + index * 12;

      if (this.bagMenuIndex === index) {
        this.drawCursor(ctx, INVENTORY_PANEL.x + 8, y + 1);
      }

      if (entry.isBack) {
        ctx.fillText(entry.label, INVENTORY_PANEL.x + 16, y);
        return;
      }

      ctx.fillText(truncateLabel(entry.label.toUpperCase(), 10), INVENTORY_PANEL.x + 16, y);
      ctx.fillText(String(entry.quantity), INVENTORY_PANEL.x + 94, y);
      ctx.fillText(truncateLabel(entry.description, 17), INVENTORY_PANEL.x + 122, y);
    });

    ctx.fillText("A usa", INVENTORY_PANEL.x + 8, INVENTORY_PANEL.y + INVENTORY_PANEL.h - 12);
    ctx.fillText("B indietro", INVENTORY_PANEL.x + 80, INVENTORY_PANEL.y + INVENTORY_PANEL.h - 12);
  }

  drawBattleSkillsScreen(ctx) {
    const entries = this.getSkillMenuEntries();

    this.drawUiWindowBackground(ctx);

    ctx.fillStyle = "#f0efe2";
    ctx.fillRect(INVENTORY_PANEL.x, INVENTORY_PANEL.y, INVENTORY_PANEL.w, INVENTORY_PANEL.h);
    ctx.strokeStyle = "#3d3f52";
    ctx.lineWidth = 2;
    ctx.strokeRect(INVENTORY_PANEL.x, INVENTORY_PANEL.y, INVENTORY_PANEL.w, INVENTORY_PANEL.h);

    ctx.fillStyle = "#2c2d36";
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";

    ctx.fillText("SKILLS", INVENTORY_PANEL.x + 8, INVENTORY_PANEL.y + 8);
    ctx.fillText("Abilita'", INVENTORY_PANEL.x + 8, INVENTORY_PANEL.y + 24);
    ctx.fillText("MP", INVENTORY_PANEL.x + 104, INVENTORY_PANEL.y + 24);
    ctx.fillText("Descrizione", INVENTORY_PANEL.x + 132, INVENTORY_PANEL.y + 24);

    entries.forEach((entry, index) => {
      const y = INVENTORY_PANEL.y + 36 + index * 12;

      if (this.skillMenuIndex === index) {
        this.drawCursor(ctx, INVENTORY_PANEL.x + 8, y + 1);
      }

      if (entry.isBack) {
        ctx.fillText(entry.label, INVENTORY_PANEL.x + 16, y);
        return;
      }

      const manaInfo = `${entry.manaCost}/${entry.manaLeft}`;
      ctx.fillText(truncateLabel(entry.label, 13), INVENTORY_PANEL.x + 16, y);
      ctx.fillText(manaInfo, INVENTORY_PANEL.x + 104, y);
      ctx.fillText(truncateLabel(entry.description, 17), INVENTORY_PANEL.x + 132, y);
    });

    ctx.fillText(
      this.skillDescriptionPopupOpen ? "Sinistra chiude dettaglio" : "A usa  Destra dettaglio",
      INVENTORY_PANEL.x + 8,
      INVENTORY_PANEL.y + INVENTORY_PANEL.h - 22,
    );
    ctx.fillText("B indietro", INVENTORY_PANEL.x + 8, INVENTORY_PANEL.y + INVENTORY_PANEL.h - 12);

    if (this.skillDescriptionPopupOpen) {
      const selected = entries[this.skillMenuIndex];
      if (selected && !selected.isBack) {
        this.drawSkillDescriptionPopup(ctx, selected);
      }
    }
  }

  drawSkillDescriptionPopup(ctx, skillEntry) {
    const popupX = INVENTORY_PANEL.x + 14;
    const popupY = INVENTORY_PANEL.y + 62;
    const popupW = INVENTORY_PANEL.w - 28;
    const popupH = 48;

    ctx.fillStyle = "#00000099";
    ctx.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

    ctx.fillStyle = "#f0efe2";
    ctx.fillRect(popupX, popupY, popupW, popupH);
    ctx.strokeStyle = "#3d3f52";
    ctx.lineWidth = 2;
    ctx.strokeRect(popupX, popupY, popupW, popupH);

    ctx.fillStyle = "#2c2d36";
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.fillText(skillEntry.label, popupX + 8, popupY + 6);

    const lines = wrapText(skillEntry.description, 34);
    lines.slice(0, 3).forEach((line, index) => {
      ctx.fillText(line, popupX + 8, popupY + 18 + index * 9);
    });
  }

  drawUiWindowBackground(ctx) {
    if (
      this.uiBackgroundImage &&
      this.uiBackgroundImage.complete &&
      this.uiBackgroundImage.naturalWidth > 0
    ) {
      drawImageCover(ctx, this.uiBackgroundImage, 0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
    } else {
      ctx.fillStyle = "#0f1116";
      ctx.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
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
    ctx.fillStyle = "#2c2d36";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4, y + 3);
    ctx.lineTo(x, y + 6);
    ctx.closePath();
    ctx.fill();
  }
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
