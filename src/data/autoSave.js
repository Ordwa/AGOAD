export const AUTO_SAVE_TRIGGER = Object.freeze({
  INTERVAL: "interval",
  BATTLE_END: "battle_end",
  MANUAL: "manual",
});

export const DEFAULT_AUTO_SAVE_TRIGGER_CONFIG = Object.freeze({
  [AUTO_SAVE_TRIGGER.INTERVAL]: Object.freeze({ immediate: false }),
  [AUTO_SAVE_TRIGGER.BATTLE_END]: Object.freeze({ immediate: true }),
  [AUTO_SAVE_TRIGGER.MANUAL]: Object.freeze({ immediate: true }),
});
