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
        collectibles.push(createCarrot(
          platform.x + platform.width / 2 - GAME_CONFIG.COLLECTIBLE.CARROT_SIZE / 2,
          platform.y
        ))
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
    
    const earHeight = isJumping ? 20 : 18
    const earWidth = 7
    const earSpacing = 11
    
    ctx.shadowColor = 'rgba(255, 182, 217, 0.3)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 3
    
    ctx.fillStyle = '#FFE5F0'
    ctx.beginPath()
    ctx.ellipse(centerX - earSpacing, y + 3, earWidth, earHeight, -0.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(centerX + earSpacing, y + 3, earWidth, earHeight, 0.15, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.fillStyle = '#FFB6D9'
    ctx.beginPath()
    ctx.ellipse(centerX - earSpacing, y + 6, 3.5, 11, -0.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(centerX + earSpacing, y + 6, 3.5, 11, 0.15, 0, Math.PI * 2)
    ctx.fill()
    
    const bodyGradient = ctx.createRadialGradient(centerX, centerY + 2, 0, centerX, centerY + 2, width * 0.5)
    bodyGradient.addColorStop(0, '#FFFFFF')
    bodyGradient.addColorStop(0.7, '#FFF5F7')
    bodyGradient.addColorStop(1, '#FFE5F0')
    
    ctx.fillStyle = bodyGradient
    ctx.beginPath()
    ctx.arc(centerX, centerY + 4, width * 0.48, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#FFB6D9'
    ctx.lineWidth = 2
    ctx.stroke()
    
    const eyeY = centerY - 1
    const eyeSpacing = 9
    
    ctx.fillStyle = '#1A1A2E'
    ctx.beginPath()
    ctx.ellipse(centerX - eyeSpacing, eyeY, 4, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(centerX + eyeSpacing, eyeY, 4, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(centerX - eyeSpacing + 2, eyeY - 1.5, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(centerX + eyeSpacing + 2, eyeY - 1.5, 2, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.strokeStyle = '#FF8FAB'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(centerX - 5, eyeY + 7)
    ctx.quadraticCurveTo(centerX, eyeY + 9, centerX + 5, eyeY + 7)
    ctx.stroke()
    
    const noseGradient = ctx.createRadialGradient(centerX, eyeY + 6, 0, centerX, eyeY + 6, 2.5)
    noseGradient.addColorStop(0, '#FFB6D9')
    noseGradient.addColorStop(1, '#FF8FAB')
    ctx.fillStyle = noseGradient
    ctx.beginPath()
    ctx.arc(centerX, eyeY + 6, 2.5, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.fillStyle = '#FFD6E8'
    ctx.beginPath()
    ctx.arc(centerX - 13, centerY + 2, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(centerX + 13, centerY + 2, 4, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.shadowColor = 'transparent'
  }

  const drawPlatform = (ctx: CanvasRenderingContext2D, platform: Platform) => {
    const { x, y, width, height, type, isBreaking } = platform
    
    if (isBreaking) {
      ctx.globalAlpha = 0.4
    }
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 4
    
    let gradient
    if (type === PlatformType.Moving) {
      gradient = ctx.createLinearGradient(x, y, x, y + height)
      gradient.addColorStop(0, '#E9D5FF')
      gradient.addColorStop(0.5, '#C084FC')
      gradient.addColorStop(1, '#A855F7')
      
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, 12)
      ctx.fill()
      
      ctx.strokeStyle = '#F3E8FF'
      ctx.lineWidth = 3
      ctx.stroke()
      
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.beginPath()
        ctx.arc(x + 15 + i * 20, y + height / 2, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    } else if (type === PlatformType.Breakable) {
      gradient = ctx.createLinearGradient(x, y, x, y + height)
      gradient.addColorStop(0, '#FECDD3')
      gradient.addColorStop(0.5, '#FDA4AF')
      gradient.addColorStop(1, '#FB7185')
      
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, 12)
      ctx.fill()
      
      ctx.strokeStyle = '#FFE4E6'
      ctx.lineWidth = 3
      ctx.stroke()
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      ctx.strokeRect(x + 4, y + 4, width - 8, height - 8)
      ctx.setLineDash([])
    } else {
      gradient = ctx.createLinearGradient(x, y, x, y + height)
      gradient.addColorStop(0, '#D9F99D')
      gradient.addColorStop(0.5, '#A3E635')
      gradient.addColorStop(1, '#84CC16')
      
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, 12)
      ctx.fill()
      
      ctx.strokeStyle = '#F7FEE7'
      ctx.lineWidth = 3
      ctx.stroke()
      
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.beginPath()
        ctx.arc(x + 10 + i * 15, y + height / 2, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.beginPath()
    ctx.roundRect(x + 5, y + 2, width - 10, height / 2.8, 6)
    ctx.fill()
    
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }

  const drawCarrot = (ctx: CanvasRenderingContext2D, carrot: Collectible) => {
    if (carrot.collected) return
    
    const centerX = carrot.x + carrot.width / 2
    const centerY = carrot.y + carrot.height / 2
    const time = performance.now() / 1000
    const bounce = Math.sin(time * 3 + centerX) * 2
    
    ctx.shadowColor = 'rgba(249, 115, 22, 0.3)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 4
    
    const leafGradient = ctx.createLinearGradient(centerX, carrot.y - 8 + bounce, centerX, carrot.y + 4 + bounce)
    leafGradient.addColorStop(0, '#BEF264')
    leafGradient.addColorStop(0.5, '#84CC16')
    leafGradient.addColorStop(1, '#65A30D')
    
    ctx.fillStyle = leafGradient
    ctx.beginPath()
    ctx.moveTo(centerX - 7, carrot.y + 2 + bounce)
    ctx.quadraticCurveTo(centerX - 5, carrot.y - 7 + bounce, centerX - 2, carrot.y + 2 + bounce)
    ctx.fill()
    
    ctx.beginPath()
    ctx.moveTo(centerX - 2, carrot.y + 2 + bounce)
    ctx.quadraticCurveTo(centerX + 1, carrot.y - 9 + bounce, centerX + 4, carrot.y + 2 + bounce)
    ctx.fill()
    
    ctx.beginPath()
    ctx.moveTo(centerX + 2, carrot.y + 2 + bounce)
    ctx.quadraticCurveTo(centerX + 5, carrot.y - 6 + bounce, centerX + 8, carrot.y + 2 + bounce)
    ctx.fill()
    
    const carrotGradient = ctx.createLinearGradient(centerX - carrot.width / 2, centerY + bounce, centerX + carrot.width / 2, centerY + bounce)
    carrotGradient.addColorStop(0, '#FDBA74')
    carrotGradient.addColorStop(0.3, '#FB923C')
    carrotGradient.addColorStop(0.7, '#F97316')
    carrotGradient.addColorStop(1, '#EA580C')
    
    ctx.fillStyle = carrotGradient
    ctx.beginPath()
    ctx.moveTo(centerX, carrot.y + bounce)
    ctx.lineTo(centerX + carrot.width * 0.28, centerY + bounce)
    ctx.lineTo(centerX + carrot.width * 0.15, carrot.y + carrot.height - 4 + bounce)
    ctx.lineTo(centerX - carrot.width * 0.15, carrot.y + carrot.height - 4 + bounce)
    ctx.lineTo(centerX - carrot.width * 0.28, centerY + bounce)
    ctx.closePath()
    ctx.fill()
    
    ctx.strokeStyle = '#C2410C'
    ctx.lineWidth = 1.5
    ctx.stroke()
    
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.5)'
    ctx.lineWidth = 1
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(centerX - 3, carrot.y + 8 + i * 4 + bounce)
      ctx.lineTo(centerX + 3, carrot.y + 10 + i * 4 + bounce)
      ctx.stroke()
    }
    
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
  }

  const render = (
    ctx: CanvasRenderingContext2D,
    data: typeof gameDataRef.current
  ) => {
    if (!data) return

    const { player, platforms, collectibles, cameraY } = data

    const bgGradient = ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.HEIGHT)
    bgGradient.addColorStop(0, '#FDF4FF')
    bgGradient.addColorStop(0.3, '#FCE7F3')
    bgGradient.addColorStop(0.6, '#E0E7FF')
    bgGradient.addColorStop(1, '#DBEAFE')
    ctx.fillStyle = bgGradient
    ctx.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT)
    
    const time = performance.now() / 1000
    const starPositions = [
      [80, 100], [320, 150], [150, 280], [380, 320], [50, 450],
      [250, 520], [100, 650], [350, 700], [180, 820], [290, 900]
    ]
    starPositions.forEach(([sx, sy], i) => {
      const offsetY = ((cameraY * 0.2 + sy) % (GAME_CONFIG.HEIGHT + 300))
      const twinkle = Math.sin(time * 2 + i) * 0.3 + 0.7
      ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * 0.8})`
      ctx.beginPath()
      const size = 3 + Math.sin(time + i) * 1
      for (let j = 0; j < 5; j++) {
        const angle = (j * 4 * Math.PI / 5) - Math.PI / 2
        const radius = j % 2 === 0 ? size : size / 2
        const px = sx + Math.cos(angle) * radius
        const py = offsetY + Math.sin(angle) * radius
        if (j === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
    })
    
    const cloudY = [120, 280, 460, 620, 780]
    const cloudX = [60, 220, 340, 100, 300]
    cloudY.forEach((cy, i) => {
      const offsetY = ((cameraY * 0.25 + cy) % (GAME_CONFIG.HEIGHT + 250))
      const float = Math.sin(time * 0.5 + i * 2) * 3
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
      ctx.shadowColor = 'rgba(255, 255, 255, 0.5)'
      ctx.shadowBlur = 15
      ctx.beginPath()
      ctx.arc(cloudX[i], offsetY + float, 22, 0, Math.PI * 2)
      ctx.arc(cloudX[i] + 22, offsetY - 2 + float, 30, 0, Math.PI * 2)
      ctx.arc(cloudX[i] + 48, offsetY + float, 24, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
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

    const heightProgress = data.startY - data.maxHeight
    const heightScore = Math.floor(heightProgress * GAME_CONFIG.SCORING.HEIGHT_FACTOR)
    const collectScore = data.carrotCount * GAME_CONFIG.SCORING.CARROT_POINTS
    const displayScore = heightScore + collectScore

    const scoreGradient = ctx.createLinearGradient(10, 10, 10, 80)
    scoreGradient.addColorStop(0, 'rgba(255, 255, 255, 0.98)')
    scoreGradient.addColorStop(1, 'rgba(254, 240, 255, 0.95)')
    ctx.fillStyle = scoreGradient
    ctx.shadowColor = 'rgba(219, 39, 119, 0.15)'
    ctx.shadowBlur = 15
    ctx.shadowOffsetY = 3
    ctx.beginPath()
    ctx.roundRect(10, 10, 240, 75, 18)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.3)'
    ctx.lineWidth = 2
    ctx.stroke()
    
    const scoreTextGradient = ctx.createLinearGradient(0, 20, 0, 60)
    scoreTextGradient.addColorStop(0, '#DB2777')
    scoreTextGradient.addColorStop(1, '#BE185D')
    ctx.fillStyle = scoreTextGradient
    ctx.font = 'bold 32px Fredoka, sans-serif'
    ctx.fillText(`分數: ${displayScore}`, 28, 52)
    
    if (data.carrotCount > 0) {
      ctx.font = 'bold 20px Fredoka, sans-serif'
      const carrotGradient = ctx.createLinearGradient(0, 55, 0, 75)
      carrotGradient.addColorStop(0, '#F97316')
      carrotGradient.addColorStop(1, '#EA580C')
      ctx.fillStyle = carrotGradient
      ctx.fillText(`🥕 × ${data.carrotCount}`, 28, 73)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200 animate-gradient-shift">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={GAME_CONFIG.WIDTH}
          height={GAME_CONFIG.HEIGHT}
          className="border-[10px] border-white rounded-[2rem] shadow-[0_20px_60px_rgba(219,39,119,0.3)]"
          style={{
            boxShadow: '0 20px 60px rgba(219, 39, 119, 0.3), 0 0 0 3px rgba(236, 72, 153, 0.2)'
          }}
        />

        {gameState === GameState.Menu && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-pink-50/98 via-purple-50/98 to-blue-50/98 backdrop-blur-sm rounded-[2rem]">
            <div className="text-center space-y-8 px-6">
              <div className="inline-block animate-bounce-slow">
                <div className="text-9xl mb-4 filter drop-shadow-lg animate-wiggle">🐰</div>
              </div>
              <h1 className="text-8xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-4 drop-shadow-sm animate-gradient-x" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                跳跳兔
              </h1>
              <div className="inline-block bg-white/70 px-8 py-4 rounded-3xl backdrop-blur-sm shadow-lg">
                <p className="text-2xl text-purple-600 font-semibold">
                  跳上平台，收集胡蘿蔔！
                </p>
                <div className="flex items-center justify-center gap-3 mt-2 text-3xl">
                  <span className="animate-bounce" style={{ animationDelay: '0s' }}>🥕</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>✨</span>
                  <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>💖</span>
                </div>
              </div>
              <Button 
                size="lg" 
                onClick={startGame} 
                className="gap-3 text-2xl px-12 py-8 rounded-3xl bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 hover:from-pink-600 hover:via-purple-600 hover:to-pink-600 shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 animate-pulse-slow border-4 border-white/50"
              >
                <Play size={32} weight="fill" />
                <span className="font-bold">開始遊戲</span>
              </Button>
              {bestScore > 0 && (
                <div className="mt-8 p-6 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-3xl backdrop-blur-sm shadow-lg border-4 border-white/60">
                  <div className="text-xl text-purple-600 mb-2 font-semibold">👑 最高分數 👑</div>
                  <div className="text-5xl font-bold bg-gradient-to-r from-yellow-500 via-orange-500 to-pink-500 bg-clip-text text-transparent">
                    {bestScore}
                  </div>
                </div>
              )}
              <div className="mt-8 bg-white/50 rounded-2xl p-4 backdrop-blur-sm">
                <p className="text-lg text-purple-600 font-semibold">✨ 使用 ← → 或 A D 鍵移動 ✨</p>
              </div>
            </div>
          </div>
        )}

        {gameState === GameState.GameOver && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <Card className="p-12 max-w-md mx-4 text-center bg-gradient-to-br from-white via-pink-50 to-purple-50 backdrop-blur-sm border-[6px] border-white shadow-2xl rounded-[2rem]">
              <div className="text-7xl mb-6 animate-bounce-slow">💫</div>
              <h2 className="text-6xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-8 animate-gradient-x" style={{ fontFamily: 'Fredoka, sans-serif' }}>
                遊戲結束
              </h2>
              <div className="mb-10 space-y-5">
                <div className="p-8 bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 rounded-3xl shadow-lg border-4 border-white/70">
                  <p className="text-2xl text-purple-600 mb-3 font-semibold">
                    你的分數
                  </p>
                  <p className="text-7xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                    {currentScore}
                  </p>
                </div>
                <div className="p-6 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-3xl shadow-md border-4 border-white/70">
                  <p className="text-xl text-purple-600 font-semibold">
                    👑 最高分數: <span className="text-3xl font-bold text-orange-600">{bestScore}</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-5 justify-center">
                <Button 
                  onClick={handleRestart} 
                  size="lg" 
                  className="gap-3 px-8 py-7 text-xl rounded-3xl bg-gradient-to-r from-pink-500 via-purple-500 to-pink-500 hover:from-pink-600 hover:via-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all border-4 border-white/50"
                >
                  <ArrowsClockwise size={28} weight="bold" />
                  <span className="font-bold">再玩一次</span>
                </Button>
                <Button 
                  onClick={handleMenu} 
                  variant="outline" 
                  size="lg" 
                  className="gap-3 px-8 py-7 text-xl rounded-3xl border-4 border-purple-300 hover:bg-purple-50 hover:border-purple-400 shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                >
                  <House size={28} weight="bold" />
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
