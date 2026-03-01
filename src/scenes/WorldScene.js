import { Scene } from "../core/Scene.js";
import {
  MAP_LAYOUT,
  WORLD_MAP,
  WORLD_POINTS,
  getTileAt,
  isInsideMap,
  isWalkableTile,
} from "../data/map.js";

const MOVE_DURATION_SECONDS = 0.35;
const CAMERA_VIEW_HEIGHT_RATIO = 0.5;
const CAMERA_ZOOM_MIN = 1.45;
const CAMERA_ZOOM_MAX = 3.8;
const INTERACTION_MESSAGE_SECONDS = 2.4;
const PLAYER_DRAW_SIZE_TILES = 0.5;
const NPC_DRAW_SIZE_TILES = 1;
const PLAYER_SPRITE_FRAME_WIDTH = 58;
const PLAYER_SPRITE_FRAME_HEIGHT = 76;
const PLAYER_SPRITE_HEIGHT_RATIO = PLAYER_SPRITE_FRAME_HEIGHT / PLAYER_SPRITE_FRAME_WIDTH;
const PLAYER_IDLE_FRAME_COUNT = 4;
const PLAYER_IDLE_FPS = 5;

const MOVE_PRIORITY = Object.freeze(["up", "down", "left", "right"]);
const DIRECTION_STEP = Object.freeze({
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
});

const DEFAULT_SPAWN = Object.freeze({
  x: WORLD_POINTS.playerSpawn?.x ?? 8,
  y: WORLD_POINTS.playerSpawn?.y ?? 8,
  facing: WORLD_POINTS.playerSpawn?.facing ?? "down",
});

export class WorldScene extends Scene {
  constructor(game) {
    super(game);

    this.time = 0;
    this.mapImage = createUiImage("../assets/map_village.png");
    this.playerSpriteSheetImage = createUiImage("../assets/sprite_sheet.png");
    this.playerIdleFrames = [];
    this.playerIdleFramesReady = false;

    this.npcs = (WORLD_POINTS.npcs ?? []).map((npc) => ({
      ...npc,
      dialogIndex: 0,
    }));
    this.interactionPoints = [...(WORLD_POINTS.interactionPoints ?? [])];

    this.player = {
      tileX: DEFAULT_SPAWN.x,
      tileY: DEFAULT_SPAWN.y,
      worldX: tileToWorldX(DEFAULT_SPAWN.x),
      worldY: tileToWorldY(DEFAULT_SPAWN.y),
      facing: normalizeFacing(DEFAULT_SPAWN.facing),
      move: null,
    };
    this.turnBufferDirection = "";

    this.worldMessage = {
      text: "",
      ttl: 0,
    };
  }

  onEnter() {
    this.time = 0;
    this.worldMessage.text = "";
    this.worldMessage.ttl = 0;
    this.turnBufferDirection = "";
    this.syncPlayerFromPersistentState();
    this.ensurePlayerIdleFrames();
  }

  update(dt, input) {
    this.time += dt;
    this.ensurePlayerIdleFrames();
    this.updateMessageTimer(dt);

    if (input.wasPressed("profile")) {
      this.game.changeScene("profile", {
        returnScene: "world",
      });
      return;
    }

    if (input.wasPressed("inventory")) {
      this.game.changeScene("inventory", {
        returnScene: "world",
      });
      return;
    }

    if (input.wasPressed("back")) {
      this.game.changeScene("start", { startMode: "main" });
      return;
    }

    if (input.wasPressed("confirm")) {
      this.tryInteract();
    }

    if (!isUiImageUsable(this.mapImage)) {
      return;
    }

    const pressedDirection = resolvePressedDirection(input);
    if (pressedDirection) {
      this.turnBufferDirection = pressedDirection;
    }

    if (this.player.move) {
      this.advancePlayerMove(dt);
      // If a move just finished this frame, allow immediate chaining.
      if (this.player.move) {
        return;
      }
    }

    if (this.turnBufferDirection) {
      const bufferedDirection = this.turnBufferDirection;
      this.turnBufferDirection = "";
      if (this.tryStartPlayerMove(bufferedDirection, input.isPressed(bufferedDirection))) {
        return;
      }
    }

    const heldDirection = resolveHeldDirection(input);
    if (!heldDirection) {
      return;
    }

    this.tryStartPlayerMove(heldDirection, true);
  }

