export const PLAYER_CLASSES = [
  {
    id: "warrior",
    label: "Guerriero",
    description: "Tanta vita, pochi danni",
    maxHp: 48,
    attackMin: 3,
    attackMax: 5,
    speed: 3,
    maxMana: 30,
    special: {
      id: "shield_bash",
      name: "Shield Bash",
      cost: 10,
      priority: false,
      description: "Blocca il turno nemico e consente un attacco nello stesso turno.",
    },
  },
  {
    id: "mage",
    label: "Mago",
    description: "Vita media, danni medi",
    maxHp: 36,
    attackMin: 5,
    attackMax: 7,
    speed: 3,
    maxMana: 30,
    special: {
      id: "arcane_heal",
      name: "Cura Arcana",
      cost: 10,
      priority: false,
      description: "Recupera HP durante il combattimento.",
    },
  },
  {
    id: "rogue",
    label: "Ladro",
    description: "Vita media, danni medi",
    maxHp: 36,
    attackMin: 5,
    attackMax: 7,
    speed: 4,
    maxMana: 30,
    special: {
      id: "shadow_escape",
      name: "Fuga Garantita",
      cost: 10,
      priority: true,
      description: "Permette una fuga certa dal combattimento.",
    },
  },
];

export function getClassById(classId, classes = PLAYER_CLASSES) {
  if (!Array.isArray(classes) || classes.length === 0) {
    return PLAYER_CLASSES[0];
  }

  return classes.find((classData) => classData.id === classId) ?? classes[0];
}

export function applyClassToPlayer(player, classData, name) {
  const special = classData.special ?? {};

  player.name = name;
  player.classId = classData.id;
  player.className = classData.label;
  player.maxHp = classData.maxHp;
  player.hp = classData.maxHp;
  player.attackMin = classData.attackMin;
  player.attackMax = classData.attackMax;
  player.speed = classData.speed ?? 3;
  player.maxMana = classData.maxMana;
  player.mana = classData.maxMana;
  player.specialId = special.id ?? "";
  player.specialName = special.name ?? "Special";
  player.specialCost = special.cost ?? 0;
  player.specialPriority = Boolean(special.priority);
  player.specialDescription = special.description ?? "";
}
