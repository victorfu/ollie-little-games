import { useEffect, useRef, useState } from 'react'
import { GAME_CONFIG } from '@/lib/constants'
import { GameState, Player, Platform, Collectible, PlatformType } from '@/lib/types'
import { 
  checkCollision, 
  clamp, 
  randomInt, 
  getBestScore, 
  setBestScore 
} from '@/lib/game-utils'
import {
  createPlatform,
  createCarrot,
  selectPlatformType,
  getGapRange,
} from '@/lib/game-objects'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Play, ArrowsClockwise, House } from '@phosphor-icons/react'

export default function BunnyJumper() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<GameState>(GameState.Menu)
  const [currentScore, setCurrentScore] = useState(0)
  const [bestScore, setBestScoreState] = useState(0)
  const gameLoopRef = useRef<number | undefined>(undefined)
  const gameDataRef = useRef<{
    player: Player
    platforms: Platform[]
    collectibles: Collectible[]
    cameraY: number
    startY: number
    maxHeight: number
    carrotCount: number
    keys: { [key: string]: boolean }
    lastTime: number
  } | undefined>(undefined)

  useEffect(() => {
    setBestScoreState(getBestScore())
  }, [])

  const initGame = () => {
    const player: Player = {
      x: GAME_CONFIG.WIDTH / 2 - GAME_CONFIG.PLAYER.WIDTH / 2,
      y: GAME_CONFIG.HEIGHT * GAME_CONFIG.PLAYER.START_Y_RATIO,
      width: GAME_CONFIG.PLAYER.WIDTH,
      height: GAME_CONFIG.PLAYER.HEIGHT,
      velocity: { x: 0, y: 0 },
      onGround: false,
    }

    const platforms: Platform[] = []
    const collectibles: Collectible[] = []
    
    let currentY = GAME_CONFIG.HEIGHT - 100
    
    for (let i = 0; i < GAME_CONFIG.INITIAL_PLATFORMS; i++) {
      const gapRange = getGapRange(0)
      const gap = randomInt(gapRange.min, gapRange.max)
      currentY -= gap
      
      const x = randomInt(
        GAME_CONFIG.MARGIN_X,
        GAME_CONFIG.WIDTH - GAME_CONFIG.MARGIN_X - GAME_CONFIG.PLATFORM.WIDTH
      )
      
      const platformType = i < 3 ? PlatformType.Static : selectPlatformType(0)
      const platform = createPlatform(x, currentY, platformType)
      platforms.push(platform)
      
      if (Math.random() < GAME_CONFIG.COLLECTIBLE.SPAWN_CHANCE) {
        collectibles.push(createCarrot(
          platform.x + platform.width / 2 - GAME_CONFIG.COLLECTIBLE.CARROT_SIZE / 2,
          platform.y
        ))
      }
    }

    player.y = platforms[platforms.length - 1].y - GAME_CONFIG.PLAYER.HEIGHT - 10

    gameDataRef.current = {
      player,
      platforms,
      collectibles,
      cameraY: 0,
      startY: player.y,
      maxHeight: player.y,
      carrotCount: 0,
      keys: {},
      lastTime: performance.now(),
    }
  }

  const startGame = () => {
    initGame()
    setGameState(GameState.Playing)
    setCurrentScore(0)
  }

  const handleRestart = () => {
    startGame()
  }

  const handleMenu = () => {
    setGameState(GameState.Menu)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameDataRef.current) return
      gameDataRef.current.keys[e.key.toLowerCase()] = true
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!gameDataRef.current) return
      gameDataRef.current.keys[e.key.toLowerCase()] = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    if (gameState !== GameState.Playing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const gameLoop = (time: number) => {
      if (!gameDataRef.current) return

      const data = gameDataRef.current
      const deltaTime = Math.min((time - data.lastTime) / 1000, 0.05)
      data.lastTime = time

      updateGame(deltaTime, data)
      render(ctx, data)

      const heightProgress = data.startY - data.maxHeight
      const heightScore = Math.floor(heightProgress * GAME_CONFIG.SCORING.HEIGHT_FACTOR)
      const collectScore = data.carrotCount * GAME_CONFIG.SCORING.CARROT_POINTS
      const totalScore = heightScore + collectScore
      setCurrentScore(totalScore)

      if (data.player.y > data.cameraY + GAME_CONFIG.HEIGHT + 100) {
        const best = getBestScore()
        if (totalScore > best) {
          setBestScore(totalScore)
          setBestScoreState(totalScore)
        }
        setGameState(GameState.GameOver)
        return
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop)
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current)
      }
    }
  }, [gameState])

  const updateGame = (
    deltaTime: number,
    data: typeof gameDataRef.current
  ) => {
    if (!data) return

    const { player, platforms, collectibles, keys } = data

    let moveX = 0
    if (keys['arrowleft'] || keys['a']) moveX -= 1
    if (keys['arrowright'] || keys['d']) moveX += 1

    player.velocity.x = moveX * GAME_CONFIG.MOVE_SPEED

    player.velocity.y += GAME_CONFIG.GRAVITY * deltaTime

    player.x += player.velocity.x * deltaTime
    player.y += player.velocity.y * deltaTime

    player.x = clamp(player.x, 0, GAME_CONFIG.WIDTH - player.width)

    player.onGround = false

    platforms.forEach((platform) => {
      if (platform.isBreaking && platform.breakTimer !== undefined) {
        platform.breakTimer -= deltaTime * 1000
        if (platform.breakTimer <= 0) {
          platform.x = -1000
          platform.y = -1000
        }
      }

      if (platform.movingData) {
        const { baseX, range, speed, direction } = platform.movingData
        platform.x += direction * speed * deltaTime
        
        if (platform.x < baseX - range / 2) {
          platform.x = baseX - range / 2
          platform.movingData.direction = 1
        } else if (platform.x > baseX + range / 2) {
          platform.x = baseX + range / 2
          platform.movingData.direction = -1
        }
      }

      if (
        !platform.isBreaking &&
        player.velocity.y > 0 &&
        checkCollision(player, platform) &&
        player.y < platform.y
      ) {
        player.velocity.y = -GAME_CONFIG.JUMP_FORCE
        player.onGround = true

        if (platform.type === PlatformType.Breakable) {
          platform.isBreaking = true
          platform.breakTimer = GAME_CONFIG.PLATFORM.BREAK_DELAY
        }
      }
    })

    collectibles.forEach((carrot) => {
      if (!carrot.collected && checkCollision(player, carrot)) {
        carrot.collected = true
        data.carrotCount++
      }
    })

    data.maxHeight = Math.min(data.maxHeight, player.y)

    if (player.y < data.cameraY + GAME_CONFIG.HEIGHT * 0.4) {
      data.cameraY = player.y - GAME_CONFIG.HEIGHT * 0.4
    }

    const heightProgress = data.startY - data.maxHeight
    const gapRange = getGapRange(heightProgress)

    platforms.forEach((platform, index) => {
      if (platform.y > data.cameraY + GAME_CONFIG.HEIGHT + 50) {
        const newY = data.cameraY - randomInt(gapRange.min, gapRange.max)
        const newX = randomInt(
          GAME_CONFIG.MARGIN_X,
          GAME_CONFIG.WIDTH - GAME_CONFIG.MARGIN_X - GAME_CONFIG.PLATFORM.WIDTH
        )
        const newType = selectPlatformType(heightProgress)
        const newPlatform = createPlatform(newX, newY, newType)
        platforms[index] = newPlatform

        if (Math.random() < GAME_CONFIG.COLLECTIBLE.SPAWN_CHANCE) {
          collectibles.push(createCarrot(
            newPlatform.x + newPlatform.width / 2 - GAME_CONFIG.COLLECTIBLE.CARROT_SIZE / 2,
            newPlatform.y
          ))
        }
      }
    })
  }

  const render = (
    ctx: CanvasRenderingContext2D,
    data: typeof gameDataRef.current
  ) => {
    if (!data) return

    const { player, platforms, collectibles, cameraY } = data

    ctx.fillStyle = '#d4e7f5'
    ctx.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT)

    ctx.save()
    ctx.translate(0, -cameraY)

    platforms.forEach((platform) => {
      let color = '#7ec96f'
      
      if (platform.type === PlatformType.Moving) {
        color = '#b08fc7'
      } else if (platform.type === PlatformType.Breakable) {
        color = '#f09a8f'
      }

      if (platform.isBreaking) {
        ctx.globalAlpha = 0.5
      }

      ctx.fillStyle = color
      ctx.fillRect(
        platform.x,
        platform.y,
        platform.width,
        platform.height
      )
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 2
      ctx.strokeRect(
        platform.x,
        platform.y,
        platform.width,
        platform.height
      )

      ctx.globalAlpha = 1
    })

    collectibles.forEach((carrot) => {
      if (!carrot.collected) {
        ctx.fillStyle = '#e89350'
        ctx.beginPath()
        ctx.arc(
          carrot.x + carrot.width / 2,
          carrot.y + carrot.height / 2,
          carrot.width / 2,
          0,
          Math.PI * 2
        )
        ctx.fill()
        
        ctx.fillStyle = '#7ec96f'
        ctx.fillRect(
          carrot.x + carrot.width / 2 - 3,
          carrot.y - 6,
          6,
          8
        )
      }
    })

    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(player.x, player.y, player.width, player.height)
    
    ctx.fillStyle = '#3a3d5c'
    ctx.fillRect(player.x + 8, player.y + 8, 8, 8)
    ctx.fillRect(player.x + 24, player.y + 8, 8, 8)
    
    ctx.fillRect(player.x + 8, player.y + 24, 24, 4)

    ctx.restore()

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fillRect(10, 10, 200, 50)
    ctx.fillStyle = '#3a3d5c'
    ctx.font = 'bold 24px Fredoka, sans-serif'
    ctx.fillText(`Score: ${currentScore}`, 20, 42)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-sky-200 to-sky-300">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={GAME_CONFIG.WIDTH}
          height={GAME_CONFIG.HEIGHT}
          className="border-4 border-white rounded-lg shadow-2xl bg-sky-100"
        />

        {gameState === GameState.Menu && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 rounded-lg">
            <h1 className="text-6xl font-bold text-foreground mb-8" style={{ fontFamily: 'Fredoka, sans-serif' }}>
              Bunny Jumper
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Jump on platforms and collect carrots!
            </p>
            <Button size="lg" onClick={startGame} className="gap-2">
              <Play size={24} weight="fill" />
              Start Game
            </Button>
            {bestScore > 0 && (
              <p className="mt-6 text-lg text-muted-foreground">
                Best Score: <span className="font-bold text-foreground">{bestScore}</span>
              </p>
            )}
          </div>
        )}

        {gameState === GameState.GameOver && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Card className="p-8 max-w-sm mx-4 text-center">
              <h2 className="text-4xl font-bold text-foreground mb-4" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                Game Over
              </h2>
              <div className="mb-6">
                <p className="text-2xl text-muted-foreground mb-2">
                  Your Score
                </p>
                <p className="text-5xl font-bold text-primary mb-4">
                  {currentScore}
                </p>
                <p className="text-lg text-muted-foreground">
                  Best Score: <span className="font-bold text-foreground">{bestScore}</span>
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleRestart} size="lg" className="gap-2">
                  <ArrowsClockwise size={20} />
                  Restart
                </Button>
                <Button onClick={handleMenu} variant="outline" size="lg" className="gap-2">
                  <House size={20} />
                  Menu
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
