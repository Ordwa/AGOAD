import { Scene } from "../core/Scene.js";
import { WORLD_NPCS } from "../data/npcs.js";
import {
  DEFAULT_WORLD_MAP_ID,
  getWorldMapDefinition,
  hasWorldMapDefinition,
  getTileAt,
  isInsideMap,
  isWalkableTile,
} from "../data/map.js";

const MOVE_DURATION_SECONDS = 0.2;
const BLOCKED_WALK_ANIMATION_HOLD_SECONDS = 0.14;
const CAMERA_VIEW_HEIGHT_RATIO = 0.5;
const CAMERA_ZOOM_MIN = 1.45;
const CAMERA_ZOOM_MAX = 3.8;
const INTERACTION_MESSAGE_SECONDS = 2.4;
const PLAYER_DRAW_SIZE_TILES = 1;
const NPC_DRAW_SIZE_TILES = 1;
const PLAYER_ANIMATION_IDLE_LEFT = "idleLeft";
const PLAYER_ANIMATION_IDLE_RIGHT = "idleRight";
const PLAYER_ANIMATION_WALK_LEFT = "walkLeft";
const PLAYER_ANIMATION_WALK_RIGHT = "walkRight";
const PLAYER_ANIMATIONS = Object.freeze({
  [PLAYER_ANIMATION_IDLE_LEFT]: Object.freeze({
    path: "../assets/entity/character_animation_idle_l.png",
    frameCount: 4,
    fps: 5,
  }),
  [PLAYER_ANIMATION_IDLE_RIGHT]: Object.freeze({
    path: "../assets/entity/character_animation_idle_r.png",
    frameCount: 4,
    fps: 5,
  }),
  [PLAYER_ANIMATION_WALK_LEFT]: Object.freeze({
    path: "../assets/entity/character_animation_l.png",
    frameCount: 4,
    fps: 8,
  }),
  [PLAYER_ANIMATION_WALK_RIGHT]: Object.freeze({
    path: "../assets/entity/character_animation_r.png",
    frameCount: 4,
    fps: 8,
  }),
});

const MOVE_PRIORITY = Object.freeze(["up", "down", "left", "right"]);
const DIRECTION_STEP = Object.freeze({
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
});

let ACTIVE_WORLD_MAP_ID = DEFAULT_WORLD_MAP_ID;
let ACTIVE_WORLD_MAP_DEFINITION = getWorldMapDefinition(DEFAULT_WORLD_MAP_ID);
let ACTIVE_MAP_LAYOUT = ACTIVE_WORLD_MAP_DEFINITION.layout;
let ACTIVE_WORLD_MAP_GRID = ACTIVE_WORLD_MAP_DEFINITION.collisionGrid;
let ACTIVE_WORLD_MAP_ASSET_PATH = ACTIVE_WORLD_MAP_DEFINITION.primaryAssetPath;

export class WorldScene extends Scene {
  constructor(game) {
    super(game);

    this.time = 0;
    this.baseNpcs = (WORLD_NPCS ?? []).map((npc) => ({
      ...npc,
      dialogIndex: 0,
    }));
    this.currentMapId = ACTIVE_WORLD_MAP_ID;
    this.mapLayerImageCache = new Map();
    this.mapLayerImages = [];
    this.playerAnimationImages = Object.freeze({
      [PLAYER_ANIMATION_IDLE_LEFT]: createUiImage(PLAYER_ANIMATIONS[PLAYER_ANIMATION_IDLE_LEFT].path),
      [PLAYER_ANIMATION_IDLE_RIGHT]: createUiImage(PLAYER_ANIMATIONS[PLAYER_ANIMATION_IDLE_RIGHT].path),
      [PLAYER_ANIMATION_WALK_LEFT]: createUiImage(PLAYER_ANIMATIONS[PLAYER_ANIMATION_WALK_LEFT].path),
      [PLAYER_ANIMATION_WALK_RIGHT]: createUiImage(PLAYER_ANIMATIONS[PLAYER_ANIMATION_WALK_RIGHT].path),
    });
    this.playerAnimationFrames = {
      [PLAYER_ANIMATION_IDLE_LEFT]: [],
      [PLAYER_ANIMATION_IDLE_RIGHT]: [],
      [PLAYER_ANIMATION_WALK_LEFT]: [],
      [PLAYER_ANIMATION_WALK_RIGHT]: [],
    };
    this.playerAnimationFramesReady = {
      [PLAYER_ANIMATION_IDLE_LEFT]: false,
      [PLAYER_ANIMATION_IDLE_RIGHT]: false,
      [PLAYER_ANIMATION_WALK_LEFT]: false,
      [PLAYER_ANIMATION_WALK_RIGHT]: false,
    };
    this.playerAnimationFrameCounts = {
      [PLAYER_ANIMATION_IDLE_LEFT]: PLAYER_ANIMATIONS[PLAYER_ANIMATION_IDLE_LEFT].frameCount,
      [PLAYER_ANIMATION_IDLE_RIGHT]: PLAYER_ANIMATIONS[PLAYER_ANIMATION_IDLE_RIGHT].frameCount,
      [PLAYER_ANIMATION_WALK_LEFT]: PLAYER_ANIMATIONS[PLAYER_ANIMATION_WALK_LEFT].frameCount,
      [PLAYER_ANIMATION_WALK_RIGHT]: PLAYER_ANIMATIONS[PLAYER_ANIMATION_WALK_RIGHT].frameCount,
    };

    this.npcs = [];
    this.interactionPoints = [];
    this.battleZones = [];
    this.cutsceneTriggers = [];
    this.transitionPoints = [];
    this.healTile = null;
    this.cutsceneTriggerCooldown = new Set();
    this.applyMapDefinition(DEFAULT_WORLD_MAP_ID);
    const defaultSpawn = getActiveDefaultSpawn();

    this.player = {
      tileX: defaultSpawn.x,
      tileY: defaultSpawn.y,
      worldX: tileToWorldX(defaultSpawn.x),
      worldY: tileToWorldY(defaultSpawn.y),
      facing: normalizeFacing(defaultSpawn.facing),
      lastHorizontalDirection:
        normalizeFacing(defaultSpawn.facing) === "left" ? "left" : "right",
      move: null,
      blockedWalkUntil: 0,
    };
    this.turnBufferDirection = "";

    this.worldMessage = {
      text: "",
      ttl: 0,
    };
  }

