import { HUD_DEFAULT_TUTORIAL, HUD_SCENE_TUTORIALS } from "./hudConfig.js";

const NOOP = () => {};

const DEFAULT_TAB_ACTIONS = Object.freeze({
  settings: ({ game }) => {
    const originScene = game.currentSceneName;
    game.changeScene("start", {
      startMode: "options",
      returnScene: originScene === "world" ? "world" : "",
    });
  },
  profile: ({ input }) => {
    input.tapAction("profile");
  },
  bag: ({ input }) => {
    input.tapAction("inventory");
  },
  slot_a: NOOP,
  slot_b: NOOP,
});

export function createHudBridge({
  game,
  input,
  hud,
  tabActions = {},
  onTabAction = NOOP,
  onMenuOpen = NOOP,
  sceneTutorialsEnabled = false,
  isHudVisibleInScene = defaultSceneVisibility,
} = {}) {
  if (!game || !input || !hud) {
    throw new Error("createHudBridge richiede game, input e hud.");
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
        handler({ game, input, hud, tabId, tab });
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

  hud.updateCallbacks(callbacks);
  syncHudForScene(true);

  const syncTimerId = window.setInterval(() => {
    syncHudForScene(false);
  }, 120);

  return {
    destroy() {
      window.clearInterval(syncTimerId);
      heldDirections.forEach((direction) => {
        input.releaseAction(direction);
      });
      heldDirections.clear();

      hud.updateCallbacks({
        onTabChange: NOOP,
        onMenuOpen: NOOP,
        onMove: NOOP,
        onAction: NOOP,
      });
    },
  };

  function syncHudForScene(force) {
    const sceneName = game.currentSceneName;
    if (!force && sceneName === lastSceneName) {
      return;
    }

    lastSceneName = sceneName;
    const visible = isHudVisibleInScene(sceneName);
    hud.setVisible(visible);

    if (!visible) {
      heldDirections.forEach((direction) => {
        input.releaseAction(direction);
      });
      heldDirections.clear();
      hud.setTutorialVisible(false, { emit: false });
      return;
    }

    if (sceneTutorialsEnabled) {
      hud.setTutorialText(resolveSceneTutorial(sceneName), {
        autoShow: true,
        emit: false,
      });
      return;
    }

    hud.setTutorialVisible(false, { emit: false });
  }
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
