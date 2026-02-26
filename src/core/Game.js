import { GAME_CONFIG, PLAYER_CONFIG } from "../data/constants.js";
import { PLAYER_CLASSES, applyClassToPlayer, getClassById } from "../data/classes.js";
import { ENEMIES } from "../data/enemies.js";

const SAVE_STORAGE_KEY = "gba_like_rpg_save_slots_v1";
const SAVE_SLOT_COUNT = 3;
const GM_CONFIG_STORAGE_KEY = "gba_like_rpg_gm_config_v1";
const MOBILE_RENDER_SCALE = 3;

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultGameData() {
  return {
    classes: cloneData(PLAYER_CLASSES),
    enemies: cloneData(ENEMIES),
  };
}

function createDefaultPlayer(classes = PLAYER_CLASSES) {
  const defaultClass = getClassById("warrior", classes);
  const player = {};
  applyClassToPlayer(player, defaultClass, "Pippo");
  return player;
}

function createDefaultInventory() {
  return {
    lifePotion: {
      id: "life_potion",
      label: "Life Potion",
      description: `Recupera ${PLAYER_CONFIG.healAmount} HP`,
      quantity: PLAYER_CONFIG.startLifePotions,
      usableInBattle: true,
    },
    manaPotion: {
      id: "mana_potion",
      label: "Mana Potion",
      description: `Recupera ${PLAYER_CONFIG.manaPotionAmount} MP`,
      quantity: PLAYER_CONFIG.startManaPotions,
      usableInBattle: true,
    },
    amulet: {
      id: "amulet",
      label: "Amulet",
      description: "Nessun effetto per ora.",
      quantity: 1,
      usableInBattle: false,
    },
  };
}

function createInitialState(classes = PLAYER_CLASSES) {
  return {
    player: createDefaultPlayer(classes),
    progress: {
      battlesWon: 0,
      battlesTotal: 0,
      totalSteps: 0,
      encounteredEnemyIds: [],
      playTimeSeconds: 0,
      lastRestPoint: null,
    },
    world: {
      playerX: null,
      playerY: null,
      facing: "down",
    },
    inventory: createDefaultInventory(),
  };
}

function normalizeInventory(savedInventory, fallbackInventory) {
  const inventory = cloneData(fallbackInventory);
  if (!savedInventory || typeof savedInventory !== "object") {
    return inventory;
  }

  Object.entries(savedInventory).forEach(([key, item]) => {
    if (!item || typeof item !== "object") {
      return;
    }

    if (key === "potion" && !savedInventory.lifePotion) {
      const quantity = Number(item.quantity) || 0;
      inventory.lifePotion.quantity = quantity;
      return;
    }

    if (inventory[key]) {
      inventory[key] = {
        ...inventory[key],
        ...item,
      };
      return;
    }

    inventory[key] = { ...item };
  });

  return inventory;
}

function formatSaveSummary(state) {
  return {
    playerName: state.player?.name ?? "Player",
    className: state.player?.className ?? "Classe",
    playTimeSeconds: Math.floor(state.progress?.playTimeSeconds ?? 0),
  };
}

function createDefaultSettings() {
  return {
    debugOverlay: false,
    soundLevel: 5,
    musicLevel: 5,
  };
}

function clampSettingLevel(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 5;
  }

  return Math.max(0, Math.min(5, Math.round(numeric)));
}

function sanitizeId(value, fallbackId) {
  const base = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

  if (base.length > 0) {
    return base;
  }

  return String(fallbackId ?? "id");
}

function toSafeString(value, fallback = "") {
  const text = String(value ?? "").trim();
  if (text.length === 0) {
    return fallback;
  }

  return text;
}

