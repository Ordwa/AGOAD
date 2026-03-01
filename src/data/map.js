import { TILE } from "./constants.js";

const DEFAULT_MAP_LAYOUT = Object.freeze({
  cols: 24,
  rows: 16,
  tileSize: 64,
});

const DEFAULT_COLLISION_LEGEND = Object.freeze({
  ".": "PATH",
  "#": "TREE",
  "~": "WATER",
  g: "TALL_GRASS",
});

const EMPTY_POINTS = Object.freeze({
  interactionPoints: Object.freeze([]),
  healTile: null,
});

const mapsManifestUrl = buildVersionedUrl(new URL("../maps/maps.json", import.meta.url));
const mapsManifest = await loadJson(mapsManifestUrl);
const availableMapEntries = normalizeMapEntries(mapsManifest, mapsManifestUrl);
const activeMapId = selectActiveMapId(mapsManifest, availableMapEntries);
const activeMapEntry = availableMapEntries.find((entry) => entry.id === activeMapId) ?? availableMapEntries[0];

if (!activeMapEntry) {
  throw new Error("Nessuna mappa disponibile in src/maps/maps.json.");
}

const activeMapDefinitionUrl = buildVersionedUrl(
  new URL(activeMapEntry.definition, mapsManifestUrl),
);
const activeMapDefinition = await loadJson(activeMapDefinitionUrl);
const normalizedMap = normalizeMapDefinition(activeMapEntry.id, activeMapDefinition, activeMapDefinitionUrl);

export const ACTIVE_WORLD_MAP_ID = normalizedMap.id;
export const AVAILABLE_WORLD_MAP_IDS = Object.freeze(availableMapEntries.map((entry) => entry.id));
export const WORLD_MAP_ASSET_PATH = normalizedMap.assetPath;
export const MAP_LAYOUT = Object.freeze(normalizedMap.layout);
export const WORLD_MAP = Object.freeze(normalizedMap.collisionGrid.map((row) => Object.freeze(row)));
export const WORLD_POINTS = Object.freeze(normalizedMap.points);

export function isInsideMap(x, y, map = WORLD_MAP) {
  if (!Array.isArray(map) || map.length === 0 || !Array.isArray(map[0])) {
    return false;
  }
  const rows = map.length;
  const cols = map[0].length;
  return x >= 0 && x < cols && y >= 0 && y < rows;
}

export function getTileAt(x, y, map = WORLD_MAP) {
  if (!isInsideMap(x, y, map)) {
    return null;
  }
  return map[y][x];
}

export function isWalkableTile(tileValue) {
  return tileValue === TILE.PATH || tileValue === TILE.TALL_GRASS;
}

function normalizeMapEntries(manifest, manifestUrl) {
  const entries = Array.isArray(manifest?.maps) ? manifest.maps : [];
  if (entries.length <= 0) {
    throw new Error(`Nessuna entry 'maps' valida in ${manifestUrl}.`);
  }

  return entries.map((entry, index) => {
    const id = String(entry?.id ?? "").trim();
    const definition = String(entry?.definition ?? "").trim();
    if (!id) {
      throw new Error(`maps[${index}] senza 'id' in ${manifestUrl}.`);
    }
    if (!definition) {
      throw new Error(`maps[${index}] senza 'definition' in ${manifestUrl}.`);
    }
    return { id, definition };
  });
}

function selectActiveMapId(manifest, availableEntries) {
  const requestedMapId = getRequestedMapIdFromLocation();
  if (requestedMapId && availableEntries.some((entry) => entry.id === requestedMapId)) {
    return requestedMapId;
  }

  const defaultMapId = String(manifest?.defaultMapId ?? "").trim();
  if (defaultMapId && availableEntries.some((entry) => entry.id === defaultMapId)) {
    return defaultMapId;
  }

  return availableEntries[0].id;
}

function normalizeMapDefinition(expectedId, definition, definitionUrl) {
  const definitionId = String(definition?.id ?? expectedId ?? "").trim();
  const id = definitionId || expectedId;
  if (!id) {
    throw new Error(`Mappa senza id in ${definitionUrl}.`);
  }

  const rows = Array.isArray(definition?.collisionMap?.rows) ? definition.collisionMap.rows : [];
  const inferredRows = rows.length;
  const inferredCols = inferredRows > 0 ? String(rows[0] ?? "").length : 0;

  const layout = normalizeLayout(definition?.layout, inferredCols, inferredRows);
  const legend = normalizeCollisionLegend(definition?.collisionMap?.legend);
  const collisionGrid = parseCollisionRows(rows, layout, legend, definitionUrl);
  const points = normalizeWorldPoints(definition?.points);
  const assetPath = resolveMapAssetPath(definition?.asset, id, definitionUrl);

  return {
    id,
    layout,
    collisionGrid,
    points,
    assetPath,
  };
}

