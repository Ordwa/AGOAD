import { HUD_DEFAULT_TUTORIAL, HUD_SCENE_TUTORIALS } from "./hudConfig.js";
import { resolveNavbarLayout } from "./navbarSceneConfig.js";

const NOOP = () => {};

const DEFAULT_TAB_ACTIONS = Object.freeze({
  settings: ({ game }) => {
    const originScene = game.currentSceneName;
    const returnScene = originScene === "start" ? "start" : "world";
    game.changeScene("settings", {
      returnScene,
    });
  },
  profile: ({ game }) => {
    game.changeScene("profile", {
      returnScene: "world",
    });
  },
  bag: ({ game }) => {
    game.changeScene("inventory", {
      returnScene: "world",
    });
  },
  slot_a: ({ game }) => {
    game.changeScene("skills", {
      returnScene: "world",
    });
  },
  slot_b: ({ game }) => {
    const activeScene = game.currentScene;
    if (activeScene && typeof activeScene.closeFromNavbar === "function") {
      activeScene.closeFromNavbar();
      return;
    }

    game.changeScene("world");
  },
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

  const isHudEnabledForScene = (sceneName) => {
    const layout = resolveSceneNavbarLayout(sceneName, game);
    return layout.visible === true && isHudVisibleInScene(sceneName);
  };

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
      if (!direction || !isHudEnabledForScene(game.currentSceneName)) {
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
      if (!action || !isHudEnabledForScene(game.currentSceneName)) {
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
    const navbarLayout = resolveSceneNavbarLayout(sceneName, game);
    const visible = navbarLayout.visible === true && isHudVisibleInScene(sceneName);
    activeConsoleShell.setVisible(visible);

    if (!visible) {
      heldDirections.forEach((direction) => {
        input.releaseAction(direction);
      });
      heldDirections.clear();
      activeConsoleShell.setTutorialVisible(false, { emit: false });
      return;
    }

    activeConsoleShell.applyLayout(navbarLayout);

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
  return sceneName !== "start" && sceneName !== "setup" && sceneName !== "battle";
}

function resolveSceneNavbarLayout(sceneName, game) {
  const baseLayout = resolveNavbarLayout(sceneName);
  const activeScene = game?.currentScene;
  if (activeScene && typeof activeScene.getNavbarLayout === "function") {
    const sceneLayout = activeScene.getNavbarLayout();
    if (sceneLayout && typeof sceneLayout === "object") {
      return {
        ...baseLayout,
        ...sceneLayout,
      };
    }
  }

  return baseLayout;
}

function resolveSceneTutorial(sceneName) {
  if (typeof sceneName !== "string") {
    return HUD_DEFAULT_TUTORIAL;
  }

  return HUD_SCENE_TUTORIALS[sceneName] ?? HUD_DEFAULT_TUTORIAL;
}
