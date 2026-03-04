import { GAME_CONFIG, PLAYER_CONFIG } from "../data/constants.js";
import { PLAYER_CLASSES } from "../data/classes.js";
import { ENEMIES } from "../data/enemies.js";
import { AUTO_SAVE_TRIGGER, DEFAULT_AUTO_SAVE_TRIGGER_CONFIG } from "../data/autoSave.js";
import {
  fetchRemoteGameData,
  fetchRemotePlayerProgress,
  fetchSessionAccount,
  logoutSessionAccount,
  saveRemoteGameData,
  saveRemotePlayerProgress,
  signInWithGoogle,
} from "../services/cloudSync.js";

const SAVE_STORAGE_KEY = "gba_like_rpg_profile_slot_v2";
const SAVE_SLOT_COUNT = 1;
const GM_CONFIG_STORAGE_KEY = "gba_like_rpg_gm_config_v1";
const DEBUG_MODE_STORAGE_KEY = "agoad_debug_mode";
const LEGACY_THE_BUG_MODE_STORAGE_KEY = "agoad_the_bug_mode";
const MOBILE_RENDER_SCALE = 3;
const PRIMARY_SAVE_SLOT_INDEX = 0;
const DEFAULT_AUTO_SAVE_INTERVAL_SECONDS = 30;
const DEFAULT_AUTO_SAVE_MIN_GAP_SECONDS = 2;
const DEFAULT_AUTO_SAVE_RETRY_SECONDS = 5;
const GOBLIN_PLAYER_BASE = Object.freeze({
  pgTitle: "Goblin",
  maxHp: 30,
  maxMana: 30,
  speed: 3,
  attackMin: 3,
  attackMax: 5,
});
const UNKNOWN_TOOL_DESCRIPTION = "Non conosci l'utilita' di questo arnese";

const DEFAULT_PLAYER_SKILLS = Object.freeze([
  Object.freeze({
    id: "shield_bash",
    label: "Shield Bash",
    description: "Stordisce il nemico e infligge danno",
    manaCost: 10,
    usableInBattle: true,
    priority: false,
    effect: "stun_attack",
  }),
  Object.freeze({
    id: "arcane_heal",
    label: "Cura Arcana",
    description: "Ripristina HP durante il combattimento",
    manaCost: 10,
    usableInBattle: true,
    priority: false,
    effect: "heal",
  }),
  Object.freeze({
    id: "shadow_escape",
    label: "Fuga Garantita",
    description: "Permette una fuga certa dal combattimento",
    manaCost: 10,
    usableInBattle: true,
    priority: true,
    effect: "escape",
  }),
  Object.freeze({
    id: "rune_focus",
    label: "Rune Focus",
    description: "Schema runico da studiare",
    manaCost: 0,
    usableInBattle: false,
    priority: false,
    effect: "",
  }),
  Object.freeze({
    id: "mind_link",
    label: "Mind Link",
    description: "Connessione mentale incompleta",
    manaCost: 0,
    usableInBattle: false,
    priority: false,
    effect: "",
  }),
  Object.freeze({
    id: "stone_ward",
    label: "Stone Ward",
    description: "Tecnica passiva senza effetto pratico",
    manaCost: 0,
    usableInBattle: false,
    priority: false,
    effect: "",
  }),
  Object.freeze({
    id: "ember_mark",
    label: "Ember Mark",
    description: "Marchio sperimentale non attivo",
    manaCost: 0,
    usableInBattle: false,
    priority: false,
    effect: "",
  }),
  Object.freeze({
    id: "lunar_step",
    label: "Lunar Step",
    description: "Movimento rituale ancora instabile",
    manaCost: 0,
    usableInBattle: false,
    priority: false,
    effect: "",
  }),
  Object.freeze({
    id: "tide_echo",
    label: "Tide Echo",
    description: "Eco elementale non canalizzata",
    manaCost: 0,
    usableInBattle: false,
    priority: false,
    effect: "",
  }),
  Object.freeze({
    id: "iron_vow",
    label: "Iron Vow",
    description: "Giuramento antico senza riscontro",
    manaCost: 0,
    usableInBattle: false,
    priority: false,
    effect: "",
  }),
  Object.freeze({
    id: "mist_call",
    label: "Mist Call",
    description: "Richiamo incompleto della nebbia",
    manaCost: 0,
    usableInBattle: false,
    priority: false,
    effect: "",
  }),
  Object.freeze({
    id: "thorn_thread",
    label: "Thorn Thread",
    description: "Traccia druidica ancora da comprendere",
    manaCost: 0,
    usableInBattle: false,
    priority: false,
    effect: "",
  }),
  Object.freeze({
    id: "void_whisper",
    label: "Void Whisper",
    description: "Sussurro arcano senza effetto",
    manaCost: 0,
    usableInBattle: false,
    priority: false,
    effect: "",
  }),
]);

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultGameData() {
  return {
    classes: cloneData(PLAYER_CLASSES),
    enemies: cloneData(ENEMIES),
  };
}

