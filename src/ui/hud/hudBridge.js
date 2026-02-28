import { HUD_DEFAULT_TUTORIAL, HUD_SCENE_TUTORIALS } from "./hudConfig.js";

const NOOP = () => {};

const DEFAULT_TAB_ACTIONS = Object.freeze({
  settings: ({ game }) => {
    if (game.currentSceneName !== "start") {
      game.changeScene("start");
    }
  },
  character: ({ input }) => {
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
    onMenuOpen,
    onMove: ({ direction, phase }) => {
      if (!direction) {
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
  };

  hud.updateCallbacks(callbacks);
  hud.setTutorialText(resolveSceneTutorial(game.currentSceneName), {
    autoShow: true,
    emit: false,
  });

  const syncTimerId = window.setInterval(() => {
    if (game.currentSceneName === lastSceneName) {
      return;
    }

    lastSceneName = game.currentSceneName;
    hud.setTutorialText(resolveSceneTutorial(lastSceneName), {
      autoShow: true,
      emit: false,
    });

    if (lastSceneName === "profile") {
      hud.setActiveTab("character", { emit: false });
    }
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
      });
    },
  };
}

function resolveSceneTutorial(sceneName) {
  if (typeof sceneName !== "string") {
    return HUD_DEFAULT_TUTORIAL;
  }

  return HUD_SCENE_TUTORIALS[sceneName] ?? HUD_DEFAULT_TUTORIAL;
}
