export enum PlatformType {
  Static = "static",
  Moving = "moving",
  Breakable = "breakable",
  Vanishing = "vanishing",
}

export enum CollectibleType {
  Carrot = "carrot",
}

export enum PowerupType {
  Flight = "flight",
  SuperJump = "superJump",
  Magnet = "magnet",
  Shield = "shield",
}

export enum GameState {
  Menu = "menu",
  Playing = "playing",
  GameOver = "gameover",
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  velocity: Vector2D;
}

export interface Platform extends GameObject {
  type: PlatformType;
  id: string;
  isBreaking?: boolean;
  breakTimer?: number;
  remainingUses?: number;
  movingData?: {
    baseX: number;
    range: number;
    speed: number;
    direction: 1 | -1;
  };
}

export interface Collectible extends GameObject {
  type: CollectibleType;
  id: string;
  collected: boolean;
}

export interface Powerup extends GameObject {
  type: PowerupType;
  id: string;
  collected: boolean;
}

export interface Player extends GameObject {
  onGround: boolean;
}

export interface GameScore {
  height: number;
  carrots: number;
  total: number;
}

export interface Critter extends GameObject {
  id: string;
  stomped: boolean;
  platformId: string;
}

export interface Gust {
  id: string;
  y: number;
  height: number;
  strength: number;
  direction: 1 | -1;
}
