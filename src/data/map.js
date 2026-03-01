import { TILE } from "./constants.js";

export const MAP_LAYOUT = Object.freeze({
  cols: 24,
  rows: 16,
  tileSize: 64,
});

function createFilledGrid(cols, rows, value) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => value));
}

function paintRect(grid, x, y, width, height, value) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  for (let row = y; row < y + height; row += 1) {
    if (row < 0 || row >= rows) {
      continue;
    }
    for (let col = x; col < x + width; col += 1) {
      if (col < 0 || col >= cols) {
        continue;
      }
      grid[row][col] = value;
    }
  }
}

function buildVillageCollisionMap() {
  const grid = createFilledGrid(MAP_LAYOUT.cols, MAP_LAYOUT.rows, TILE.PATH);

  // Bordi mappa non attraversabili.
  paintRect(grid, 0, 0, MAP_LAYOUT.cols, 1, TILE.TREE);
  paintRect(grid, 0, MAP_LAYOUT.rows - 1, MAP_LAYOUT.cols, 1, TILE.TREE);
  paintRect(grid, 0, 0, 1, MAP_LAYOUT.rows, TILE.TREE);
  paintRect(grid, MAP_LAYOUT.cols - 1, 0, 1, MAP_LAYOUT.rows, TILE.TREE);

  // Strutture principali e zone foresta (ostacoli intelligenti statici).
  paintRect(grid, 1, 1, 6, 3, TILE.TREE);
  paintRect(grid, 7, 1, 4, 2, TILE.TREE);
  paintRect(grid, 18, 1, 5, 3, TILE.TREE);
  paintRect(grid, 1, 5, 3, 2, TILE.TREE);
  paintRect(grid, 6, 5, 4, 2, TILE.TREE);
  paintRect(grid, 11, 6, 4, 2, TILE.TREE);
  paintRect(grid, 17, 5, 5, 2, TILE.TREE);
  paintRect(grid, 2, 9, 7, 2, TILE.TREE);
  paintRect(grid, 11, 9, 3, 2, TILE.TREE);
  paintRect(grid, 17, 9, 6, 2, TILE.TREE);

  // Fiume/cascata.
  paintRect(grid, 14, 2, 2, 10, TILE.WATER);
  paintRect(grid, 13, 7, 3, 1, TILE.WATER);
  paintRect(grid, 13, 11, 3, 2, TILE.WATER);
  paintRect(grid, 14, 13, 4, 2, TILE.WATER);

  // Sentieri principali liberi.
  paintRect(grid, 4, 4, 17, 1, TILE.PATH);
  paintRect(grid, 3, 7, 19, 1, TILE.PATH);
  paintRect(grid, 2, 11, 21, 1, TILE.PATH);
  paintRect(grid, 8, 3, 1, 10, TILE.PATH);

  // Erba alta in zone periferiche.
  paintRect(grid, 1, 12, 4, 3, TILE.TALL_GRASS);
  paintRect(grid, 19, 12, 4, 3, TILE.TALL_GRASS);

  return grid;
}

export const WORLD_MAP = buildVillageCollisionMap();

export const WORLD_POINTS = Object.freeze({
  playerSpawn: { x: 8, y: 8, facing: "down" },
  npcs: [
    {
      id: "shaman",
      name: "Sciamano Gruk",
      x: 10,
      y: 7,
      blocksMovement: true,
      lines: [
        "Il villaggio e' vivo anche quando non combatti.",
        "Usa il D-pad per muoverti a griglia.",
        "Le capanne e il fiume sono ostacoli reali.",
      ],
    },
    {
      id: "guard",
      name: "Guardia Krul",
      x: 6,
      y: 11,
      blocksMovement: true,
      lines: [
        "Il ponte a sud porta fuori dal villaggio.",
        "Torna qui quando hai finito le missioni.",
      ],
    },
  ],
  interactionPoints: [
    {
      id: "fountain",
      x: 6,
      y: 6,
      text: "Fontana antica: l'acqua e' fredda e pulita.",
    },
    {
      id: "bonfire",
      x: 3,
      y: 13,
      text: "Falo del clan: senti odore di legna e spezie.",
    },
    {
      id: "totem",
      x: 20,
      y: 4,
      text: "Totem teschio: un simbolo di protezione tribale.",
    },
  ],
  healTile: {
    x: 6,
    y: 6,
    label: "Fontana",
    text: "Ti riposi un momento.",
  },
});

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