  render(ctx) {
    const canvasWidth = this.game.canvas.width;
    const canvasHeight = this.game.canvas.height;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (!isUiImageSettled(this.mapImage) || !isUiImageSettled(this.playerSpriteSheetImage)) {
      drawLoading(ctx, canvasWidth, canvasHeight, this.time);
      ctx.restore();
      return;
    }

    if (!isUiImageUsable(this.mapImage)) {
      ctx.fillStyle = "#0f1116";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.restore();
      return;
    }

    const camera = this.computeCamera(canvasWidth, canvasHeight);
    drawCameraView(ctx, this.mapImage, camera, canvasWidth, canvasHeight);

    this.drawNpcMarkers(ctx, camera, canvasWidth, canvasHeight);
    this.drawPlayer(ctx, camera.zoom, canvasWidth, canvasHeight);
    drawWorldMessage(ctx, this.worldMessage.text, this.worldMessage.ttl, canvasWidth, canvasHeight);

    ctx.restore();
  }

  computeCamera(canvasWidth, canvasHeight) {
    const mapHeight = this.mapImage.naturalHeight || MAP_LAYOUT.rows * MAP_LAYOUT.tileSize;
    const zoom = computeCameraZoom(canvasWidth, canvasHeight, mapHeight);
    const viewWidth = canvasWidth / zoom;
    const viewHeight = canvasHeight / zoom;

    return {
      zoom,
      viewWidth,
      viewHeight,
      sourceX: this.player.worldX - viewWidth * 0.5,
      sourceY: this.player.worldY - viewHeight * 0.5,
    };
  }

  drawPlayer(ctx, zoom, canvasWidth, canvasHeight) {
    const playerFrame = this.getCurrentPlayerIdleFrame();
    const canUseSpriteSheet = isUiImageUsable(this.playerSpriteSheetImage);
    if (!playerFrame && !canUseSpriteSheet) {
      return;
    }

    const drawWidth = MAP_LAYOUT.tileSize * PLAYER_DRAW_SIZE_TILES * zoom;
    const drawHeight = drawWidth * PLAYER_SPRITE_HEIGHT_RATIO;
    const feetOffset = MAP_LAYOUT.tileSize * 0.1 * zoom;

    const screenX = canvasWidth * 0.5;
    const screenY = canvasHeight * 0.5 + feetOffset;
    const drawX = Math.round(screenX - drawWidth * 0.5);
    const drawY = Math.round(screenY - drawHeight);
    const drawWidthRounded = Math.round(drawWidth);
    const drawHeightRounded = Math.round(drawHeight);

    ctx.imageSmoothingEnabled = false;
    if (playerFrame) {
      ctx.drawImage(playerFrame, drawX, drawY, drawWidthRounded, drawHeightRounded);
      return;
    }

    ctx.drawImage(
      this.playerSpriteSheetImage,
      0,
      0,
      PLAYER_SPRITE_FRAME_WIDTH,
      PLAYER_SPRITE_FRAME_HEIGHT,
      drawX,
      drawY,
      drawWidthRounded,
      drawHeightRounded,
    );
  }

