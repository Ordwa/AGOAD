const appVersion = new URL(import.meta.url).searchParams.get("v") || `${Date.now()}`;
const versionSuffix = `?v=${encodeURIComponent(appVersion)}`;
const importWithVersion = (path) => import(`${path}${versionSuffix}`);

const [
  { Game },
  { Input },
  { BattleScene },
  { ProfileScene },
  { SetupScene },
  { StartScene },
  { WorldScene },
  { GameHud },
  { createHudBridge },
  { HUD_DEFAULT_ACTIVE_TAB, HUD_DEFAULT_TUTORIAL },
] = await Promise.all([
  importWithVersion("./core/Game.js"),
  importWithVersion("./core/Input.js"),
  importWithVersion("./scenes/BattleScene.js"),
  importWithVersion("./scenes/ProfileScene.js"),
  importWithVersion("./scenes/SetupScene.js"),
  importWithVersion("./scenes/StartScene.js"),
  importWithVersion("./scenes/WorldScene.js"),
  importWithVersion("./ui/hud/GameHud.js"),
  importWithVersion("./ui/hud/hudBridge.js"),
  importWithVersion("./ui/hud/hudConfig.js"),
]);

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas di gioco non trovato nel DOM.");
}

const input = new Input();
const game = new Game(canvas, input);
await game.initializeCloudSession();

game.registerScene("setup", new SetupScene(game));
game.registerScene("start", new StartScene(game));
game.registerScene("world", new WorldScene(game));
game.registerScene("battle", new BattleScene(game));
game.registerScene("profile", new ProfileScene(game));

let hud = null;
let hudBridge = null;
const hudRoot = document.getElementById("game-hud-root");
if (hudRoot instanceof HTMLElement) {
  hud = new GameHud({
    root: hudRoot,
    activeTabId: HUD_DEFAULT_ACTIVE_TAB,
    tutorialText: HUD_DEFAULT_TUTORIAL,
    tutorialVisible: true,
  });
  hud.mount();
  hudBridge = createHudBridge({ game, input, hud });
  game.hud = hud;
}

window.addEventListener(
  "beforeunload",
  () => {
    hudBridge?.destroy();
    hud?.destroy();
  },
  { once: true },
);

game.start("start");