function toNumberInRange(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function toBooleanValue(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on", "si"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function ensureUniqueId(id, usedIds, fallbackPrefix, index) {
  let candidate = sanitizeId(id, `${fallbackPrefix}_${index + 1}`);
  if (!usedIds.has(candidate)) {
    usedIds.add(candidate);
    return candidate;
  }

  let suffix = 2;
  while (usedIds.has(`${candidate}_${suffix}`)) {
    suffix += 1;
  }

  const unique = `${candidate}_${suffix}`;
  usedIds.add(unique);
  return unique;
}

function normalizeClassEntry(rawClass, fallbackClass, usedIds, index) {
  const base = fallbackClass ?? PLAYER_CLASSES[0];
  const baseSpecial = base?.special ?? PLAYER_CLASSES[0].special;
  const rawSpecial = rawClass?.special ?? {};

  const id = ensureUniqueId(rawClass?.id ?? base.id, usedIds, "class", index);
  const maxHp = toNumberInRange(rawClass?.maxHp, 1, 999, base.maxHp);
  const attackMin = toNumberInRange(rawClass?.attackMin, 0, 999, base.attackMin);
  const attackMax = toNumberInRange(rawClass?.attackMax, attackMin, 999, base.attackMax);

  return {
    id,
    label: toSafeString(rawClass?.label, base.label),
    description: toSafeString(rawClass?.description, base.description ?? ""),
    maxHp,
    attackMin,
    attackMax: Math.max(attackMax, attackMin),
    speed: toNumberInRange(rawClass?.speed, 1, 5, base.speed ?? 3),
    maxMana: toNumberInRange(rawClass?.maxMana, 0, 999, base.maxMana ?? 0),
    special: {
      id: sanitizeId(rawSpecial?.id, baseSpecial.id),
      name: toSafeString(rawSpecial?.name, baseSpecial.name),
      cost: toNumberInRange(rawSpecial?.cost, 0, 999, baseSpecial.cost ?? 0),
      priority: toBooleanValue(rawSpecial?.priority, Boolean(baseSpecial.priority)),
      description: toSafeString(rawSpecial?.description, baseSpecial.description ?? ""),
    },
  };
}

function normalizeEnemyEntry(rawEnemy, fallbackEnemy, usedIds, index) {
  const base = fallbackEnemy ?? ENEMIES[0];
  const id = ensureUniqueId(rawEnemy?.id ?? base.id, usedIds, "enemy", index);
  const attackMin = toNumberInRange(rawEnemy?.attackMin, 0, 999, base.attackMin);
  const attackMax = toNumberInRange(rawEnemy?.attackMax, attackMin, 999, base.attackMax);

  return {
    id,
    name: toSafeString(rawEnemy?.name, base.name),
    maxHp: toNumberInRange(rawEnemy?.maxHp, 1, 999, base.maxHp),
    attackMin,
    attackMax: Math.max(attackMax, attackMin),
    speed: toNumberInRange(rawEnemy?.speed, 1, 5, base.speed ?? 3),
    colorA: toSafeString(rawEnemy?.colorA, base.colorA),
    colorB: toSafeString(rawEnemy?.colorB, base.colorB),
  };
}

function normalizeClasses(rawClasses, fallbackClasses = PLAYER_CLASSES) {
  const source = Array.isArray(rawClasses) && rawClasses.length > 0 ? rawClasses : fallbackClasses;
  const usedIds = new Set();
  const normalized = source.map((classData, index) => {
    const fallback = fallbackClasses[index] ?? fallbackClasses[0] ?? PLAYER_CLASSES[0];
    return normalizeClassEntry(classData, fallback, usedIds, index);
  });

  if (normalized.length === 0) {
    return cloneData(PLAYER_CLASSES);
  }

  return normalized;
}

function normalizeEnemies(rawEnemies, fallbackEnemies = ENEMIES) {
  const source = Array.isArray(rawEnemies) && rawEnemies.length > 0 ? rawEnemies : fallbackEnemies;
  const usedIds = new Set();
  const normalized = source.map((enemyData, index) => {
    const fallback = fallbackEnemies[index] ?? fallbackEnemies[0] ?? ENEMIES[0];
    return normalizeEnemyEntry(enemyData, fallback, usedIds, index);
  });

  if (normalized.length === 0) {
    return cloneData(ENEMIES);
  }

  return normalized;
}

function normalizeGameData(rawData, fallbackData = createDefaultGameData()) {
  return {
    classes: normalizeClasses(rawData?.classes, fallbackData.classes),
    enemies: normalizeEnemies(rawData?.enemies, fallbackData.enemies),
  };
}

function parseDelimitedTable(text) {
  if (typeof text !== "string") {
    return { ok: false, error: "Formato file non valido." };
  }

  const normalizedText = text.replace(/\r/g, "").trim();
  if (normalizedText.length === 0) {
    return { ok: false, error: "Il file e' vuoto." };
  }

  const lines = normalizedText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return { ok: false, error: "Tabella incompleta: manca almeno una riga dati." };
  }

  const headerLine = lines[0];
  const separator = headerLine.includes("\t") ? "\t" : ",";
  const headers = headerLine.split(separator).map((header) => header.trim().toLowerCase());
  if (headers.some((header) => header.length === 0)) {
    return { ok: false, error: "Intestazione tabella non valida." };
  }

  const rows = lines.slice(1).map((line) => {
    const values = line.split(separator).map((value) => value.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });

  return {
    ok: true,
    headers,
    rows,
  };
}

function toDelimitedTable(headers, rows) {
  const firstLine = headers.join("\t");
  const bodyLines = rows.map((row) => headers.map((header) => String(row[header] ?? "")).join("\t"));
  return [firstLine, ...bodyLines].join("\n");
}

export class Game {
  constructor(canvas, input) {
    this.canvas = canvas;
    this.input = input;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.viewportScaleX = 1;
    this.viewportScaleY = 1;
    this.viewportScale = 1;
    this.viewportOffsetX = 0;
    this.viewportOffsetY = 0;

    this.scenes = new Map();
    this.currentScene = null;
    this.currentSceneName = "";
    this.lastFrameTime = 0;

    this.persistedGameData = this.readPersistedGmData();
    this.runtimeGameData = cloneData(this.persistedGameData);
    this.gmDataDirty = false;

    this.state = createInitialState(this.getClasses());
    this.settings = createDefaultSettings();

    this.loop = this.loop.bind(this);
    this.updateViewport = this.updateViewport.bind(this);
    this.updateViewport();
    window.addEventListener("resize", this.updateViewport);
  }

  registerScene(name, scene) {
    this.scenes.set(name, scene);
  }

  start(initialSceneName, payload = {}) {
    this.changeScene(initialSceneName, payload);
    this.lastFrameTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  changeScene(name, payload = {}) {
    const nextScene = this.scenes.get(name);
    if (!nextScene) {
      throw new Error(`Scene "${name}" non trovata.`);
    }

    if (this.currentScene) {
      this.currentScene.onExit();
    }

    this.currentSceneName = name;
    this.currentScene = nextScene;

    if (typeof document !== "undefined" && document.body) {
      document.body.dataset.scene = name;
      if (name !== "start") {
        delete document.body.dataset.startMode;
      }
    }

    this.currentScene.onEnter(payload);
  }

  resetState() {
    this.discardUnsavedGmDataChanges();
    this.state = createInitialState(this.getClasses());
    this.syncPlayerClassData();
  }

  getClasses() {
    if (!Array.isArray(this.runtimeGameData?.classes) || this.runtimeGameData.classes.length === 0) {
      this.runtimeGameData = normalizeGameData(this.runtimeGameData, this.persistedGameData);
    }

    return this.runtimeGameData.classes;
  }

  getEnemies() {
    if (!Array.isArray(this.runtimeGameData?.enemies) || this.runtimeGameData.enemies.length === 0) {
      this.runtimeGameData = normalizeGameData(this.runtimeGameData, this.persistedGameData);
    }

    return this.runtimeGameData.enemies;
  }

  hasUnsavedGmDataChanges() {
    return this.gmDataDirty === true;
  }

  exportClassesAsTable() {
    const headers = [
      "id",
      "label",
      "description",
      "maxHp",
      "attackMin",
      "attackMax",
      "speed",
      "maxMana",
      "specialId",
      "specialName",
      "specialCost",
      "specialPriority",
      "specialDescription",
    ];

    const rows = this.getClasses().map((classData) => ({
      id: classData.id,
      label: classData.label,
      description: classData.description ?? "",
      maxHp: classData.maxHp,
      attackMin: classData.attackMin,
      attackMax: classData.attackMax,
      speed: classData.speed ?? 3,
      maxMana: classData.maxMana ?? 0,
      specialId: classData.special?.id ?? "",
      specialName: classData.special?.name ?? "",
      specialCost: classData.special?.cost ?? 0,
      specialPriority: classData.special?.priority ? "true" : "false",
      specialDescription: classData.special?.description ?? "",
    }));

    return toDelimitedTable(headers, rows);
  }

  exportEnemiesAsTable() {
    const headers = ["id", "name", "maxHp", "attackMin", "attackMax", "speed", "colorA", "colorB"];
    const rows = this.getEnemies().map((enemyData) => ({
      id: enemyData.id,
      name: enemyData.name,
      maxHp: enemyData.maxHp,
      attackMin: enemyData.attackMin,
      attackMax: enemyData.attackMax,
      speed: enemyData.speed ?? 3,
      colorA: enemyData.colorA,
      colorB: enemyData.colorB,
    }));

    return toDelimitedTable(headers, rows);
  }

  importClassesFromTable(text) {
    const parsed = parseDelimitedTable(text);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }

    const requiredHeaders = [
      "id",
      "label",
      "maxhp",
      "attackmin",
      "attackmax",
      "speed",
      "maxmana",
      "specialid",
      "specialname",
      "specialcost",
      "specialpriority",
    ];
    const missing = requiredHeaders.filter((header) => !parsed.headers.includes(header));
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Colonne mancanti: ${missing.join(", ")}`,
      };
    }

    const currentClasses = this.getClasses();
    const importedClasses = parsed.rows.map((row, index) => ({
      id: sanitizeId(row.id, `class_${index + 1}`),
      label: row.label,
      description: row.description,
      maxHp: row.maxhp,
      attackMin: row.attackmin,
      attackMax: row.attackmax,
      speed: row.speed,
      maxMana: row.maxmana,
      special: {
        id: row.specialid,
        name: row.specialname,
        cost: row.specialcost,
        priority: row.specialpriority,
        description: row.specialdescription,
      },
    }));

    const normalizedClasses = normalizeClasses(importedClasses, currentClasses);
    this.runtimeGameData.classes = normalizedClasses;
    this.gmDataDirty = true;
    this.syncPlayerClassData();

    return { ok: true, count: normalizedClasses.length };
  }

  importEnemiesFromTable(text) {
    const parsed = parseDelimitedTable(text);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }

    const requiredHeaders = ["id", "name", "maxhp", "attackmin", "attackmax", "speed", "colora", "colorb"];
    const missing = requiredHeaders.filter((header) => !parsed.headers.includes(header));
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Colonne mancanti: ${missing.join(", ")}`,
      };
    }

    const currentEnemies = this.getEnemies();
    const importedEnemies = parsed.rows.map((row, index) => ({
      id: sanitizeId(row.id, `enemy_${index + 1}`),
      name: row.name,
      maxHp: row.maxhp,
      attackMin: row.attackmin,
      attackMax: row.attackmax,
      speed: row.speed,
      colorA: row.colora,
      colorB: row.colorb,
    }));

    const normalizedEnemies = normalizeEnemies(importedEnemies, currentEnemies);
    this.runtimeGameData.enemies = normalizedEnemies;
    this.gmDataDirty = true;

    return { ok: true, count: normalizedEnemies.length };
  }

  saveGmDataChanges() {
    const normalizedData = normalizeGameData(this.runtimeGameData, createDefaultGameData());
    if (!this.writePersistedGmData(normalizedData)) {
      return { ok: false, error: "Impossibile salvare la configurazione GM." };
    }

    this.persistedGameData = cloneData(normalizedData);
    this.runtimeGameData = cloneData(normalizedData);
    this.gmDataDirty = false;
    this.syncPlayerClassData();
    return { ok: true };
  }

  discardUnsavedGmDataChanges() {
    if (!this.gmDataDirty) {
      return;
    }

    this.runtimeGameData = cloneData(this.persistedGameData);
    this.gmDataDirty = false;
    this.syncPlayerClassData();
  }

  syncPlayerClassData() {
    const player = this.state?.player;
    if (!player) {
      return;
    }

    const classData = getClassById(player.classId, this.getClasses());
    if (!classData) {
      return;
    }

    const currentHp = Number(player.hp);
    const currentMana = Number(player.mana);

    player.classId = classData.id;
    player.className = classData.label;
    player.maxHp = classData.maxHp;
    player.attackMin = classData.attackMin;
    player.attackMax = classData.attackMax;
    player.speed = classData.speed ?? 3;
    player.maxMana = classData.maxMana ?? 0;
    player.specialId = classData.special?.id ?? "";
    player.specialName = classData.special?.name ?? "";
    player.specialCost = classData.special?.cost ?? 0;
    player.specialPriority = Boolean(classData.special?.priority);
    player.specialDescription = classData.special?.description ?? "";

    player.hp = Number.isFinite(currentHp)
      ? Math.max(0, Math.min(player.maxHp, Math.round(currentHp)))
      : player.maxHp;
    player.mana = Number.isFinite(currentMana)
      ? Math.max(0, Math.min(player.maxMana, Math.round(currentMana)))
      : player.maxMana;
  }

  readPersistedGmData() {
    const fallback = createDefaultGameData();

    try {
      const raw = window.localStorage.getItem(GM_CONFIG_STORAGE_KEY);
      if (!raw) {
        return fallback;
      }

      const parsed = JSON.parse(raw);
      return normalizeGameData(parsed?.data, fallback);
    } catch (error) {
      return fallback;
    }
  }

  writePersistedGmData(data) {
    try {
      window.localStorage.setItem(
        GM_CONFIG_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          data,
        }),
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  getSaveSlots() {
    const slots = this.readSaveSlots();
    return slots;
  }

  saveToSlot(slotIndex) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= SAVE_SLOT_COUNT) {
      return false;
    }

    const slots = this.readSaveSlots();
    const snapshot = cloneData(this.state);
    slots[slotIndex] = {
      version: 1,
      savedAt: Date.now(),
      summary: formatSaveSummary(snapshot),
      snapshot,
    };

    return this.writeSaveSlots(slots);
  }

  loadFromSlot(slotIndex) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= SAVE_SLOT_COUNT) {
      return { ok: false, error: "invalid_slot" };
    }

    const slots = this.readSaveSlots();
    const slot = slots[slotIndex];
    if (!slot || !slot.snapshot) {
      return { ok: false, error: "empty_slot" };
    }

    this.discardUnsavedGmDataChanges();
    this.state = this.normalizeLoadedState(slot.snapshot);
    this.syncPlayerClassData();
    return { ok: true };
  }

  normalizeLoadedState(snapshot) {
    const fallback = createInitialState(this.getClasses());
    const loaded = snapshot && typeof snapshot === "object" ? snapshot : {};

    return {
      ...fallback,
      ...loaded,
      player: {
        ...fallback.player,
        ...(loaded.player ?? {}),
      },
      progress: {
        ...fallback.progress,
        ...(loaded.progress ?? {}),
      },
      world: {
        ...fallback.world,
        ...(loaded.world ?? {}),
      },
      inventory: normalizeInventory(loaded.inventory, fallback.inventory),
    };
  }

  readSaveSlots() {
    const emptySlots = Array.from({ length: SAVE_SLOT_COUNT }, () => null);

    try {
      const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) {
        return emptySlots;
      }

      const parsed = JSON.parse(raw);
      const rawSlots = Array.isArray(parsed?.slots) ? parsed.slots : [];

      return emptySlots.map((_, index) => {
        const slot = rawSlots[index];
        if (!slot || typeof slot !== "object") {
          return null;
        }

        if (!slot.snapshot || typeof slot.snapshot !== "object") {
          return null;
        }

        return {
          version: slot.version ?? 1,
          savedAt: Number(slot.savedAt) || 0,
          summary: slot.summary ?? formatSaveSummary(slot.snapshot),
          snapshot: slot.snapshot,
        };
      });
    } catch (error) {
      return emptySlots;
    }
  }

  writeSaveSlots(slots) {
    try {
      const normalized = Array.from({ length: SAVE_SLOT_COUNT }, (_, index) => slots[index] ?? null);
      window.localStorage.setItem(
        SAVE_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          slots: normalized,
        }),
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  getDebugOverlayEnabled() {
    return this.settings?.debugOverlay === true;
  }

  toggleDebugOverlay() {
    const nextValue = !this.getDebugOverlayEnabled();
    this.setDebugOverlayEnabled(nextValue);
    return nextValue;
  }

  setDebugOverlayEnabled(enabled) {
    if (!this.settings || typeof this.settings !== "object") {
      this.settings = createDefaultSettings();
    }

    this.settings.debugOverlay = Boolean(enabled);
  }

  getSoundLevel() {
    if (!this.settings || typeof this.settings !== "object") {
      this.settings = createDefaultSettings();
    }

    this.settings.soundLevel = clampSettingLevel(this.settings.soundLevel);
    return this.settings.soundLevel;
  }

  setSoundLevel(level) {
    if (!this.settings || typeof this.settings !== "object") {
      this.settings = createDefaultSettings();
    }

    this.settings.soundLevel = clampSettingLevel(level);
    return this.settings.soundLevel;
  }

  shiftSoundLevel(delta) {
    return this.setSoundLevel(this.getSoundLevel() + delta);
  }

  getMusicLevel() {
    if (!this.settings || typeof this.settings !== "object") {
      this.settings = createDefaultSettings();
    }

    this.settings.musicLevel = clampSettingLevel(this.settings.musicLevel);
    return this.settings.musicLevel;
  }

  setMusicLevel(level) {
    if (!this.settings || typeof this.settings !== "object") {
      this.settings = createDefaultSettings();
    }

    this.settings.musicLevel = clampSettingLevel(level);
    return this.settings.musicLevel;
  }

  shiftMusicLevel(delta) {
    return this.setMusicLevel(this.getMusicLevel() + delta);
  }

  updateViewport() {
    const clientWidth = Math.max(1, Math.round(this.canvas.clientWidth || window.innerWidth || 1));
    const clientHeight = Math.max(1, Math.round(this.canvas.clientHeight || window.innerHeight || 1));
    const targetCanvasWidth = clientWidth * MOBILE_RENDER_SCALE;
    const targetCanvasHeight = clientHeight * MOBILE_RENDER_SCALE;

    if (this.canvas.width !== targetCanvasWidth || this.canvas.height !== targetCanvasHeight) {
      this.canvas.width = targetCanvasWidth;
      this.canvas.height = targetCanvasHeight;
    }

    this.viewportScaleX = this.canvas.width / GAME_CONFIG.width;
    this.viewportScaleY = this.canvas.height / GAME_CONFIG.height;
    this.viewportScale = Math.min(this.viewportScaleX, this.viewportScaleY);
    this.viewportOffsetX = 0;
    this.viewportOffsetY = 0;
  }

  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = timestamp;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "#0f1b2b";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.setTransform(
      this.viewportScaleX,
      0,
      0,
      this.viewportScaleY,
      0,
      0,
    );

    if (this.currentScene) {
      this.currentScene.update(dt, this.input);
      this.currentScene.render(this.ctx);
    }

    this.state.progress.playTimeSeconds += dt;
    this.input.endFrame();
    requestAnimationFrame(this.loop);
  }
}
