import { ProfileScene } from "./ProfileScene.js";

export class InventoryScene extends ProfileScene {
  onEnter(payload = {}) {
    super.onEnter({
      ...payload,
      view: "inventory",
    });
  }
}
