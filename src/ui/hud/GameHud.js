import {
  HUD_DEFAULT_ACTIVE_TAB,
  HUD_DEFAULT_TUTORIAL,
  HUD_DPAD_BUTTONS,
  HUD_TOP_TABS,
} from "./hudConfig.js";

const NOOP = () => {};
const POINTER_END_EVENTS = ["pointerup", "pointercancel", "pointerleave"];

export class GameHud {
  constructor({
    root,
    tabs = HUD_TOP_TABS,
    dpadButtons = HUD_DPAD_BUTTONS,
    activeTabId = HUD_DEFAULT_ACTIVE_TAB,
    tutorialText = HUD_DEFAULT_TUTORIAL,
    tutorialVisible = true,
    visible = true,
    callbacks = {},
  } = {}) {
    this.root = root;
    this.tabs = Array.isArray(tabs) ? tabs : HUD_TOP_TABS;
    this.dpadButtons = Array.isArray(dpadButtons) ? dpadButtons : HUD_DPAD_BUTTONS;
    this.activeTabId = activeTabId;
    this.tutorialText = String(tutorialText ?? "").trim();
    this.tutorialVisible = Boolean(tutorialVisible);
    this.visible = Boolean(visible);

    this.callbacks = {
      onTabChange: NOOP,
      onMenuOpen: NOOP,
      onMove: NOOP,
      onTutorialChange: NOOP,
      ...callbacks,
    };

    this.tabButtonById = new Map();
    this.directionButtonById = new Map();
    this.activePointerDirections = new Map();
    this.activeKeyboardDirections = new Set();

    this.tutorialElement = null;

    this.onTopButtonPressStart = this.onTopButtonPressStart.bind(this);
    this.onTopButtonPressEnd = this.onTopButtonPressEnd.bind(this);
    this.onTopButtonClick = this.onTopButtonClick.bind(this);

    this.onDpadPointerDown = this.onDpadPointerDown.bind(this);
    this.onDpadPointerEnd = this.onDpadPointerEnd.bind(this);
    this.onDpadKeyDown = this.onDpadKeyDown.bind(this);
    this.onDpadKeyUp = this.onDpadKeyUp.bind(this);
    this.onDpadBlur = this.onDpadBlur.bind(this);
  }

  mount() {
    if (!(this.root instanceof HTMLElement)) {
      throw new Error("Root HUD non valido.");
    }

    this.root.innerHTML = buildHudMarkup(this.tabs, this.dpadButtons);
    this.root.classList.add("game-hud");

    this.tutorialElement = this.root.querySelector("[data-hud-tutorial]");

    const tabButtons = Array.from(this.root.querySelectorAll("[data-hud-tab]"));
    tabButtons.forEach((button) => {
      const tabId = button.dataset.hudTab;
      if (!tabId) {
        return;
      }

      this.tabButtonById.set(tabId, button);
      button.addEventListener("pointerdown", this.onTopButtonPressStart);
      button.addEventListener("pointerup", this.onTopButtonPressEnd);
      button.addEventListener("pointercancel", this.onTopButtonPressEnd);
      button.addEventListener("pointerleave", this.onTopButtonPressEnd);
      button.addEventListener("click", this.onTopButtonClick);
      button.addEventListener("contextmenu", preventDefaultEvent);
    });

    const directionButtons = Array.from(this.root.querySelectorAll("[data-hud-direction]"));
    directionButtons.forEach((button) => {
      const direction = button.dataset.hudDirection;
      if (!direction) {
        return;
      }

      this.directionButtonById.set(direction, button);
      button.addEventListener("pointerdown", this.onDpadPointerDown);
      POINTER_END_EVENTS.forEach((eventName) => {
        button.addEventListener(eventName, this.onDpadPointerEnd);
      });
      button.addEventListener("keydown", this.onDpadKeyDown);
      button.addEventListener("keyup", this.onDpadKeyUp);
      button.addEventListener("blur", this.onDpadBlur);
      button.addEventListener("contextmenu", preventDefaultEvent);
    });

    if (!this.tabButtonById.has(this.activeTabId)) {
      const fallbackTab = this.tabs[0]?.id ?? "";
      this.activeTabId = fallbackTab;
    }

    this.syncTopTabs();
    this.syncTutorial();
    this.setVisible(this.visible);
  }