  onEnter(payload = {}) {
    this.time = 0;
    this.worldMessage.text = "";
    this.worldMessage.ttl = 0;
    this.turnBufferDirection = "";
    this.cutsceneTriggerCooldown.clear();
    const entryState = this.resolveWorldEntryState(payload);
    this.applyMapDefinition(entryState.mapId);
    this.syncPlayerFromPersistentState(entryState);
    this.ensurePlayerAnimationFrames();

    const entryMessage = String(payload?.message ?? "").trim();
    if (entryMessage) {
      this.showWorldMessage(entryMessage);
    }

    const requestedDialogId =
      String(payload?.dialogId ?? "").trim() || String(payload?.cutsceneId ?? "").trim();
    if (requestedDialogId) {
      this.openCutsceneOverlay(requestedDialogId);
    }
  }

  onExit() {}

  getNavbarLayout() {
    return {
      visible: true,
      topbarVisible: true,
      controlsVisible: true,
      visibleTabIds: ["settings", "profile", "bag", "slot_a"],
      activeTabId: "",
    };
  }

  update(dt, input) {
    this.time += dt;
    this.ensurePlayerAnimationFrames();

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
      if (this.tryInteract()) {
        return;
      }
    }

    const pressedDirection = resolvePressedDirection(input);
    if (pressedDirection) {
      this.turnBufferDirection = pressedDirection;
    }

    if (this.player.move) {
      const battleTriggered = this.advancePlayerMove(dt);
      if (battleTriggered) {
        return;
      }
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

    const arePlayerAnimationsSettled = Object.values(this.playerAnimationImages).every((image) =>
      isUiImageSettled(image),
    );
    const areMapLayersSettled = this.mapLayerImages.every((image) => isUiImageSettled(image));
    if (!areMapLayersSettled || !arePlayerAnimationsSettled) {
      drawLoading(ctx, canvasWidth, canvasHeight, this.time);
      ctx.restore();
      return;
    }

    const camera = this.computeCamera(canvasWidth, canvasHeight);
    drawCameraBackdrop(ctx, camera, canvasWidth, canvasHeight);
    this.drawMapLayer(ctx, 0, camera, canvasWidth, canvasHeight);
    this.drawMapLayer(ctx, 1, camera, canvasWidth, canvasHeight);
    this.drawMapLayer(ctx, 2, camera, canvasWidth, canvasHeight);

    this.drawBattleZoneMarkers(ctx, camera, canvasWidth, canvasHeight);
    this.drawNpcMarkers(ctx, camera, canvasWidth, canvasHeight);
    this.drawPlayer(ctx, camera.zoom, canvasWidth, canvasHeight);
    this.drawMapLayer(ctx, 3, camera, canvasWidth, canvasHeight);

    drawWorldMessage(ctx, this.worldMessage.text, this.worldMessage.ttl, canvasWidth, canvasHeight);

    ctx.restore();
  }

