export const GAME_CONFIG = {
  width: 270,
  height: 180,
  tileSize: 18,
  mapWidth: 15,
  mapHeight: 10,
};

export const PLAYER_CONFIG = {
  maxHp: 30,
  startLifePotions: 2,
  startManaPotions: 1,
  startPotions: 2,
  healAmount: 10,
  manaPotionAmount: 10,
};

export const ENCOUNTER_CHANCE = 0.16;

export const TILE = {
  PATH: 0,
  TREE: 1,
  TALL_GRASS: 2,
  WATER: 3,
};

export const DIRECTION = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export const PALETTE = {
  pathLight: "#d7c99e",
  pathDark: "#c0ae82",
  treeLight: "#3d7a4a",
  treeDark: "#285233",
  grassLight: "#5dbf5f",
  grassDark: "#3f8f42",
  waterLight: "#5fb4e8",
  waterDark: "#2f6ea4",
  uiPanel: "#f8f8ea",
  uiBorder: "#303038",
  uiText: "#1f2233",
  shadow: "#00000033",
};
