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

type CollectParticle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }

type GameData = {
  player: Player
  platforms: Platform[]
  collectibles: Collectible[]
  cameraY: number
  startY: number
  maxHeight: number
  carrotCount: number
  keys: Record<string, boolean>
  lastTime: number
  playerSquash: number
  playerLandTime: number
  collectParticles: CollectParticle[]
}

export default function BunnyJumper() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<GameState>(GameState.Menu)
  const [currentScore, setCurrentScore] = useState(0)
  const [bestScore, setBestScoreState] = useState(0)
  const gameLoopRef = useRef<number | undefined>(undefined)
  const gameDataRef = useRef<GameData | undefined>(undefined)

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
    let currentY = GAME_CONFIG.HEIGHT - 80

    const startPlatform = createPlatform(
      GAME_CONFIG.WIDTH / 2 - GAME_CONFIG.PLATFORM.WIDTH / 2,
      currentY,
      PlatformType.Static
    )
    platforms.push(startPlatform)

    for (let i = 1; i < GAME_CONFIG.INITIAL_PLATFORMS; i++) {
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
        collectibles.push(
          createCarrot(
            platform.x + platform.width / 2 - GAME_CONFIG.COLLECTIBLE.CARROT_SIZE / 2,
            platform.y
          )
        )
      }
    }

    player.y = startPlatform.y - GAME_CONFIG.PLAYER.HEIGHT - 5

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
      playerSquash: 1,
      playerLandTime: 0,
      collectParticles: [],
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

  const updateGame = (deltaTime: number, data: GameData) => {
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

        data.playerSquash = 1.4
        data.playerLandTime = performance.now() / 1000

        if (platform.type === PlatformType.Breakable) {
          platform.isBreaking = true
          platform.breakTimer = GAME_CONFIG.PLATFORM.BREAK_DELAY
        }
      }
    })

    const timeSinceLand = performance.now() / 1000 - data.playerLandTime
    if (player.onGround) {
      data.playerSquash = 1.4
    } else if (data.playerLandTime > 0 && timeSinceLand < 0.15) {
      data.playerSquash = 1.4 - (timeSinceLand / 0.15) * 0.4
    } else {
      data.playerSquash = 1
    }

    collectibles.forEach((carrot) => {
      if (!carrot.collected && checkCollision(player, carrot)) {
        carrot.collected = true
        data.carrotCount++
        const centerX = carrot.x + carrot.width / 2
        const centerY = carrot.y + carrot.height / 2
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.35
          data.collectParticles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * (50 + Math.random() * 30),
            vy: Math.sin(angle) * (50 + Math.random() * 30) - 30,
            life: 1,
            maxLife: 0.7 + Math.random() * 0.3,
          })
        }
      }
    })

    data.collectibles = data.collectibles.filter(
      (carrot) => !carrot.collected && carrot.y <= data.cameraY + GAME_CONFIG.HEIGHT + 80
    )

    for (let i = data.collectParticles.length - 1; i >= 0; i--) {
      const particle = data.collectParticles[i]
      particle.life -= deltaTime
      particle.x += particle.vx * deltaTime
      particle.y += particle.vy * deltaTime
      particle.vy += 200 * deltaTime

      if (particle.life <= 0) {
        data.collectParticles.splice(i, 1)
      }
    }

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
          data.collectibles.push(
            createCarrot(
              newPlatform.x + newPlatform.width / 2 - GAME_CONFIG.COLLECTIBLE.CARROT_SIZE / 2,
              newPlatform.y
            )
          )
        }
      }
    })
  }

  const drawBunny = (
    ctx: CanvasRenderingContext2D,
    player: Player,
    squash: number,
    time: number
  ) => {
    const width = player.width
    const height = player.height
    const centerX = player.x + width / 2
    const centerY = player.y + height / 2
    const idleBounce = Math.sin(time * 3) * 1.5

    ctx.save()
    ctx.translate(centerX, centerY + idleBounce)
    ctx.scale(1 / squash, squash)
    ctx.translate(-centerX, -(centerY + idleBounce))

    ctx.fillStyle = '#FFE5F0'
    ctx.beginPath()
    ctx.ellipse(centerX - 10, player.y + 6 + idleBounce, 8, 16, -0.15, 0, Math.PI * 2)
    ctx.ellipse(centerX + 10, player.y + 6 + idleBounce, 8, 16, 0.15, 0, Math.PI * 2)
    ctx.fill()

    const bodyGradient = ctx.createRadialGradient(centerX, centerY + 4, 0, centerX, centerY + 4, width * 0.6)
    bodyGradient.addColorStop(0, '#FFFFFF')
    bodyGradient.addColorStop(1, '#FFD6E8')
    ctx.fillStyle = bodyGradient
    ctx.beginPath()
    ctx.ellipse(centerX, centerY + 6, width * 0.45, height * 0.46, 0, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#1A1A2E'
    ctx.beginPath()
    ctx.arc(centerX - 8, centerY - 4, 3.5, 0, Math.PI * 2)
    ctx.arc(centerX + 8, centerY - 4, 3.5, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = '#FF8FAB'
    ctx.beginPath()
    ctx.arc(centerX, centerY + 4, 3, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = '#FF8FAB'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(centerX - 6, centerY + 10)
    ctx.quadraticCurveTo(centerX, centerY + 12, centerX + 6, centerY + 10)
    ctx.stroke()

    ctx.restore()
  }

  const drawPlatform = (ctx: CanvasRenderingContext2D, platform: Platform, time: number) => {
    const { x, y, width, height, type, isBreaking } = platform
    const bob = Math.sin(time * 2 + x) * 1.5
    const drawY = y + bob

    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.15)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 4

    const gradient = ctx.createLinearGradient(x, drawY, x, drawY + height)
    if (type === PlatformType.Moving) {
      gradient.addColorStop(0, '#E9D5FF')
      gradient.addColorStop(1, '#C084FC')
    } else if (type === PlatformType.Breakable) {
      gradient.addColorStop(0, '#FECDD3')
      gradient.addColorStop(1, '#FB7185')
    } else {
      gradient.addColorStop(0, '#ECFCCB')
      gradient.addColorStop(1, '#D9F99D')
    }

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.roundRect(x, drawY, width, height, 10)
    ctx.fill()

    if (isBreaking) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)'
      ctx.setLineDash([6, 6])
      ctx.strokeRect(x + 4, drawY + 4, width - 8, height - 8)
      ctx.setLineDash([])
    }

    ctx.restore()
  }

  const drawCarrot = (ctx: CanvasRenderingContext2D, carrot: Collectible, time: number) => {
    if (carrot.collected) return
    const centerX = carrot.x + carrot.width / 2
    const centerY = carrot.y + carrot.height / 2
    const bounce = Math.sin(time * 3 + centerX) * 3

    ctx.save()
    ctx.translate(centerX, centerY + bounce)
    ctx.rotate(Math.sin(time * 2 + centerX) * 0.05)
    ctx.translate(-centerX, -(centerY + bounce))

    ctx.fillStyle = '#84CC16'
    ctx.beginPath()
    ctx.moveTo(centerX - 6, carrot.y + bounce)
    ctx.quadraticCurveTo(centerX - 2, carrot.y - 8 + bounce, centerX + 2, carrot.y + bounce)
    ctx.quadraticCurveTo(centerX + 6, carrot.y - 6 + bounce, centerX + 10, carrot.y + bounce)
    ctx.fill()

    const carrotGrad = ctx.createLinearGradient(centerX - 10, centerY, centerX + 10, centerY)
    carrotGrad.addColorStop(0, '#FDBA74')
    carrotGrad.addColorStop(1, '#F97316')
    ctx.fillStyle = carrotGrad
    ctx.beginPath()
    ctx.moveTo(centerX, carrot.y + bounce)
    ctx.lineTo(centerX + carrot.width * 0.3, centerY + bounce)
    ctx.lineTo(centerX + carrot.width * 0.2, carrot.y + carrot.height - 4 + bounce)
    ctx.lineTo(centerX - carrot.width * 0.2, carrot.y + carrot.height - 4 + bounce)
    ctx.lineTo(centerX - carrot.width * 0.3, centerY + bounce)
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }

  const render = (ctx: CanvasRenderingContext2D, data: GameData) => {
    const time = performance.now() / 1000
    const { player, platforms, collectibles, cameraY, collectParticles, playerSquash } = data

    ctx.clearRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT)

    const bgGradient = ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.HEIGHT)
    bgGradient.addColorStop(0, '#E0F2FE')
    bgGradient.addColorStop(0.5, '#FCE7F3')
    bgGradient.addColorStop(1, '#FDF2F8')
    ctx.fillStyle = bgGradient
    ctx.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT)

    ctx.save()
    ctx.translate(0, -cameraY)

    platforms.forEach((platform) => drawPlatform(ctx, platform, time))
    collectibles.forEach((carrot) => drawCarrot(ctx, carrot, time))

    collectParticles.forEach((particle) => {
      const alpha = particle.life / particle.maxLife
      ctx.fillStyle = `rgba(251, 146, 60, ${alpha})`
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, 3 * alpha, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `rgba(254, 215, 170, ${alpha * 0.8})`
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, 1.5 * alpha, 0, Math.PI * 2)
      ctx.fill()
    })

    drawBunny(ctx, player, playerSquash, time)

    ctx.restore()

    const heightProgress = data.startY - data.maxHeight
    const heightScore = Math.floor(heightProgress * GAME_CONFIG.SCORING.HEIGHT_FACTOR)
    const collectScore = data.carrotCount * GAME_CONFIG.SCORING.CARROT_POINTS
    const displayScore = heightScore + collectScore

    ctx.save()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.strokeStyle = 'rgba(219, 39, 119, 0.25)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(GAME_CONFIG.WIDTH / 2 - 130, 12, 260, 70, 18)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#DB2777'
    ctx.font = 'bold 20px sans-serif'
    ctx.fillText('分數', GAME_CONFIG.WIDTH / 2 - 110, 42)

    const numberGrad = ctx.createLinearGradient(0, 0, 0, 70)
    numberGrad.addColorStop(0, '#DB2777')
    numberGrad.addColorStop(1, '#BE185D')
    ctx.fillStyle = numberGrad
    ctx.font = 'bold 28px sans-serif'
    ctx.fillText(`${displayScore}`, GAME_CONFIG.WIDTH / 2 - 110, 68)

    ctx.fillStyle = '#EA580C'
    ctx.font = 'bold 18px sans-serif'
    ctx.fillText(`🥕 x ${data.carrotCount}`, GAME_CONFIG.WIDTH / 2 + 30, 55)

    ctx.restore()
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={GAME_CONFIG.WIDTH}
          height={GAME_CONFIG.HEIGHT}
          className="border-[8px] border-white rounded-[2rem] shadow-[0_20px_60px_rgba(219,39,119,0.3)]"
        />

        {gameState === GameState.Menu && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="p-10 max-w-md text-center bg-white/80 backdrop-blur-md border-4 border-white shadow-2xl rounded-[1.5rem]">
              <div className="text-6xl mb-4 animate-bounce">🐰</div>
              <h1 className="text-4xl font-bold text-pink-500 mb-3">跳跳兔</h1>
              <p className="text-lg text-purple-600 mb-6">跳上平台，收集胡蘿蔔！</p>
              <div className="space-y-3">
                <Button onClick={startGame} size="lg" className="w-full gap-2 text-xl bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500">
                  <Play weight="bold" />
                  <span className="font-bold">開始遊戲</span>
                </Button>
                {bestScore > 0 && (
                  <div className="text-purple-700 font-semibold bg-white/70 rounded-xl py-3 border border-white">
                    👑 最高分數：{bestScore}
                  </div>
                )}
                <div className="text-sm text-purple-500">使用 ← → 或 A D 移動</div>
              </div>
            </Card>
          </div>
        )}

        {gameState === GameState.GameOver && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="p-10 max-w-md text-center bg-white/85 backdrop-blur-md border-4 border-white shadow-2xl rounded-[1.5rem]">
              <div className="text-6xl mb-4">💫</div>
              <h2 className="text-4xl font-bold text-pink-500 mb-4">遊戲結束</h2>
              <p className="text-xl text-purple-600 mb-2">你的分數</p>
              <p className="text-5xl font-bold text-orange-500 mb-4">{currentScore}</p>
              <p className="text-md text-purple-600 mb-6">最高分：{bestScore}</p>
              <div className="flex gap-3 justify-center">
                <Button 
                  onClick={handleRestart} 
                  size="lg" 
                  className="gap-2 px-8 text-lg bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500"
                >
                  <ArrowsClockwise size={24} weight="bold" />
                  <span className="font-bold">再玩一次</span>
                </Button>
                <Button 
                  onClick={handleMenu} 
                  variant="outline" 
                  size="lg" 
                  className="gap-2 px-8 text-lg"
                >
                  <House size={24} weight="bold" />
                  <span className="font-bold">主選單</span>
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
