import { GAME_CONFIG } from "./constants";
import { generateId, randomRange, randomInt } from "./game-utils";
import {
  Platform,
  PlatformType,
  Collectible,
  CollectibleType,
  Powerup,
  PowerupType,
} from "./types";

export function createPlatform(
  x: number,
  y: number,
  type: PlatformType,
): Platform {
  const platform: Platform = {
    id: generateId(),
    x,
    y,
    width: GAME_CONFIG.PLATFORM.WIDTH,
    height: GAME_CONFIG.PLATFORM.HEIGHT,
    type,
    velocity: { x: 0, y: 0 },
    isBreaking: false,
  };

  if (type === PlatformType.Moving) {
    const range = randomInt(
      GAME_CONFIG.PLATFORM.MOVING_RANGE.MIN,
      GAME_CONFIG.PLATFORM.MOVING_RANGE.MAX,
    );
    const speed = randomRange(
      GAME_CONFIG.PLATFORM.MOVING_SPEED.MIN,
      GAME_CONFIG.PLATFORM.MOVING_SPEED.MAX,
    );

    platform.movingData = {
      baseX: x,
      range,
      speed,
      direction: Math.random() > 0.5 ? 1 : -1,
    };
  }

  return platform;
}

export function createCarrot(x: number, y: number): Collectible {
  return {
    id: generateId(),
    x,
    y: y - GAME_CONFIG.COLLECTIBLE.CARROT_OFFSET_Y,
    width: GAME_CONFIG.COLLECTIBLE.CARROT_SIZE,
    height: GAME_CONFIG.COLLECTIBLE.CARROT_SIZE,
    type: CollectibleType.Carrot,
    velocity: { x: 0, y: 0 },
    collected: false,
  };
}

export function createPowerup(x: number, y: number): Powerup {
  const types = [
    PowerupType.Flight,
    PowerupType.SuperJump,
    PowerupType.Magnet,
    PowerupType.Shield,
  ];
  const randomType = types[Math.floor(Math.random() * types.length)];

  return {
    id: generateId(),
    x,
    y: y - GAME_CONFIG.POWERUP.OFFSET_Y,
    width: GAME_CONFIG.POWERUP.SIZE,
    height: GAME_CONFIG.POWERUP.SIZE,
    type: randomType,
    velocity: { x: 0, y: 0 },
    collected: false,
  };
}

export function selectPlatformType(heightProgress: number): PlatformType {
  let distribution: { STATIC: number; MOVING: number; BREAKABLE: number };

  if (heightProgress < GAME_CONFIG.DIFFICULTY.EASY.HEIGHT_THRESHOLD) {
    distribution = GAME_CONFIG.DIFFICULTY.EASY.PLATFORM_DISTRIBUTION;
  } else if (heightProgress < GAME_CONFIG.DIFFICULTY.MEDIUM.HEIGHT_THRESHOLD) {
    distribution = GAME_CONFIG.DIFFICULTY.MEDIUM.PLATFORM_DISTRIBUTION;
  } else {
    distribution = GAME_CONFIG.DIFFICULTY.HARD.PLATFORM_DISTRIBUTION;
  }

  const rand = Math.random();

  if (rand < distribution.STATIC) {
    return PlatformType.Static;
  } else if (rand < distribution.STATIC + distribution.MOVING) {
    return PlatformType.Moving;
  } else {
    return PlatformType.Breakable;
  }
}

export function getGapRange(heightProgress: number): {
  min: number;
  max: number;
} {
  if (heightProgress < GAME_CONFIG.DIFFICULTY.EASY.HEIGHT_THRESHOLD) {
    return {
      min: GAME_CONFIG.DIFFICULTY.EASY.GAP_Y.MIN,
      max: GAME_CONFIG.DIFFICULTY.EASY.GAP_Y.MAX,
    };
  } else if (heightProgress < GAME_CONFIG.DIFFICULTY.MEDIUM.HEIGHT_THRESHOLD) {
    return {
      min: GAME_CONFIG.DIFFICULTY.MEDIUM.GAP_Y.MIN,
      max: GAME_CONFIG.DIFFICULTY.MEDIUM.GAP_Y.MAX,
    };
  } else {
    return {
      min: GAME_CONFIG.DIFFICULTY.HARD.GAP_Y.MIN,
      max: GAME_CONFIG.DIFFICULTY.HARD.GAP_Y.MAX,
    };
  }
}
