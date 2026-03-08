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
const MAP_RENDER_LAYER_COUNT = 4;

const EMPTY_POINTS = Object.freeze({
  interactionPoints: Object.freeze([]),
  battleZones: Object.freeze([]),
  cutsceneTriggers: Object.freeze([]),
  transitionPoints: Object.freeze([]),
  healTile: null,
});

const mapsManifestUrl = buildVersionedUrl(new URL("../maps/maps.json", import.meta.url));
const mapsManifest = await loadJson(mapsManifestUrl);
const availableMapEntries = normalizeMapEntries(mapsManifest, mapsManifestUrl);
const requestedDefaultMapId = selectActiveMapId(mapsManifest, availableMapEntries);
const normalizedMaps = await Promise.all(
  availableMapEntries.map(async (entry) => {
    const definitionUrl = buildVersionedUrl(new URL(entry.definition, mapsManifestUrl));
    const definition = await loadJson(definitionUrl);
    return normalizeMapDefinition(entry.id, definition, definitionUrl);
  }),
);
const worldMapsById = new Map(
  normalizedMaps.map((mapDefinition) => [mapDefinition.id, freezeNormalizedMap(mapDefinition)]),
);
const defaultWorldMap =
  worldMapsById.get(requestedDefaultMapId) ?? worldMapsById.get(availableMapEntries[0]?.id ?? "");

if (!defaultWorldMap) {
  throw new Error("Nessuna mappa disponibile in src/maps/maps.json.");
}

export const DEFAULT_WORLD_MAP_ID = defaultWorldMap.id;
export const WORLD_MAP_DEFINITIONS = Object.freeze(Array.from(worldMapsById.values()));

export const AVAILABLE_WORLD_MAP_IDS = Object.freeze(availableMapEntries.map((entry) => entry.id));
export const WORLD_MAP_LAYER_ASSET_PATHS = Object.freeze(
  defaultWorldMap.layerAssetPaths.map((assetPath) => assetPath || ""),
);
export const WORLD_MAP_ASSET_PATH = defaultWorldMap.primaryAssetPath;
export const MAP_LAYOUT = Object.freeze(defaultWorldMap.layout);
export const WORLD_MAP = Object.freeze(defaultWorldMap.collisionGrid.map((row) => Object.freeze(row)));
export const WORLD_POINTS = Object.freeze(defaultWorldMap.points);
export const WORLD_SPAWN_POINT = Object.freeze(defaultWorldMap.spawn);

export function getWorldMapDefinition(mapId) {
  const safeMapId = String(mapId ?? "").trim();
  if (safeMapId && worldMapsById.has(safeMapId)) {
    return worldMapsById.get(safeMapId) ?? defaultWorldMap;
  }
  return defaultWorldMap;
}

