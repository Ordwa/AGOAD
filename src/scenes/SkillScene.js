import { ProfileScene } from "./ProfileScene.js";
import { PLAYER_CONFIG } from "../data/constants.js";

export class SkillScene extends ProfileScene {
  onEnter(payload = {}) {
    super.onEnter({
      ...payload,
      view: "skills",
    });
  }

  requestUseSelectedSkill(skill) {
    const evaluation = this.evaluateSkillUse(skill);
    if (!evaluation.canUse) {
      this.showInventoryNotice(evaluation.message);
      return;
    }

    this.openUseConfirmPopup({
      source: "skill",
      title: skill.label,
      detail: evaluation.confirmText,
      onConfirm: () => {
        this.useSelectedSkill(skill);
      },
    });
  }

  evaluateSkillUse(skill) {
    if (!skill || typeof skill !== "object") {
      return { canUse: false, message: "Abilita' non disponibile.", confirmText: "" };
    }

    const player = this.game.state.player;
    const manaCost = Math.max(0, Number(skill.manaCost) || 0);
    if (!skill.usableOutsideBattle) {
      return {
        canUse: false,
        message: "Abilita' non utilizzabile fuori dal combattimento.",
        confirmText: "",
      };
    }

    if ((player.mana ?? 0) < manaCost) {
      return {
        canUse: false,
        message: "MP insufficienti.",
        confirmText: "",
      };
    }

    if ((skill.effect === "heal" || skill.id === "arcane_heal") && (player.hp ?? 0) >= (player.maxHp ?? 0)) {
      return {
        canUse: false,
        message: "HP gia' al massimo.",
        confirmText: "",
      };
    }

    if (skill.effect === "heal" || skill.id === "arcane_heal") {
      return {
        canUse: true,
        message: "",
        confirmText: `Consuma ${manaCost} MP e recupera ${PLAYER_CONFIG.healAmount} HP. Confermi l'uso?`,
      };
    }

    return {
      canUse: false,
      message: "Abilita' non utilizzabile ora.",
      confirmText: "",
    };
  }

  useSelectedSkill(skill) {
    const evaluation = this.evaluateSkillUse(skill);
    if (!evaluation.canUse) {
      this.showInventoryNotice(evaluation.message);
      return;
    }

    const player = this.game.state.player;
    const manaCost = Math.max(0, Number(skill.manaCost) || 0);
    if ((player.mana ?? 0) < manaCost) {
      this.showInventoryNotice("MP insufficienti.");
      return;
    }

    if (manaCost > 0) {
      player.mana = Math.max(0, (player.mana ?? 0) - manaCost);
    }

    if (skill.effect === "heal" || skill.id === "arcane_heal") {
      player.hp = Math.min(player.maxHp, (player.hp ?? 0) + PLAYER_CONFIG.healAmount);
      this.showInventoryNotice(`Usi ${skill.label}.`);
      return;
    }

    this.showInventoryNotice("Abilita' non utilizzabile ora.");
  }
}
