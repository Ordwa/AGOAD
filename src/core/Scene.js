export class Scene {
  constructor(game) {
    this.game = game;
  }

  onEnter() {}

  onExit() {}

  update() {}

  render() {}

  triggerAutoSave(triggerId, payload, options) {
    if (!this.game || typeof this.game.triggerAutoSave !== "function") {
      return false;
    }

    return this.game.triggerAutoSave(triggerId, payload, options);
  }
}
