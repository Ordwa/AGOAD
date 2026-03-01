import {
  HUD_ACTION_BUTTON,
  HUD_DEFAULT_ACTIVE_TAB,
  HUD_DEFAULT_TUTORIAL,
  HUD_DPAD_BUTTONS,
  HUD_TOP_TABS,
} from "./hudConfig.js";

const NOOP = () => {};
const POINTER_END_EVENTS = ["pointerup", "pointercancel", "pointerleave"];
const DPAD_DIAMOND_HIT_THRESHOLD = 0.7;

export class ConsoleShellHud {
  constructor({
    root,
    tabs = HUD_TOP_TABS,
    dpadButtons = HUD_DPAD_BUTTONS,
    actionButton = HUD_ACTION_BUTTON,
    activeTabId = HUD_DEFAULT_ACTIVE_TAB,
    tutorialText = HUD_DEFAULT_TUTORIAL,
    tutorialVisible = true,
    enableTabTutorial = false,
    visible = true,
    callbacks = {},
  } = {}) {
    this.root = root;
    this.tabs = Array.isArray(tabs) ? tabs : HUD_TOP_TABS;
    this.dpadButtons = Array.isArray(dpadButtons) ? dpadButtons : HUD_DPAD_BUTTONS;
    this.actionButton = actionButton && typeof actionButton === "object" ? actionButton : HUD_ACTION_BUTTON;
    this.activeTabId = activeTabId;
    this.tutorialText = String(tutorialText ?? "").trim();
    this.tutorialVisible = Boolean(tutorialVisible);
    this.enableTabTutorial = Boolean(enableTabTutorial);
    this.visible = Boolean(visible);
    this.topbarVisible = true;
    this.controlsVisible = true;
    this.visibleTabIds = new Set(
      this.tabs
        .map((tab) => String(tab?.id ?? "").trim())
        .filter((tabId) => tabId.length > 0),
    );

    this.callbacks = {
      onTabChange: NOOP,
      onMenuOpen: NOOP,
      onMove: NOOP,
      onAction: NOOP,
      onTutorialChange: NOOP,
      ...callbacks,
    };

    this.tabButtonById = new Map();
    this.directionButtonById = new Map();
    this.actionControlButtons = [];
    this.activePointerDirections = new Map();
    this.activeKeyboardDirections = new Set();

    this.tutorialElement = null;
    this.topbarShellElement = null;
    this.controlsElement = null;

    this.onTopButtonPressStart = this.onTopButtonPressStart.bind(this);
    this.onTopButtonPressEnd = this.onTopButtonPressEnd.bind(this);
    this.onTopButtonClick = this.onTopButtonClick.bind(this);

    this.onDpadPointerDown = this.onDpadPointerDown.bind(this);
    this.onDpadPointerEnd = this.onDpadPointerEnd.bind(this);
    this.onDpadKeyDown = this.onDpadKeyDown.bind(this);
    this.onDpadKeyUp = this.onDpadKeyUp.bind(this);
    this.onDpadBlur = this.onDpadBlur.bind(this);

    this.onActionPointerDown = this.onActionPointerDown.bind(this);
    this.onActionPointerUp = this.onActionPointerUp.bind(this);
    this.onActionKeyDown = this.onActionKeyDown.bind(this);
  }

