const appVersion = new URL(import.meta.url).searchParams.get("v") || `${Date.now()}`;
const versionSuffix = `?v=${encodeURIComponent(appVersion)}`;
const importWithVersion = (path) => import(`${path}${versionSuffix}`);

const [
  { Game },
  { Input },
  { BattleScene },
  { CutsceneScene },
  { GmEditScene },
  { InventoryScene },
  { ProfileScene },
  { SkillScene },
  { SettingsScene },
  { SetupScene },
  { StartScene },
  { WorldScene },
  { ConsoleShellHud },
  { createConsoleShellBridge },
  { HUD_DEFAULT_ACTIVE_TAB, HUD_DEFAULT_TUTORIAL },
] = await Promise.all([
  importWithVersion("./core/Game.js"),
  importWithVersion("./core/Input.js"),
  importWithVersion("./scenes/BattleScene.js"),
  importWithVersion("./scenes/CutsceneScene.js"),
  importWithVersion("./scenes/GmEditScene.js"),
  importWithVersion("./scenes/InventoryScene.js"),
  importWithVersion("./scenes/ProfileScene.js"),
  importWithVersion("./scenes/SkillScene.js"),
  importWithVersion("./scenes/SettingsScene.js"),
  importWithVersion("./scenes/SetupScene.js"),
  importWithVersion("./scenes/StartScene.js"),
  importWithVersion("./scenes/WorldScene.js"),
  importWithVersion("./ui/hud/ConsoleShellHud.js"),
  importWithVersion("./ui/hud/consoleShellBridge.js"),
  importWithVersion("./ui/hud/hudConfig.js"),
]);

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas di gioco non trovato nel DOM.");
}

const gameShell = document.querySelector(".game-shell");
if (gameShell instanceof HTMLElement) {
  gameShell.addEventListener("selectstart", (event) => {
    event.preventDefault();
  });
  gameShell.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
}

document.addEventListener("selectionchange", () => {
  const activeElement = document.activeElement;
  if (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    activeElement?.getAttribute?.("contenteditable") === "true"
  ) {
    return;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount <= 0 || selection.isCollapsed) {
    return;
  }

  selection.removeAllRanges();
});

const input = new Input();
const game = new Game(canvas, input);
await game.initializeCloudSession();

game.registerScene("setup", new SetupScene(game));
game.registerScene("start", new StartScene(game));
game.registerScene("settings", new SettingsScene(game));
game.registerScene("world", new WorldScene(game));
game.registerScene("battle", new BattleScene(game));
game.registerScene("cutscene_overlay", new CutsceneScene(game));
game.registerScene("gm_edit", new GmEditScene(game));
game.registerScene("profile", new ProfileScene(game));
game.registerScene("inventory", new InventoryScene(game));
game.registerScene("skills", new SkillScene(game));

let consoleShellHud = null;
let consoleShellBridge = null;
const consoleShellRoot =
  document.getElementById("game-console-shell-root") ?? document.getElementById("game-hud-root");
if (consoleShellRoot instanceof HTMLElement) {
  consoleShellHud = new ConsoleShellHud({
    root: consoleShellRoot,
    activeTabId: HUD_DEFAULT_ACTIVE_TAB,
    tutorialText: HUD_DEFAULT_TUTORIAL,
    tutorialVisible: false,
    visible: false,
  });
  consoleShellHud.mount();
  consoleShellBridge = createConsoleShellBridge({ game, input, consoleShell: consoleShellHud });
  game.consoleShellHud = consoleShellHud;
  game.hud = consoleShellHud;
}

window.addEventListener(
  "beforeunload",
  () => {
    consoleShellBridge?.destroy();
    consoleShellHud?.destroy();
  },
  { once: true },
);

game.start("start");