  destroy() {
    this.tabButtonById.forEach((button) => {
      button.removeEventListener("pointerdown", this.onTopButtonPressStart);
      button.removeEventListener("pointerup", this.onTopButtonPressEnd);
      button.removeEventListener("pointercancel", this.onTopButtonPressEnd);
      button.removeEventListener("pointerleave", this.onTopButtonPressEnd);
      button.removeEventListener("click", this.onTopButtonClick);
      button.removeEventListener("contextmenu", preventDefaultEvent);
    });

    this.directionButtonById.forEach((button) => {
      button.removeEventListener("pointerdown", this.onDpadPointerDown);
      POINTER_END_EVENTS.forEach((eventName) => {
        button.removeEventListener(eventName, this.onDpadPointerEnd);
      });
      button.removeEventListener("keydown", this.onDpadKeyDown);
      button.removeEventListener("keyup", this.onDpadKeyUp);
      button.removeEventListener("blur", this.onDpadBlur);
      button.removeEventListener("contextmenu", preventDefaultEvent);
    });

    this.releaseAllDirections();
    this.root.innerHTML = "";
    this.root.classList.remove("game-hud");
    this.tabButtonById.clear();
    this.directionButtonById.clear();
    this.tutorialElement = null;
  }

  updateCallbacks(callbacks = {}) {
    this.callbacks = {
      ...this.callbacks,
      ...callbacks,
    };
  }

  setActiveTab(tabId, { emit = false } = {}) {
    if (!this.tabButtonById.has(tabId)) {
      return;
    }

    if (this.activeTabId === tabId && !emit) {
      return;
    }

    this.activeTabId = tabId;
    this.syncTopTabs();

    if (emit) {
      const tab = this.getTabById(tabId);
      const payload = {
        tabId,
        tab,
      };
      this.callbacks.onTabChange(payload);
      this.callbacks.onMenuOpen(payload);
    }
  }

  setTutorialText(text, { autoShow = true, emit = true } = {}) {
    this.tutorialText = String(text ?? "").trim();
    if (this.tutorialText.length === 0) {
      this.tutorialVisible = false;
    } else if (autoShow) {
      this.tutorialVisible = true;
    }

    this.syncTutorial();

    if (emit) {
      this.callbacks.onTutorialChange({
        text: this.tutorialText,
        visible: this.tutorialVisible,
      });
    }
  }

  setTutorialVisible(visible, { emit = true } = {}) {
    this.tutorialVisible = Boolean(visible);
    if (this.tutorialText.length === 0 && this.tutorialVisible) {
      this.tutorialText = HUD_DEFAULT_TUTORIAL;
    }

    this.syncTutorial();

    if (emit) {
      this.callbacks.onTutorialChange({
        text: this.tutorialText,
        visible: this.tutorialVisible,
      });
    }
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.root.hidden = !this.visible;
    this.root.classList.toggle("is-hidden", !this.visible);

    if (!this.visible) {
      this.releaseAllDirections();
      this.tabButtonById.forEach((button) => {
        button.classList.remove("is-pressed");
      });
      this.directionButtonById.forEach((button) => {
        button.classList.remove("is-pressed");
      });
    }
  }

  onTopButtonPressStart(event) {
    if (!(event.currentTarget instanceof HTMLButtonElement)) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.currentTarget.classList.add("is-pressed");
  }

  onTopButtonPressEnd(event) {
    if (!(event.currentTarget instanceof HTMLButtonElement)) {
      return;
    }

    event.currentTarget.classList.remove("is-pressed");
  }

  onTopButtonClick(event) {
    if (!(event.currentTarget instanceof HTMLButtonElement)) {
      return;
    }

    const tabId = event.currentTarget.dataset.hudTab;
    if (!tabId) {
      return;
    }

    this.setActiveTab(tabId, { emit: true });

    const tab = this.getTabById(tabId);
    if (tab?.tutorialText) {
      this.setTutorialText(tab.tutorialText, { autoShow: true, emit: true });
    }
  }

  onDpadPointerDown(event) {
    if (!(event.currentTarget instanceof HTMLButtonElement)) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const direction = event.currentTarget.dataset.hudDirection;
    if (!direction || this.activePointerDirections.has(event.pointerId)) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    this.activePointerDirections.set(event.pointerId, direction);
    event.currentTarget.classList.add("is-pressed");

    this.callbacks.onMove({
      direction,
      phase: "start",
      source: "pointer",
    });
  }

  onDpadPointerEnd(event) {
    if (!(event.currentTarget instanceof HTMLButtonElement)) {
      return;
    }

    const direction = this.activePointerDirections.get(event.pointerId);
    if (!direction) {
      return;
    }

    this.activePointerDirections.delete(event.pointerId);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    event.currentTarget.classList.remove("is-pressed");

    this.callbacks.onMove({
      direction,
      phase: "end",
      source: "pointer",
    });
  }

  onDpadKeyDown(event) {
    if (!(event.currentTarget instanceof HTMLButtonElement)) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const direction = event.currentTarget.dataset.hudDirection;
    if (!direction || this.activeKeyboardDirections.has(direction)) {
      return;
    }

    event.preventDefault();
    this.activeKeyboardDirections.add(direction);
    event.currentTarget.classList.add("is-pressed");

    this.callbacks.onMove({
      direction,
      phase: "start",
      source: "keyboard",
    });
  }

  onDpadKeyUp(event) {
    if (!(event.currentTarget instanceof HTMLButtonElement)) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const direction = event.currentTarget.dataset.hudDirection;
    if (!direction) {
      return;
    }

    this.releaseKeyboardDirection(direction);
  }

