#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const MAPS_ROOT = path.resolve(PROJECT_ROOT, "src/maps");
const MAPS_MANIFEST_PATH = path.resolve(MAPS_ROOT, "maps.json");

const args = process.argv.slice(2);
const mapId = sanitizeMapId(args[0]);
const cols = getFlagNumber(args, "--cols", 24);
const rows = getFlagNumber(args, "--rows", 16);
const tileSize = getFlagNumber(args, "--tile-size", 64);

if (!mapId) {
  printUsageAndExit(
    "Specifica un mapId valido. Esempio: node scripts/create-map-template.mjs forest --cols 24 --rows 16",
  );
}

const mapDir = path.resolve(MAPS_ROOT, mapId);
if (existsSync(mapDir)) {
  printUsageAndExit(`La cartella mappa '${mapId}' esiste gia': ${mapDir}`);
}

mkdirSync(mapDir, { recursive: true });

const template = {
  id: mapId,
  name: toLabel(mapId),
  assets: {
    layer0: `./${mapId}.png`,
    layer1: "",
    layer2: "",
    layer3: "",
  },
  layout: {
    cols,
    rows,
    tileSize,
  },
  collisionMap: {
    legend: {
      ".": "PATH",
      "#": "TREE",
      g: "TALL_GRASS",
      "~": "WATER",
    },
    rows: buildCollisionRowsTemplate(cols, rows),
  },
  points: {
    interactionPoints: [],
    healTile: null,
  },
};

writeFileSync(path.resolve(mapDir, `${mapId}.json`), `${JSON.stringify(template, null, 2)}\n`, "utf8");

let manifest = {
  defaultMapId: mapId,
  maps: [],
};
if (existsSync(MAPS_MANIFEST_PATH)) {
  manifest = JSON.parse(readFileSync(MAPS_MANIFEST_PATH, "utf8"));
}

if (!Array.isArray(manifest.maps)) {
  manifest.maps = [];
}

if (!manifest.maps.some((entry) => entry?.id === mapId)) {
  manifest.maps.push({
    id: mapId,
    definition: `./${mapId}/${mapId}.json`,
  });
}

if (!manifest.defaultMapId) {
  manifest.defaultMapId = mapId;
}

writeFileSync(MAPS_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Mappa '${mapId}' creata in ${mapDir}`);
console.log("Prossimi passi:");
console.log("1. Copia i PNG layer in src/maps/<mapId>/ (almeno layer0).");
console.log("2. Aggiorna assets.layer0..layer3 in src/maps/<mapId>/<mapId>.json");
console.log("3. Modifica collisionMap.rows in src/maps/<mapId>/<mapId>.json");
console.log("4. (Opzionale) passa ?map=<mapId> nell'URL per provarla subito.");

function buildCollisionRowsTemplate(cols, rows) {
  return Array.from({ length: rows }, (_, rowIndex) => {
    if (rowIndex === Math.floor(rows / 2)) {
      return ".".repeat(cols);
    }
    return "#".repeat(cols);
  });
}

function sanitizeMapId(rawValue) {
  return String(rawValue ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
}

function getFlagNumber(inputArgs, flag, fallback) {
  const index = inputArgs.indexOf(flag);
  if (index < 0 || index >= inputArgs.length - 1) {
    return fallback;
  }

  const value = Number(inputArgs[index + 1]);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

function toLabel(mapIdValue) {
  return String(mapIdValue)
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function printUsageAndExit(message) {
  console.error(message);
  console.error("Uso: node scripts/create-map-template.mjs <mapId> [--cols 24] [--rows 16] [--tile-size 64]");
  process.exit(1);
}
