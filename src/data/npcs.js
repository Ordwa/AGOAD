export const WORLD_PLAYER = Object.freeze({
  id: "hero",
  spawn: Object.freeze({
    x: 8,
    y: 8,
    facing: "down",
  }),
});

export const WORLD_NPCS = [
  {
    id: "shaman",
    name: "Sciamano Gruk",
    x: 10,
    y: 7,
    blocksMovement: true,
    quest: null,
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
    quest: null,
    lines: [
      "Il ponte a sud porta fuori dal villaggio.",
      "Torna qui quando hai finito le missioni.",
    ],
  },
];
