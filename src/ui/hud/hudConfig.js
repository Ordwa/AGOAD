const assetUrl = (fileName) => new URL(`../../assets/${fileName}`, import.meta.url).href;

export const HUD_DEFAULT_ACTIVE_TAB = "profile";

export const HUD_TOP_TABS = Object.freeze([
  {
    id: "settings",
    label: "Settings",
    ariaLabel: "Apri impostazioni",
    icon: {
      type: "image",
      src: assetUrl("UI_button_settings.png"),
      alt: "",
    },
    tutorialText: "Regola audio, preferenze e opzioni avanzate.",
  },
  {
    id: "profile",
    label: "Profilo",
    ariaLabel: "Apri profilo personaggio",
    icon: {
      type: "image",
      src: assetUrl("UI_button_pg.png"),
      alt: "",
    },
    tutorialText: "Apri la scheda personaggio per statistiche e equipaggiamento.",
  },
  {
    id: "bag",
    label: "Zaino",
    ariaLabel: "Apri zaino",
    icon: {
      type: "image",
      src: assetUrl("UI_button_bag.png"),
      alt: "",
    },
    tutorialText: "Controlla oggetti, consumabili e materiali nel tuo zaino.",
  },
  {
    id: "slot_a",
    label: "Slot A",
    ariaLabel: "Apri tab placeholder A",
    icon: {
      type: "glyph",
      glyph: "A",
      style: "placeholder",
    },
    tutorialText: "Slot UI libero: missioni, crafting o mappa rapida.",
  },
  {
    id: "slot_b",
    label: "Slot B",
    ariaLabel: "Apri tab placeholder B",
    icon: {
      type: "glyph",
      glyph: "B",
      style: "placeholder",
    },
    tutorialText: "Slot UI libero: social, gilda o notifiche evento.",
  },
]);

export const HUD_DPAD_BUTTONS = Object.freeze([
  {
    direction: "up",
    ariaLabel: "Muovi su",
    iconSrc: assetUrl("UI_dpad_up.png"),
    slot: "up",
  },
  {
    direction: "left",
    ariaLabel: "Muovi a sinistra",
    iconSrc: assetUrl("UI_dpad_left.png"),
    slot: "left",
  },
  {
    direction: "right",
    ariaLabel: "Muovi a destra",
    iconSrc: assetUrl("UI_dpad_right.png"),
    slot: "right",
  },
  {
    direction: "down",
    ariaLabel: "Muovi giu",
    iconSrc: assetUrl("UI_dpad_down.png"),
    slot: "down",
  },
]);

export const HUD_DEFAULT_TUTORIAL = "";

export const HUD_SCENE_TUTORIALS = Object.freeze({
  start: "Dal menu iniziale puoi configurare il personaggio, poi entrare nel mondo.",
  setup: "Completa setup nome/classe e conferma per iniziare la tua avventura.",
  world: "Esplora la mappa, parla con gli NPC e preparati ai combattimenti.",
  battle: "Scegli ATTACK, BAG o SKILLS in base alla situazione del turno.",
  profile: "Gestisci statistiche, inventario e progressione personaggio.",
});
