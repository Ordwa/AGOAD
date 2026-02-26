import { TILE } from "./constants.js";

export const WORLD_MAP = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 2, 2, 2, 0, 0, 0, 0, 2, 2, 2, 0, 0, 1],
  [1, 0, 2, 2, 2, 0, 1, 1, 0, 2, 2, 2, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 0, 1],
  [1, 0, 2, 2, 2, 0, 0, 0, 0, 2, 2, 3, 3, 0, 1],
  [1, 0, 2, 2, 2, 0, 0, 0, 0, 2, 2, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

export const WORLD_POINTS = {
  playerSpawn: { x: 2, y: 5, facing: "right" },
  npc: {
    x: 10,
    y: 4,
    name: "Ranger Lio",
    lines: [
      "Ciao allenatore!",
      "Nell'erba alta compaiono creature selvatiche.",
      "Gestisci le pozioni e non rischiare troppo.",
    ],
  },
  healTile: {
    x: 2,
    y: 8,
    label: "Casa",
    text: "Ti riposi un momento.",
  },
};

export function isWalkableTile(tileValue) {
  return tileValue === TILE.PATH || tileValue === TILE.TALL_GRASS;
}
