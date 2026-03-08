import { Scene } from "../core/Scene.js";
import { getCutsceneDefinition } from "../data/cutscenes.js";
import { AUTO_SAVE_TRIGGER } from "../data/autoSave.js";

const CUTSCENE_TYPEWRITER_CHARS_PER_SECOND = 42;
const CUTSCENE_SPEAKER_SHAKE_SECONDS = 0.42;
const CUTSCENE_SPEAKER_FADE_SECONDS = 0.32;

export class CutsceneScene extends Scene {
  constructor(game) {
    super(game);

    this.time = 0;
    this.cutscene = createInitialCutsceneState();
    this.speakerImageCache = new Map();
    this.pointerEventsBound = false;
    this.advanceRequested = false;
    this.sourceSceneName = "";

    this.onPointerDown = this.onPointerDown.bind(this);
  }

  onEnter(payload = {}) {
    this.time = 0;
    this.cutscene = createInitialCutsceneState();
    this.advanceRequested = false;
    this.sourceSceneName = String(payload?.sourceSceneName ?? "").trim();
    this.bindPointerEvents();

    const requestedDialogId =
      String(payload?.dialogId ?? "").trim() || String(payload?.cutsceneId ?? "").trim();
    if (!requestedDialogId) {
      this.finish("invalid");
      return;
    }

    if (!this.startCutscene(requestedDialogId)) {
      this.finish("missing");
    }
  }

  onExit() {
    this.unbindPointerEvents();
    this.advanceRequested = false;
  }

  getNavbarLayout() {
    return {
      visible: true,
      topbarVisible: true,
      controlsVisible: false,
      visibleTabIds: ["slot_b"],
      activeTabId: "slot_b",
    };
  }

  closeFromNavbar() {
    this.finish("skipped");
  }

  bindPointerEvents() {
    if (this.pointerEventsBound) {
      return;
    }

    const canvas = this.game?.canvas;
    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }

