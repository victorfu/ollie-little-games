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

    // Cute pink ears with inner ear detail
    ctx.fillStyle = '#FFB6C1'
    ctx.beginPath()
    ctx.ellipse(centerX - 10, player.y + 6 + idleBounce, 8, 18, -0.15, 0, Math.PI * 2)
    ctx.ellipse(centerX + 10, player.y + 6 + idleBounce, 8, 18, 0.15, 0, Math.PI * 2)
    ctx.fill()
    // Inner ear pink
    ctx.fillStyle = '#FF69B4'
    ctx.beginPath()
    ctx.ellipse(centerX - 10, player.y + 8 + idleBounce, 4, 10, -0.15, 0, Math.PI * 2)
    ctx.ellipse(centerX + 10, player.y + 8 + idleBounce, 4, 10, 0.15, 0, Math.PI * 2)
    ctx.fill()

    // Fluffy body gradient (pink/white)
    const bodyGradient = ctx.createRadialGradient(centerX, centerY + 4, 0, centerX, centerY + 4, width * 0.6)
    bodyGradient.addColorStop(0, '#FFFFFF')
    bodyGradient.addColorStop(0.7, '#FFF0F5')
    bodyGradient.addColorStop(1, '#FFB6C1')
    ctx.fillStyle = bodyGradient
    ctx.beginPath()
    ctx.ellipse(centerX, centerY + 6, width * 0.48, height * 0.48, 0, 0, Math.PI * 2)
    ctx.fill()

    // Cute sparkly eyes
    ctx.fillStyle = '#2D1B69'
    ctx.beginPath()
    ctx.arc(centerX - 8, centerY - 4, 4, 0, Math.PI * 2)
    ctx.arc(centerX + 8, centerY - 4, 4, 0, Math.PI * 2)
    ctx.fill()
    // Eye highlights (sparkles)
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(centerX - 9, centerY - 5.5, 1.5, 0, Math.PI * 2)
    ctx.arc(centerX + 7, centerY - 5.5, 1.5, 0, Math.PI * 2)
    ctx.fill()

    // Pink blush cheeks
    ctx.fillStyle = 'rgba(255, 105, 180, 0.4)'
    ctx.beginPath()
    ctx.ellipse(centerX - 14, centerY + 2, 4, 2.5, 0, 0, Math.PI * 2)
    ctx.ellipse(centerX + 14, centerY + 2, 4, 2.5, 0, 0, Math.PI * 2)
    ctx.fill()

    // Cute pink heart nose
    ctx.fillStyle = '#FF69B4'
    ctx.beginPath()
    ctx.arc(centerX - 2, centerY + 3, 2.5, 0, Math.PI * 2)
    ctx.arc(centerX + 2, centerY + 3, 2.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(centerX - 4.5, centerY + 4)
    ctx.lineTo(centerX, centerY + 9)
    ctx.lineTo(centerX + 4.5, centerY + 4)
    ctx.fill()

    // Cute smile
    ctx.strokeStyle = '#FF69B4'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(centerX - 5, centerY + 12)
    ctx.quadraticCurveTo(centerX, centerY + 16, centerX + 5, centerY + 12)
    ctx.stroke()

    // Little bow on ear
    ctx.fillStyle = '#FF1493'
    ctx.beginPath()
    ctx.ellipse(centerX - 16, player.y + 2 + idleBounce, 5, 3, -0.5, 0, Math.PI * 2)
    ctx.ellipse(centerX - 12, player.y - 2 + idleBounce, 5, 3, 0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFD700'
    ctx.beginPath()
    ctx.arc(centerX - 14, player.y + idleBounce, 2.5, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  const drawPlatform = (ctx: CanvasRenderingContext2D, platform: Platform, time: number) => {
    const { x, y, width, height, type, isBreaking } = platform
    const bob = Math.sin(time * 2 + x) * 1.5
    const drawY = y + bob

    ctx.save()
    ctx.shadowColor = 'rgba(255, 105, 180, 0.3)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 4

    const gradient = ctx.createLinearGradient(x, drawY, x, drawY + height)
    if (type === PlatformType.Moving) {
      // Lavender purple for moving platforms
      gradient.addColorStop(0, '#E6E6FA')
      gradient.addColorStop(1, '#DDA0DD')
    } else if (type === PlatformType.Breakable) {
      // Soft peach for breakable platforms
      gradient.addColorStop(0, '#FFDAB9')
      gradient.addColorStop(1, '#FFB6C1')
    } else {
      // Cute pink gradient for static platforms
      gradient.addColorStop(0, '#FFB6C1')
      gradient.addColorStop(1, '#FF69B4')
    }

    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.roundRect(x, drawY, width, height, 14)
    ctx.fill()

    // Add sparkle decoration on platforms
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
    ctx.beginPath()
    ctx.arc(x + 12, drawY + height / 2, 3, 0, Math.PI * 2)
    ctx.arc(x + width - 12, drawY + height / 2, 3, 0, Math.PI * 2)
    ctx.fill()

    if (type === PlatformType.Moving) {
      // Cute heart decorations for moving platforms
      ctx.fillStyle = 'rgba(255, 182, 193, 0.8)'
      const heartX = x + width / 2
      const heartY = drawY + height / 2
      ctx.beginPath()
      ctx.arc(heartX - 3, heartY - 2, 3, 0, Math.PI * 2)
      ctx.arc(heartX + 3, heartY - 2, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(heartX - 6, heartY)
      ctx.lineTo(heartX, heartY + 5)
      ctx.lineTo(heartX + 6, heartY)
      ctx.fill()
    }

    if (isBreaking) {
      ctx.strokeStyle = 'rgba(255, 105, 180, 0.8)'
      ctx.setLineDash([6, 6])
      ctx.lineWidth = 2
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
    const sparkle = Math.sin(time * 5) * 0.3 + 0.7

    ctx.save()
    ctx.translate(centerX, centerY + bounce)
    ctx.rotate(Math.sin(time * 2 + centerX) * 0.05)
    ctx.translate(-centerX, -(centerY + bounce))

    // Sparkle glow effect
    ctx.shadowColor = 'rgba(255, 215, 0, 0.6)'
    ctx.shadowBlur = 15 * sparkle

    // Cute star shape instead of carrot
    ctx.fillStyle = '#FFD700'
    ctx.beginPath()
    const starX = centerX
    const starY = centerY + bounce
    const outerRadius = 12
    const innerRadius = 5
    for (let i = 0; i < 5; i++) {
      const outerAngle = (Math.PI / 2) + (i * 2 * Math.PI / 5)
      const innerAngle = outerAngle + Math.PI / 5
      if (i === 0) {
        ctx.moveTo(starX + outerRadius * Math.cos(outerAngle), starY - outerRadius * Math.sin(outerAngle))
      } else {
        ctx.lineTo(starX + outerRadius * Math.cos(outerAngle), starY - outerRadius * Math.sin(outerAngle))
      }
      ctx.lineTo(starX + innerRadius * Math.cos(innerAngle), starY - innerRadius * Math.sin(innerAngle))
    }
    ctx.closePath()
    ctx.fill()

    // Inner highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.beginPath()
    ctx.arc(starX - 2, starY - 2, 3, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  const render = (ctx: CanvasRenderingContext2D, data: GameData) => {
    const time = performance.now() / 1000
    const { player, platforms, collectibles, cameraY, collectParticles, playerSquash } = data

    ctx.clearRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT)

    // Cute pink gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.HEIGHT)
    bgGradient.addColorStop(0, '#FFF0F5')
    bgGradient.addColorStop(0.3, '#FFE4EC')
    bgGradient.addColorStop(0.6, '#FFDEE9')
    bgGradient.addColorStop(1, '#E6E6FA')
    ctx.fillStyle = bgGradient
    ctx.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT)

    // Cute floating hearts and stars in background
    const cloudOffset = (time * 15) % (GAME_CONFIG.WIDTH + 100)
    for (let i = 0; i < 4; i++) {
      const heartX = cloudOffset - 50 + i * 150 - (i * 180)
      const heartY = 80 + i * 100 + Math.sin(time * 2 + i) * 10
      const heartSize = 15 + i * 3
      
      ctx.fillStyle = `rgba(255, 182, 193, ${0.4 - i * 0.08})`
      // Draw heart shape
      ctx.beginPath()
      ctx.arc(heartX - heartSize / 4, heartY, heartSize / 2.5, 0, Math.PI * 2)
      ctx.arc(heartX + heartSize / 4, heartY, heartSize / 2.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(heartX - heartSize / 2, heartY + heartSize / 6)
      ctx.lineTo(heartX, heartY + heartSize)
      ctx.lineTo(heartX + heartSize / 2, heartY + heartSize / 6)
      ctx.fill()
    }

    // Sparkle decorations
    for (let i = 0; i < 6; i++) {
      const sparkleX = (time * 20 + i * 80) % GAME_CONFIG.WIDTH
      const sparkleY = 50 + i * 80 + Math.sin(time * 3 + i * 2) * 20
      const alpha = Math.sin(time * 4 + i) * 0.3 + 0.5
      ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`
      ctx.beginPath()
      ctx.arc(sparkleX, sparkleY, 2, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.save()
    ctx.translate(0, -cameraY)

    platforms.forEach((platform) => drawPlatform(ctx, platform, time))
    collectibles.forEach((carrot) => drawCarrot(ctx, carrot, time))

    // Cute sparkle particles (pink/gold)
    collectParticles.forEach((particle) => {
      const alpha = particle.life / particle.maxLife
      ctx.fillStyle = `rgba(255, 105, 180, ${alpha})`
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, 4 * alpha, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.8})`
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, 2 * alpha, 0, Math.PI * 2)
      ctx.fill()
    })

    drawBunny(ctx, player, playerSquash, time)

    ctx.restore()

    const heightProgress = data.startY - data.maxHeight
    const heightScore = Math.floor(heightProgress * GAME_CONFIG.SCORING.HEIGHT_FACTOR)
    const collectScore = data.carrotCount * GAME_CONFIG.SCORING.CARROT_POINTS
    const displayScore = heightScore + collectScore

    // Cute score display with pink theme
    ctx.save()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.strokeStyle = 'rgba(255, 105, 180, 0.4)'
    ctx.lineWidth = 3
    ctx.shadowColor = 'rgba(255, 182, 193, 0.5)'
    ctx.shadowBlur = 15
    ctx.beginPath()
    ctx.roundRect(GAME_CONFIG.WIDTH / 2 - 130, 12, 260, 70, 20)
    ctx.fill()
    ctx.stroke()

    ctx.shadowBlur = 0
    ctx.fillStyle = '#FF69B4'
    ctx.font = 'bold 18px "Comic Sans MS", cursive'
    ctx.fillText('✨ 分數', GAME_CONFIG.WIDTH / 2 - 110, 40)

    const numberGrad = ctx.createLinearGradient(0, 0, 0, 70)
    numberGrad.addColorStop(0, '#FF69B4')
    numberGrad.addColorStop(1, '#FF1493')
    ctx.fillStyle = numberGrad
    ctx.font = 'bold 26px "Comic Sans MS", cursive'
    ctx.fillText(`${displayScore}`, GAME_CONFIG.WIDTH / 2 - 110, 68)

    ctx.fillStyle = '#FFD700'
    ctx.font = 'bold 16px "Comic Sans MS", cursive'
    ctx.fillText(`⭐ x ${data.carrotCount}`, GAME_CONFIG.WIDTH / 2 + 30, 55)

    ctx.restore()
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-100 via-pink-200 to-purple-200">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={GAME_CONFIG.WIDTH}
          height={GAME_CONFIG.HEIGHT}
          className="border-[8px] border-white rounded-[2rem] shadow-[0_20px_60px_rgba(255,105,180,0.35)]"
        />

        {gameState === GameState.Menu && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="p-10 max-w-md text-center bg-white/90 backdrop-blur-md border-4 border-pink-200 shadow-2xl rounded-[2rem]">
              <div className="text-6xl mb-4 animate-bounce">🐰💕</div>
              <h1 className="text-4xl font-bold text-pink-500 mb-3" style={{ fontFamily: '"Comic Sans MS", cursive' }}>跳跳兔</h1>
              <p className="text-lg text-pink-400 mb-6" style={{ fontFamily: '"Comic Sans MS", cursive' }}>✨ 跳躍收集閃亮星星！✨</p>
              <div className="space-y-3">
                <Button onClick={startGame} size="lg" className="w-full gap-2 text-xl bg-gradient-to-r from-pink-400 via-pink-500 to-purple-400 hover:from-pink-500 hover:via-pink-600 hover:to-purple-500 rounded-full shadow-lg">
                  <Play weight="bold" />
                  <span className="font-bold" style={{ fontFamily: '"Comic Sans MS", cursive' }}>開始遊戲 🎀</span>
                </Button>
                {bestScore > 0 && (
                  <div className="text-pink-600 font-semibold bg-pink-50/80 rounded-full py-3 border-2 border-pink-200" style={{ fontFamily: '"Comic Sans MS", cursive' }}>
                    👑 最高分數：{bestScore}
                  </div>
                )}
                <div className="text-sm text-pink-400" style={{ fontFamily: '"Comic Sans MS", cursive' }}>使用 ← → 或 A D 移動 💫</div>
              </div>
            </Card>
          </div>
        )}

        {gameState === GameState.GameOver && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="p-10 max-w-md text-center bg-white/90 backdrop-blur-md border-4 border-pink-200 shadow-2xl rounded-[2rem]">
              <div className="text-6xl mb-4">🌟💖</div>
              <h2 className="text-4xl font-bold text-pink-500 mb-4" style={{ fontFamily: '"Comic Sans MS", cursive' }}>遊戲結束</h2>
              <p className="text-xl text-pink-400 mb-2" style={{ fontFamily: '"Comic Sans MS", cursive' }}>你的分數</p>
              <p className="text-5xl font-bold text-pink-500 mb-4" style={{ fontFamily: '"Comic Sans MS", cursive' }}>{currentScore}</p>
              <p className="text-md text-pink-400 mb-6" style={{ fontFamily: '"Comic Sans MS", cursive' }}>✨ 最高分：{bestScore} ✨</p>
              <div className="flex gap-3 justify-center">
                <Button 
                  onClick={handleRestart} 
                  size="lg" 
                  className="gap-2 px-8 text-lg bg-gradient-to-r from-pink-400 via-pink-500 to-purple-400 hover:from-pink-500 hover:via-pink-600 hover:to-purple-500 rounded-full shadow-lg"
                >
                  <ArrowsClockwise size={24} weight="bold" />
                  <span className="font-bold" style={{ fontFamily: '"Comic Sans MS", cursive' }}>再玩一次 🎀</span>
                </Button>
                <Button 
                  onClick={handleMenu} 
                  variant="outline" 
                  size="lg" 
                  className="gap-2 px-8 text-lg border-2 border-pink-300 text-pink-500 hover:bg-pink-50 rounded-full"
                >
                  <House size={24} weight="bold" />
                  <span className="font-bold" style={{ fontFamily: '"Comic Sans MS", cursive' }}>主選單</span>
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
