const DEFAULT_CUTSCENE_CONFIG = Object.freeze({
  speakers: Object.freeze([
    Object.freeze({
      id: "narrator",
      label: "NARRATORE",
      assetPath: "../assets/entity/cutscene/cutscene_elder.png",
    }),
  ]),
  cutscenes: Object.freeze([
    Object.freeze({
      id: "intro",
      speakerId: "narrator",
      lines: Object.freeze(["Benvenuto nel mondo di gioco."]),
    }),
  ]),
});
const LOCAL_CUTSCENE_CONFIG_STORAGE_KEY = "agoad_cutscenes_config_v1";

const cutsceneConfigUrl = buildVersionedUrl(new URL("./cutscenes.json", import.meta.url));
const rawCutsceneConfig = await loadCutsceneConfig(cutsceneConfigUrl);
const normalizedCutsceneConfig = normalizeCutsceneConfig(rawCutsceneConfig);

export const CUTSCENE_SPEAKERS = Object.freeze(normalizedCutsceneConfig.speakers);
export const CUTSCENES = Object.freeze(normalizedCutsceneConfig.cutscenesById);

export function getCutsceneDefinition(cutsceneId) {
  const safeId = String(cutsceneId ?? "").trim();
  if (!safeId) {
    return null;
  }

  return CUTSCENES[safeId] ?? null;
}

export function getCutsceneSpeakerDefinition(speakerId) {
  const safeId = String(speakerId ?? "").trim();
  if (!safeId) {
    return null;
  }

  return normalizedCutsceneConfig.speakersById[safeId] ?? null;
}

async function loadCutsceneConfig(url) {
  const localOverride = loadLocalCutsceneConfig();
  if (localOverride) {
    return localOverride;
  }

  if (typeof fetch !== "function") {
    return DEFAULT_CUTSCENE_CONFIG;
  }

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || typeof payload !== "object") {
      throw new Error("Payload non valido");
    }

    return payload;
  } catch {
    return DEFAULT_CUTSCENE_CONFIG;
  }
}

function loadLocalCutsceneConfig() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_CUTSCENE_CONFIG_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function normalizeCutsceneConfig(rawConfig) {
  const rawSpeakers = Array.isArray(rawConfig?.speakers) ? rawConfig.speakers : [];
  const rawCutscenes = Array.isArray(rawConfig?.cutscenes) ? rawConfig.cutscenes : [];

  const speakers = [];
  const speakersById = {};
  rawSpeakers.forEach((rawSpeaker, index) => {
    const speaker = normalizeSpeaker(rawSpeaker, index);
    if (!speaker) {
      return;
    }
    speakers.push(speaker);
    speakersById[speaker.id] = speaker;
  });

  if (speakers.length <= 0) {
    const fallbackSpeaker = normalizeSpeaker(DEFAULT_CUTSCENE_CONFIG.speakers[0], 0);
    if (fallbackSpeaker) {
      speakers.push(fallbackSpeaker);
      speakersById[fallbackSpeaker.id] = fallbackSpeaker;
    }
  }

  const cutscenes = [];
  const cutscenesById = {};
  rawCutscenes.forEach((rawCutscene, index) => {
    const cutscene = normalizeCutscene(rawCutscene, index, speakersById);
    if (!cutscene) {
      return;
    }
    cutscenes.push(cutscene);
    cutscenesById[cutscene.id] = cutscene;
  });

  if (cutscenes.length <= 0) {
    DEFAULT_CUTSCENE_CONFIG.cutscenes.forEach((rawCutscene, index) => {
      const cutscene = normalizeCutscene(rawCutscene, index, speakersById);
      if (!cutscene) {
        return;
      }
      cutscenes.push(cutscene);
      cutscenesById[cutscene.id] = cutscene;
    });
  }

  return {
    speakers: Object.freeze(speakers),
    speakersById: Object.freeze(speakersById),
    cutscenes: Object.freeze(cutscenes),
    cutscenesById: Object.freeze(cutscenesById),
  };
}

function normalizeSpeaker(rawSpeaker, index) {
  if (!rawSpeaker || typeof rawSpeaker !== "object") {
    return null;
  }

  const id = String(rawSpeaker.id ?? `speaker_${index + 1}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  if (!id) {
    return null;
  }

  const label = String(rawSpeaker.label ?? rawSpeaker.name ?? id).trim() || id.toUpperCase();
  const assetPath = String(rawSpeaker.assetPath ?? "").trim();
  const npcId = String(rawSpeaker.npcId ?? "").trim();

  return Object.freeze({
    id,
    label,
    assetPath: assetPath || "../assets/entity/cutscene/cutscene_elder.png",
    npcId,
  });
}

function normalizeCutscene(rawCutscene, index, speakersById) {
  if (!rawCutscene || typeof rawCutscene !== "object") {
    return null;
  }

  const id = String(rawCutscene.id ?? `cutscene_${index + 1}`).trim();
  if (!id) {
    return null;
  }

  const speakerId = String(rawCutscene.speakerId ?? "").trim().toLowerCase();
  const linkedSpeaker = speakerId ? speakersById[speakerId] ?? null : null;
  const lines = Array.isArray(rawCutscene.lines)
    ? rawCutscene.lines
        .map((line) => String(line ?? "").trim())
        .filter((line) => line.length > 0)
    : [];
  if (lines.length <= 0) {
    return null;
  }

  const speakerName =
    String(rawCutscene.speakerName ?? "").trim() ||
    String(linkedSpeaker?.label ?? "").trim() ||
    "NARRATORE";
  const speakerAssetPath =
    String(rawCutscene.speakerAssetPath ?? "").trim() ||
    String(linkedSpeaker?.assetPath ?? "").trim() ||
    "../assets/entity/cutscene/cutscene_elder.png";

  return Object.freeze({
    id,
    speakerId: linkedSpeaker?.id ?? "",
    speakerName,
    speakerAssetPath,
    lines: Object.freeze(lines),
  });
}

function buildVersionedUrl(url) {
  const version = new URL(import.meta.url).searchParams.get("v");
  if (version) {
    url.searchParams.set("v", version);
  }
  return url;
}