function createDefaultPlayer(_classes = PLAYER_CLASSES) {
  return {
    name: "Rit",
    pgTitle: GOBLIN_PLAYER_BASE.pgTitle,
    maxHp: GOBLIN_PLAYER_BASE.maxHp,
    hp: GOBLIN_PLAYER_BASE.maxHp,
    attackMin: GOBLIN_PLAYER_BASE.attackMin,
    attackMax: GOBLIN_PLAYER_BASE.attackMax,
    speed: GOBLIN_PLAYER_BASE.speed,
    maxMana: GOBLIN_PLAYER_BASE.maxMana,
    mana: GOBLIN_PLAYER_BASE.maxMana,
  };
}

function createDefaultSkills() {
  const skills = {};
  DEFAULT_PLAYER_SKILLS.forEach((skill) => {
    skills[skill.id] = cloneData(skill);
  });
  return skills;
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
      description: UNKNOWN_TOOL_DESCRIPTION,
      quantity: 1,
      usableInBattle: false,
    },
    stone: {
      id: "stone",
      label: "Sasso",
      description: UNKNOWN_TOOL_DESCRIPTION,
      quantity: 1,
      usableInBattle: false,
    },
    rustyKey: {
      id: "rusty_key",
      label: "Chiave Arrugginita",
      description: UNKNOWN_TOOL_DESCRIPTION,
      quantity: 1,
      usableInBattle: false,
    },
    boneCharm: {
      id: "bone_charm",
      label: "Ciondolo d'Osso",
      description: UNKNOWN_TOOL_DESCRIPTION,
      quantity: 1,
      usableInBattle: false,
    },
    tornMap: {
      id: "torn_map",
      label: "Mappa Strappata",
      description: UNKNOWN_TOOL_DESCRIPTION,
      quantity: 1,
      usableInBattle: false,
    },
    crackedOrb: {
      id: "cracked_orb",
      label: "Sfera Crepata",
      description: UNKNOWN_TOOL_DESCRIPTION,
      quantity: 1,
      usableInBattle: false,
    },
    oldCoin: {
      id: "old_coin",
      label: "Moneta Antica",
      description: UNKNOWN_TOOL_DESCRIPTION,
      quantity: 1,
      usableInBattle: false,
    },
    emptyFlask: {
      id: "empty_flask",
      label: "Fiasca Vuota",
      description: UNKNOWN_TOOL_DESCRIPTION,
      quantity: 1,
      usableInBattle: false,
    },
    waxSeal: {
      id: "wax_seal",
      label: "Sigillo di Cera",
      description: UNKNOWN_TOOL_DESCRIPTION,
      quantity: 1,
      usableInBattle: false,
    },
    copperNail: {
      id: "copper_nail",
      label: "Chiodo di Rame",
      description: UNKNOWN_TOOL_DESCRIPTION,
      quantity: 1,
      usableInBattle: false,
    },
    featherToken: {
      id: "feather_token",
      label: "Gettone Piumato",
      description: UNKNOWN_TOOL_DESCRIPTION,
      quantity: 1,
      usableInBattle: false,
    },
    shellFragment: {
      id: "shell_fragment",
      label: "Frammento di Conchiglia",
      description: UNKNOWN_TOOL_DESCRIPTION,
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
      coins: 0,
      encounteredEnemyIds: [],
      playTimeSeconds: 0,
      lastRestPoint: null,
      cutsceneSpeakerLabels: {},
    },
    world: {
      playerX: null,
      playerY: null,
      facing: "down",
    },
    inventory: createDefaultInventory(),
    skills: createDefaultSkills(),
  };
}

