import { HUD_DEFAULT_TUTORIAL, HUD_SCENE_TUTORIALS } from "./hudConfig.js";

const NOOP = () => {};

const DEFAULT_TAB_ACTIONS = Object.freeze({
  settings: ({ game }) => {
    const originScene = game.currentSceneName;
    const returnScene =
      typeof originScene === "string" && originScene.length > 0 && originScene !== "settings"
        ? originScene
        : "start";
    game.changeScene("settings", {
      returnScene,
    });
  },
  profile: ({ game }) => {
    const originScene = game.currentSceneName;
    const returnScene =
      typeof originScene === "string" && originScene.length > 0 && originScene !== "profile"
        ? originScene
        : "world";
    game.changeScene("profile", {
      returnScene,
    });
  },
  bag: ({ game }) => {
    const originScene = game.currentSceneName;
    const returnScene =
      typeof originScene === "string" && originScene.length > 0 && originScene !== "inventory"
        ? originScene
        : "world";
    game.changeScene("inventory", {
      returnScene,
    });
  },
  slot_a: NOOP,
  slot_b: NOOP,
});

export function createConsoleShellBridge({
  game,
  input,
  consoleShell,
  hud,
  tabActions = {},
  onTabAction = NOOP,
  onMenuOpen = NOOP,
  sceneTutorialsEnabled = false,
  isHudVisibleInScene = defaultSceneVisibility,
} = {}) {
  const activeConsoleShell = consoleShell ?? hud;
  if (!game || !input || !activeConsoleShell) {
    throw new Error("createConsoleShellBridge richiede game, input e consoleShell.");
  }

  const mergedTabActions = {
    ...DEFAULT_TAB_ACTIONS,
    ...tabActions,
  };

  let lastSceneName = "";
  const heldDirections = new Set();

  const callbacks = {
    onTabChange: ({ tabId, tab }) => {
      const handler = mergedTabActions[tabId];
      if (typeof handler === "function") {
        handler({ game, input, consoleShell: activeConsoleShell, hud: activeConsoleShell, tabId, tab });
      }
      onTabAction({ tabId, tab, sceneName: game.currentSceneName });
    },
    onMenuOpen: ({ tabId, tab }) => {
      onMenuOpen({ tabId, tab, sceneName: game.currentSceneName });
    },
    onMove: ({ direction, phase }) => {
      if (!direction || !isHudVisibleInScene(game.currentSceneName)) {
        return;
      }

      if (phase === "start") {
        if (heldDirections.has(direction)) {
          return;
        }
        heldDirections.add(direction);
        input.pressAction(direction);
        return;
      }

      if (!heldDirections.has(direction)) {
        return;
      }
      heldDirections.delete(direction);
      input.releaseAction(direction);
    },
    onAction: ({ action }) => {
      if (!action || !isHudVisibleInScene(game.currentSceneName)) {
        return;
      }

      input.tapAction(action);
    },
  };

  activeConsoleShell.updateCallbacks(callbacks);
  syncConsoleShellForScene(true);

  const syncTimerId = window.setInterval(() => {
    syncConsoleShellForScene(false);
  }, 120);

  return {
    destroy() {
      window.clearInterval(syncTimerId);
      heldDirections.forEach((direction) => {
        input.releaseAction(direction);
      });
      heldDirections.clear();

      activeConsoleShell.updateCallbacks({
        onTabChange: NOOP,
        onMenuOpen: NOOP,
        onMove: NOOP,
        onAction: NOOP,
      });
    },
  };

  function syncConsoleShellForScene(force) {
    const sceneName = game.currentSceneName;
    if (!force && sceneName === lastSceneName) {
      return;
    }

    lastSceneName = sceneName;
    const visible = isHudVisibleInScene(sceneName);
    activeConsoleShell.setVisible(visible);

    if (!visible) {
      heldDirections.forEach((direction) => {
        input.releaseAction(direction);
      });
      heldDirections.clear();
      activeConsoleShell.setTutorialVisible(false, { emit: false });
      return;
    }

    if (sceneTutorialsEnabled) {
      activeConsoleShell.setTutorialText(resolveSceneTutorial(sceneName), {
        autoShow: true,
        emit: false,
      });
      return;
    }

    activeConsoleShell.setTutorialVisible(false, { emit: false });
  }
}

export function createHudBridge(options = {}) {
  return createConsoleShellBridge(options);
}

function defaultSceneVisibility(sceneName) {
  return sceneName === "world";
}

function resolveSceneTutorial(sceneName) {
  if (typeof sceneName !== "string") {
    return HUD_DEFAULT_TUTORIAL;
  }

  return HUD_SCENE_TUTORIALS[sceneName] ?? HUD_DEFAULT_TUTORIAL;
}