function normalizeLayout(rawLayout, inferredCols, inferredRows) {
  const cols = toPositiveInt(rawLayout?.cols, inferredCols || DEFAULT_MAP_LAYOUT.cols);
  const rows = toPositiveInt(rawLayout?.rows, inferredRows || DEFAULT_MAP_LAYOUT.rows);
  const tileSize = toPositiveInt(rawLayout?.tileSize, DEFAULT_MAP_LAYOUT.tileSize);
  return { cols, rows, tileSize };
}

function normalizeCollisionLegend(rawLegend) {
  const mergedLegend = {
    ...DEFAULT_COLLISION_LEGEND,
    ...(rawLegend && typeof rawLegend === "object" ? rawLegend : {}),
  };

  const legend = {};
  Object.entries(mergedLegend).forEach(([symbol, tileName]) => {
    const key = String(symbol ?? "");
    if (key.length !== 1) {
      return;
    }
    legend[key] = toTileValue(tileName);
  });

  if (Object.keys(legend).length <= 0) {
    throw new Error("Collision legend vuota: definire almeno un simbolo valido.");
  }

  return legend;
}

function parseCollisionRows(rows, layout, legend, definitionUrl) {
  if (!Array.isArray(rows) || rows.length <= 0) {
    throw new Error(`collisionMap.rows non definito o vuoto in ${definitionUrl}.`);
  }

  if (rows.length !== layout.rows) {
    throw new Error(
      `collisionMap.rows (${rows.length}) diverso da layout.rows (${layout.rows}) in ${definitionUrl}.`,
    );
  }

  return rows.map((rawRow, rowIndex) => {
    const row = String(rawRow ?? "");
    if (row.length !== layout.cols) {
      throw new Error(
        `Riga collisione ${rowIndex} lunga ${row.length}, atteso ${layout.cols} in ${definitionUrl}.`,
      );
    }

    return Array.from(row).map((symbol, colIndex) => {
      if (!Object.prototype.hasOwnProperty.call(legend, symbol)) {
        throw new Error(
          `Simbolo collisione '${symbol}' non mappato (riga ${rowIndex}, col ${colIndex}) in ${definitionUrl}.`,
        );
      }
      return legend[symbol];
    });
  });
}

function normalizeWorldPoints(rawPoints) {
  if (!rawPoints || typeof rawPoints !== "object") {
    return EMPTY_POINTS;
  }

  const interactionPoints = Array.isArray(rawPoints.interactionPoints)
    ? rawPoints.interactionPoints.map((point) => ({ ...point }))
    : [];
  const healTile =
    rawPoints.healTile && typeof rawPoints.healTile === "object" ? { ...rawPoints.healTile } : null;

  return {
    interactionPoints,
    healTile,
  };
}

function resolveMapAssetPath(rawAssetPath, mapId, definitionUrl) {
  const fallbackAssetPath = `./${sanitizeMapFileStem(mapId)}.png`;
  const assetPath = String(rawAssetPath ?? fallbackAssetPath).trim();
  if (!assetPath) {
    return buildVersionedUrl(new URL(fallbackAssetPath, definitionUrl)).toString();
  }
  return buildVersionedUrl(new URL(assetPath, definitionUrl)).toString();
}

function sanitizeMapFileStem(mapId) {
  const sanitized = String(mapId ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  return sanitized.length > 0 ? sanitized : "map";
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.floor(parsed));
}

function toTileValue(tileName) {
  const normalized = String(tileName ?? "")
    .trim()
    .toUpperCase();

  switch (normalized) {
    case "PATH":
      return TILE.PATH;
    case "TREE":
      return TILE.TREE;
    case "TALL_GRASS":
      return TILE.TALL_GRASS;
    case "WATER":
      return TILE.WATER;
    default:
      throw new Error(`Tile '${tileName}' non supportato nella collision legend.`);
  }
}

function getRequestedMapIdFromLocation() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const mapId = new URL(window.location.href).searchParams.get("map");
    return String(mapId ?? "").trim();
  } catch {
    return "";
  }
}

function buildVersionedUrl(url) {
  const version = new URL(import.meta.url).searchParams.get("v");
  const versioned = new URL(url.toString());
  if (version) {
    versioned.searchParams.set("v", version);
  }
  return versioned;
}

async function loadJson(url) {
  if (typeof window === "undefined" && url.protocol === "file:") {
    const [{ readFile }, { fileURLToPath }] = await Promise.all([
      import("node:fs/promises"),
      import("node:url"),
    ]);
    const fileContent = await readFile(fileURLToPath(url), "utf8");
    return JSON.parse(fileContent);
  }

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Impossibile caricare JSON (${response.status}) da ${url}.`);
  }
  return response.json();
}