function normalizeCutsceneSpeakerLabels(rawLabels) {
  if (!rawLabels || typeof rawLabels !== "object" || Array.isArray(rawLabels)) {
    return {};
  }

  const normalizedLabels = {};
  Object.entries(rawLabels).forEach(([speakerId, label]) => {
    const safeSpeakerId = String(speakerId ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    if (!safeSpeakerId) {
      return;
    }

    const safeLabel = String(label ?? "").trim().toLocaleUpperCase("it-IT");
    if (!safeLabel) {
      return;
    }

    normalizedLabels[safeSpeakerId] = safeLabel;
  });
  return normalizedLabels;
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
      const mergedItem = {
        ...inventory[key],
        ...item,
      };
      mergedItem.description = normalizeDescriptionText(
        mergedItem.description,
        inventory[key].description ?? "",
      );
      inventory[key] = mergedItem;
      return;
    }

    inventory[key] = {
      ...item,
      description: normalizeDescriptionText(item.description, ""),
    };
  });

  Object.entries(inventory).forEach(([key, item]) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const fallbackDescription =
      key === "amulet" || key === "stone" ? UNKNOWN_TOOL_DESCRIPTION : "";
    item.description = normalizeDescriptionText(item.description, fallbackDescription);
  });

  return inventory;
}

function normalizeSkills(savedSkills, fallbackSkills) {
  const skills = cloneData(fallbackSkills);
  if (!savedSkills || typeof savedSkills !== "object") {
    return skills;
  }

  Object.entries(savedSkills).forEach(([key, rawSkill]) => {
    if (!rawSkill || typeof rawSkill !== "object") {
      return;
    }

    const safeKey = String(key ?? "").trim();
    if (!safeKey) {
      return;
    }

    const baseSkill = skills[safeKey] ?? {
      id: safeKey,
      label: "ABILITA'",
      description: "",
      manaCost: 0,
      usableInBattle: true,
      priority: false,
      effect: "",
    };

    const manaCost = toNumberInRange(rawSkill.manaCost, 0, 999, baseSkill.manaCost ?? 0);
    skills[safeKey] = {
      ...baseSkill,
      ...rawSkill,
      id: toSafeString(rawSkill.id, baseSkill.id),
      label: toSafeString(rawSkill.label, baseSkill.label),
      description: normalizeDescriptionText(rawSkill.description, baseSkill.description),
      manaCost,
      usableInBattle: toBooleanValue(rawSkill.usableInBattle, baseSkill.usableInBattle !== false),
      priority: toBooleanValue(rawSkill.priority, Boolean(baseSkill.priority)),
      effect: toSafeString(rawSkill.effect, baseSkill.effect ?? ""),
    };
  });

  return skills;
}

function formatSaveSummary(state) {
  return {
    playerName: state.player?.name ?? "Player",
    playerTitle: state.player?.pgTitle ?? GOBLIN_PLAYER_BASE.pgTitle,
    playTimeSeconds: Math.floor(state.progress?.playTimeSeconds ?? 0),
  };
}

function normalizeSingleSlot(rawSlot) {
  if (!rawSlot || typeof rawSlot !== "object") {
    return null;
  }

  if (!rawSlot.snapshot || typeof rawSlot.snapshot !== "object") {
    return null;
  }

  return {
    version: Number(rawSlot.version) || 1,
    savedAt: Number(rawSlot.savedAt) || Date.now(),
    summary: rawSlot.summary ?? formatSaveSummary(rawSlot.snapshot),
    snapshot: rawSlot.snapshot,
  };
}

function createDefaultSettings() {
  return {
    debugOverlay: false,
    soundLevel: 5,
    musicLevel: 5,
  };
}