  drawNpcMarkers(ctx, camera, canvasWidth, canvasHeight) {
    const npcFrame = this.playerIdleFrames[0] ?? null;
    const canUseSpriteSheet = isUiImageUsable(this.playerSpriteSheetImage);
    if (!npcFrame && !canUseSpriteSheet) {
      return;
    }

    const drawWidth = Math.round(MAP_LAYOUT.tileSize * NPC_DRAW_SIZE_TILES * camera.zoom);
    const drawHeight = Math.round(drawWidth * PLAYER_SPRITE_HEIGHT_RATIO);
    ctx.imageSmoothingEnabled = false;

    this.npcs.forEach((npc) => {
      const worldX = tileToWorldX(npc.x);
      const worldY = tileToWorldY(npc.y);
      const screenX = (worldX - camera.sourceX) * camera.zoom;
      const screenY = (worldY - camera.sourceY) * camera.zoom + MAP_LAYOUT.tileSize * 0.1 * camera.zoom;

      if (
        screenX < -drawWidth ||
        screenY < -drawHeight ||
        screenX > canvasWidth + drawWidth ||
        screenY > canvasHeight + drawHeight
      ) {
        return;
      }

      const drawX = Math.round(screenX - drawWidth * 0.5);
      const drawY = Math.round(screenY - drawHeight);

      ctx.save();
      ctx.globalAlpha = 0.9;
      if (npcFrame) {
        ctx.drawImage(npcFrame, drawX, drawY, drawWidth, drawHeight);
      } else {
        ctx.drawImage(
          this.playerSpriteSheetImage,
          0,
          0,
          PLAYER_SPRITE_FRAME_WIDTH,
          PLAYER_SPRITE_FRAME_HEIGHT,
          drawX,
          drawY,
          drawWidth,
          drawHeight,
        );
      }
      ctx.restore();
    });
  }

  syncPlayerFromPersistentState() {
    const stateWorld = this.game?.state?.world ?? {};
    const savedX = Number.isFinite(stateWorld.playerX) ? Math.floor(stateWorld.playerX) : DEFAULT_SPAWN.x;
    const savedY = Number.isFinite(stateWorld.playerY) ? Math.floor(stateWorld.playerY) : DEFAULT_SPAWN.y;
    const safeSpawn = this.resolveNearestWalkableTile(savedX, savedY);

    this.player.tileX = safeSpawn.x;
    this.player.tileY = safeSpawn.y;
    this.player.worldX = tileToWorldX(safeSpawn.x);
    this.player.worldY = tileToWorldY(safeSpawn.y);
    this.player.facing = normalizeFacing(stateWorld.facing ?? DEFAULT_SPAWN.facing);
    this.player.move = null;

    if (stateWorld && typeof stateWorld === "object") {
      stateWorld.playerX = this.player.tileX;
      stateWorld.playerY = this.player.tileY;
      stateWorld.facing = this.player.facing;
    }
  }

  resolveNearestWalkableTile(tileX, tileY) {
    const startX = clampNumber(tileX, 0, MAP_LAYOUT.cols - 1);
    const startY = clampNumber(tileY, 0, MAP_LAYOUT.rows - 1);

    if (this.isWalkableAndFree(startX, startY)) {
      return { x: startX, y: startY };
    }

    const maxRadius = Math.max(MAP_LAYOUT.cols, MAP_LAYOUT.rows);
    for (let radius = 1; radius <= maxRadius; radius += 1) {
      for (let y = startY - radius; y <= startY + radius; y += 1) {
        for (let x = startX - radius; x <= startX + radius; x += 1) {
          if (!isInsideMap(x, y, WORLD_MAP)) {
            continue;
          }
          if (this.isWalkableAndFree(x, y)) {
            return { x, y };
          }
        }
      }
    }

    return { x: DEFAULT_SPAWN.x, y: DEFAULT_SPAWN.y };
  }

