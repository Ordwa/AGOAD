import { ProfileScene } from "./ProfileScene.js";

export class SkillScene extends ProfileScene {
  onEnter(payload = {}) {
    super.onEnter({
      ...payload,
      view: "skills",
    });
  }
}
