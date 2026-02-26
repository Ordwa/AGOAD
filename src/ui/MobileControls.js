const HOLD_ACTIONS = new Set(["up", "down", "left", "right"]);
const TAP_ACTIONS = new Set(["confirm", "back", "pause", "inventory", "profile"]);

export class MobileControls {
  constructor(rootElement, input, game = null) {
    this.rootElement = rootElement;
    this.input = input;
    this.game = game;
    this.textToolsElement = rootElement.querySelector("[data-text-tools]");
    this.controlButtons = Array.from(rootElement.querySelectorAll("[data-control-action]"));
    this.activeHoldByPointer = new Map();
    this.activeButtonByPointer = new Map();
    this.backspaceHold = null;
    this.textToolsIntervalId = 0;
    this.controlsHidden = false;
    this.desktopMode = detectDesktopMode();

    this.onControlPointerDown = this.onControlPointerDown.bind(this);
    this.onControlPointerUp = this.onControlPointerUp.bind(this);
    this.onControlPointerCancel = this.onControlPointerCancel.bind(this);
    this.syncTextToolsVisibility = this.syncTextToolsVisibility.bind(this);
  }

  mount() {
    this.rootElement.classList.add("is-enabled");

    this.controlButtons.forEach((button) => {
      button.addEventListener("pointerdown", this.onControlPointerDown);
      button.addEventListener("pointerup", this.onControlPointerUp);
      button.addEventListener("pointercancel", this.onControlPointerCancel);
      button.addEventListener("contextmenu", preventDefault);
    });

    this.syncTextToolsVisibility();
    this.textToolsIntervalId = window.setInterval(() => {
      this.syncTextToolsVisibility();
    }, 120);
  }

  destroy() {
    this.releaseAllActiveControls();
    this.rootElement.classList.remove("is-enabled");
    this.controlButtons.forEach((button) => {
      button.removeEventListener("pointerdown", this.onControlPointerDown);
      button.removeEventListener("pointerup", this.onControlPointerUp);
      button.removeEventListener("pointercancel", this.onControlPointerCancel);
      button.removeEventListener("contextmenu", preventDefault);
    });

    if (this.textToolsIntervalId) {
      clearInterval(this.textToolsIntervalId);
      this.textToolsIntervalId = 0;
    }
  }

  onControlPointerDown(event) {
    if (this.controlsHidden) {
      return;
    }

    if (!(event.currentTarget instanceof HTMLButtonElement)) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const action = event.currentTarget.dataset.controlAction;
    if (!action) {
      return;
    }

    if (action === "text-input") {
      event.preventDefault();
      this.pulseButton(event.currentTarget, 220);
      this.openTextInputPrompt();
      return;
    }

    if (action === "backspace") {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      this.activeButtonByPointer.set(event.pointerId, event.currentTarget);
      this.input.injectBackspace(1);
      this.startBackspaceHold(event.pointerId, event.currentTarget);
      return;
    }

    if (HOLD_ACTIONS.has(action)) {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      this.activeButtonByPointer.set(event.pointerId, event.currentTarget);
      this.activeHoldByPointer.set(event.pointerId, action);
      event.currentTarget.classList.add("is-active");
      this.input.pressAction(action);
      return;
    }

    if (TAP_ACTIONS.has(action)) {
      event.preventDefault();
      this.input.tapAction(action);
      this.pulseButton(event.currentTarget, 120);
    }
  }

  onControlPointerUp(event) {
    if (!(event.currentTarget instanceof HTMLButtonElement)) {
      return;
    }

    event.preventDefault();
    this.releasePointerAction(event.pointerId);
  }

  onControlPointerCancel(event) {
    if (!(event.currentTarget instanceof HTMLButtonElement)) {
      return;
    }

    this.releasePointerAction(event.pointerId);
  }