  tryStartPlayerMove(direction, continuous = false) {
    const step = DIRECTION_STEP[direction];
    if (!step) {
      return false;
    }

    const nextTileX = this.player.tileX + step.x;
    const nextTileY = this.player.tileY + step.y;
    this.player.facing = direction;
    this.syncFacingOnly(direction);

    if (!isInsideMap(nextTileX, nextTileY, WORLD_MAP)) {
      return false;
    }

    if (!this.isWalkableAndFree(nextTileX, nextTileY)) {
      return false;
    }

    this.player.move = {
      elapsed: 0,
      duration: MOVE_DURATION_SECONDS,
      continuous,
      targetTileX: nextTileX,
      targetTileY: nextTileY,
      startWorldX: this.player.worldX,
      startWorldY: this.player.worldY,
      targetWorldX: tileToWorldX(nextTileX),
      targetWorldY: tileToWorldY(nextTileY),
    };
    return true;
  }

  isWalkableAndFree(tileX, tileY) {
    const tile = getTileAt(tileX, tileY, WORLD_MAP);
    if (!isWalkableTile(tile)) {
      return false;
    }

    const blockingNpc = this.getNpcAtTile(tileX, tileY, { onlyBlocking: true });
    return !blockingNpc;
  }

  advancePlayerMove(dt) {
    if (!this.player.move) {
      return;
    }

    this.player.move.elapsed += dt;
    const progress = clampNumber(this.player.move.elapsed / this.player.move.duration, 0, 1);
    const interpolationProgress = this.player.move.continuous ? progress : easeInOutCubic(progress);

    this.player.worldX = lerp(
      this.player.move.startWorldX,
      this.player.move.targetWorldX,
      interpolationProgress,
    );
    this.player.worldY = lerp(
      this.player.move.startWorldY,
      this.player.move.targetWorldY,
      interpolationProgress,
    );

    if (progress < 1) {
      return;
    }

    this.player.tileX = this.player.move.targetTileX;
    this.player.tileY = this.player.move.targetTileY;
    this.player.worldX = this.player.move.targetWorldX;
    this.player.worldY = this.player.move.targetWorldY;
    this.player.move = null;

    const stateWorld = this.game?.state?.world;
    if (stateWorld && typeof stateWorld === "object") {
      stateWorld.playerX = this.player.tileX;
      stateWorld.playerY = this.player.tileY;
      stateWorld.facing = this.player.facing;
    }

    if (this.game?.state?.progress && typeof this.game.state.progress === "object") {
      this.game.state.progress.totalSteps = Math.max(
        0,
        Math.floor(Number(this.game.state.progress.totalSteps) || 0) + 1,
      );
    }
  }

  tryInteract() {
    const facingStep = DIRECTION_STEP[this.player.facing] ?? DIRECTION_STEP.down;
    const frontTile = {
      x: this.player.tileX + facingStep.x,
      y: this.player.tileY + facingStep.y,
    };

    const npc =
      this.getNpcAtTile(frontTile.x, frontTile.y, { onlyBlocking: false }) ??
      this.getNpcAtTile(this.player.tileX, this.player.tileY, { onlyBlocking: false });
    if (npc) {
      const lines = Array.isArray(npc.lines) ? npc.lines : [];
      const lineIndex = lines.length > 0 ? npc.dialogIndex % lines.length : 0;
      const line = lines[lineIndex] ?? "...";
      npc.dialogIndex = lineIndex + 1;
      this.showWorldMessage(`${npc.name}: ${line}`);
      return true;
    }

    const interaction =
      this.getInteractionAtTile(frontTile.x, frontTile.y) ??
      this.getInteractionAtTile(this.player.tileX, this.player.tileY);
    if (interaction) {
      this.showWorldMessage(interaction.text ?? "Interazione disponibile.");
      return true;
    }

    this.showWorldMessage("Non c'e nulla con cui interagire qui.", 1.1);
    return false;
  }

  getNpcAtTile(tileX, tileY, { onlyBlocking = false } = {}) {
    return (
      this.npcs.find((npc) => {
        if (npc.x !== tileX || npc.y !== tileY) {
          return false;
        }
        if (!onlyBlocking) {
          return true;
        }
        return npc.blocksMovement !== false;
      }) ?? null
    );
  }

