import { StartScene } from "./StartScene.js";

export class SettingsScene extends StartScene {
  onEnter(payload = {}) {
    super.onEnter({
      ...payload,
      startMode: "options",
    });
  }
}