  computeCamera(canvasWidth, canvasHeight) {
    const primaryMapImage = this.getPrimaryMapImage();
    const mapHeight = primaryMapImage?.naturalHeight || ACTIVE_MAP_LAYOUT.rows * ACTIVE_MAP_LAYOUT.tileSize;
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

  getPrimaryMapImage() {
    return this.mapLayerImages.find((image) => isUiImageUsable(image)) ?? null;
  }

  drawMapLayer(ctx, layerIndex, camera, canvasWidth, canvasHeight) {
    const image = this.mapLayerImages[layerIndex] ?? null;
    if (!isUiImageUsable(image)) {
      return;
    }
    drawCameraLayer(ctx, image, camera, canvasWidth, canvasHeight);
  }

  drawPlayer(ctx, zoom, canvasWidth, canvasHeight) {
    const animationKey = this.getCurrentPlayerAnimationKey();
    const frame = this.resolveAnimationFrame(animationKey);
    if (!frame) {
      return;
    }

    const drawWidth = ACTIVE_MAP_LAYOUT.tileSize * PLAYER_DRAW_SIZE_TILES * zoom;
    const drawHeight = drawWidth * (frame.sourceHeight / Math.max(1, frame.sourceWidth));
    const feetOffset = ACTIVE_MAP_LAYOUT.tileSize * 0.1 * zoom;

    const screenX = canvasWidth * 0.5;
    const screenY = canvasHeight * 0.5 + feetOffset;
    const drawX = Math.round(screenX - drawWidth * 0.5);
    const drawY = Math.round(screenY - drawHeight);
    const drawWidthRounded = Math.round(drawWidth);
    const drawHeightRounded = Math.round(drawHeight);

    ctx.imageSmoothingEnabled = false;
    this.drawResolvedFrame(ctx, frame, drawX, drawY, drawWidthRounded, drawHeightRounded);
  }

  drawNpcMarkers(ctx, camera, canvasWidth, canvasHeight) {
    const npcFrame = this.resolveAnimationFrame(PLAYER_ANIMATION_IDLE_RIGHT, 0);
    if (!npcFrame) {
      return;
    }

    const drawWidth = Math.round(ACTIVE_MAP_LAYOUT.tileSize * NPC_DRAW_SIZE_TILES * camera.zoom);
    const drawHeight = Math.round(drawWidth * (npcFrame.sourceHeight / Math.max(1, npcFrame.sourceWidth)));
    ctx.imageSmoothingEnabled = false;

    this.npcs.forEach((npc) => {
      const worldX = tileToWorldX(npc.x);
      const worldY = tileToWorldY(npc.y);
      const screenX = (worldX - camera.sourceX) * camera.zoom;
      const screenY = (worldY - camera.sourceY) * camera.zoom + ACTIVE_MAP_LAYOUT.tileSize * 0.1 * camera.zoom;

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
      this.drawResolvedFrame(ctx, npcFrame, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();
    });
  }

  drawBattleZoneMarkers(ctx, camera, canvasWidth, canvasHeight) {
    if (!Array.isArray(this.battleZones) || this.battleZones.length <= 0) {
      return;
    }

    const tileSize = ACTIVE_MAP_LAYOUT.tileSize;
    this.battleZones.forEach((zone) => {
      const worldX = zone.x * tileSize;
      const worldY = zone.y * tileSize;
      const worldW = zone.w * tileSize;
      const worldH = zone.h * tileSize;
      const screenX = Math.round((worldX - camera.sourceX) * camera.zoom);
      const screenY = Math.round((worldY - camera.sourceY) * camera.zoom);
      const drawW = Math.round(worldW * camera.zoom);
      const drawH = Math.round(worldH * camera.zoom);

      if (
        screenX > canvasWidth ||
        screenY > canvasHeight ||
        screenX + drawW < 0 ||
        screenY + drawH < 0
      ) {
        return;
      }

      ctx.save();
      ctx.fillStyle = "rgba(217, 78, 57, 0.32)";
      ctx.fillRect(screenX, screenY, drawW, drawH);
      ctx.strokeStyle = "rgba(255, 208, 122, 0.95)";
      ctx.lineWidth = Math.max(1, Math.round(camera.zoom * 1.2));
      ctx.strokeRect(screenX + 0.5, screenY + 0.5, Math.max(0, drawW - 1), Math.max(0, drawH - 1));
      ctx.restore();
    });
  }

  applyMapDefinition(mapId) {
    const nextMap = getWorldMapDefinition(mapId);
    ACTIVE_WORLD_MAP_ID = nextMap.id;
    ACTIVE_WORLD_MAP_DEFINITION = nextMap;
    ACTIVE_MAP_LAYOUT = nextMap.layout;
    ACTIVE_WORLD_MAP_GRID = nextMap.collisionGrid;
    ACTIVE_WORLD_MAP_ASSET_PATH = nextMap.primaryAssetPath;

    this.currentMapId = nextMap.id;
    this.mapLayerImages = this.getOrCreateMapLayerImages(nextMap);
    this.interactionPoints = [...(nextMap.points?.interactionPoints ?? [])];
    this.battleZones = normalizeBattleZones(nextMap.points?.battleZones ?? []);
    this.cutsceneTriggers = normalizeCutsceneTriggers(nextMap.points?.cutsceneTriggers ?? []);
    this.transitionPoints = normalizeTransitionPoints(nextMap.points?.transitionPoints ?? []);
    this.healTile =
      nextMap.points?.healTile && typeof nextMap.points.healTile === "object"
        ? { ...nextMap.points.healTile }
        : null;
    this.npcs = this.baseNpcs.filter((npc) => {
      const npcMapId = String(npc?.mapId ?? "").trim();
      return !npcMapId || npcMapId === this.currentMapId;
    });
  }

  getOrCreateMapLayerImages(mapDefinition) {
    const cached = this.mapLayerImageCache.get(mapDefinition.id);
    if (cached) {
      return cached;
    }

    const images = mapDefinition.layerAssetPaths.map((assetPath) => createUiImage(assetPath));
    this.mapLayerImageCache.set(mapDefinition.id, images);
    return images;
  }

  resolveWorldEntryState(payload = {}) {
    const stateWorld = this.game?.state?.world ?? {};
    const progress = this.game?.state?.progress ?? {};
    const savedMapId = hasWorldMapDefinition(stateWorld.currentMapId)
      ? String(stateWorld.currentMapId).trim()
      : DEFAULT_WORLD_MAP_ID;
    const explicitMapId = this.resolveRequestedMapId(payload, savedMapId);

    if (payload?.resetToLastRest) {
      const lastRestPoint = progress.lastRestPoint ?? null;
      if (lastRestPoint && typeof lastRestPoint === "object") {
        return {
          mapId: this.resolveRequestedMapId(lastRestPoint, explicitMapId),
          x: toOptionalInt(lastRestPoint.x),
          y: toOptionalInt(lastRestPoint.y),
          facing: normalizeFacing(lastRestPoint.facing ?? "down"),
        };
      }
    }

    if (payload?.resetToSpawn) {
      const spawnMap = getWorldMapDefinition(explicitMapId);
      return {
        mapId: spawnMap.id,
        x: spawnMap.spawn.x,
        y: spawnMap.spawn.y,
        facing: normalizeFacing(payload?.facing ?? spawnMap.spawn.facing),
      };
    }

    const explicitX =
      toOptionalInt(payload?.targetX) ??
      toOptionalInt(payload?.x) ??
      toOptionalInt(payload?.playerX) ??
      toOptionalInt(payload?.targetTileX);
    const explicitY =
      toOptionalInt(payload?.targetY) ??
      toOptionalInt(payload?.y) ??
      toOptionalInt(payload?.playerY) ??
      toOptionalInt(payload?.targetTileY);
    if (Number.isInteger(explicitX) && Number.isInteger(explicitY)) {
      return {
        mapId: explicitMapId,
        x: explicitX,
        y: explicitY,
        facing: normalizeFacing(payload?.facing ?? stateWorld.facing ?? "down"),
      };
    }

    if (savedMapId !== explicitMapId) {
      const spawnMap = getWorldMapDefinition(explicitMapId);
      return {
        mapId: spawnMap.id,
        x: spawnMap.spawn.x,
        y: spawnMap.spawn.y,
        facing: normalizeFacing(spawnMap.spawn.facing),
      };
    }

    return {
      mapId: savedMapId,
      x: toOptionalInt(stateWorld.playerX),
      y: toOptionalInt(stateWorld.playerY),
      facing: normalizeFacing(stateWorld.facing ?? getActiveDefaultSpawn().facing),
    };
  }

  resolveRequestedMapId(source, fallbackMapId = DEFAULT_WORLD_MAP_ID) {
    const requestedMapId = String(
      source?.mapId ?? source?.targetMapId ?? source?.worldMapId ?? "",
    ).trim();
    if (hasWorldMapDefinition(requestedMapId)) {
      return requestedMapId;
    }
    return hasWorldMapDefinition(fallbackMapId) ? String(fallbackMapId).trim() : DEFAULT_WORLD_MAP_ID;
  }

  syncPlayerFromPersistentState(entryState = {}) {
    const stateWorld = this.game?.state?.world ?? {};
    const defaultSpawn = getActiveDefaultSpawn();
    const savedX = Number.isInteger(entryState?.x) ? entryState.x : defaultSpawn.x;
    const savedY = Number.isInteger(entryState?.y) ? entryState.y : defaultSpawn.y;
    const safeSpawn = this.resolveNearestWalkableTile(savedX, savedY);

    this.player.tileX = safeSpawn.x;
    this.player.tileY = safeSpawn.y;
    this.player.worldX = tileToWorldX(safeSpawn.x);
    this.player.worldY = tileToWorldY(safeSpawn.y);
    this.player.facing = normalizeFacing(entryState?.facing ?? stateWorld.facing ?? defaultSpawn.facing);
    if (this.player.facing === "left") {
      this.player.lastHorizontalDirection = "left";
    } else if (this.player.facing === "right") {
      this.player.lastHorizontalDirection = "right";
    } else {
      this.player.lastHorizontalDirection =
        this.player.lastHorizontalDirection === "left" ? "left" : "right";
    }
    this.player.move = null;
    this.player.blockedWalkUntil = 0;
    this.player.blockedWalkUntil = 0;

    if (stateWorld && typeof stateWorld === "object") {
      stateWorld.currentMapId = this.currentMapId;
      stateWorld.playerX = this.player.tileX;
      stateWorld.playerY = this.player.tileY;
      stateWorld.facing = this.player.facing;
    }
  }

  resolveNearestWalkableTile(tileX, tileY) {
    const startX = clampNumber(tileX, 0, ACTIVE_MAP_LAYOUT.cols - 1);
    const startY = clampNumber(tileY, 0, ACTIVE_MAP_LAYOUT.rows - 1);

    if (this.isWalkableAndFree(startX, startY)) {
      return { x: startX, y: startY };
    }

    const maxRadius = Math.max(ACTIVE_MAP_LAYOUT.cols, ACTIVE_MAP_LAYOUT.rows);
    for (let radius = 1; radius <= maxRadius; radius += 1) {
      for (let y = startY - radius; y <= startY + radius; y += 1) {
        for (let x = startX - radius; x <= startX + radius; x += 1) {
          if (!isInsideMap(x, y, ACTIVE_WORLD_MAP_GRID)) {
            continue;
          }
          if (this.isWalkableAndFree(x, y)) {
            return { x, y };
          }
        }
      }
    }

    const defaultSpawn = getActiveDefaultSpawn();
    return { x: defaultSpawn.x, y: defaultSpawn.y };
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

    if (!isInsideMap(nextTileX, nextTileY, ACTIVE_WORLD_MAP_GRID)) {
      this.startBlockedWalkAnimation(direction);
      return false;
    }

    if (!this.isWalkableAndFree(nextTileX, nextTileY)) {
      this.startBlockedWalkAnimation(direction);
      return false;
    }

    if (direction === "left" || direction === "right") {
      this.player.lastHorizontalDirection = direction;
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
    this.player.blockedWalkUntil = 0;
    return true;
  }

  startBlockedWalkAnimation(direction) {
    if (direction === "left" || direction === "right") {
      this.player.lastHorizontalDirection = direction;
    }
    this.player.blockedWalkUntil = this.time + BLOCKED_WALK_ANIMATION_HOLD_SECONDS;
  }

  isWalkableAndFree(tileX, tileY) {
    const tile = getTileAt(tileX, tileY, ACTIVE_WORLD_MAP_GRID);
    if (!isWalkableTile(tile)) {
      return false;
    }

    const blockingNpc = this.getNpcAtTile(tileX, tileY, { onlyBlocking: true });
    if (blockingNpc) {
      return false;
    }

    const blockingInteraction = this.getInteractionAtTile(tileX, tileY, {
      onlyLayer2: true,
      onlyBlocking: true,
    });
    return !blockingInteraction;
  }

  advancePlayerMove(dt) {
    if (!this.player.move) {
      return false;
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
      return false;
    }

    this.player.tileX = this.player.move.targetTileX;
    this.player.tileY = this.player.move.targetTileY;
    this.player.worldX = this.player.move.targetWorldX;
    this.player.worldY = this.player.move.targetWorldY;
    this.player.move = null;

    const stateWorld = this.game?.state?.world;
    if (stateWorld && typeof stateWorld === "object") {
      stateWorld.currentMapId = this.currentMapId;
      stateWorld.playerX = this.player.tileX;
      stateWorld.playerY = this.player.tileY;
      stateWorld.facing = this.player.facing;
    }

    if (this.tryEnterTransitionPoint(this.player.tileX, this.player.tileY)) {
      return true;
    }
    if (this.tryStartCutsceneFromTrigger(this.player.tileX, this.player.tileY)) {
      return false;
    }
    return this.tryEnterBattleZone();
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
      if (this.tryHandleMapInteraction(interaction)) {
        return true;
      }
      if (this.tryHandleRestInteraction(interaction)) {
        return true;
      }
      const interactionDialogId =
        String(interaction.cutsceneId ?? "").trim() || String(interaction.dialogId ?? "").trim();
      if (interactionDialogId && this.openCutsceneOverlay(interactionDialogId)) {
        return true;
      }
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

  getInteractionAtTile(tileX, tileY, { onlyLayer2 = true, onlyBlocking = false } = {}) {
    return (
      this.interactionPoints.find((point) => {
        if (!point || point.x !== tileX || point.y !== tileY) {
          return false;
        }
        if (onlyLayer2 && Number(point.layer ?? 2) !== 2) {
          return false;
        }
        if (onlyBlocking) {
          return point.blocksMovement === true;
        }
        return true;
      }) ?? null
    );
  }

  getBattleZoneAtTile(tileX, tileY) {
    return (
      this.battleZones.find((zone) => this.isTileInsideBattleZone(tileX, tileY, zone)) ?? null
    );
  }

  getTransitionAtTile(tileX, tileY) {
    return (
      this.transitionPoints.find((point) => point && point.x === tileX && point.y === tileY) ?? null
    );
  }

  isTileInsideBattleZone(tileX, tileY, zone) {
    if (!zone || typeof zone !== "object") {
      return false;
    }

    return (
      tileX >= zone.x &&
      tileX < zone.x + zone.w &&
      tileY >= zone.y &&
      tileY < zone.y + zone.h
    );
  }

  tryEnterBattleZone() {
    const zone = this.getBattleZoneAtTile(this.player.tileX, this.player.tileY);
    if (!zone) {
      return false;
    }

    this.game.changeScene("battle", {
      zoneId: zone.id ?? "",
      encounterTileX: this.player.tileX,
      encounterTileY: this.player.tileY,
      mapAssetPath: ACTIVE_WORLD_MAP_ASSET_PATH,
    });
    return true;
  }

  tryEnterTransitionPoint(tileX, tileY) {
    const transition = this.getTransitionAtTile(tileX, tileY);
    if (!transition) {
      return false;
    }
    return this.executeMapTransition(transition);
  }

  tryHandleMapInteraction(interaction) {
    const targetMapId = String(interaction?.targetMapId ?? interaction?.mapId ?? "").trim();
    if (!targetMapId) {
      return false;
    }
    return this.executeMapTransition(interaction);
  }

  tryHandleRestInteraction(interaction) {
    const action = String(interaction?.action ?? "").trim().toLowerCase();
    if (action !== "rest" && interaction?.rest !== true) {
      return false;
    }

    const player = this.game?.state?.player;
    if (player && typeof player === "object") {
      player.hp = player.maxHp;
      player.mana = player.maxMana;
    }

    const progress = this.game?.state?.progress;
    if (progress && typeof progress === "object") {
      const restSpawnX = toOptionalInt(interaction?.restSpawnX) ?? this.player.tileX;
      const restSpawnY = toOptionalInt(interaction?.restSpawnY) ?? this.player.tileY;
      progress.lastRestPoint = {
        mapId: this.currentMapId,
        x: restSpawnX,
        y: restSpawnY,
        facing: normalizeFacing(interaction?.restFacing ?? this.player.facing),
      };
    }

    this.showWorldMessage(
      String(interaction?.text ?? "").trim() || "Ti riposi e recuperi le forze.",
      1.6,
    );
    return true;
  }

  executeMapTransition(transition) {
    const targetMapId = this.resolveRequestedMapId(transition, this.currentMapId);
    const targetMap = getWorldMapDefinition(targetMapId);
    const targetX = toOptionalInt(transition?.targetX) ?? targetMap.spawn.x;
    const targetY = toOptionalInt(transition?.targetY) ?? targetMap.spawn.y;
    const targetFacing = normalizeFacing(transition?.targetFacing ?? targetMap.spawn.facing);
    const message = String(transition?.transitionText ?? transition?.text ?? "").trim();

    this.game.changeScene("world", {
      mapId: targetMap.id,
      x: targetX,
      y: targetY,
      facing: targetFacing,
      message,
    });
    return true;
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

  openCutsceneOverlay(cutsceneId) {
    const safeCutsceneId = String(cutsceneId ?? "").trim();
    if (!safeCutsceneId) {
      return false;
    }

    this.worldMessage.text = "";
    this.worldMessage.ttl = 0;
    this.turnBufferDirection = "";
    this.player.move = null;
    this.player.blockedWalkUntil = 0;
    try {
      this.game.openOverlayScene("cutscene_overlay", {
        dialogId: safeCutsceneId,
        sourceSceneName: "world",
      });
    } catch {
      this.showWorldMessage("Cut-scene non disponibile.", 1.1);
      return false;
    }
    return true;
  }

  tryStartCutsceneFromTrigger(tileX, tileY) {
    if (!Array.isArray(this.cutsceneTriggers) || this.cutsceneTriggers.length <= 0) {
      return false;
    }

    for (let index = 0; index < this.cutsceneTriggers.length; index += 1) {
      const trigger = this.cutsceneTriggers[index];
      if (!trigger || trigger.mode !== "step") {
        continue;
      }
      if (trigger.x !== tileX || trigger.y !== tileY) {
        continue;
      }
      const triggerId = `${this.currentMapId}:${String(trigger.id ?? `trigger_${index}`)}`;
      if (trigger.once !== false && this.cutsceneTriggerCooldown.has(triggerId)) {
        continue;
      }
      const started = this.openCutsceneOverlay(trigger.cutsceneId);
      if (!started) {
        continue;
      }
      if (trigger.once !== false) {
        this.cutsceneTriggerCooldown.add(triggerId);
      }
      return true;
    }

    return false;
  }

  syncFacingOnly(direction) {
    const stateWorld = this.game?.state?.world;
    if (stateWorld && typeof stateWorld === "object") {
      stateWorld.currentMapId = this.currentMapId;
      stateWorld.facing = direction;
    }
  }

  getCurrentPlayerAnimationKey() {
    const horizontalDirection = this.player.lastHorizontalDirection === "left" ? "left" : "right";
    if (this.player.move || this.time < this.player.blockedWalkUntil) {
      return horizontalDirection === "left" ? PLAYER_ANIMATION_WALK_LEFT : PLAYER_ANIMATION_WALK_RIGHT;
    }

    return horizontalDirection === "left" ? PLAYER_ANIMATION_IDLE_LEFT : PLAYER_ANIMATION_IDLE_RIGHT;
  }

  resolveAnimationFrame(animationKey, fixedFrameIndex = null) {
    const selectedKey = Object.prototype.hasOwnProperty.call(PLAYER_ANIMATIONS, animationKey)
      ? animationKey
      : this.getCurrentPlayerAnimationKey();
    const config = PLAYER_ANIMATIONS[selectedKey];
    const frames = this.playerAnimationFrames[selectedKey] ?? [];

    if (frames.length > 0) {
      const rawFrameIndex =
        fixedFrameIndex ??
        Math.floor(
          this.time * (Number(config.fps) || PLAYER_ANIMATIONS[PLAYER_ANIMATION_IDLE_RIGHT].fps),
        );
      const normalizedFrameIndex = normalizeFrameIndex(rawFrameIndex, frames.length);
      const frame = frames[normalizedFrameIndex] ?? frames[0];
      const sourceWidth = frame?.width || frame?.naturalWidth || 1;
      const sourceHeight = frame?.height || frame?.naturalHeight || 1;
      return {
        image: frame,
        isSpriteSheet: false,
        sourceX: 0,
        sourceY: 0,
        sourceWidth,
        sourceHeight,
      };
    }

    const sourceImage = this.playerAnimationImages[selectedKey];
    if (!isUiImageUsable(sourceImage)) {
      const fallbackIdleKey =
        this.player.lastHorizontalDirection === "left"
          ? PLAYER_ANIMATION_IDLE_LEFT
          : PLAYER_ANIMATION_IDLE_RIGHT;
      if (selectedKey !== fallbackIdleKey) {
        return this.resolveAnimationFrame(fallbackIdleKey, fixedFrameIndex);
      }
      return null;
    }

    const frameCount = Math.max(
      1,
      Math.floor(Number(this.playerAnimationFrameCounts[selectedKey] ?? config.frameCount) || 1),
    );
    const sourceWidth = Math.max(1, Math.floor((sourceImage.naturalWidth || sourceImage.width) / frameCount));
    const sourceHeight = Math.max(1, sourceImage.naturalHeight || sourceImage.height);
    const rawFrameIndex =
      fixedFrameIndex ??
      Math.floor(
        this.time * (Number(config.fps) || PLAYER_ANIMATIONS[PLAYER_ANIMATION_IDLE_RIGHT].fps),
      );
    const normalizedFrameIndex = normalizeFrameIndex(rawFrameIndex, frameCount);
    return {
      image: sourceImage,
      isSpriteSheet: true,
      sourceX: normalizedFrameIndex * sourceWidth,
      sourceY: 0,
      sourceWidth,
      sourceHeight,
    };
  }

  drawResolvedFrame(ctx, frame, drawX, drawY, drawWidth, drawHeight) {
    if (!frame || !frame.image) {
      return;
    }

    if (!frame.isSpriteSheet) {
      ctx.drawImage(frame.image, drawX, drawY, drawWidth, drawHeight);
      return;
    }

    ctx.drawImage(
      frame.image,
      frame.sourceX,
      frame.sourceY,
      frame.sourceWidth,
      frame.sourceHeight,
      drawX,
      drawY,
      drawWidth,
      drawHeight,
    );
  }

  ensurePlayerAnimationFrames() {
    Object.keys(PLAYER_ANIMATIONS).forEach((animationKey) => {
      if (this.playerAnimationFramesReady[animationKey]) {
        return;
      }

      const image = this.playerAnimationImages[animationKey];
      if (!isUiImageUsable(image)) {
        return;
      }

      const config = PLAYER_ANIMATIONS[animationKey];
      const frameCount = resolveSpriteSheetFrameCount(image, config.frameCount);
      const frameWidth = Math.max(1, Math.floor((image.naturalWidth || image.width) / frameCount));
      const frameHeight = Math.max(1, image.naturalHeight || image.height);
      this.playerAnimationFrames[animationKey] = buildMaskedSpriteFrames(image, {
        frameWidth,
        frameHeight,
        frameCount,
      });
      this.playerAnimationFrameCounts[animationKey] = frameCount;
      this.playerAnimationFramesReady[animationKey] = true;
    });
  }
}

function normalizeFrameIndex(frameIndex, frameCount) {
  const safeCount = Math.max(1, Math.floor(frameCount) || 1);
  const rawIndex = Math.floor(frameIndex);
  return ((rawIndex % safeCount) + safeCount) % safeCount;
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
  const safeMapHeight = Math.max(1, mapHeight || ACTIVE_MAP_LAYOUT.rows * ACTIVE_MAP_LAYOUT.tileSize);
  const targetViewHeight = safeMapHeight * CAMERA_VIEW_HEIGHT_RATIO;
  const rawZoom = canvasHeight / Math.max(1, targetViewHeight);
  return clampNumber(rawZoom, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
}

function drawCameraBackdrop(ctx, camera, canvasWidth, canvasHeight) {
  ctx.fillStyle = "#05090f";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "#0a1220";
  ctx.fillRect(
    Math.round(-camera.sourceX * camera.zoom),
    Math.round(-camera.sourceY * camera.zoom),
    Math.round(ACTIVE_MAP_LAYOUT.cols * ACTIVE_MAP_LAYOUT.tileSize * camera.zoom),
    Math.round(ACTIVE_MAP_LAYOUT.rows * ACTIVE_MAP_LAYOUT.tileSize * camera.zoom),
  );
}

function drawCameraLayer(ctx, mapImage, camera, canvasWidth, canvasHeight) {
  if (!isUiImageUsable(mapImage)) {
    return;
  }

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

  const frames = [];
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
    const sourceX = (frameIndex % columns) * frameWidth;
    const sourceY = Math.floor(frameIndex / columns) * frameHeight;

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = frameWidth;
    outputCanvas.height = frameHeight;
    const outputContext = outputCanvas.getContext("2d");
    if (!outputContext) {
      continue;
    }

    outputContext.imageSmoothingEnabled = false;
    outputContext.drawImage(
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
    frames.push(outputCanvas);
  }

  return frames;
}

function resolveSpriteSheetFrameCount(image, fallbackFrameCount = 1) {
  const safeFallback = clampNumber(Math.floor(Number(fallbackFrameCount) || 1), 1, 32);
  const width = Number(image?.naturalWidth || image?.width || 0);
  const height = Number(image?.naturalHeight || image?.height || 0);
  if (width <= 0 || height <= 0) {
    return safeFallback;
  }
  const guessedFrameCount = clampNumber(Math.ceil(width / Math.max(1, height)), 1, 32);
  return clampNumber(Math.min(safeFallback, guessedFrameCount), 1, 32);
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
  return tileX * ACTIVE_MAP_LAYOUT.tileSize + ACTIVE_MAP_LAYOUT.tileSize * 0.5;
}

function tileToWorldY(tileY) {
  return tileY * ACTIVE_MAP_LAYOUT.tileSize + ACTIVE_MAP_LAYOUT.tileSize * 0.5;
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
  const safePath = String(relativePath ?? "").trim();
  if (typeof Image === "undefined" || safePath.length <= 0) {
    return null;
  }

  const imageUrl = buildVersionedAssetUrl(safePath);
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

function getActiveDefaultSpawn() {
  const spawn = ACTIVE_WORLD_MAP_DEFINITION?.spawn ?? {};
  return {
    x: Number.isInteger(spawn.x) ? spawn.x : 0,
    y: Number.isInteger(spawn.y) ? spawn.y : 0,
    facing: normalizeFacing(spawn.facing ?? "down"),
  };
}

function normalizeBattleZones(rawZones) {
  if (!Array.isArray(rawZones)) {
    return [];
  }

  return rawZones
    .map((zone, index) => {
      const x = clampNumber(Math.floor(Number(zone?.x) || 0), 0, ACTIVE_MAP_LAYOUT.cols - 1);
      const y = clampNumber(Math.floor(Number(zone?.y) || 0), 0, ACTIVE_MAP_LAYOUT.rows - 1);
      const maxWidth = ACTIVE_MAP_LAYOUT.cols - x;
      const maxHeight = ACTIVE_MAP_LAYOUT.rows - y;
      const w = clampNumber(Math.floor(Number(zone?.w) || 1), 1, Math.max(1, maxWidth));
      const h = clampNumber(Math.floor(Number(zone?.h) || 1), 1, Math.max(1, maxHeight));
      return {
        id: String(zone?.id ?? `zone_${index + 1}`),
        x,
        y,
        w,
        h,
        text: String(zone?.text ?? "").trim(),
      };
    })
    .filter((zone) => zone.w > 0 && zone.h > 0);
}

function normalizeCutsceneTriggers(rawTriggers) {
  if (!Array.isArray(rawTriggers)) {
    return [];
  }

  return rawTriggers
    .map((trigger, index) => {
      const x = clampNumber(Math.floor(Number(trigger?.x) || 0), 0, ACTIVE_MAP_LAYOUT.cols - 1);
      const y = clampNumber(Math.floor(Number(trigger?.y) || 0), 0, ACTIVE_MAP_LAYOUT.rows - 1);
      const cutsceneId =
        String(trigger?.cutsceneId ?? "").trim() || String(trigger?.dialogId ?? "").trim();
      if (!cutsceneId) {
        return null;
      }
      return {
        id: String(trigger?.id ?? `cutscene_trigger_${index + 1}`),
        x,
        y,
        mode: String(trigger?.mode ?? "step").trim().toLowerCase() === "interact" ? "interact" : "step",
        cutsceneId,
        once: trigger?.once !== false,
      };
    })
    .filter((trigger) => trigger !== null);
}

function normalizeTransitionPoints(rawPoints) {
  if (!Array.isArray(rawPoints)) {
    return [];
  }

  return rawPoints
    .map((point, index) => {
      const targetMapId = String(point?.targetMapId ?? point?.mapId ?? "").trim();
      if (!hasWorldMapDefinition(targetMapId)) {
        return null;
      }

      return {
        id: String(point?.id ?? `transition_${index + 1}`),
        x: clampNumber(Math.floor(Number(point?.x) || 0), 0, ACTIVE_MAP_LAYOUT.cols - 1),
        y: clampNumber(Math.floor(Number(point?.y) || 0), 0, ACTIVE_MAP_LAYOUT.rows - 1),
        targetMapId,
        targetX: toOptionalInt(point?.targetX),
        targetY: toOptionalInt(point?.targetY),
        targetFacing: normalizeFacing(point?.targetFacing ?? "down"),
        transitionText: String(point?.transitionText ?? point?.text ?? "").trim(),
      };
    })
    .filter((point) => point !== null);
}

function toOptionalInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.floor(parsed);
}