  getInteractionAtTile(tileX, tileY) {
    return this.interactionPoints.find((point) => point.x === tileX && point.y === tileY) ?? null;
  }

  showWorldMessage(text, durationSeconds = INTERACTION_MESSAGE_SECONDS) {
    this.worldMessage.text = String(text ?? "").trim();
    this.worldMessage.ttl = Math.max(0, Number(durationSeconds) || 0);
  }

  updateMessageTimer(dt) {
    if (this.worldMessage.ttl <= 0) {
      return;
    }
    this.worldMessage.ttl = Math.max(0, this.worldMessage.ttl - dt);
    if (this.worldMessage.ttl === 0) {
      this.worldMessage.text = "";
    }
  }

  syncFacingOnly(direction) {
    const stateWorld = this.game?.state?.world;
    if (stateWorld && typeof stateWorld === "object") {
      stateWorld.facing = direction;
    }
  }

  getCurrentPlayerIdleFrame() {
    if (this.playerIdleFrames.length <= 0) {
      return null;
    }

    const frameIndex = Math.floor(this.time * PLAYER_IDLE_FPS) % this.playerIdleFrames.length;
    return this.playerIdleFrames[frameIndex] ?? this.playerIdleFrames[0];
  }

  ensurePlayerIdleFrames() {
    if (this.playerIdleFramesReady || !isUiImageUsable(this.playerSpriteSheetImage)) {
      return;
    }

    this.playerIdleFrames = buildMaskedSpriteFrames(this.playerSpriteSheetImage, {
      frameWidth: PLAYER_SPRITE_FRAME_WIDTH,
      frameHeight: PLAYER_SPRITE_FRAME_HEIGHT,
      frameCount: PLAYER_IDLE_FRAME_COUNT,
    });
    this.playerIdleFramesReady = true;
  }
}

function resolvePressedDirection(input) {
  for (const direction of MOVE_PRIORITY) {
    if (input.wasPressed(direction)) {
      return direction;
    }
  }
  return "";
}

function resolveHeldDirection(input) {
  for (const direction of MOVE_PRIORITY) {
    if (input.isPressed(direction)) {
      return direction;
    }
  }

  return "";
}

function computeCameraZoom(canvasWidth, canvasHeight, mapHeight) {
  const safeMapHeight = Math.max(1, mapHeight || MAP_LAYOUT.rows * MAP_LAYOUT.tileSize);
  const targetViewHeight = safeMapHeight * CAMERA_VIEW_HEIGHT_RATIO;
  const rawZoom = canvasHeight / Math.max(1, targetViewHeight);
  return clampNumber(rawZoom, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
}

function drawCameraView(ctx, mapImage, camera, canvasWidth, canvasHeight) {
  ctx.fillStyle = "#05090f";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const translateX = Math.round(-camera.sourceX * camera.zoom);
  const translateY = Math.round(-camera.sourceY * camera.zoom);

  ctx.save();
  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, translateX, translateY);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mapImage, 0, 0);
  ctx.restore();
}

function drawWorldMessage(ctx, text, ttl, canvasWidth, canvasHeight) {
  if (!text || ttl <= 0) {
    return;
  }

  const fade = clampNumber(ttl / 0.3, 0, 1);
  const panelWidth = Math.min(canvasWidth * 0.86, 980);
  const panelHeight = Math.max(54, Math.round(canvasHeight * 0.062));
  const panelX = Math.round((canvasWidth - panelWidth) * 0.5);
  const panelY = Math.round(canvasHeight * 0.1);

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.fillStyle = "rgba(7, 13, 27, 0.78)";
  ctx.strokeStyle = "rgba(233, 174, 88, 0.92)";
  ctx.lineWidth = 2;
  roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f4e8cc";
  ctx.font = `${Math.max(18, Math.round(panelHeight * 0.38))}px Trebuchet MS`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    truncateToWidth(ctx, text, panelWidth - 26),
    Math.round(panelX + panelWidth * 0.5),
    Math.round(panelY + panelHeight * 0.56),
  );
  ctx.restore();
}