  onDpadBlur(event) {
    if (!(event.currentTarget instanceof HTMLButtonElement)) {
      return;
    }

    const direction = event.currentTarget.dataset.hudDirection;
    if (!direction) {
      return;
    }

    this.releaseKeyboardDirection(direction);
  }

  releaseKeyboardDirection(direction) {
    if (!this.activeKeyboardDirections.has(direction)) {
      return;
    }

    this.activeKeyboardDirections.delete(direction);
    const button = this.directionButtonById.get(direction);
    button?.classList.remove("is-pressed");

    this.callbacks.onMove({
      direction,
      phase: "end",
      source: "keyboard",
    });
  }

  releaseAllDirections() {
    this.activePointerDirections.forEach((direction) => {
      this.callbacks.onMove({
        direction,
        phase: "end",
        source: "pointer",
      });
    });
    this.activePointerDirections.clear();

    this.activeKeyboardDirections.forEach((direction) => {
      this.callbacks.onMove({
        direction,
        phase: "end",
        source: "keyboard",
      });
    });
    this.activeKeyboardDirections.clear();
  }

  syncTopTabs() {
    this.tabButtonById.forEach((button, tabId) => {
      const selected = tabId === this.activeTabId;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.dataset.selected = selected ? "true" : "false";
    });
  }

  syncTutorial() {
    if (!(this.tutorialElement instanceof HTMLElement)) {
      return;
    }

    const hasText = this.tutorialText.length > 0;
    const visible = this.tutorialVisible && hasText;

    this.tutorialElement.textContent = hasText ? this.tutorialText : "";
    this.tutorialElement.hidden = !visible;
  }

  getTabById(tabId) {
    return this.tabs.find((tab) => tab.id === tabId) ?? null;
  }
}

function buildHudMarkup(tabs, dpadButtons) {
  const topBar = tabs
    .map((tab) => {
      const label = escapeHtml(tab.label ?? tab.id ?? "Tab");
      const ariaLabel = escapeHtml(tab.ariaLabel ?? tab.label ?? tab.id ?? "Tab");
      return `
        <button
          type="button"
          class="game-hud__top-button"
          data-hud-tab="${escapeHtml(tab.id)}"
          aria-label="${ariaLabel}"
        >
          <span class="game-hud__icon-frame">
            ${renderTopIcon(tab.icon)}
          </span>
          <span class="game-hud__top-label">${label}</span>
        </button>
      `;
    })
    .join("");

  const dpad = dpadButtons
    .map((button) => {
      const ariaLabel = escapeHtml(button.ariaLabel ?? button.direction ?? "Direzione");
      const direction = escapeHtml(button.direction ?? "");
      const slot = escapeHtml(button.slot ?? button.direction ?? "center");
      const iconSrc = escapeHtml(button.iconSrc ?? "");

      return `
        <button
          type="button"
          class="game-hud__dpad-button game-hud__dpad-button--${slot}"
          data-hud-direction="${direction}"
          aria-label="${ariaLabel}"
        >
          <span class="game-hud__dpad-icon-frame">
            <img src="${iconSrc}" alt="" draggable="false" />
          </span>
        </button>
      `;
    })
    .join("");

  return `
    <nav class="game-hud__topbar" aria-label="HUD top navigation">
      ${topBar}
    </nav>

    <section class="game-hud__tutorial" data-hud-tutorial role="status" aria-live="polite"></section>

    <section class="game-hud__viewport" aria-label="Area di gioco">
      <div class="game-hud__viewport-surface" aria-hidden="true">
        <div class="game-hud__tile-layer"></div>
        <div class="game-hud__shadow-layer"></div>
        <div class="game-hud__hero" aria-hidden="true">
          <span class="game-hud__hero-head"></span>
          <span class="game-hud__hero-body"></span>
        </div>
      </div>
      <p class="game-hud__viewport-caption">World viewport placeholder</p>
    </section>

    <section class="game-hud__controls" aria-label="Controlli touch">
      <div class="game-hud__dpad" role="group" aria-label="Croce direzionale">
        ${dpad}
      </div>
    </section>
  `;
}

function renderTopIcon(icon) {
  if (!icon || typeof icon !== "object") {
    return `<span class="game-hud__tab-glyph">?</span>`;
  }

  if (icon.type === "image") {
    const src = escapeHtml(icon.src ?? "");
    const alt = escapeHtml(icon.alt ?? "");
    return `<img class="game-hud__top-icon" src="${src}" alt="${alt}" draggable="false" />`;
  }

  const glyph = escapeHtml(icon.glyph ?? "?");
  const style = escapeHtml(icon.style ?? "default");
  return `<span class="game-hud__tab-glyph game-hud__tab-glyph--${style}">${glyph}</span>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function preventDefaultEvent(event) {
  event.preventDefault();
}
