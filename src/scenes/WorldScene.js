import { Scene } from "../core/Scene.js";
import {
  DIRECTION,
  ENCOUNTER_CHANCE,
  GAME_CONFIG,
  PALETTE,
  TILE,
} from "../data/constants.js";
import { WORLD_MAP, WORLD_POINTS, isWalkableTile } from "../data/map.js";
import { clamp } from "../utils/math.js";
import { downloadTextFile, pickTextFile } from "../utils/fileTransfer.js";
import { verifyGmEditPassword } from "../utils/security.js";

const MOVE_DURATION = 0.14;
const REST_DOTS_TOKEN = "__REST_DOTS__";
const REST_DOTS_DURATION_SECONDS = 3;
const PAUSE_MAIN_OPTIONS = ["RESUME", "SAVE GAME", "LOAD GAME", "NEW GAME", "SETTINGS"];
const PAUSE_OPTIONS_MENU = ["SOUND", "MUSIC", "GM-EDIT", "INDIETRO"];
const PAUSE_GM_EDIT_MENU = [
  { id: "debug", label: "DEBUG MODE" },
  { id: "export_classes", label: "EXPORT CLASSES" },
  { id: "import_classes", label: "IMPORT CLASSES" },
  { id: "export_enemies", label: "EXPORT ENEMIES" },
  { id: "import_enemies", label: "IMPORT ENEMIES" },
  { id: "back", label: "INDIETRO" },
];
const MAX_GM_PASSWORD_LENGTH = 20;

export class WorldScene extends Scene {
  constructor(game) {
    super(game);

    this.initialized = false;
    this.encounterSafetySteps = 0;
    this.map = WORLD_MAP;
    this.npc = WORLD_POINTS.npc;
    this.healTile = WORLD_POINTS.healTile;

    this.player = {
      tileX: 0,
      tileY: 0,
      drawX: 0,
      drawY: 0,
      startX: 0,
      startY: 0,
      targetX: 0,
      targetY: 0,
      moveProgress: 0,
      isMoving: false,
      facing: "down",
      stepFrame: 0,
    };

    this.dialog = null;
    this.infoMessage = "";
    this.infoQueue = [];
    this.infoLockSeconds = 0;
    this.uiPulse = 0;
    this.pauseMenu = {
      active: false,
      mode: "main",
      mainIndex: 0,
      slotIndex: 0,
      optionsIndex: 0,
      gmEditIndex: 0,
      gmPasswordBuffer: "",
      gmAuthStatus: "",
      gmAuthToken: 0,
      gmActionBusy: false,
      gmActionToken: 0,
      notice: "",
    };
    this.uiBackgroundImage = createUiImage("../assets/UI_startscene_background.png");
  }

  onEnter(payload = {}) {
    if (payload.restoreFromSave) {
      const savedWorld = this.getSavedWorldPosition();
      if (savedWorld) {
        this.setPlayerPosition(savedWorld.x, savedWorld.y, savedWorld.facing);
        this.initialized = true;
      }
    }

    if (!this.initialized) {
      const spawn = WORLD_POINTS.playerSpawn;
      this.setPlayerPosition(spawn.x, spawn.y, spawn.facing);
      this.initialized = true;
      this.showToast("Esplora il percorso e sopravvivi alle battaglie.");
    }

    if (payload.resetToSpawn) {
      const spawn = WORLD_POINTS.playerSpawn;
      this.setPlayerPosition(spawn.x, spawn.y, spawn.facing);
    }

    if (payload.resetToLastRest) {
      const lastRestPoint = this.game.state.progress.lastRestPoint;
      if (lastRestPoint) {
        this.setPlayerPosition(lastRestPoint.x, lastRestPoint.y, lastRestPoint.facing ?? "down");
      }
    }

    if (payload.message) {
      this.showToast(payload.message);
    }

    if (payload.safeSteps) {
      this.encounterSafetySteps = payload.safeSteps;
    }

    this.closePauseMenu();
  }

  onExit() {
    this.pauseMenu.gmAuthToken += 1;
    this.pauseMenu.gmActionToken += 1;
    this.pauseMenu.gmActionBusy = false;
    this.game.input.setTextCapture(false);
  }

  setPlayerPosition(x, y, facing) {
    this.player.tileX = x;
    this.player.tileY = y;
    this.player.drawX = x * GAME_CONFIG.tileSize;
    this.player.drawY = y * GAME_CONFIG.tileSize;
    this.player.startX = x;
    this.player.startY = y;
    this.player.targetX = x;
    this.player.targetY = y;
    this.player.moveProgress = 0;
    this.player.isMoving = false;
    this.player.facing = facing;
    this.syncWorldState();
  }

  getSavedWorldPosition() {
    const world = this.game.state.world;
    if (!world) {
      return null;
    }

    const x = Number(world.playerX);
    const y = Number(world.playerY);
    const facing = typeof world.facing === "string" ? world.facing : "down";

    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      return null;
    }

    if (!this.isInsideMap(x, y)) {
      return null;
    }