  mount() {
    if (!(this.root instanceof HTMLElement)) {
      throw new Error("Root console shell non valido.");
    }

    this.root.innerHTML = buildConsoleShellMarkup(this.tabs, this.dpadButtons, this.actionButton);
    this.root.classList.add("game-hud");
    this.root.classList.add("game-console-shell");

    this.tutorialElement = this.root.querySelector("[data-hud-tutorial]");
    this.topbarShellElement = this.root.querySelector("[data-hud-topbar-shell]");
    this.controlsElement = this.root.querySelector("[data-hud-controls]");

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

    this.actionControlButtons = Array.from(this.root.querySelectorAll("[data-hud-action]"));
    this.actionControlButtons.forEach((button) => {
      button.addEventListener("pointerdown", this.onActionPointerDown);
      button.addEventListener("pointerup", this.onActionPointerUp);
      button.addEventListener("pointercancel", this.onActionPointerUp);
      button.addEventListener("pointerleave", this.onActionPointerUp);
      button.addEventListener("keydown", this.onActionKeyDown);
      button.addEventListener("contextmenu", preventDefaultEvent);
    });

    if (!this.tabButtonById.has(this.activeTabId)) {
      const fallbackTab = this.tabs[0]?.id ?? "";
      this.activeTabId = fallbackTab;
    }

    this.syncTopTabs();
    this.syncTopbarVisibility();
    this.syncControlsVisibility();
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

    this.actionControlButtons.forEach((button) => {
      button.removeEventListener("pointerdown", this.onActionPointerDown);
      button.removeEventListener("pointerup", this.onActionPointerUp);
      button.removeEventListener("pointercancel", this.onActionPointerUp);
      button.removeEventListener("pointerleave", this.onActionPointerUp);
      button.removeEventListener("keydown", this.onActionKeyDown);
      button.removeEventListener("contextmenu", preventDefaultEvent);
    });
    this.actionControlButtons = [];

    this.releaseAllDirections();
    this.root.innerHTML = "";
    this.root.classList.remove("game-hud");
    this.root.classList.remove("game-console-shell");
    this.tabButtonById.clear();
    this.directionButtonById.clear();
    this.tutorialElement = null;
    this.topbarShellElement = null;
    this.controlsElement = null;
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
      this.actionControlButtons.forEach((button) => {
        button.classList.remove("is-pressed");
      });
    }
  }

  setTopbarVisible(visible) {
    this.topbarVisible = Boolean(visible);
    this.syncTopbarVisibility();
  }

  setControlsVisible(visible) {
    this.controlsVisible = Boolean(visible);
    this.syncControlsVisibility();
  }

  setVisibleTabIds(tabIds = []) {
    const nextVisibleTabIds = new Set(
      (Array.isArray(tabIds) ? tabIds : [])
        .map((tabId) => String(tabId ?? "").trim())
        .filter((tabId) => tabId.length > 0),
    );
    this.visibleTabIds = nextVisibleTabIds;
    this.syncTopTabs();
  }

  applyLayout(layout = {}) {
    const visibleTabIds = Array.isArray(layout.visibleTabIds)
      ? layout.visibleTabIds
      : this.tabs.map((tab) => tab.id);
    this.setVisibleTabIds(visibleTabIds);
    this.setTopbarVisible(layout.topbarVisible !== false);
    this.setControlsVisible(layout.controlsVisible !== false);

    if (typeof layout.activeTabId === "string" && layout.activeTabId.length > 0) {
      this.setActiveTab(layout.activeTabId, { emit: false });
    } else {
      this.syncTopTabs();
    }
  }

  onActionPointerDown(event) {
    if (!(event.currentTarget instanceof HTMLButtonElement)) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const action = event.currentTarget.dataset.hudAction;
    if (!action) {
      return;
    }

    event.preventDefault();
    event.currentTarget.classList.add("is-pressed");
    this.callbacks.onAction({
      action,
      source: "pointer",
    });
  }

  onActionPointerUp(event) {
    if (!(event.currentTarget instanceof HTMLButtonElement)) {
      return;
    }

    event.currentTarget.classList.remove("is-pressed");
  }

  onActionKeyDown(event) {
    if (!(event.currentTarget instanceof HTMLButtonElement)) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const action = event.currentTarget.dataset.hudAction;
    if (!action) {
      return;
    }

    event.preventDefault();
    event.currentTarget.classList.add("is-pressed");
    this.callbacks.onAction({
      action,
      source: "keyboard",
    });
    window.setTimeout(() => {
      event.currentTarget.classList.remove("is-pressed");
    }, 120);
  }

  onTopButtonPressStart(event) {
    if (!(event.currentTarget instanceof HTMLButtonElement)) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.preventDefault();
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
    if (this.enableTabTutorial && tab?.tutorialText) {
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

    if (this.activePointerDirections.has(event.pointerId)) {
      return;
    }

    const hit = this.resolveDpadHit(event);
    if (!hit) {
      return;
    }

    event.preventDefault();
    const { direction, button } = hit;
    button.setPointerCapture?.(event.pointerId);
    this.activePointerDirections.set(event.pointerId, {
      direction,
      button,
    });
    button.classList.add("is-pressed");

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

    const pointerState = this.activePointerDirections.get(event.pointerId);
    if (!pointerState) {
      return;
    }

    this.activePointerDirections.delete(event.pointerId);
    pointerState.button.releasePointerCapture?.(event.pointerId);
    pointerState.button.classList.remove("is-pressed");

    this.callbacks.onMove({
      direction: pointerState.direction,
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
    this.activePointerDirections.forEach((pointerState, pointerId) => {
      pointerState.button?.releasePointerCapture?.(pointerId);
      pointerState.button?.classList.remove("is-pressed");
      this.callbacks.onMove({
        direction: pointerState.direction,
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
    const visibleTabs = [];

    this.tabButtonById.forEach((button, tabId) => {
      const isTabVisible = this.visibleTabIds.has(tabId);
      button.hidden = !isTabVisible;
      button.classList.toggle("is-hidden-by-layout", !isTabVisible);
      if (isTabVisible) {
        visibleTabs.push(tabId);
      }

      const selected = tabId === this.activeTabId;
      const canSelect = isTabVisible && selected;
      button.classList.toggle("is-selected", canSelect);
      button.setAttribute("aria-pressed", String(canSelect));
      button.dataset.selected = canSelect ? "true" : "false";
    });

    const visibleTabsCount = Math.max(1, visibleTabs.length);
    this.root.style.setProperty("--hud-visible-tabs", String(visibleTabsCount));

    if (!this.visibleTabIds.has(this.activeTabId)) {
      const fallbackTabId = visibleTabs[0] ?? "";
      if (fallbackTabId.length > 0) {
        this.activeTabId = fallbackTabId;
      }
    }

    this.tabButtonById.forEach((button, tabId) => {
      const selected = tabId === this.activeTabId && !button.hidden;
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

  syncTopbarVisibility() {
    if (!(this.topbarShellElement instanceof HTMLElement)) {
      return;
    }
    this.topbarShellElement.hidden = !this.topbarVisible;
  }

  syncControlsVisibility() {
    if (!(this.controlsElement instanceof HTMLElement)) {
      return;
    }
    this.controlsElement.hidden = !this.controlsVisible;
  }

  resolveDpadHit(event) {
    let bestHit = null;

    this.directionButtonById.forEach((button, direction) => {
      const score = getDiamondHitScore(button, event);
      if (score > DPAD_DIAMOND_HIT_THRESHOLD) {
        return;
      }

      if (!bestHit || score < bestHit.score) {
        bestHit = {
          direction,
          button,
          score,
        };
      }
    });

    if (!bestHit) {
      return null;
    }

    return {
      direction: bestHit.direction,
      button: bestHit.button,
    };
  }
}

function buildConsoleShellMarkup(tabs, dpadButtons, actionButton) {
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
        <div class="game-hud__dpad-key game-hud__dpad-key--${slot}">
          <button
            type="button"
            class="game-hud__dpad-hitbox"
            data-hud-direction="${direction}"
            aria-label="${ariaLabel}"
          ></button>
          <span class="game-hud__dpad-icon-frame">
            <img src="${iconSrc}" alt="" draggable="false" />
          </span>
        </div>
      `;
    })
    .join("");

  const actionMarkup = renderActionButton(actionButton);

  return `
    <section class="game-hud__topbar-shell" data-hud-topbar-shell>
      <nav class="game-hud__topbar" aria-label="Console shell top navigation" data-hud-topbar>
        ${topBar}
      </nav>
    </section>

    <section class="game-hud__tutorial" data-hud-tutorial role="status" aria-live="polite"></section>

    <section
      class="game-hud__viewport game-hud__screen-window"
      data-console-screen-window
      aria-label="Game Boy screen window"
    >
      <div class="game-hud__viewport-surface" aria-hidden="true"></div>
      <p class="game-hud__viewport-caption">Game screen placeholder</p>
    </section>

    <section class="game-hud__controls" data-hud-controls aria-label="Controlli console shell">
      ${actionMarkup}
      <div class="game-hud__dpad" role="group" aria-label="Croce direzionale">
        ${dpad}
      </div>
    </section>
  `;
}

function renderActionButton(actionButton) {
  if (!actionButton || typeof actionButton !== "object") {
    return "";
  }

  const action = escapeHtml(actionButton.action ?? "confirm");
  const ariaLabel = escapeHtml(actionButton.ariaLabel ?? "Azione");
  const iconSrc = escapeHtml(actionButton.iconSrc ?? "");

  return `
    <button
      type="button"
      class="game-hud__action-button"
      data-hud-action="${action}"
      aria-label="${ariaLabel}"
    >
      <span class="game-hud__action-icon-frame">
        <img src="${iconSrc}" alt="" draggable="false" />
      </span>
    </button>
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

function getDiamondHitScore(button, event) {
  if (!(button instanceof HTMLElement)) {
    return Number.POSITIVE_INFINITY;
  }

  const rect = button.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const localX = event.clientX - rect.left;
  const localY = event.clientY - rect.top;

  if (localX < 0 || localX > rect.width || localY < 0 || localY > rect.height) {
    return Number.POSITIVE_INFINITY;
  }

  const normalizedX = Math.abs((localX / rect.width) * 2 - 1);
  const normalizedY = Math.abs((localY / rect.height) * 2 - 1);
  return normalizedX + normalizedY;
}

export { ConsoleShellHud as GameHud };
