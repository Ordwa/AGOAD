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
] = await Promise.all([
  importWithVersion("./core/Game.js"),
  importWithVersion("./core/Input.js"),
  importWithVersion("./scenes/BattleScene.js"),
  importWithVersion("./scenes/ProfileScene.js"),
  importWithVersion("./scenes/SetupScene.js"),
  importWithVersion("./scenes/StartScene.js"),
  importWithVersion("./scenes/WorldScene.js"),
]);

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas di gioco non trovato nel DOM.");
}

const input = new Input();
const game = new Game(canvas, input);

game.registerScene("setup", new SetupScene(game));
game.registerScene("start", new StartScene(game));
game.registerScene("world", new WorldScene(game));
game.registerScene("battle", new BattleScene(game));
game.registerScene("profile", new ProfileScene(game));
game.start("start");