    return { x, y, facing };
  }

  syncWorldState() {
    this.game.state.world = {
      playerX: this.player.tileX,
      playerY: this.player.tileY,
      facing: this.player.facing,
    };
  }

  update(dt, input) {
    this.uiPulse += dt;

    if (this.pauseMenu.active) {
      this.updatePauseMenu(input);
      return;
    }

    if (input.wasPressed("inventory")) {
      this.game.changeScene("profile", {
        returnScene: "world",
        view: "inventory",
      });
      return;
    }

    if (input.wasPressed("profile")) {
      this.game.changeScene("profile", {
        returnScene: "world",
        view: "profile",
      });
      return;
    }

    if (this.player.isMoving) {
      this.updateMovement(dt);
      return;
    }

    if (this.dialog) {
      if (input.wasPressed("confirm")) {
        this.advanceDialog();
      } else if (input.wasPressed("back")) {
        this.dialog = null;
      }
      return;
    }

    if (this.infoMessage) {
      if (this.infoMessage === REST_DOTS_TOKEN) {
        this.infoLockSeconds = Math.max(0, this.infoLockSeconds - dt);
        if (this.infoLockSeconds <= 0) {
          this.advanceInfoMessage();
        }
      } else if (input.wasPressed("confirm")) {
        this.advanceInfoMessage();
      }
      return;
    }

    if (input.wasPressed("pause")) {
      this.openPauseMenu();
      return;
    }

    if (input.wasPressed("confirm")) {
      if (this.tryNpcInteraction()) {
        return;
      }
    }

    const direction = this.getDirectionFromInput(input);
    if (!direction) {
      return;
    }

    this.tryMove(direction);
  }

  getDirectionFromInput(input) {
    if (input.isPressed("up")) return "up";
    if (input.isPressed("down")) return "down";
    if (input.isPressed("left")) return "left";
    if (input.isPressed("right")) return "right";
    return null;
  }

  tryMove(directionName) {
    const direction = DIRECTION[directionName];
    this.player.facing = directionName;
    this.syncWorldState();

    const nextX = this.player.tileX + direction.x;
    const nextY = this.player.tileY + direction.y;

    if (!this.isInsideMap(nextX, nextY)) {
      return;
    }

    if (!isWalkableTile(this.map[nextY][nextX])) {
      return;
    }

    this.player.isMoving = true;
    this.player.moveProgress = 0;
    this.player.startX = this.player.tileX;
    this.player.startY = this.player.tileY;
    this.player.targetX = nextX;
    this.player.targetY = nextY;
  }

  updateMovement(dt) {
    this.player.moveProgress = clamp(this.player.moveProgress + dt / MOVE_DURATION, 0, 1);

    const lerpX =
      this.player.startX + (this.player.targetX - this.player.startX) * this.player.moveProgress;
    const lerpY =
      this.player.startY + (this.player.targetY - this.player.startY) * this.player.moveProgress;

    this.player.drawX = lerpX * GAME_CONFIG.tileSize;
    this.player.drawY = lerpY * GAME_CONFIG.tileSize;

    if (this.player.moveProgress >= 1) {
      this.player.isMoving = false;
      this.player.tileX = this.player.targetX;
      this.player.tileY = this.player.targetY;
      this.player.drawX = this.player.tileX * GAME_CONFIG.tileSize;
      this.player.drawY = this.player.tileY * GAME_CONFIG.tileSize;
      this.player.stepFrame = (this.player.stepFrame + 1) % 2;
      this.syncWorldState();
      this.handlePlayerStep();
    }
  }

  handlePlayerStep() {
    this.game.state.progress.totalSteps += 1;

    if (this.encounterSafetySteps > 0) {
      this.encounterSafetySteps -= 1;
    }

    if (this.player.tileX === this.healTile.x && this.player.tileY === this.healTile.y) {
      this.game.state.player.hp = this.game.state.player.maxHp;
      this.game.state.player.mana = this.game.state.player.maxMana;
      this.game.state.progress.lastRestPoint = {
        x: this.healTile.x,
        y: this.healTile.y,
        facing: this.player.facing,
      };
      this.showToastSequence([
        "Ti riposi un momento.",
        REST_DOTS_TOKEN,
        "Ti risvegli riposato.",
      ]);
    }

    const standingTile = this.map[this.player.tileY][this.player.tileX];
    if (standingTile !== TILE.TALL_GRASS) {
      return;
    }

    if (this.encounterSafetySteps > 0) {
      return;
    }

    if (Math.random() < ENCOUNTER_CHANCE) {
      this.game.changeScene("battle", {
        origin: "wild",
      });
    }
  }

  tryNpcInteraction() {
    const inFront = DIRECTION[this.player.facing];
    const checkX = this.player.tileX + inFront.x;
    const checkY = this.player.tileY + inFront.y;

    if (checkX !== this.npc.x || checkY !== this.npc.y) {
      return false;
    }

    this.dialog = {
      lines: this.npc.lines,
      index: 0,
    };

    return true;
  }

  advanceDialog() {
    if (!this.dialog) {
      return;
    }

    this.dialog.index += 1;
    if (this.dialog.index >= this.dialog.lines.length) {
      this.dialog = null;
    }
  }

  showToast(text) {
    this.showToastSequence([text]);
  }

  showToastSequence(messages) {
    if (!messages || messages.length === 0) {
      return;
    }

    if (!this.infoMessage) {
      this.setInfoMessage(messages[0]);
      this.infoQueue.push(...messages.slice(1));
      return;
    }

    this.infoQueue.push(...messages);
  }

  advanceInfoMessage() {
    if (this.infoQueue.length > 0) {
      this.setInfoMessage(this.infoQueue.shift());
      return;
    }

    this.infoMessage = "";
    this.infoLockSeconds = 0;
  }

  setInfoMessage(message) {
    this.infoMessage = message;
    this.infoLockSeconds = message === REST_DOTS_TOKEN ? REST_DOTS_DURATION_SECONDS : 0;
  }

  openPauseMenu() {
    this.pauseMenu.active = true;
    this.pauseMenu.mode = "main";
    this.pauseMenu.mainIndex = 0;
    this.pauseMenu.slotIndex = 0;
    this.pauseMenu.optionsIndex = 0;
    this.pauseMenu.gmEditIndex = 0;
    this.pauseMenu.gmPasswordBuffer = "";
    this.pauseMenu.gmAuthStatus = "";
    this.pauseMenu.gmAuthToken += 1;
    this.pauseMenu.gmActionBusy = false;
    this.pauseMenu.gmActionToken += 1;
    this.pauseMenu.notice = "";
    this.game.input.setTextCapture(false);
  }

  closePauseMenu() {
    this.pauseMenu.active = false;
    this.pauseMenu.mode = "main";
    this.pauseMenu.mainIndex = 0;
    this.pauseMenu.slotIndex = 0;
    this.pauseMenu.optionsIndex = 0;
    this.pauseMenu.gmEditIndex = 0;
    this.pauseMenu.gmPasswordBuffer = "";
    this.pauseMenu.gmAuthStatus = "";
    this.pauseMenu.gmAuthToken += 1;
    this.pauseMenu.gmActionBusy = false;
    this.pauseMenu.gmActionToken += 1;
    this.pauseMenu.notice = "";
    this.game.input.setTextCapture(false);
  }

  updatePauseMenu(input) {
    if (this.pauseMenu.mode === "main") {
      this.updatePauseMain(input);
      return;
    }

    if (this.pauseMenu.mode === "save") {
      this.updatePauseSave(input);
      return;
    }

    if (this.pauseMenu.mode === "load") {
      this.updatePauseLoad(input);
      return;
    }

    if (this.pauseMenu.mode === "options") {
      this.updatePauseOptions(input);
      return;
    }

    if (this.pauseMenu.mode === "gm-auth") {
      this.updatePauseGmAuth(input);
      return;
    }

    this.updatePauseGmEdit(input);
  }

  updatePauseMain(input) {
    if (input.wasPressed("up")) {
      this.pauseMenu.mainIndex =
        (this.pauseMenu.mainIndex + PAUSE_MAIN_OPTIONS.length - 1) % PAUSE_MAIN_OPTIONS.length;
      return;
    }

    if (input.wasPressed("down")) {
      this.pauseMenu.mainIndex = (this.pauseMenu.mainIndex + 1) % PAUSE_MAIN_OPTIONS.length;
      return;
    }

    if (input.wasPressed("back") || input.wasPressed("pause")) {
      this.closePauseMenu();
      return;
    }

    if (!input.wasPressed("confirm")) {
      return;
    }

    if (this.pauseMenu.mainIndex === 0) {
      this.closePauseMenu();
      return;
    }

    if (this.pauseMenu.mainIndex === 1) {
      this.pauseMenu.mode = "save";
      this.pauseMenu.slotIndex = 0;
      this.pauseMenu.notice = "";
      return;
    }

    if (this.pauseMenu.mainIndex === 2) {
      this.pauseMenu.mode = "load";
      this.pauseMenu.slotIndex = 0;
      this.pauseMenu.notice = "";
      return;
    }

    if (this.pauseMenu.mainIndex === 3) {
      this.closePauseMenu();
      this.game.resetState();
      this.game.changeScene("setup");
      return;
    }

    this.pauseMenu.mode = "options";
    this.pauseMenu.optionsIndex = 0;
    this.pauseMenu.notice = "";
  }

  updatePauseSave(input) {
    const slotCount = this.game.getSaveSlots().length;
    const optionsCount = slotCount + 1;

    if (input.wasPressed("up")) {
      this.pauseMenu.slotIndex = (this.pauseMenu.slotIndex + optionsCount - 1) % optionsCount;
      return;
    }

    if (input.wasPressed("down")) {
      this.pauseMenu.slotIndex = (this.pauseMenu.slotIndex + 1) % optionsCount;
      return;
    }

    if (input.wasPressed("back") || input.wasPressed("pause")) {
      this.pauseMenu.mode = "main";
      return;
    }

    if (!input.wasPressed("confirm")) {
      return;
    }

    if (this.pauseMenu.slotIndex === slotCount) {
      this.pauseMenu.mode = "main";
      return;
    }

    const saved = this.game.saveToSlot(this.pauseMenu.slotIndex);
    if (!saved) {
      this.pauseMenu.notice = "Errore durante il salvataggio.";
      return;
    }

    this.pauseMenu.notice = `Salvato nello Slot ${this.pauseMenu.slotIndex + 1}.`;
  }

  updatePauseLoad(input) {
    const slotCount = this.game.getSaveSlots().length;
    const optionsCount = slotCount + 1;

    if (input.wasPressed("up")) {
      this.pauseMenu.slotIndex = (this.pauseMenu.slotIndex + optionsCount - 1) % optionsCount;
      return;
    }

    if (input.wasPressed("down")) {
      this.pauseMenu.slotIndex = (this.pauseMenu.slotIndex + 1) % optionsCount;
      return;
    }

    if (input.wasPressed("back") || input.wasPressed("pause")) {
      this.pauseMenu.mode = "main";
      return;
    }

    if (!input.wasPressed("confirm")) {
      return;
    }

    if (this.pauseMenu.slotIndex === slotCount) {
      this.pauseMenu.mode = "main";
      return;
    }

    const selectedSlot = this.pauseMenu.slotIndex;
    const result = this.game.loadFromSlot(selectedSlot);
    if (!result.ok) {
      this.pauseMenu.notice = `Slot ${selectedSlot + 1} vuoto.`;
      return;
    }

    this.closePauseMenu();
    this.game.changeScene("world", {
      restoreFromSave: true,
      safeSteps: 5,
      message: `Caricato Slot ${selectedSlot + 1}.`,
    });
  }

  updatePauseOptions(input) {
    if (input.wasPressed("up")) {
      this.pauseMenu.optionsIndex =
        (this.pauseMenu.optionsIndex + PAUSE_OPTIONS_MENU.length - 1) % PAUSE_OPTIONS_MENU.length;
      return;
    }

    if (input.wasPressed("down")) {
      this.pauseMenu.optionsIndex = (this.pauseMenu.optionsIndex + 1) % PAUSE_OPTIONS_MENU.length;
      return;
    }

    if (input.wasPressed("back") || input.wasPressed("pause")) {
      this.pauseMenu.mode = "main";
      return;
    }

    if (this.pauseMenu.optionsIndex === 0) {
      if (input.wasPressed("left")) {
        const level = this.game.shiftSoundLevel(-1);
        this.pauseMenu.notice = `SFX ${level}/5`;
        return;
      }

      if (input.wasPressed("right") || input.wasPressed("confirm")) {
        const level = this.game.shiftSoundLevel(1);
        this.pauseMenu.notice = `SFX ${level}/5`;
        return;
      }
    }

    if (this.pauseMenu.optionsIndex === 1) {
      if (input.wasPressed("left")) {
        const level = this.game.shiftMusicLevel(-1);
        this.pauseMenu.notice = `MUSICA ${level}/5`;
        return;
      }

      if (input.wasPressed("right") || input.wasPressed("confirm")) {
        const level = this.game.shiftMusicLevel(1);
        this.pauseMenu.notice = `MUSICA ${level}/5`;
        return;
      }
    }

    if (!input.wasPressed("confirm")) {
      return;
    }

    if (this.pauseMenu.optionsIndex === 2) {
      this.enterPauseGmAuth();
      return;
    }

    this.pauseMenu.mode = "main";
  }

  updatePauseGmAuth(input) {
    const typedChars = input.consumeTypedChars();
    typedChars.forEach((char) => {
      if (this.pauseMenu.gmPasswordBuffer.length >= MAX_GM_PASSWORD_LENGTH) {
        return;
      }

      if (!/^[a-zA-Z0-9]$/.test(char)) {
        return;
      }

      this.pauseMenu.gmPasswordBuffer += char;
    });

    const backspaceCount = input.consumeBackspaceCount();
    if (backspaceCount > 0) {
      this.pauseMenu.gmPasswordBuffer = this.pauseMenu.gmPasswordBuffer.slice(
        0,
        Math.max(0, this.pauseMenu.gmPasswordBuffer.length - backspaceCount),
      );
    }

    if (input.wasPressed("back") || input.wasPressed("pause")) {
      this.leavePauseGmAuth("options");
      return;
    }

    if (!input.wasPressed("confirm")) {
      return;
    }

    if (this.pauseMenu.gmAuthStatus === "Verifica in corso...") {
      return;
    }

    if (this.pauseMenu.gmPasswordBuffer.trim().length === 0) {
      this.pauseMenu.gmAuthStatus = "Inserisci una password.";
      return;
    }

    const authToken = this.pauseMenu.gmAuthToken + 1;
    this.pauseMenu.gmAuthToken = authToken;
    this.pauseMenu.gmAuthStatus = "Verifica in corso...";

    verifyGmEditPassword(this.pauseMenu.gmPasswordBuffer)
      .then((isValid) => {
        if (this.pauseMenu.gmAuthToken !== authToken) {
          return;
        }

        if (isValid) {
          this.pauseMenu.gmPasswordBuffer = "";
          this.pauseMenu.gmAuthStatus = "";
          this.pauseMenu.gmEditIndex = 0;
          this.pauseMenu.notice = "";
          this.pauseMenu.mode = "gm-edit";
          this.game.input.setTextCapture(false);
          return;
        }

        this.pauseMenu.gmPasswordBuffer = "";
        this.pauseMenu.gmAuthStatus = "Password errata.";
      })
      .catch(() => {
        if (this.pauseMenu.gmAuthToken !== authToken) {
          return;
        }

        this.pauseMenu.gmAuthStatus = "Verifica non disponibile.";
      });
  }

  updatePauseGmEdit(input) {
    if (this.pauseMenu.gmActionBusy) {
      if (input.wasPressed("back") || input.wasPressed("pause")) {
        this.pauseMenu.notice = "Attendi la fine dell'operazione.";
      }
      return;
    }

    if (input.wasPressed("up")) {
      this.pauseMenu.gmEditIndex =
        (this.pauseMenu.gmEditIndex + PAUSE_GM_EDIT_MENU.length - 1) % PAUSE_GM_EDIT_MENU.length;
      return;
    }

    if (input.wasPressed("down")) {
      this.pauseMenu.gmEditIndex = (this.pauseMenu.gmEditIndex + 1) % PAUSE_GM_EDIT_MENU.length;
      return;
    }

    if (input.wasPressed("back") || input.wasPressed("pause")) {
      this.pauseMenu.mode = "options";
      return;
    }

    if (!input.wasPressed("confirm")) {
      return;
    }

    this.handlePauseGmEditSelection();
  }

  enterPauseGmAuth() {
    this.pauseMenu.mode = "gm-auth";
    this.pauseMenu.gmPasswordBuffer = "";
    this.pauseMenu.gmAuthStatus = "";
    this.pauseMenu.notice = "";
    this.pauseMenu.gmAuthToken += 1;
    this.game.input.setTextCapture(true);
  }

  leavePauseGmAuth(nextMode = "options") {
    this.pauseMenu.mode = nextMode;
    this.pauseMenu.gmPasswordBuffer = "";
    this.pauseMenu.gmAuthStatus = "";
    this.pauseMenu.gmAuthToken += 1;
    this.game.input.setTextCapture(false);
  }

  handlePauseGmEditSelection() {
    const selected = PAUSE_GM_EDIT_MENU[this.pauseMenu.gmEditIndex];
    if (!selected) {
      return;
    }

    if (selected.id === "debug") {
      const enabled = this.game.toggleDebugOverlay();
      this.pauseMenu.notice = `Overlay DEBUG ${enabled ? "attivo" : "disattivo"}.`;
      return;
    }

    if (selected.id === "export_classes") {
      const tableText = this.game.exportClassesAsTable();
      downloadTextFile("classes.tsv", tableText);
      this.pauseMenu.notice = "Export classes completato.";
      return;
    }

    if (selected.id === "import_classes") {
      this.startPauseGmImport("classes");
      return;
    }

    if (selected.id === "export_enemies") {
      const tableText = this.game.exportEnemiesAsTable();
      downloadTextFile("enemies.tsv", tableText);
      this.pauseMenu.notice = "Export enemies completato.";
      return;
    }

    if (selected.id === "import_enemies") {
      this.startPauseGmImport("enemies");
      return;
    }

    this.pauseMenu.mode = "options";
  }

  startPauseGmImport(target) {
    if (this.pauseMenu.gmActionBusy) {
      return;
    }

    const actionToken = this.pauseMenu.gmActionToken + 1;
    this.pauseMenu.gmActionToken = actionToken;
    this.pauseMenu.notice = "Seleziona un file tabella.";

    pickTextFile()
      .then((text) => {
        if (this.pauseMenu.gmActionToken !== actionToken) {
          return;
        }

        if (!text) {
          this.pauseMenu.notice = "Import annullato: nessun file selezionato.";
          return;
        }

        this.pauseMenu.gmActionBusy = true;
        const result =
          target === "classes"
            ? this.game.importClassesFromTable(text)
            : this.game.importEnemiesFromTable(text);

        if (!result.ok) {
          this.pauseMenu.notice = `Import fallito: ${result.error}`;
          return;
        }

        const saveResult = this.game.saveGmDataChanges();
        if (!saveResult.ok) {
          this.game.discardUnsavedGmDataChanges();
          this.pauseMenu.notice = `Import annullato: ${saveResult.error} Ripristino automatico eseguito.`;
          return;
        }

        const targetLabel = target === "classes" ? "classes" : "enemies";
        this.pauseMenu.notice = `Import ${targetLabel}: ${result.count} record salvati.`;
      })
      .catch((error) => {
        if (this.pauseMenu.gmActionToken !== actionToken) {
          return;
        }
        const reason = error instanceof Error && error.message ? error.message : "errore sconosciuto";
        this.pauseMenu.notice = `Import annullato: ${reason}`;
      })
      .finally(() => {
        if (this.pauseMenu.gmActionToken !== actionToken) {
          return;
        }
        this.pauseMenu.gmActionBusy = false;
      });
  }

  isInsideMap(x, y) {
    return x >= 0 && y >= 0 && x < GAME_CONFIG.mapWidth && y < GAME_CONFIG.mapHeight;
  }

  render(ctx) {
    this.drawMap(ctx);
    this.drawSpecialTiles(ctx);
    this.drawNpc(ctx);
    this.drawPlayer(ctx);
    this.drawHud(ctx);
    this.drawDebugOverlay(ctx);

    if (this.pauseMenu.active) {
      this.drawPauseMenu(ctx);
      return;
    }

    if (this.dialog) {
      this.drawMessageBox(ctx, this.dialog.lines[this.dialog.index]);
    } else if (this.infoMessage) {
      this.drawMessageBox(ctx, this.infoMessage);
    }
  }

  drawMap(ctx) {
    const t = GAME_CONFIG.tileSize;

    for (let y = 0; y < GAME_CONFIG.mapHeight; y += 1) {
      for (let x = 0; x < GAME_CONFIG.mapWidth; x += 1) {
        const tile = this.map[y][x];
        const px = x * t;
        const py = y * t;

        if (tile === TILE.PATH) {
          this.drawPathTile(ctx, px, py, t);
          continue;
        }

        if (tile === TILE.TREE) {
          this.drawTreeTile(ctx, px, py, t);
          continue;
        }

        if (tile === TILE.TALL_GRASS) {
          this.drawGrassTile(ctx, px, py, t);
          continue;
        }

        this.drawWaterTile(ctx, px, py, t);
      }
    }
  }

  drawPathTile(ctx, x, y, size) {
    ctx.fillStyle = PALETTE.pathLight;
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = PALETTE.pathDark;
    ctx.fillRect(x, y + size - 3, size, 3);
    ctx.fillRect(x + ((y / size) % 2 === 0 ? 2 : 5), y + 4, 3, 2);
    ctx.fillRect(x + ((x / size) % 2 === 0 ? 9 : 11), y + 9, 2, 2);
  }

  drawTreeTile(ctx, x, y, size) {
    ctx.fillStyle = PALETTE.treeDark;
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = PALETTE.treeLight;
    ctx.fillRect(x + 2, y + 2, size - 4, size - 6);

    ctx.fillStyle = PALETTE.treeDark;
    ctx.fillRect(x + 4, y + size - 5, size - 8, 3);
  }

  drawGrassTile(ctx, x, y, size) {
    ctx.fillStyle = PALETTE.grassLight;
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = PALETTE.grassDark;
    for (let i = 1; i < size; i += 4) {
      ctx.fillRect(x + i, y + size - 6, 2, 5);
      if (i % 8 === 1) {
        ctx.fillRect(x + i + 1, y + size - 10, 1, 3);
      }
    }
  }

  drawWaterTile(ctx, x, y, size) {
    ctx.fillStyle = PALETTE.waterDark;
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = PALETTE.waterLight;
    ctx.fillRect(x, y + 3, size, 2);
    ctx.fillRect(x + 2, y + 9, size - 4, 2);
  }

  drawSpecialTiles(ctx) {
    const tileSize = GAME_CONFIG.tileSize;
    const x = this.healTile.x * tileSize;
    const y = this.healTile.y * tileSize;

    ctx.fillStyle = "#d8e7ff";
    ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
    ctx.fillStyle = "#8ba3d4";
    ctx.fillRect(x + 3, y + 4, tileSize - 6, tileSize - 7);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 6, y + 7, tileSize - 12, 2);
  }

  drawNpc(ctx) {
    const size = GAME_CONFIG.tileSize;
    const x = this.npc.x * size;
    const y = this.npc.y * size;

    ctx.fillStyle = "#2e3d5b";
    ctx.fillRect(x + 5, y + 2, 6, 4);
    ctx.fillStyle = "#f6d8ad";
    ctx.fillRect(x + 5, y + 6, 6, 4);
    ctx.fillStyle = "#5778c3";
    ctx.fillRect(x + 4, y + 10, 8, 4);
    ctx.fillStyle = "#23345b";
    ctx.fillRect(x + 4, y + 14, 3, 2);
    ctx.fillRect(x + 9, y + 14, 3, 2);
  }

  drawPlayer(ctx) {
    const x = Math.round(this.player.drawX);
    const y = Math.round(this.player.drawY);
    const sway = this.player.stepFrame === 0 ? 0 : 1;

    ctx.fillStyle = "#8f1f2f";
    ctx.fillRect(x + 4, y + 1, 8, 4);
    ctx.fillStyle = "#f4d7ae";
    ctx.fillRect(x + 5, y + 5, 6, 4);
    ctx.fillStyle = "#d8474d";
    ctx.fillRect(x + 4, y + 9, 8, 4);
    ctx.fillStyle = "#304c8f";
    ctx.fillRect(x + 4, y + 13, 3, 2 + sway);
    ctx.fillRect(x + 9, y + 13, 3, 2 + (1 - sway));

    if (this.player.facing === "left") {
      ctx.fillStyle = "#102245";
      ctx.fillRect(x + 3, y + 9, 1, 3);
    } else if (this.player.facing === "right") {
      ctx.fillStyle = "#102245";
      ctx.fillRect(x + 12, y + 9, 1, 3);
    }
  }

  drawHud(ctx) {
    ctx.fillStyle = "#00000055";
    ctx.fillRect(0, 0, GAME_CONFIG.width, 14);

    ctx.fillStyle = "#ffffff";
    ctx.font = "7px monospace";
    ctx.textBaseline = "middle";

    const player = this.game.state.player;
    const progress = this.game.state.progress;
    const lifePotionCount = this.game.state.inventory.lifePotion?.quantity ?? 0;
    const manaPotionCount = this.game.state.inventory.manaPotion?.quantity ?? 0;
    const hudText = `HP ${player.hp}/${player.maxHp}  LP ${lifePotionCount}  MP ${manaPotionCount}  Win ${progress.battlesWon}`;

    ctx.fillText(hudText, 4, 7);
  }

  drawDebugOverlay(ctx) {
    if (!this.game.getDebugOverlayEnabled()) {
      return;
    }

    const panelW = 82;
    const panelH = 18;
    const panelX = GAME_CONFIG.width - panelW - 4;
    const panelY = 16;

    ctx.fillStyle = "#000000aa";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = "#ffffff";
    ctx.font = "6px monospace";
    ctx.textBaseline = "top";
    ctx.fillText(`P SPD: ${this.game.state.player.speed ?? 0}`, panelX + 4, panelY + 5);
  }

  drawPauseMenu(ctx) {
    const panelX = 44;
    const panelY = 22;
    const panelW = GAME_CONFIG.width - 88;
    const panelH = GAME_CONFIG.height - 44;

    if (
      this.uiBackgroundImage &&
      this.uiBackgroundImage.complete &&
      this.uiBackgroundImage.naturalWidth > 0
    ) {
      drawImageCover(ctx, this.uiBackgroundImage, 0, 0, GAME_CONFIG.width, GAME_CONFIG.height);
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(panelX + 2, panelY + 2, panelW, panelH);
    ctx.fillStyle = PALETTE.uiPanel;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = PALETTE.uiBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.fillStyle = PALETTE.uiText;
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.fillText("PAUSA", panelX + 8, panelY + 8);

    if (this.pauseMenu.mode === "main") {
      this.drawPauseMainPanel(ctx, panelX, panelY);
      return;
    }

    if (this.pauseMenu.mode === "save") {
      this.drawPauseSlotPanel(ctx, panelX, panelY, "save");
      return;
    }

    if (this.pauseMenu.mode === "load") {
      this.drawPauseSlotPanel(ctx, panelX, panelY, "load");
      return;
    }

    if (this.pauseMenu.mode === "options") {
      this.drawPauseOptionsPanel(ctx, panelX, panelY);
      return;
    }

    if (this.pauseMenu.mode === "gm-auth") {
      this.drawPauseGmAuthPanel(ctx, panelX, panelY);
      return;
    }

    this.drawPauseGmEditPanel(ctx, panelX, panelY);
  }

  drawPauseMainPanel(ctx, panelX, panelY) {
    PAUSE_MAIN_OPTIONS.forEach((option, index) => {
      const y = panelY + 28 + index * 16;
      if (this.pauseMenu.mainIndex === index) {
        this.drawPauseCursor(ctx, panelX + 8, y + 1);
      }
      ctx.fillText(option, panelX + 16, y);
    });
  }

  drawPauseSlotPanel(ctx, panelX, panelY, mode) {
    const slots = this.game.getSaveSlots();
    const title = mode === "load" ? "LOAD GAME" : "SAVE GAME";
    const firstSlotY = panelY + 36;

    ctx.fillText(title, panelX + 8, panelY + 18);

    slots.forEach((slot, index) => {
      const y = firstSlotY + index * 16;
      if (this.pauseMenu.slotIndex === index) {
        this.drawPauseCursor(ctx, panelX + 8, y + 1);
      }

      const slotText = slot
        ? `SLOT ${index + 1}: ${truncateText(`${slot.summary?.playerName ?? "Player"} ${formatPlayTime(slot.summary?.playTimeSeconds ?? 0)}`, 18)}`
        : `SLOT ${index + 1}: (vuoto)`;
      ctx.fillText(slotText, panelX + 16, y);
    });

    const backY = firstSlotY + slots.length * 16;
    if (this.pauseMenu.slotIndex === slots.length) {
      this.drawPauseCursor(ctx, panelX + 8, backY + 1);
    }
    ctx.fillText("INDIETRO", panelX + 16, backY);

    if (this.pauseMenu.notice) {
      ctx.fillText(truncateText(this.pauseMenu.notice, 26), panelX + 8, panelY + 98);
    }
  }

  drawPauseOptionsPanel(ctx, panelX, panelY) {
    ctx.fillText("SETTINGS", panelX + 8, panelY + 18);

    PAUSE_OPTIONS_MENU.forEach((option, index) => {
      const y = panelY + 34 + index * 16;
      if (this.pauseMenu.optionsIndex === index) {
        this.drawPauseCursor(ctx, panelX + 8, y + 1);
      }

      if (option === "SOUND") {
        ctx.fillText(`SOUND: ${this.game.getSoundLevel()}/5`, panelX + 16, y);
        return;
      }

      if (option === "MUSIC") {
        ctx.fillText(`MUSIC: ${this.game.getMusicLevel()}/5`, panelX + 16, y);
        return;
      }

      ctx.fillText(option, panelX + 16, y);
    });

    if (this.pauseMenu.notice) {
      ctx.fillText(truncateText(this.pauseMenu.notice, 26), panelX + 8, panelY + 92);
    }
  }

  drawPauseGmAuthPanel(ctx) {
    const gmPanelX = 12;
    const gmPanelY = 20;
    const gmPanelW = GAME_CONFIG.width - 24;
    const gmPanelH = GAME_CONFIG.height - 36;
    const masked =
      this.pauseMenu.gmPasswordBuffer.length > 0
        ? "*".repeat(this.pauseMenu.gmPasswordBuffer.length)
        : "____";

    ctx.fillStyle = "#f0efe2";
    ctx.fillRect(gmPanelX, gmPanelY, gmPanelW, gmPanelH);
    ctx.strokeStyle = "#3d3f52";
    ctx.lineWidth = 2;
    ctx.strokeRect(gmPanelX, gmPanelY, gmPanelW, gmPanelH);

    ctx.fillStyle = "#2c2d36";
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    ctx.fillText("GM-EDIT PASSWORD", gmPanelX + 8, gmPanelY + 8);

    ctx.fillStyle = "#e9eff3";
    ctx.fillRect(gmPanelX + 8, gmPanelY + 28, gmPanelW - 16, 18);
    ctx.strokeStyle = "#4a5665";
    ctx.lineWidth = 1;
    ctx.strokeRect(gmPanelX + 8, gmPanelY + 28, gmPanelW - 16, 18);

    ctx.fillStyle = "#1f2233";
    ctx.fillText(masked, gmPanelX + 14, gmPanelY + 34);
    ctx.fillText(this.pauseMenu.gmAuthStatus || "A conferma", gmPanelX + 8, gmPanelY + 54);
    ctx.fillText("B annulla  ABC/CANC input", gmPanelX + 8, gmPanelY + 66);
  }

  drawPauseGmEditPanel(ctx, panelX, panelY) {
    const gmPanelX = 12;
    const gmPanelY = 20;
    const gmPanelW = GAME_CONFIG.width - 24;
    const gmPanelH = GAME_CONFIG.height - 36;

    ctx.fillStyle = "#f0efe2";
    ctx.fillRect(gmPanelX, gmPanelY, gmPanelW, gmPanelH);
    ctx.strokeStyle = "#3d3f52";
    ctx.lineWidth = 2;
    ctx.strokeRect(gmPanelX, gmPanelY, gmPanelW, gmPanelH);

    ctx.fillStyle = "#2c2d36";
    ctx.font = "7px monospace";
    ctx.textBaseline = "top";
    ctx.fillText("GM-EDIT", gmPanelX + 8, gmPanelY + 8);

    PAUSE_GM_EDIT_MENU.forEach((entry, index) => {
      const y = gmPanelY + 22 + index * 12;
      if (this.pauseMenu.gmEditIndex === index) {
        this.drawPauseCursor(ctx, gmPanelX + 8, y + 1);
      }

      if (entry.id === "debug") {
        const debugValue = this.game.getDebugOverlayEnabled() ? "ON" : "OFF";
        ctx.fillText(`DEBUG MODE: ${debugValue}`, gmPanelX + 16, y);
        return;
      }

      ctx.fillText(entry.label, gmPanelX + 16, y);
    });

    ctx.fillStyle = "#2c2d36";
    ctx.fillText("Import salva automaticamente", gmPanelX + 8, gmPanelY + gmPanelH - 28);
    ctx.fillText(
      this.pauseMenu.gmActionBusy ? "Operazione in corso..." : "A seleziona",
      gmPanelX + 8,
      gmPanelY + gmPanelH - 20,
    );
    ctx.fillText("B indietro", gmPanelX + 8, gmPanelY + gmPanelH - 12);
  }

  drawPauseCursor(ctx, x, y) {
    ctx.fillStyle = PALETTE.uiText;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4, y + 3);
    ctx.lineTo(x, y + 6);
    ctx.closePath();
    ctx.fill();
  }

  drawMessageBox(ctx, text) {
    const boxX = 4;
    const boxY = GAME_CONFIG.height - 40;
    const boxW = GAME_CONFIG.width - 8;
    const boxH = 36;

    ctx.fillStyle = PALETTE.shadow;
    ctx.fillRect(boxX + 2, boxY + 2, boxW, boxH);
    ctx.fillStyle = PALETTE.uiPanel;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = PALETTE.uiBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = PALETTE.uiText;
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";
    const displayText = text === REST_DOTS_TOKEN ? this.getAnimatedDotsMessage() : text;
    const lines = wrapText(displayText, 37);
    lines.forEach((line, index) => {
      ctx.fillText(line, boxX + 6, boxY + 8 + index * 9);
    });

    if (text !== REST_DOTS_TOKEN) {
      this.drawAdvancePrompt(ctx, boxX + boxW - 12, boxY + boxH - 11);
    }
  }

  drawAdvancePrompt(ctx, x, y) {
    const blinkOn = Math.floor(this.uiPulse * 2.4) % 2 === 0;
    if (!blinkOn) {
      return;
    }

    ctx.fillStyle = PALETTE.uiText;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x + 6, y + 6);
    ctx.lineTo(x, y + 10);
    ctx.closePath();
    ctx.fill();
  }

  getAnimatedDotsMessage() {
    const dotCount = (Math.floor(this.uiPulse * 3) % 3) + 1;
    return ".".repeat(dotCount);
  }
}

function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine.length === 0 ? word : `${currentLine} ${word}`;
    if (candidate.length <= maxChars) {
      currentLine = candidate;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

function formatPlayTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function truncateText(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 1)}.`;
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