    canvas.addEventListener("pointerdown", this.onPointerDown);
    this.pointerEventsBound = true;
  }

  unbindPointerEvents() {
    if (!this.pointerEventsBound) {
      return;
    }

    const canvas = this.game?.canvas;
    if (!(canvas instanceof HTMLCanvasElement)) {
      this.pointerEventsBound = false;
      return;
    }

    canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.pointerEventsBound = false;
  }

  onPointerDown(event) {
    this.advanceRequested = true;
    event.preventDefault();
  }

  startCutscene(cutsceneId) {
    const definition = getCutsceneDefinition(cutsceneId);
    if (!definition) {
      return false;
    }

    const lines = normalizeCutsceneLines(definition.lines).map((line) =>
      parseCutsceneLineWithCommands(line),
    );
    if (lines.length <= 0) {
      return false;
    }

    const speakerId = sanitizeSpeakerId(definition.speakerId);
    const fallbackSpeakerName = String(definition.speakerName ?? "").trim() || "NARRATORE";
    const speakerName =
      this.getPersistedSpeakerLabel(speakerId) || fallbackSpeakerName;
    const speakerAssetPath = String(definition.speakerAssetPath ?? "").trim();
    const speakerImage = this.resolveSpeakerImage(speakerAssetPath);
    this.cutscene = {
      active: true,
      id: String(definition.id ?? cutsceneId),
      speakerId,
      speakerName,
      speakerAssetPath,
      speakerImage,
      lines,
      lineIndex: 0,
      revealedChars: 0,
      revealAccumulator: 0,
      lineCompleted: false,
      speakerShakeTtl: CUTSCENE_SPEAKER_SHAKE_SECONDS,
      speakerFadeElapsed: 0,
      speakerFadeCompleted: false,
      speakerVisible: Boolean(speakerAssetPath),
    };
    return true;
  }

  resolveSpeakerImage(assetPath) {
    const safePath = String(assetPath ?? "").trim();
    if (!safePath) {
      return null;
    }

    if (this.speakerImageCache.has(safePath)) {
      return this.speakerImageCache.get(safePath) ?? null;
    }

    const image = createUiImage(safePath);
    this.speakerImageCache.set(safePath, image);
    return image;
  }

  update(dt, input) {
    this.time += dt;
    if (!this.cutscene.active) {
      this.finish("completed");
      return;
    }

    const requestedAdvance =
      input.wasPressed("confirm") || input.wasPressed("back") || this.advanceRequested;
    this.advanceRequested = false;

    this.cutscene.speakerShakeTtl = Math.max(0, this.cutscene.speakerShakeTtl - dt);
    if (!this.cutscene.speakerFadeCompleted && isUiImageUsable(this.cutscene.speakerImage)) {
      this.cutscene.speakerFadeElapsed = Math.min(
        CUTSCENE_SPEAKER_FADE_SECONDS,
        this.cutscene.speakerFadeElapsed + dt,
      );
      if (this.cutscene.speakerFadeElapsed >= CUTSCENE_SPEAKER_FADE_SECONDS) {
        this.cutscene.speakerFadeCompleted = true;
      }
    }
    const currentLine = this.cutscene.lines[this.cutscene.lineIndex] ?? createEmptyCutsceneLine();
    const currentText = currentLine.text;

    if (!this.cutscene.lineCompleted) {
      if (requestedAdvance) {
        this.cutscene.revealedChars = currentText.length;
        this.cutscene.revealAccumulator = 0;
        this.cutscene.lineCompleted = true;
        return;
      }

      this.cutscene.revealAccumulator += dt * CUTSCENE_TYPEWRITER_CHARS_PER_SECOND;
      const nextChars = Math.floor(this.cutscene.revealAccumulator);
      if (nextChars > 0) {
        this.cutscene.revealAccumulator -= nextChars;
        this.cutscene.revealedChars = Math.min(
          currentText.length,
          this.cutscene.revealedChars + nextChars,
        );
      }
      if (this.cutscene.revealedChars >= currentText.length) {
        this.cutscene.lineCompleted = true;
      }
      return;
    }

    if (!requestedAdvance) {
      return;
    }

    this.applyCurrentLineCommands(currentLine);

    if (this.cutscene.lineIndex >= this.cutscene.lines.length - 1) {
      this.finish("completed");
      return;
    }

    this.cutscene.lineIndex += 1;
    this.cutscene.revealedChars = 0;
    this.cutscene.revealAccumulator = 0;
    this.cutscene.lineCompleted = false;
    this.cutscene.speakerShakeTtl = CUTSCENE_SPEAKER_SHAKE_SECONDS;
  }

  render(ctx) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;
    if (!this.cutscene.active) {
      return;
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    this.drawSpeaker(ctx, canvasWidth, canvasHeight);
    this.drawDialoguePanel(ctx, canvasWidth, canvasHeight);
    ctx.restore();
  }

  drawSpeaker(ctx, canvasWidth, canvasHeight) {
    if (!this.cutscene.speakerVisible) {
      return;
    }

    const image = this.cutscene.speakerImage;
    if (!isUiImageUsable(image)) {
      return;
    }

    const sourceW = image.naturalWidth || image.width;
    const sourceH = image.naturalHeight || image.height;
    if (sourceW <= 0 || sourceH <= 0) {
      return;
    }

    let frameW = sourceW;
    let frameX = 0;
    const probableFrameWidth = Math.floor(sourceW / 4);
    if (probableFrameWidth > 0 && sourceW >= sourceH * 2) {
      frameW = probableFrameWidth;
      frameX = 0;
    }

    const panel = getCutscenePanelRect(canvasWidth, canvasHeight);
    const targetHeight = Math.max(84, Math.round(canvasHeight * 0.42));
    const targetWidth = Math.max(56, Math.round((targetHeight * frameW) / Math.max(1, sourceH)));
    const shakeRatio = this.cutscene.speakerShakeTtl / CUTSCENE_SPEAKER_SHAKE_SECONDS;
    const shakePower = Math.max(0, Math.min(1, shakeRatio));
    const shakeX = Math.sin(this.time * 74) * 8.5 * shakePower;
    const shakeY = Math.cos(this.time * 61) * 2.8 * shakePower;
    const drawX = Math.round((canvasWidth - targetWidth) * 0.5 + shakeX);
    const drawY = Math.round(panel.y - targetHeight + shakeY);
    const fadeRatio =
      this.cutscene.speakerFadeCompleted
        ? 1
        : clampNumber(this.cutscene.speakerFadeElapsed / CUTSCENE_SPEAKER_FADE_SECONDS, 0, 1);

    ctx.save();
    ctx.globalAlpha = fadeRatio;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, frameX, 0, frameW, sourceH, drawX, drawY, targetWidth, targetHeight);
    ctx.restore();
  }

  drawDialoguePanel(ctx, canvasWidth, canvasHeight) {
    const panel = getCutscenePanelRect(canvasWidth, canvasHeight);
    const panelX = panel.x;
    const panelY = panel.y;
    const panelW = panel.w;
    const panelH = panel.h;
    const line = this.cutscene.lines[this.cutscene.lineIndex] ?? createEmptyCutsceneLine();
    const visibleText = line.text.slice(0, this.cutscene.revealedChars);

    const gradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
    gradient.addColorStop(0, "rgb(30, 48, 76)");
    gradient.addColorStop(1, "rgb(12, 24, 42)");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "#d79a4a";
    ctx.lineWidth = 2;
    roundRect(ctx, panelX, panelY, panelW, panelH, 10);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#40230e";
    ctx.lineWidth = 1;
    roundRect(ctx, panelX + 1, panelY + 1, panelW - 2, panelH - 2, 9);
    ctx.stroke();

    ctx.fillStyle = "#f6ecd2";
    const speakerFontSize = Math.max(6, Math.round(panelH * 0.13));
    ctx.font = `${speakerFontSize}px monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const speakerY = panelY + 9;
    ctx.fillText(this.cutscene.speakerName, panelX + 8, speakerY);

    ctx.fillStyle = "#f4e8cc";
    const dialogFontSize = Math.max(6, Math.round(panelH * 0.13));
    const dialogLineHeight = Math.max(8, Math.round(dialogFontSize * 1.3));
    ctx.font = `${dialogFontSize}px monospace`;
    const textStartX = panelX + 8;
    const textStartY = Math.round(speakerY + speakerFontSize + 10);
    const textMaxWidth = panelW - 16;
    const textBottomPadding = 7;
    const textMaxHeight = Math.max(8, panelY + panelH - textBottomPadding - textStartY);
    const maxLines = Math.max(1, Math.floor(textMaxHeight / dialogLineHeight));
    const wrapped = wrapCutsceneText(ctx, visibleText, textMaxWidth);
    const clippedLines = wrapped.slice(0, maxLines);
    if (wrapped.length > maxLines && clippedLines.length > 0) {
      const lastIndex = clippedLines.length - 1;
      clippedLines[lastIndex] = clipLineWithEllipsis(ctx, clippedLines[lastIndex], textMaxWidth);
    }
    clippedLines.forEach((textLine, index) => {
      ctx.fillText(textLine, textStartX, textStartY + index * dialogLineHeight);
    });

    if (!this.cutscene.lineCompleted) {
      return;
    }

    const blinkOn = Math.floor(this.time * 2.5) % 2 === 0;
    if (!blinkOn) {
      return;
    }
    ctx.fillStyle = "#f6ecd2";
    const arrowX = panelX + panelW - 12;
    const arrowY = panelY + panelH - 8;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX + 6, arrowY);
    ctx.lineTo(arrowX + 3, arrowY + 4);
    ctx.closePath();
    ctx.fill();
  }

  finish(reason) {
    const safeReason = String(reason || "").trim() || "completed";
    if (safeReason === "completed" || safeReason === "skipped") {
      const autoSaveQueued = this.triggerAutoSave(
        AUTO_SAVE_TRIGGER.MANUAL,
        {
          source: "cutscene",
          cutsceneId: this.cutscene.id || "",
          reason: safeReason,
        },
        { immediate: true },
      );
      if (!autoSaveQueued && this.game && typeof this.game.saveToSlot === "function") {
        this.game.saveToSlot(0);
      }
    }

    const payload = {
      reason: safeReason,
      cutsceneId: this.cutscene.id || "",
      sourceSceneName: this.sourceSceneName,
    };
    this.cutscene = createInitialCutsceneState();
    this.game.closeOverlayScene(payload);
  }

  getPersistedSpeakerLabel(speakerId) {
    const safeSpeakerId = sanitizeSpeakerId(speakerId);
    if (!safeSpeakerId) {
      return "";
    }
    const store = this.ensureSpeakerLabelStore();
    return toSpeakerLabel(store[safeSpeakerId] ?? "");
  }

  applyCurrentLineCommands(line) {
    if (!line || typeof line !== "object") {
      return;
    }

    if (line.showSpeaker === true) {
      this.cutscene.speakerVisible = true;
      this.cutscene.speakerFadeElapsed = 0;
      this.cutscene.speakerFadeCompleted = false;
    } else if (line.hideSpeaker === true) {
      this.cutscene.speakerVisible = false;
    }

    const nextLabel = toSpeakerLabel(line.updateLabel ?? "");
    if (!nextLabel) {
      return;
    }

    this.cutscene.speakerName = nextLabel;
    const safeSpeakerId = sanitizeSpeakerId(this.cutscene.speakerId);
    if (!safeSpeakerId) {
      return;
    }

    const store = this.ensureSpeakerLabelStore();
    store[safeSpeakerId] = nextLabel;
  }

  ensureSpeakerLabelStore() {
    const progress = this.game?.state?.progress;
    if (!progress || typeof progress !== "object") {
      return {};
    }

    if (
      !progress.cutsceneSpeakerLabels ||
      typeof progress.cutsceneSpeakerLabels !== "object" ||
      Array.isArray(progress.cutsceneSpeakerLabels)
    ) {
      progress.cutsceneSpeakerLabels = {};
    }

    return progress.cutsceneSpeakerLabels;
  }
}

function createInitialCutsceneState() {
  return {
    active: false,
    id: "",
    speakerId: "",
    speakerName: "",
    speakerAssetPath: "",
    speakerImage: null,
    lines: [],
    lineIndex: 0,
    revealedChars: 0,
    revealAccumulator: 0,
    lineCompleted: false,
    speakerShakeTtl: 0,
    speakerFadeElapsed: 0,
    speakerFadeCompleted: false,
    speakerVisible: false,
  };
}

function createEmptyCutsceneLine() {
  return {
    text: "",
    updateLabel: "",
    showSpeaker: false,
    hideSpeaker: false,
  };
}

function getCutscenePanelRect(canvasWidth, canvasHeight) {
  const panelHeight = Math.max(58, Math.round(canvasHeight * 0.18));
  return {
    x: 0,
    y: canvasHeight - panelHeight - 18,
    w: canvasWidth,
    h: panelHeight,
  };
}

function normalizeCutsceneLines(rawLines) {
  if (!Array.isArray(rawLines)) {
    return [];
  }
  return rawLines
    .map((line) => String(line ?? "").trim())
    .filter((line) => line.length > 0);
}

function parseCutsceneLineWithCommands(line) {
  const rawLine = String(line ?? "");
  let updateLabel = "";
  let showSpeaker = false;
  let hideSpeaker = false;

  const commandPattern = /\[(npc_show|npc_hide|label_update=[^\]]+)\]/gi;
  Array.from(rawLine.matchAll(commandPattern)).forEach((match) => {
    const rawCommand = String(match[1] ?? "").trim();
    const normalizedCommand = rawCommand.toLowerCase();
    if (normalizedCommand === "npc_show") {
      showSpeaker = true;
      hideSpeaker = false;
      return;
    }
    if (normalizedCommand === "npc_hide") {
      hideSpeaker = true;
      showSpeaker = false;
      return;
    }
    if (normalizedCommand.startsWith("label_update=")) {
      updateLabel = toSpeakerLabel(rawCommand.slice("label_update=".length));
    }
  });

  const text = rawLine.replace(commandPattern, "").replace(/\s+/g, " ").trim();
  return {
    text,
    updateLabel,
    showSpeaker,
    hideSpeaker,
  };
}

function toSpeakerLabel(value) {
  return String(value ?? "").trim().toLocaleUpperCase("it-IT");
}

function sanitizeSpeakerId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function wrapCutsceneText(ctx, text, maxWidth) {
  const safeWidth = Math.max(1, Math.floor(Number(maxWidth) || 1));
  const source = String(text ?? "");
  if (!source.trim()) {
    return [];
  }

  const lines = [];
  const paragraphs = source.split(/\r?\n/);
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const words = String(paragraph ?? "")
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    if (words.length <= 0) {
      if (paragraphIndex < paragraphs.length - 1) {
        lines.push("");
      }
      return;
    }

    let current = "";
    words.forEach((word) => {
      const chunks = splitTokenByWidth(ctx, word, safeWidth);
      chunks.forEach((chunk) => {
        const candidate = current.length > 0 ? `${current} ${chunk}` : chunk;
        if (ctx.measureText(candidate).width <= safeWidth) {
          current = candidate;
          return;
        }

        if (current.length > 0) {
          lines.push(current);
        }
        current = chunk;
      });
    });

    if (current.length > 0) {
      lines.push(current);
    }
    if (paragraphIndex < paragraphs.length - 1) {
      lines.push("");
    }
  });

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function splitTokenByWidth(ctx, token, maxWidth) {
  const value = String(token ?? "");
  if (!value) {
    return [];
  }
  if (ctx.measureText(value).width <= maxWidth) {
    return [value];
  }

  const chunks = [];
  let current = "";
  Array.from(value).forEach((character) => {
    const candidate = `${current}${character}`;
    if (current.length > 0 && ctx.measureText(candidate).width > maxWidth) {
      chunks.push(current);
      current = character;
      return;
    }
    current = candidate;
  });

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function clipLineWithEllipsis(ctx, line, maxWidth) {
  const safeLine = String(line ?? "");
  const safeWidth = Math.max(1, Math.floor(Number(maxWidth) || 1));
  if (ctx.measureText(safeLine).width <= safeWidth) {
    return safeLine;
  }

  const ellipsis = "...";
  if (ctx.measureText(ellipsis).width > safeWidth) {
    return "";
  }

  let clipped = safeLine;
  while (clipped.length > 0 && ctx.measureText(`${clipped}${ellipsis}`).width > safeWidth) {
    clipped = clipped.slice(0, -1);
  }

  return `${clipped}${ellipsis}`;
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width * 0.5, height * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function createUiImage(relativePath) {
  if (typeof Image === "undefined") {
    return null;
  }

  const imageUrl = buildVersionedAssetUrl(relativePath);
  const image = new Image();
  image.decoding = "async";
  image.__agoadLoadState = "loading";
  image.addEventListener("load", () => {
    image.__agoadLoadState = "ready";
  });
  image.addEventListener("error", () => {
    image.__agoadLoadState = "error";
  });
  image.src = imageUrl.toString();
  return image;
}

function buildVersionedAssetUrl(relativePath) {
  const version = new URL(import.meta.url).searchParams.get("v");
  const assetUrl = new URL(relativePath, import.meta.url);
  if (version) {
    assetUrl.searchParams.set("v", version);
  }
  return assetUrl;
}

function isUiImageUsable(image) {
  return Boolean(image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}
