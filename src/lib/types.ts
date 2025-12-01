export enum PlatformType {
  Static = 'static',
  Moving = 'moving',
  Breakable = 'breakable',
}

export enum CollectibleType {
  Carrot = 'carrot',
}

export enum GameState {
  Menu = 'menu',
  Playing = 'playing',
  GameOver = 'gameover',
}

export interface Vector2D {
  x: number
  y: number
}

export interface GameObject {
  x: number
  y: number
  width: number
  height: number
  velocity: Vector2D
}

export interface Platform extends GameObject {
  type: PlatformType
  id: string
  isBreaking?: boolean
  breakTimer?: number
  movingData?: {
    baseX: number
    range: number
    speed: number
    direction: 1 | -1
  }
}

export interface Collectible extends GameObject {
  type: CollectibleType
  id: string
  collected: boolean
}

export interface Player extends GameObject {
  onGround: boolean
}

export interface GameScore {
  height: number
  carrots: number
  total: number
}