export function hasWorldMapDefinition(mapId) {
  const safeMapId = String(mapId ?? "").trim();
  return safeMapId.length > 0 && worldMapsById.has(safeMapId);
}

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
  const spawn = normalizeCollisionSpawn(definition?.collisionMap?.spawn, layout, collisionGrid);
  const points = normalizeWorldPoints(definition?.points);
  const layerAssetPaths = resolveMapLayerAssetPaths(
    definition?.assets,
    definition?.asset,
    id,
    definitionUrl,
  );
  const primaryAssetPath = selectPrimaryMapAssetPath(layerAssetPaths);

  return {
    id,
    layout,
    collisionGrid,
    spawn,
    points,
    layerAssetPaths,
    primaryAssetPath,
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

function normalizeCollisionSpawn(rawSpawn, layout, collisionGrid) {
  const fallback = findFirstWalkableTile(collisionGrid) ?? { x: 0, y: 0 };
  const x = clampInt(rawSpawn?.x, 0, layout.cols - 1, fallback.x);
  const y = clampInt(rawSpawn?.y, 0, layout.rows - 1, fallback.y);
  const tile = collisionGrid[y]?.[x];
  const safeSpawn = isWalkableTile(tile) ? { x, y } : fallback;
  const facing = normalizeFacing(rawSpawn?.facing);

  return {
    x: safeSpawn.x,
    y: safeSpawn.y,
    facing,
  };
}

function normalizeWorldPoints(rawPoints) {
  if (!rawPoints || typeof rawPoints !== "object") {
    return EMPTY_POINTS;
  }

  const interactionPoints = Array.isArray(rawPoints.interactionPoints)
    ? rawPoints.interactionPoints.map((point) => ({
        ...point,
        layer: normalizeMapLayerIndex(point?.layer, 2),
        blocksMovement: Boolean(point?.blocksMovement),
      }))
    : [];
  const battleZones = Array.isArray(rawPoints.battleZones)
    ? rawPoints.battleZones.map((zone) => ({ ...zone }))
    : [];
  const cutsceneTriggers = Array.isArray(rawPoints.cutsceneTriggers)
    ? rawPoints.cutsceneTriggers.map((trigger) => ({ ...trigger }))
    : [];
  const transitionPoints = Array.isArray(rawPoints.transitionPoints)
    ? rawPoints.transitionPoints.map((point) => ({ ...point }))
    : [];
  const healTile =
    rawPoints.healTile && typeof rawPoints.healTile === "object" ? { ...rawPoints.healTile } : null;

  return {
    interactionPoints,
    battleZones,
    cutsceneTriggers,
    transitionPoints,
    healTile,
  };
}

function freezeNormalizedMap(mapDefinition) {
  return Object.freeze({
    ...mapDefinition,
    layout: Object.freeze({ ...mapDefinition.layout }),
    collisionGrid: Object.freeze(
      mapDefinition.collisionGrid.map((row) => Object.freeze([...row])),
    ),
    spawn: Object.freeze({ ...mapDefinition.spawn }),
    points: Object.freeze({
      interactionPoints: Object.freeze(
        (mapDefinition.points?.interactionPoints ?? []).map((point) => Object.freeze({ ...point })),
      ),
      battleZones: Object.freeze(
        (mapDefinition.points?.battleZones ?? []).map((zone) => Object.freeze({ ...zone })),
      ),
      cutsceneTriggers: Object.freeze(
        (mapDefinition.points?.cutsceneTriggers ?? []).map((trigger) =>
          Object.freeze({ ...trigger }),
        ),
      ),
      transitionPoints: Object.freeze(
        (mapDefinition.points?.transitionPoints ?? []).map((point) => Object.freeze({ ...point })),
      ),
      healTile:
        mapDefinition.points?.healTile && typeof mapDefinition.points.healTile === "object"
          ? Object.freeze({ ...mapDefinition.points.healTile })
          : null,
    }),
    layerAssetPaths: Object.freeze([...(mapDefinition.layerAssetPaths ?? [])]),
  });
}

function resolveMapLayerAssetPaths(rawAssets, rawLegacyAssetPath, mapId, definitionUrl) {
  const fallbackStem = sanitizeMapFileStem(mapId);
  const fallbackLayer0 = `./${fallbackStem}.png`;
  const rawLayers =
    rawAssets && typeof rawAssets === "object" && !Array.isArray(rawAssets) ? rawAssets : {};

  return Array.from({ length: MAP_RENDER_LAYER_COUNT }, (_, layerIndex) => {
    const layerKey = `layer${layerIndex}`;
    const fallbackAssetPath =
      layerIndex === 0
        ? String(rawLegacyAssetPath ?? rawLayers[layerKey] ?? fallbackLayer0).trim()
        : String(rawLayers[layerKey] ?? "").trim();

    if (!fallbackAssetPath) {
      return "";
    }
    return buildVersionedUrl(new URL(fallbackAssetPath, definitionUrl)).toString();
  });
}

function selectPrimaryMapAssetPath(layerAssetPaths) {
  if (!Array.isArray(layerAssetPaths)) {
    return "";
  }
  return layerAssetPaths.find((assetPath) => String(assetPath ?? "").trim().length > 0) ?? "";
}

function sanitizeMapFileStem(mapId) {
  const sanitized = String(mapId ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
  return sanitized.length > 0 ? sanitized : "map";
}

function normalizeMapLayerIndex(value, fallback = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(MAP_RENDER_LAYER_COUNT - 1, Math.floor(parsed)));
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.floor(parsed));
}

function clampInt(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function findFirstWalkableTile(grid) {
  if (!Array.isArray(grid) || grid.length <= 0) {
    return null;
  }

  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y];
    if (!Array.isArray(row)) {
      continue;
    }
    for (let x = 0; x < row.length; x += 1) {
      if (isWalkableTile(row[x])) {
        return { x, y };
      }
    }
  }

  return null;
}

function normalizeFacing(value) {
  const facing = String(value ?? "").trim().toLowerCase();
  if (facing === "up" || facing === "down" || facing === "left" || facing === "right") {
    return facing;
  }
  return "down";
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