  releasePointerAction(pointerId) {
    const holdAction = this.activeHoldByPointer.get(pointerId);
    if (holdAction) {
      this.input.releaseAction(holdAction);
      this.activeHoldByPointer.delete(pointerId);
    }

    const button = this.activeButtonByPointer.get(pointerId);
    if (button) {
      button.classList.remove("is-active");
      button.releasePointerCapture?.(pointerId);
      this.activeButtonByPointer.delete(pointerId);
    }

    if (this.backspaceHold?.pointerId === pointerId) {
      this.stopBackspaceHold();
    }
  }

  pulseButton(button, durationMs) {
    button.classList.add("is-active");
    window.setTimeout(() => {
      button.classList.remove("is-active");
    }, durationMs);
  }

  startBackspaceHold(pointerId, button) {
    this.stopBackspaceHold();
    button.classList.add("is-active");

    const timeoutId = window.setTimeout(() => {
      const intervalId = window.setInterval(() => {
        this.input.injectBackspace(1);
      }, 90);
      this.backspaceHold = {
        ...this.backspaceHold,
        intervalId,
      };
    }, 320);

    this.backspaceHold = {
      pointerId,
      button,
      timeoutId,
      intervalId: null,
    };
  }

  stopBackspaceHold() {
    if (!this.backspaceHold) {
      return;
    }

    if (this.backspaceHold.timeoutId !== null) {
      clearTimeout(this.backspaceHold.timeoutId);
    }

    if (this.backspaceHold.intervalId !== null) {
      clearInterval(this.backspaceHold.intervalId);
    }

    this.backspaceHold.button.classList.remove("is-active");
    this.backspaceHold = null;
  }

  releaseAllActiveControls() {
    this.stopBackspaceHold();

    this.activeHoldByPointer.forEach((action) => {
      this.input.releaseAction(action);
    });
    this.activeHoldByPointer.clear();

    this.activeButtonByPointer.forEach((button, pointerId) => {
      button.classList.remove("is-active");
      button.releasePointerCapture?.(pointerId);
    });
    this.activeButtonByPointer.clear();
  }

  openTextInputPrompt() {
    if (!this.input.getTextCaptureEnabled()) {
      return;
    }

    const rawValue = window.prompt("Inserisci testo (A-Z, 0-9). Verrà aggiunto al campo.");
    if (rawValue === null) {
      return;
    }

    const sanitized = rawValue.replace(/[^a-zA-Z0-9]/g, "");
    if (sanitized.length === 0) {
      return;
    }

    this.input.injectTypedText(sanitized);
  }

  syncTextToolsVisibility() {
    const hideForDesktop = this.desktopMode;
    const body = typeof document !== "undefined" ? document.body : null;
    const hideForHomeFromDom = Boolean(
      body && body.dataset.scene === "start" && body.dataset.startMode === "main",
    );
    const hideForHomeFromScene = Boolean(
      this.game &&
        this.game.currentSceneName === "start" &&
        this.game.currentScene &&
        this.game.currentScene.mode === "main",
    );
    const hideForHome = hideForHomeFromDom || hideForHomeFromScene;
    const shouldHideControls = hideForDesktop || hideForHome;

    if (shouldHideControls !== this.controlsHidden) {
      this.controlsHidden = shouldHideControls;

      if (shouldHideControls) {
        this.releaseAllActiveControls();
      }
    }
    this.rootElement.classList.toggle("is-hidden-home-controls", hideForHome);
    this.rootElement.classList.toggle("is-hidden-desktop-controls", hideForDesktop);

    if (this.textToolsElement) {
      const visible = !shouldHideControls && this.input.getTextCaptureEnabled();
      this.textToolsElement.hidden = !visible;
    }
  }
}

function preventDefault(event) {
  event.preventDefault();
}

function detectDesktopMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches === true;
  const touchPoints = Number(globalThis.navigator?.maxTouchPoints ?? 0);
  return !coarsePointer && touchPoints <= 0;
}
