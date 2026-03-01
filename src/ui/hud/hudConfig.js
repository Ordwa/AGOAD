const assetUrl = (relativePath) => new URL(`../../assets/${relativePath}`, import.meta.url).href;

export const HUD_DEFAULT_ACTIVE_TAB = "profile";

export const HUD_TOP_TABS = Object.freeze([
  {
    id: "settings",
    label: "Settings",
    ariaLabel: "Apri impostazioni",
    icon: {
      type: "image",
      src: assetUrl("UI/UI_button_settings.png"),
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
      src: assetUrl("UI/UI_button_pg.png"),
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
      src: assetUrl("UI/UI_button_bag.png"),
      alt: "",
    },
    tutorialText: "Controlla oggetti, consumabili e materiali nel tuo zaino.",
  },
  {
    id: "slot_b",
    label: "Chiudi",
    ariaLabel: "Chiudi menu",
    icon: {
      type: "glyph",
      glyph: "X",
      style: "placeholder",
    },
    tutorialText: "Torna alla schermata precedente.",
  },
]);

export const HUD_DPAD_BUTTONS = Object.freeze([
  {
    direction: "up",
    ariaLabel: "Muovi su",
    iconSrc: assetUrl("UI/UI_dpad_up.png"),
    slot: "up",
  },
  {
    direction: "left",
    ariaLabel: "Muovi a sinistra",
    iconSrc: assetUrl("UI/UI_dpad_left.png"),
    slot: "left",
  },
  {
    direction: "right",
    ariaLabel: "Muovi a destra",
    iconSrc: assetUrl("UI/UI_dpad_right.png"),
    slot: "right",
  },
  {
    direction: "down",
    ariaLabel: "Muovi giu",
    iconSrc: assetUrl("UI/UI_dpad_down.png"),
    slot: "down",
  },
]);

export const HUD_ACTION_BUTTON = Object.freeze({
  action: "confirm",
  ariaLabel: "Azione principale",
  iconSrc: assetUrl("UI/UI_button_action.png"),
});

export const HUD_DEFAULT_TUTORIAL = "";

export const HUD_SCENE_TUTORIALS = Object.freeze({
  start: "Dal menu iniziale puoi configurare il personaggio, poi entrare nel mondo.",
  settings: "Regola audio, musiche e opzioni di supporto al gameplay.",
  setup: "Completa setup nome e conferma per iniziare la tua avventura.",
  world: "Esplora la mappa, parla con gli NPC e preparati ai combattimenti.",
  battle: "Scegli ATTACK, BAG o SKILLS in base alla situazione del turno.",
  profile: "Gestisci statistiche, inventario e progressione personaggio.",
  inventory: "Controlla oggetti, consumabili e materiali disponibili.",
});