function truncateToWidth(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let output = text;
  while (output.length > 0 && ctx.measureText(`${output}...`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output}...`;
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

function buildMaskedSpriteFrames(image, { frameWidth, frameHeight, frameCount } = {}) {
  if (typeof document === "undefined") {
    return [];
  }

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (
    width <= 0 ||
    height <= 0 ||
    frameWidth <= 0 ||
    frameHeight <= 0 ||
    width < frameWidth ||
    height < frameHeight
  ) {
    return [];
  }

  const columns = Math.floor(width / frameWidth);
  const rows = Math.floor(height / frameHeight);
  const maxFrames = columns * rows;
  const totalFrames = clampNumber(
    Math.floor(frameCount ?? maxFrames),
    1,
    maxFrames,
  );

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext("2d");
  if (!sourceContext) {
    return [];
  }
  sourceContext.drawImage(image, 0, 0);

  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = frameWidth;
  frameCanvas.height = frameHeight;
  const frameContext = frameCanvas.getContext("2d", { willReadFrequently: true });
  if (!frameContext) {
    return [];
  }

  const frames = [];
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
    const sourceX = (frameIndex % columns) * frameWidth;
    const sourceY = Math.floor(frameIndex / columns) * frameHeight;

    frameContext.clearRect(0, 0, frameWidth, frameHeight);
    frameContext.drawImage(
      sourceCanvas,
      sourceX,
      sourceY,
      frameWidth,
      frameHeight,
      0,
      0,
      frameWidth,
      frameHeight,
    );

    const imageData = frameContext.getImageData(0, 0, frameWidth, frameHeight);
    maskFrameBackground(imageData.data, frameWidth, frameHeight);

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = frameWidth;
    outputCanvas.height = frameHeight;
    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) {
      continue;
    }

    outputContext.putImageData(imageData, 0, 0);
    frames.push(outputCanvas);
  }

  return frames;
}

function maskFrameBackground(pixelData, width, height) {
  const backgroundSamples = collectBorderColorSamples(pixelData, width, height);
  if (backgroundSamples.length <= 0) {
    return;
  }

  const backgroundMinDistance = 44;
  const softenMinDistance = 26;
  const softenMaxDistance = 44;

  const totalPixels = width * height;
  const queue = new Uint32Array(totalPixels);
  const visited = new Uint8Array(totalPixels);
  let queueHead = 0;
  let queueTail = 0;

  const tryQueuePixel = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return;
    }

    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) {
      return;
    }

    const dataOffset = pixelIndex * 4;
    const alpha = pixelData[dataOffset + 3];
    if (alpha <= 0) {
      visited[pixelIndex] = 1;
      return;
    }

    const minDistance = getMinColorDistance(pixelData, dataOffset, backgroundSamples);
    if (minDistance > backgroundMinDistance) {
      return;
    }

    visited[pixelIndex] = 1;
    queue[queueTail] = pixelIndex;
    queueTail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    tryQueuePixel(x, 0);
    tryQueuePixel(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    tryQueuePixel(0, y);
    tryQueuePixel(width - 1, y);
  }

  while (queueHead < queueTail) {
    const pixelIndex = queue[queueHead];
    queueHead += 1;
    const x = pixelIndex % width;
    const y = (pixelIndex - x) / width;
    const dataOffset = pixelIndex * 4;
    pixelData[dataOffset + 3] = 0;

    tryQueuePixel(x + 1, y);
    tryQueuePixel(x - 1, y);
    tryQueuePixel(x, y + 1);
    tryQueuePixel(x, y - 1);
  }

  for (let dataOffset = 0; dataOffset < pixelData.length; dataOffset += 4) {
    const alpha = pixelData[dataOffset + 3];
    if (alpha <= 0) {
      continue;
    }

    const minDistance = getMinColorDistance(pixelData, dataOffset, backgroundSamples);
    if (minDistance <= softenMinDistance) {
      pixelData[dataOffset + 3] = 0;
      continue;
    }

    if (minDistance >= softenMaxDistance) {
      continue;
    }

    const alphaFactor = (minDistance - softenMinDistance) / (softenMaxDistance - softenMinDistance);
    pixelData[dataOffset + 3] = Math.round(alpha * clampNumber(alphaFactor, 0, 1));
  }
}

function collectBorderColorSamples(pixelData, width, height) {
  const samples = [];
  const seen = new Set();

  const addSampleAt = (x, y) => {
    const safeX = clampNumber(Math.floor(x), 0, width - 1);
    const safeY = clampNumber(Math.floor(y), 0, height - 1);
    const dataOffset = (safeY * width + safeX) * 4;
    const alpha = pixelData[dataOffset + 3];
    if (alpha <= 0) {
      return;
    }

    const r = pixelData[dataOffset];
    const g = pixelData[dataOffset + 1];
    const b = pixelData[dataOffset + 2];
    const dedupeKey = `${r >> 3}:${g >> 3}:${b >> 3}`;
    if (seen.has(dedupeKey)) {
      return;
    }

    seen.add(dedupeKey);
    samples.push({ r, g, b });
  };

  for (let x = 0; x < width; x += 1) {
    addSampleAt(x, 0);
    addSampleAt(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    addSampleAt(0, y);
    addSampleAt(width - 1, y);
  }

  return samples;
}

function getMinColorDistance(pixelData, dataOffset, colorSamples) {
  const r = pixelData[dataOffset];
  const g = pixelData[dataOffset + 1];
  const b = pixelData[dataOffset + 2];

  let minDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < colorSamples.length; index += 1) {
    const sample = colorSamples[index];
    const distance = Math.abs(r - sample.r) + Math.abs(g - sample.g) + Math.abs(b - sample.b);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  return minDistance;
}

function drawLoading(ctx, width, height, time) {
  const spinnerSize = Math.round(clampNumber(Math.min(width, height) * 0.11, 24, 80));
  const strokeWidth = Math.max(3, Math.round(spinnerSize * 0.12));
  const spinnerRadius = Math.round((spinnerSize - strokeWidth) * 0.5);
  const centerX = Math.round(width * 0.5);
  const centerY = Math.round(height * 0.5);
  const angle = (time * Math.PI * 2) / 0.8;

  ctx.fillStyle = "#111822";
  ctx.fillRect(0, 0, width, height);

  ctx.beginPath();
  ctx.arc(centerX, centerY, spinnerRadius, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(115, 149, 205, 0.26)";
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, spinnerRadius, angle, angle + Math.PI * 1.5);
  ctx.strokeStyle = "#d6ecff";
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.stroke();
}

function normalizeFacing(value) {
  if (typeof value !== "string") {
    return "down";
  }
  const facing = value.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(DIRECTION_STEP, facing) ? facing : "down";
}

function tileToWorldX(tileX) {
  return tileX * MAP_LAYOUT.tileSize + MAP_LAYOUT.tileSize * 0.5;
}

function tileToWorldY(tileY) {
  return tileY * MAP_LAYOUT.tileSize + MAP_LAYOUT.tileSize * 0.5;
}

function clampNumber(value, min, max) {
  const safeValue = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, safeValue));
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function easeInOutCubic(value) {
  const t = clampNumber(value, 0, 1);
  if (t < 0.5) {
    return 4 * t * t * t;
  }
  return 1 - Math.pow(-2 * t + 2, 3) * 0.5;
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

function isUiImageSettled(image) {
  if (!image) {
    return true;
  }

  if (image.__agoadLoadState === "ready" || image.__agoadLoadState === "error") {
    return true;
  }

  if (!image.complete) {
    return false;
  }

  image.__agoadLoadState = isUiImageUsable(image) ? "ready" : "error";
  return true;
}
