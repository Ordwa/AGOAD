function normalizeKey(key) {
  return key.length === 1 ? key.toLowerCase() : key;
}

function toActions(value) {
  return Array.isArray(value) ? value : [value];
}

export class Input {
  constructor() {
    this.pressed = new Set();
    this.justPressed = new Set();
    this.textCaptureEnabled = false;
    this.typedChars = [];
    this.backspaceCount = 0;
    this.keyToAction = new Map([
      ["ArrowUp", "up"],
      ["ArrowDown", "down"],
      ["ArrowLeft", "left"],
      ["ArrowRight", "right"],
      ["w", "up"],
      ["s", "down"],
      ["a", "left"],
      ["d", "right"],
      ["i", "inventory"],
      ["p", "profile"],
      ["Enter", "confirm"],
      [" ", "back"],
      ["Escape", "back"],
    ]);

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  onKeyDown(event) {
    if (this.textCaptureEnabled && !event.altKey && !event.ctrlKey && !event.metaKey) {
      if (event.key === "Backspace") {
        this.backspaceCount += 1;
        event.preventDefault();
      } else if (/^[a-zA-Z0-9]$/.test(event.key)) {
        this.typedChars.push(event.key);
        event.preventDefault();
      }
    }

    const key = normalizeKey(event.key);
    const mappedActions = this.keyToAction.get(key);
    if (!mappedActions) {
      return;
    }

    toActions(mappedActions).forEach((action) => {
      this.pressAction(action);
    });
    event.preventDefault();
  }

  onKeyUp(event) {
    const key = normalizeKey(event.key);
    const mappedActions = this.keyToAction.get(key);
    if (!mappedActions) {
      return;
    }

    toActions(mappedActions).forEach((action) => {
      this.releaseAction(action);
    });
    event.preventDefault();
  }

  isPressed(action) {
    return this.pressed.has(action);
  }

  wasPressed(action) {
    return this.justPressed.has(action);
  }

  getTextCaptureEnabled() {
    return this.textCaptureEnabled;
  }

  pressAction(action) {
    if (typeof action !== "string" || action.length === 0) {
      return;
    }

    if (!this.pressed.has(action)) {
      this.justPressed.add(action);
    }
    this.pressed.add(action);
  }

  releaseAction(action) {
    if (typeof action !== "string" || action.length === 0) {
      return;
    }

    this.pressed.delete(action);
  }

  tapAction(action) {
    if (typeof action !== "string" || action.length === 0) {
      return;
    }

    this.justPressed.add(action);
  }

  setTextCapture(enabled) {
    this.textCaptureEnabled = enabled;
    this.typedChars.length = 0;
    this.backspaceCount = 0;
  }

  injectTypedText(text) {
    if (!this.textCaptureEnabled || typeof text !== "string") {
      return;
    }

    text.split("").forEach((char) => {
      if (/^[a-zA-Z0-9]$/.test(char)) {
        this.typedChars.push(char);
      }
    });
  }

  injectBackspace(count = 1) {
    if (!this.textCaptureEnabled) {
      return;
    }

    const safeCount = Math.max(0, Math.floor(Number(count) || 0));
    this.backspaceCount += safeCount;
  }

  consumeTypedChars() {
    if (this.typedChars.length === 0) {
      return [];
    }

    const chars = [...this.typedChars];
    this.typedChars.length = 0;
    return chars;
  }

  consumeBackspaceCount() {
    const count = this.backspaceCount;
    this.backspaceCount = 0;
    return count;
  }

  endFrame() {
    this.justPressed.clear();
  }

  destroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }
}
