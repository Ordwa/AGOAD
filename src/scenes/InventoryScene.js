import { ProfileScene } from "./ProfileScene.js";
import { PLAYER_CONFIG } from "../data/constants.js";

export class InventoryScene extends ProfileScene {
  onEnter(payload = {}) {
    super.onEnter({
      ...payload,
      view: "inventory",
    });
  }

  requestUseSelectedInventoryItem(item) {
    const evaluation = this.evaluateInventoryItemUse(item);
    if (!evaluation.canUse) {
      this.showInventoryNotice(evaluation.message);
      return;
    }

    this.openUseConfirmPopup({
      source: "item",
      title: item.label,
      detail: evaluation.confirmText,
      onConfirm: () => {
        this.useSelectedInventoryItem(item);
      },
    });
  }

  evaluateInventoryItemUse(item) {
    if (!item || typeof item !== "object") {
      return { canUse: false, message: "Oggetto non disponibile.", confirmText: "" };
    }

    const player = this.game.state.player;
    if (item.id === "life_potion") {
      if ((item.quantity ?? 0) <= 0) {
        return { canUse: false, message: "Nessuna Life Potion disponibile.", confirmText: "" };
      }
      if ((player.hp ?? 0) >= (player.maxHp ?? 0)) {
        return { canUse: false, message: "HP gia' al massimo.", confirmText: "" };
      }
      return {
        canUse: true,
        message: "",
        confirmText: `Recupera ${PLAYER_CONFIG.healAmount} HP. Confermi l'uso?`,
      };
    }

    if (item.id === "mana_potion") {
      if ((item.quantity ?? 0) <= 0) {
        return { canUse: false, message: "Nessuna Mana Potion disponibile.", confirmText: "" };
      }
      if ((player.mana ?? 0) >= (player.maxMana ?? 0)) {
        return { canUse: false, message: "MP gia' al massimo.", confirmText: "" };
      }
      return {
        canUse: true,
        message: "",
        confirmText: `Recupera ${PLAYER_CONFIG.manaPotionAmount} MP. Confermi l'uso?`,
      };
    }

    if (item.id === "amulet") {
      if (!this.game.state.progress?.lastRestPoint) {
        return { canUse: false, message: "Nessun letto registrato.", confirmText: "" };
      }
      return {
        canUse: true,
        message: "",
        confirmText: "Ti riporta all'ultimo letto. Confermi l'uso?",
      };
    }

    return {
      canUse: false,
      message: "Oggetto non utilizzabile ora.",
      confirmText: "",
    };
  }

  useSelectedInventoryItem(item) {
    if (!item) {
      return;
    }

    const player = this.game.state.player;

    if (item.id === "life_potion") {
      if ((item.quantity ?? 0) <= 0) {
        this.showInventoryNotice("Nessuna Life Potion disponibile.");
        return;
      }
      if ((player.hp ?? 0) >= (player.maxHp ?? 0)) {
        this.showInventoryNotice("HP gia' al massimo.");
        return;
      }
      player.hp = Math.min(player.maxHp, (player.hp ?? 0) + PLAYER_CONFIG.healAmount);
      item.quantity = Math.max(0, (item.quantity ?? 0) - 1);
      this.showInventoryNotice("Usi una Life Potion.");
      return;
    }

    if (item.id === "mana_potion") {
      if ((item.quantity ?? 0) <= 0) {
        this.showInventoryNotice("Nessuna Mana Potion disponibile.");
        return;
      }
      if ((player.mana ?? 0) >= (player.maxMana ?? 0)) {
        this.showInventoryNotice("MP gia' al massimo.");
        return;
      }
      player.mana = Math.min(player.maxMana, (player.mana ?? 0) + PLAYER_CONFIG.manaPotionAmount);
      item.quantity = Math.max(0, (item.quantity ?? 0) - 1);
      this.showInventoryNotice("Usi una Mana Potion.");
      return;
    }

    if (item.id === "amulet") {
      const lastRestPoint = this.game.state.progress?.lastRestPoint;
      if (!lastRestPoint) {
        this.showInventoryNotice("Nessun letto registrato.");
        return;
      }
      this.game.changeScene("world", {
        resetToLastRest: true,
        safeSteps: 5,
        message: "L'Amulet ti riporta all'ultimo letto.",
      });
      return;
    }

    this.showInventoryNotice("Oggetto non utilizzabile ora.");
  }
}
