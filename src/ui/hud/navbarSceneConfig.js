const DEFAULT_NAVBAR_LAYOUT = Object.freeze({
  visible: false,
  topbarVisible: true,
  controlsVisible: false,
  visibleTabIds: Object.freeze([]),
  activeTabId: "",
});

const MENU_TAB_IDS = Object.freeze(["settings", "profile", "bag", "slot_a", "slot_b"]);
const WORLD_TAB_IDS = Object.freeze(["settings", "profile", "bag", "slot_a"]);

export const NAVBAR_SCENE_LAYOUTS = Object.freeze({
  world: Object.freeze({
    visible: true,
    topbarVisible: true,
    controlsVisible: true,
    visibleTabIds: WORLD_TAB_IDS,
    activeTabId: "",
  }),
  profile: Object.freeze({
    visible: true,
    topbarVisible: true,
    controlsVisible: false,
    visibleTabIds: MENU_TAB_IDS,
    activeTabId: "profile",
  }),
  inventory: Object.freeze({
    visible: true,
    topbarVisible: true,
    controlsVisible: false,
    visibleTabIds: MENU_TAB_IDS,
    activeTabId: "bag",
  }),
  skills: Object.freeze({
    visible: true,
    topbarVisible: true,
    controlsVisible: false,
    visibleTabIds: MENU_TAB_IDS,
    activeTabId: "slot_a",
  }),
  settings: Object.freeze({
    visible: true,
    topbarVisible: true,
    controlsVisible: false,
    visibleTabIds: MENU_TAB_IDS,
    activeTabId: "settings",
  }),
  gm_edit: Object.freeze({
    visible: true,
    topbarVisible: true,
    controlsVisible: false,
    visibleTabIds: MENU_TAB_IDS,
    activeTabId: "settings",
  }),
});

export function resolveNavbarLayout(sceneName) {
  if (typeof sceneName !== "string") {
    return DEFAULT_NAVBAR_LAYOUT;
  }

  return NAVBAR_SCENE_LAYOUTS[sceneName] ?? DEFAULT_NAVBAR_LAYOUT;
}