function readStoredDebugModeFlag() {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  try {
    const debugModeValue = window.localStorage.getItem(DEBUG_MODE_STORAGE_KEY);
    if (debugModeValue === "1" || debugModeValue === "0") {
      return debugModeValue === "1";
    }

    return window.localStorage.getItem(LEGACY_THE_BUG_MODE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistDebugModeFlag(enabled) {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(DEBUG_MODE_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Ignore storage write failures in restricted environments.
  }
}

function emitDebugModeChange(enabled) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent("agoad:debugmodechange", {
      detail: { enabled: Boolean(enabled) },
    }),
  );
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

function normalizeDescriptionText(value, fallback = "") {
  const normalized = toSafeString(value, fallback).replace(/\.+$/g, "");
  if (normalized.toLowerCase() === "nessun effetto per ora") {
    return UNKNOWN_TOOL_DESCRIPTION;
  }
  return normalized;
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

function clampPositiveNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function normalizeAutoSaveTriggerId(triggerId) {
  const id = String(triggerId ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return id.length > 0 ? id : "manual";
}

function normalizeAutoSaveTriggerConfig(config = {}) {
  return {
    enabled: config.enabled !== false,
    immediate: config.immediate === true,
  };
}

function createDefaultAutoSaveState() {
  return {
    enabled: true,
    intervalSeconds: DEFAULT_AUTO_SAVE_INTERVAL_SECONDS,
    minGapSeconds: DEFAULT_AUTO_SAVE_MIN_GAP_SECONDS,
    retrySeconds: DEFAULT_AUTO_SAVE_RETRY_SECONDS,
    elapsedIntervalSeconds: 0,
    pending: false,
    pendingImmediate: false,
    pendingTriggerId: "",
    pendingPayload: null,
    lastSavedAtSeconds: 0,
    nextRetryAtSeconds: 0,
    triggers: new Map(),
  };
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
    this.previousSceneName = "";
    this.overlayScene = null;
    this.overlaySceneName = "";
    this.lastFrameTime = 0;

    this.account = {
      status: "unknown",
      user: null,
    };
    this.lastSyncError = "";
    this.profileSlot = null;

    this.persistedGameData = this.readPersistedGmData();
    this.runtimeGameData = cloneData(this.persistedGameData);
    this.gmDataDirty = false;

    this.state = createInitialState(this.getClasses());
    this.profileSlot = this.readSaveSlots()[0] ?? null;
    this.settings = createDefaultSettings();
    this.settings.debugOverlay = readStoredDebugModeFlag();
    this.autoSave = createDefaultAutoSaveState();
    this.registerAutoSaveTriggers(DEFAULT_AUTO_SAVE_TRIGGER_CONFIG);

    this.loop = this.loop.bind(this);
    this.updateViewport = this.updateViewport.bind(this);
    this.updateViewport();
    window.addEventListener("resize", this.updateViewport);
  }

  registerScene(name, scene) {
    this.scenes.set(name, scene);
  }

  async initializeCloudSession() {
    this.lastSyncError = "";
    const authResult = await fetchSessionAccount();
    if (!authResult.ok || !authResult.user) {
      this.account.status = "guest";
      this.account.user = null;
      return { ok: true, authenticated: false };
    }

    this.account.status = "authenticated";
    this.account.user = authResult.user;
    await this.pullRemoteGameData();
    await this.pullRemoteProgress();
    return { ok: true, authenticated: true };
  }

  isAuthenticated() {
    return this.account.status === "authenticated" && Boolean(this.account.user);
  }

  getAccountUser() {
    return this.account.user ?? null;
  }

  getAccountDisplayName() {
    const user = this.getAccountUser();
    if (!user) {
      return "";
    }

    const name = String(user.name ?? "").trim();
    if (name.length > 0) {
      return name;
    }

    return String(user.email ?? "").trim();
  }

  getLastSyncError() {
    return this.lastSyncError;
  }

  async signInWithGoogleAccount() {
    const login = await signInWithGoogle();
    if (!login.ok) {
      this.lastSyncError = login.error ?? "Login Google fallito.";
      return {
        ok: false,
        error: this.lastSyncError,
        recovery: login.recovery ?? null,
      };
    }

    this.account.status = "authenticated";
    this.account.user = login.user ?? null;
    this.lastSyncError = "";
    await this.pullRemoteGameData();
    await this.pullRemoteProgress();
    return { ok: true };
  }

  async signOutAccount() {
    const result = await logoutSessionAccount();
    if (!result.ok) {
      this.lastSyncError = result.error ?? "Logout fallito.";
      return { ok: false, error: this.lastSyncError };
    }

    this.account.status = "guest";
    this.account.user = null;
    this.lastSyncError = "";
    this.clearAutoSaveQueue();
    this.profileSlot = null;
    this.writeSaveSlots([null]);
    this.resetState();
    return { ok: true };
  }

  async pullRemoteGameData() {
    const result = await fetchRemoteGameData();
    if (!result.ok) {
      this.lastSyncError = result.error ?? "Impossibile leggere i dati globali.";
      return { ok: false, error: this.lastSyncError };
    }

    if (!result.data || typeof result.data !== "object") {
      return { ok: true, found: false };
    }

    const normalized = normalizeGameData(result.data, createDefaultGameData());
    this.persistedGameData = cloneData(normalized);
    this.runtimeGameData = cloneData(normalized);
    this.gmDataDirty = false;
    this.syncPlayerClassData();
    this.writePersistedGmData(normalized);
    return { ok: true, found: true };
  }

  async pullRemoteProgress() {
    const result = await fetchRemotePlayerProgress();
    if (!result.ok) {
      this.lastSyncError = result.error ?? "Impossibile leggere i progressi.";
      return { ok: false, error: this.lastSyncError };
    }

    if (!result.progress || typeof result.progress !== "object" || !result.progress.snapshot) {
      this.profileSlot = null;
      this.writeSaveSlots([null]);
      return { ok: true, found: false };
    }

    const normalizedSlot = normalizeSingleSlot(result.progress);
    this.profileSlot = normalizedSlot;
    this.writeSaveSlots([normalizedSlot]);
    this.discardUnsavedGmDataChanges();
    this.state = this.normalizeLoadedState(normalizedSlot.snapshot);
    this.syncPlayerClassData();
    return { ok: true, found: true };
  }

  queueRemoteProfileSave(slot) {
    if (!this.isAuthenticated() || !slot) {
      return;
    }

    saveRemotePlayerProgress(slot).then((result) => {
      if (!result.ok) {
        this.lastSyncError = result.error ?? "Sync progressi fallita.";
      }
    });
  }

  queueRemoteGameDataSave(data) {
    if (!this.isAuthenticated()) {
      return;
    }

    saveRemoteGameData(data).then((result) => {
      if (!result.ok) {
        this.lastSyncError = result.error ?? "Sync dati globali fallita.";
      }
    });
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

    if (this.overlayScene) {
      this.overlayScene.onExit();
      this.overlayScene = null;
      this.overlaySceneName = "";
    }

    const outgoingSceneName = this.currentSceneName;
    if (this.currentScene) {
      this.currentScene.onExit();
    }

    this.previousSceneName = outgoingSceneName;
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

  openOverlayScene(name, payload = {}) {
    const nextOverlayScene = this.scenes.get(name);
    if (!nextOverlayScene) {
      throw new Error(`Overlay scene "${name}" non trovata.`);
    }

    if (this.overlayScene) {
      this.overlayScene.onExit();
    }

    this.overlaySceneName = name;
    this.overlayScene = nextOverlayScene;
    const safePayload =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? { ...payload }
        : {};
    if (!safePayload.sourceSceneName) {
      safePayload.sourceSceneName = this.currentSceneName;
    }

    this.overlayScene.onEnter(safePayload);
  }

  closeOverlayScene(payload = {}) {
    if (!this.overlayScene) {
      return;
    }

    const closingOverlayScene = this.overlayScene;
    const closedOverlayName = this.overlaySceneName;
    this.overlayScene = null;
    this.overlaySceneName = "";
    closingOverlayScene.onExit();

    if (this.currentScene && typeof this.currentScene.onOverlayClosed === "function") {
      this.currentScene.onOverlayClosed({
        overlayName: closedOverlayName,
        ...(payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}),
      });
    }
  }

  getPreviousSceneName() {
    return this.previousSceneName;
  }

  defineAutoSaveTrigger(triggerId, config = {}) {
    const normalizedId = normalizeAutoSaveTriggerId(triggerId);
    const normalizedConfig = normalizeAutoSaveTriggerConfig(config);
    this.autoSave.triggers.set(normalizedId, normalizedConfig);
    return normalizedId;
  }

  registerAutoSaveTriggers(triggers = {}) {
    if (!triggers || typeof triggers !== "object") {
      return;
    }

    Object.entries(triggers).forEach(([triggerId, config]) => {
      this.defineAutoSaveTrigger(triggerId, config);
    });
  }

  removeAutoSaveTrigger(triggerId) {
    const normalizedId = normalizeAutoSaveTriggerId(triggerId);
    this.autoSave.triggers.delete(normalizedId);
  }

  setAutoSaveEnabled(enabled) {
    this.autoSave.enabled = Boolean(enabled);
    if (!this.autoSave.enabled) {
      this.clearAutoSaveQueue();
    }
  }

  setAutoSaveIntervalSeconds(seconds) {
    this.autoSave.intervalSeconds = clampPositiveNumber(seconds, DEFAULT_AUTO_SAVE_INTERVAL_SECONDS);
  }

  setAutoSaveMinGapSeconds(seconds) {
    this.autoSave.minGapSeconds = clampPositiveNumber(seconds, DEFAULT_AUTO_SAVE_MIN_GAP_SECONDS);
  }

  triggerAutoSave(triggerId = AUTO_SAVE_TRIGGER.MANUAL, payload = null, options = {}) {
    if (!this.autoSave.enabled) {
      return false;
    }

    const normalizedId = normalizeAutoSaveTriggerId(triggerId);
    const config = this.autoSave.triggers.get(normalizedId) ?? normalizeAutoSaveTriggerConfig();
    if (config.enabled === false) {
      return false;
    }

    this.autoSave.pending = true;
    this.autoSave.pendingTriggerId = normalizedId;
    this.autoSave.pendingPayload = payload && typeof payload === "object" ? { ...payload } : null;
    const immediate = options.immediate === true || config.immediate === true;
    this.autoSave.pendingImmediate = this.autoSave.pendingImmediate || immediate;
    if (immediate) {
      this.processAutoSaveQueue();
    }
    return true;
  }

  clearAutoSaveQueue() {
    this.autoSave.pending = false;
    this.autoSave.pendingImmediate = false;
    this.autoSave.pendingTriggerId = "";
    this.autoSave.pendingPayload = null;
    this.autoSave.nextRetryAtSeconds = 0;
    this.autoSave.elapsedIntervalSeconds = 0;
  }

  noteSaveCompleted() {
    const nowSeconds = Date.now() / 1000;
    this.autoSave.lastSavedAtSeconds = nowSeconds;
    this.autoSave.nextRetryAtSeconds = 0;
    this.autoSave.elapsedIntervalSeconds = 0;
  }

  updateAutoSave(dt) {
    if (!this.autoSave.enabled) {
      return;
    }

    this.autoSave.elapsedIntervalSeconds += dt;
    if (
      this.autoSave.intervalSeconds > 0 &&
      this.autoSave.elapsedIntervalSeconds >= this.autoSave.intervalSeconds
    ) {
      this.autoSave.elapsedIntervalSeconds = 0;
      this.triggerAutoSave(AUTO_SAVE_TRIGGER.INTERVAL);
    }

    this.processAutoSaveQueue();
  }

  processAutoSaveQueue() {
    if (!this.autoSave.enabled || !this.autoSave.pending) {
      return;
    }

    const nowSeconds = Date.now() / 1000;
    if (this.autoSave.nextRetryAtSeconds > nowSeconds) {
      return;
    }

    const elapsedFromLastSave = nowSeconds - this.autoSave.lastSavedAtSeconds;
    const minGap = Math.max(0, this.autoSave.minGapSeconds);
    const forceNow = this.autoSave.pendingImmediate === true;
    if (!forceNow && elapsedFromLastSave < minGap) {
      return;
    }

    const saved = this.saveToSlot(PRIMARY_SAVE_SLOT_INDEX);
    if (saved) {
      this.autoSave.pending = false;
      this.autoSave.pendingImmediate = false;
      this.autoSave.pendingTriggerId = "";
      this.autoSave.pendingPayload = null;
      return;
    }

    this.autoSave.nextRetryAtSeconds = nowSeconds + Math.max(1, this.autoSave.retrySeconds);
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
    this.queueRemoteGameDataSave(normalizedData);
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

    const currentHp = Number(player.hp);
    const currentMana = Number(player.mana);
    player.pgTitle = toSafeString(player.pgTitle, GOBLIN_PLAYER_BASE.pgTitle);
    player.maxHp = GOBLIN_PLAYER_BASE.maxHp;
    player.attackMin = GOBLIN_PLAYER_BASE.attackMin;
    player.attackMax = GOBLIN_PLAYER_BASE.attackMax;
    player.speed = GOBLIN_PLAYER_BASE.speed;
    player.maxMana = GOBLIN_PLAYER_BASE.maxMana;

    player.hp = Number.isFinite(currentHp)
      ? Math.max(0, Math.min(player.maxHp, Math.round(currentHp)))
      : player.maxHp;
    player.mana = Number.isFinite(currentMana)
      ? Math.max(0, Math.min(player.maxMana, Math.round(currentMana)))
      : player.maxMana;

    const progress = this.state?.progress;
    if (progress && typeof progress === "object") {
      progress.coins = Math.max(0, Math.floor(Number(progress.coins) || 0));
      progress.battlesWon = Math.max(0, Math.floor(Number(progress.battlesWon) || 0));
      progress.battlesTotal = Math.max(0, Math.floor(Number(progress.battlesTotal) || 0));
      progress.cutsceneSpeakerLabels = normalizeCutsceneSpeakerLabels(progress.cutsceneSpeakerLabels);
    }

    this.state.skills = normalizeSkills(this.state.skills, createDefaultSkills());
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
    return [this.profileSlot ?? null];
  }

  saveToSlot(slotIndex) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= SAVE_SLOT_COUNT) {
      return false;
    }

    const snapshot = cloneData(this.state);
    const slot = {
      version: 1,
      savedAt: Date.now(),
      summary: formatSaveSummary(snapshot),
      snapshot,
    };
    this.profileSlot = slot;
    const savedLocally = this.writeSaveSlots([slot]);
    if (!savedLocally) {
      return false;
    }
    this.queueRemoteProfileSave(slot);
    this.noteSaveCompleted();
    return true;
  }

  async clearProfileProgress() {
    this.clearAutoSaveQueue();
    this.profileSlot = null;
    const clearedLocally = this.writeSaveSlots([null]);
    this.resetState();

    if (!clearedLocally) {
      return { ok: false, error: "Impossibile cancellare il salvataggio locale." };
    }

    if (!this.isAuthenticated()) {
      return { ok: true };
    }

    const remoteResult = await saveRemotePlayerProgress({
      version: 1,
      clearedAt: Date.now(),
      summary: null,
      snapshot: null,
    });
    if (!remoteResult.ok) {
      this.lastSyncError = remoteResult.error ?? "Impossibile cancellare i progressi sul server.";
      return { ok: false, error: this.lastSyncError };
    }

    this.lastSyncError = "";
    return { ok: true };
  }

  loadFromSlot(slotIndex) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= SAVE_SLOT_COUNT) {
      return { ok: false, error: "invalid_slot" };
    }

    const slot = this.profileSlot ?? this.readSaveSlots()[0];
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
      skills: normalizeSkills(loaded.skills, fallback.skills),
    };
  }

  readSaveSlots() {
    try {
      const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) {
        return [null];
      }

      const parsed = JSON.parse(raw);
      const single = normalizeSingleSlot(parsed?.slot ?? parsed?.slots?.[0] ?? null);
      this.profileSlot = single;
      return [single];
    } catch (error) {
      return [null];
    }
  }

  writeSaveSlots(slots) {
    try {
      const single = normalizeSingleSlot(Array.isArray(slots) ? slots[0] : null);
      this.profileSlot = single;
      window.localStorage.setItem(
        SAVE_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          slot: single,
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
    persistDebugModeFlag(this.settings.debugOverlay);
    emitDebugModeChange(this.settings.debugOverlay);
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

    if (this.overlayScene) {
      this.overlayScene.update(dt, this.input);
    } else if (this.currentScene) {
      this.currentScene.update(dt, this.input);
    }

    if (this.currentScene) {
      this.currentScene.render(this.ctx);
    }
    if (this.overlayScene) {
      this.overlayScene.render(this.ctx);
    }

    this.state.progress.playTimeSeconds += dt;
    this.updateAutoSave(dt);
    this.input.endFrame();
    requestAnimationFrame(this.loop);
  }
}
