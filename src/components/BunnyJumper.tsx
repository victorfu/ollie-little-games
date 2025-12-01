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

      const playerBottom = player.y + player.height
      const playerPrevBottom = playerBottom - player.velocity.y * deltaTime
      const platformTop = platform.y
      
      if (
        !platform.isBreaking &&
        player.velocity.y > 0 &&
        checkCollision(player, platform) &&
        playerPrevBottom <= platformTop &&
        playerBottom >= platformTop
      ) {
        player.velocity.y = -GAME_CONFIG.JUMP_FORCE
        player.onGround = true
        player.y = platform.y - player.height

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

  const drawBunny = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, isJumping: boolean) => {
    const centerX = x + width / 2
    const centerY = y + height / 2
    
    const earHeight = isJumping ? 18 : 16
    const earWidth = 6
    const earSpacing = 10
    
    ctx.fillStyle = '#FFE5F0'
    ctx.beginPath()
    ctx.ellipse(centerX - earSpacing, y + 4, earWidth, earHeight, -0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(centerX + earSpacing, y + 4, earWidth, earHeight, 0.2, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.fillStyle = '#FFB6D9'
    ctx.beginPath()
    ctx.ellipse(centerX - earSpacing, y + 6, 3, 10, -0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(centerX + earSpacing, y + 6, 3, 10, 0.2, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(centerX, centerY + 4, width * 0.45, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.strokeStyle = '#FFB6D9'
    ctx.lineWidth = 1.5
    ctx.stroke()
    
    const eyeY = centerY
    const eyeSpacing = 8
    ctx.fillStyle = '#2D3748'
    ctx.beginPath()
    ctx.arc(centerX - eyeSpacing, eyeY, 3.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(centerX + eyeSpacing, eyeY, 3.5, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(centerX - eyeSpacing + 1.5, eyeY - 1, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(centerX + eyeSpacing + 1.5, eyeY - 1, 1.5, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.strokeStyle = '#FFB6D9'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(centerX - 4, eyeY + 6)
    ctx.lineTo(centerX, eyeY + 8)
    ctx.lineTo(centerX + 4, eyeY + 6)
    ctx.stroke()
    
    ctx.fillStyle = '#FFB6D9'
    ctx.beginPath()
    ctx.arc(centerX - 12, centerY + 2, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(centerX + 12, centerY + 2, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  const drawPlatform = (ctx: CanvasRenderingContext2D, platform: Platform) => {
    const { x, y, width, height, type, isBreaking } = platform
    
    if (isBreaking) {
      ctx.globalAlpha = 0.4
    }
    
    let gradient
    if (type === PlatformType.Moving) {
      gradient = ctx.createLinearGradient(x, y, x, y + height)
      gradient.addColorStop(0, '#A78BFA')
      gradient.addColorStop(1, '#7C3AED')
    } else if (type === PlatformType.Breakable) {
      gradient = ctx.createLinearGradient(x, y, x, y + height)
      gradient.addColorStop(0, '#FCA5A5')
      gradient.addColorStop(1, '#DC2626')
    } else {
      gradient = ctx.createLinearGradient(x, y, x, y + height)
      gradient.addColorStop(0, '#86EFAC')
      gradient.addColorStop(1, '#22C55E')
    }
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, 9)
    ctx.fill()
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.lineWidth = 2
    ctx.stroke()
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.beginPath()
    ctx.roundRect(x + 4, y + 2, width - 8, height / 2.5, 4)
    ctx.fill()
    
    ctx.globalAlpha = 1
  }

  const drawCarrot = (ctx: CanvasRenderingContext2D, carrot: Collectible) => {
    if (carrot.collected) return
    
    const centerX = carrot.x + carrot.width / 2
    const centerY = carrot.y + carrot.height / 2
    
    const leafGradient = ctx.createLinearGradient(centerX, carrot.y - 8, centerX, carrot.y + 4)
    leafGradient.addColorStop(0, '#86EFAC')
    leafGradient.addColorStop(1, '#22C55E')
    
    ctx.fillStyle = leafGradient
    ctx.beginPath()
    ctx.moveTo(centerX - 6, carrot.y + 2)
    ctx.lineTo(centerX - 3, carrot.y - 6)
    ctx.lineTo(centerX, carrot.y + 2)
    ctx.fill()
    
    ctx.beginPath()
    ctx.moveTo(centerX, carrot.y + 2)
    ctx.lineTo(centerX + 3, carrot.y - 8)
    ctx.lineTo(centerX + 6, carrot.y + 2)
    ctx.fill()
    
    const carrotGradient = ctx.createLinearGradient(centerX - carrot.width / 2, centerY, centerX + carrot.width / 2, centerY)
    carrotGradient.addColorStop(0, '#FB923C')
    carrotGradient.addColorStop(0.5, '#F97316')
    carrotGradient.addColorStop(1, '#EA580C')
    
    ctx.fillStyle = carrotGradient
    ctx.beginPath()
    ctx.moveTo(centerX, carrot.y)
    ctx.lineTo(centerX + carrot.width * 0.25, centerY)
    ctx.lineTo(centerX, carrot.y + carrot.height - 4)
    ctx.lineTo(centerX - carrot.width * 0.25, centerY)
    ctx.closePath()
    ctx.fill()
    
    ctx.strokeStyle = '#C2410C'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  const render = (
    ctx: CanvasRenderingContext2D,
    data: typeof gameDataRef.current
  ) => {
    if (!data) return

    const { player, platforms, collectibles, cameraY } = data

    const bgGradient = ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.HEIGHT)
    bgGradient.addColorStop(0, '#E0F2FE')
    bgGradient.addColorStop(0.5, '#BAE6FD')
    bgGradient.addColorStop(1, '#7DD3FC')
    ctx.fillStyle = bgGradient
    ctx.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT)
    
    const cloudY = [100, 250, 450, 600, 750]
    const cloudX = [50, 200, 350, 120, 280]
    cloudY.forEach((cy, i) => {
      const offsetY = ((cameraY * 0.3 + cy) % (GAME_CONFIG.HEIGHT + 200))
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.beginPath()
      ctx.arc(cloudX[i], offsetY, 20, 0, Math.PI * 2)
      ctx.arc(cloudX[i] + 20, offsetY, 28, 0, Math.PI * 2)
      ctx.arc(cloudX[i] + 45, offsetY, 22, 0, Math.PI * 2)
      ctx.fill()
    })

    ctx.save()
    ctx.translate(0, -cameraY)

    platforms.forEach((platform) => {
      drawPlatform(ctx, platform)
    })

    collectibles.forEach((carrot) => {
      drawCarrot(ctx, carrot)
    })

    const isJumping = player.velocity.y < 0
    drawBunny(ctx, player.x, player.y, player.width, player.height, isJumping)

    ctx.restore()

    const scoreGradient = ctx.createLinearGradient(10, 10, 10, 70)
    scoreGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
    scoreGradient.addColorStop(1, 'rgba(255, 255, 255, 0.85)')
    ctx.fillStyle = scoreGradient
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 2
    ctx.beginPath()
    ctx.roundRect(10, 10, 220, 60, 12)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    
    ctx.fillStyle = '#1F2937'
    ctx.font = 'bold 28px Fredoka, sans-serif'
    ctx.fillText(`分數: ${currentScore}`, 25, 48)
    
    if (data.carrotCount > 0) {
      ctx.font = '18px Fredoka, sans-serif'
      ctx.fillStyle = '#F97316'
      ctx.fillText(`🥕 ${data.carrotCount}`, 160, 48)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={GAME_CONFIG.WIDTH}
          height={GAME_CONFIG.HEIGHT}
          className="border-8 border-white rounded-3xl shadow-2xl"
        />

        {gameState === GameState.Menu && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-pink-50/98 to-purple-50/98 backdrop-blur-sm rounded-3xl">
            <div className="text-center space-y-6">
              <div className="inline-block animate-bounce">
                <div className="text-8xl mb-4">🐰</div>
              </div>
              <h1 className="text-7xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent mb-4" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                跳跳兔
              </h1>
              <p className="text-2xl text-muted-foreground mb-8 px-8">
                跳上平台，收集胡蘿蔔！🥕
              </p>
              <Button 
                size="lg" 
                onClick={startGame} 
                className="gap-3 text-lg px-8 py-6 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 shadow-lg hover:shadow-xl transition-all"
              >
                <Play size={28} weight="fill" />
                開始遊戲
              </Button>
              {bestScore > 0 && (
                <div className="mt-8 p-4 bg-white/60 rounded-2xl backdrop-blur-sm">
                  <p className="text-xl text-muted-foreground">
                    最高分數: <span className="font-bold text-3xl bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">{bestScore}</span>
                  </p>
                </div>
              )}
              <div className="mt-6 text-sm text-muted-foreground space-y-1">
                <p>使用 ← → 或 A D 鍵移動</p>
              </div>
            </div>
          </div>
        )}

        {gameState === GameState.GameOver && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="p-10 max-w-md mx-4 text-center bg-white/95 backdrop-blur-sm border-4 border-white shadow-2xl rounded-3xl">
              <div className="text-6xl mb-6">😢</div>
              <h2 className="text-5xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent mb-6" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                遊戲結束
              </h2>
              <div className="mb-8 space-y-4">
                <div className="p-6 bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl">
                  <p className="text-xl text-muted-foreground mb-2">
                    你的分數
                  </p>
                  <p className="text-6xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
                    {currentScore}
                  </p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-2xl">
                  <p className="text-lg text-muted-foreground">
                    最高分數: <span className="font-bold text-2xl text-yellow-600">{bestScore}</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-4 justify-center">
                <Button 
                  onClick={handleRestart} 
                  size="lg" 
                  className="gap-2 px-6 py-6 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 shadow-lg"
                >
                  <ArrowsClockwise size={24} />
                  再玩一次
                </Button>
                <Button 
                  onClick={handleMenu} 
                  variant="outline" 
                  size="lg" 
                  className="gap-2 px-6 py-6 rounded-2xl border-2 hover:bg-pink-50"
                >
                  <House size={24} />
                  主選單
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
