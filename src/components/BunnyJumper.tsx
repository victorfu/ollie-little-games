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
    playerSquash: number
    playerLandTime: number
    collectParticles: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number }>
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
        
        data.playerSquash = 1.4
        data.playerLandTime = performance.now() / 1000

        if (platform.type === PlatformType.Breakable) {
          platform.isBreaking = true
          platform.breakTimer = GAME_CONFIG.PLATFORM.BREAK_DELAY
        }
      }
    })
    
    const currentTime = performance.now() / 1000
    const timeSinceLand = currentTime - data.playerLandTime
    if (timeSinceLand < 0.15) {
      data.playerSquash = 1.4 - (timeSinceLand / 0.15) * 0.4
    } else {
      data.playerSquash = 1
    }

    collectibles.forEach((carrot) => {
      if (!carrot.collected && checkCollision(player, carrot)) {
        carrot.collected = true
        data.carrotCount++
        
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 * i) / 8
          data.collectParticles.push({
            x: carrot.x + carrot.width / 2,
            y: carrot.y + carrot.height / 2,
            vx: Math.cos(angle) * (50 + Math.random() * 30),
            vy: Math.sin(angle) * (50 + Math.random() * 30) - 30,
            life: 1,
            maxLife: 0.6 + Math.random() * 0.4
          })
        }
      }
    })
    
    data.collectParticles.forEach((particle, index) => {
      particle.life -= deltaTime
      particle.x += particle.vx * deltaTime
      particle.y += particle.vy * deltaTime
      particle.vy += 200 * deltaTime
      
      if (particle.life <= 0) {
        data.collectParticles.splice(index, 1)
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

  const drawBunny = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    squashStretch: number,
    idleBounce: number
  ) => {
    const centerX = x + width / 2
    const centerY = y + height / 2
    
    ctx.save()
    ctx.translate(centerX, centerY + idleBounce)
    ctx.scale(1 / squashStretch, squashStretch)
    ctx.translate(-centerX, -(centerY + idleBounce))
    
    const earHeight = 18 * squashStretch
    const earWidth = 7
    const earSpacing = 11
    
    ctx.shadowColor = 'rgba(255, 182, 217, 0.35)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 4
    
    ctx.fillStyle = '#FFE5F0'
    ctx.beginPath()
    ctx.ellipse(centerX - earSpacing, y + 3 + idleBounce, earWidth, earHeight, -0.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(centerX + earSpacing, y + 3 + idleBounce, earWidth, earHeight, 0.15, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.fillStyle = '#FFB6D9'
    ctx.beginPath()
    ctx.ellipse(centerX - earSpacing, y + 6 + idleBounce, 3.5, 11, -0.15, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(centerX + earSpacing, y + 6 + idleBounce, 3.5, 11, 0.15, 0, Math.PI * 2)
    ctx.fill()
    
    const bodyGradient = ctx.createRadialGradient(centerX, centerY + 2 + idleBounce, 0, centerX, centerY + 2 + idleBounce, width * 0.5)
    bodyGradient.addColorStop(0, '#FFFFFF')
    bodyGradient.addColorStop(0.7, '#FFF5F7')
    bodyGradient.addColorStop(1, '#FFE5F0')
    
    ctx.fillStyle = bodyGradient
    ctx.beginPath()
    ctx.arc(centerX, centerY + 4 + idleBounce, width * 0.48, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.shadowBlur = 0
    ctx.strokeStyle = '#FFB6D9'
    ctx.lineWidth = 2
    ctx.stroke()
    
    const eyeY = centerY - 1 + idleBounce
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
    ctx.arc(centerX - 13, centerY + 2 + idleBounce, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(centerX + 13, centerY + 2 + idleBounce, 4, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.restore()
    ctx.shadowColor = 'transparent'
  }

  const drawPlatform = (ctx: CanvasRenderingContext2D, platform: Platform, time: number) => {
    const { x, y, width, height, type, isBreaking } = platform
    
    const bobAmount = type === PlatformType.Moving ? Math.sin(time * 2 + x) * 1.5 : Math.sin(time * 1.5 + x * 0.1) * 0.8
    const drawY = y + bobAmount
    
    if (isBreaking) {
      ctx.globalAlpha = 0.4
    }
    
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 5
    
    let gradient
    if (type === PlatformType.Moving) {
      gradient = ctx.createLinearGradient(x, drawY, x, drawY + height)
      gradient.addColorStop(0, '#F3E8FF')
      gradient.addColorStop(0.3, '#E9D5FF')
      gradient.addColorStop(0.7, '#C084FC')
      gradient.addColorStop(1, '#A855F7')
      
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.roundRect(x, drawY, width, height, 14)
      ctx.fill()
      
      ctx.strokeStyle = '#FAF5FF'
      ctx.lineWidth = 3.5
      ctx.stroke()
      
      for (let i = 0; i < 3; i++) {
        const pulse = Math.sin(time * 4 + i) * 0.3 + 0.7
        ctx.fillStyle = `rgba(255, 255, 255, ${pulse * 0.5})`
        ctx.beginPath()
        ctx.arc(x + 15 + i * 20, drawY + height / 2, 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
      
      const sparkle = Math.sin(time * 3 + x) * 0.3 + 0.7
      ctx.strokeStyle = `rgba(255, 255, 255, ${sparkle * 0.4})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x + width - 12, drawY + 5)
      ctx.lineTo(x + width - 8, drawY + height - 5)
      ctx.stroke()
    } else if (type === PlatformType.Breakable) {
      gradient = ctx.createLinearGradient(x, drawY, x, drawY + height)
      gradient.addColorStop(0, '#FFE4E6')
      gradient.addColorStop(0.3, '#FECDD3')
      gradient.addColorStop(0.7, '#FDA4AF')
      gradient.addColorStop(1, '#FB7185')
      
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.roundRect(x, drawY, width, height, 14)
      ctx.fill()
      
      ctx.strokeStyle = '#FFF1F2'
      ctx.lineWidth = 3.5
      ctx.stroke()
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.strokeRect(x + 5, drawY + 5, width - 10, height - 10)
      ctx.setLineDash([])
      
      const crackAlpha = isBreaking ? 0.8 : 0.3
      ctx.strokeStyle = `rgba(190, 18, 60, ${crackAlpha})`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x + width * 0.3, drawY + 4)
      ctx.lineTo(x + width * 0.35, drawY + height - 4)
      ctx.moveTo(x + width * 0.65, drawY + 4)
      ctx.lineTo(x + width * 0.6, drawY + height - 4)
      ctx.stroke()
    } else {
      gradient = ctx.createLinearGradient(x, drawY, x, drawY + height)
      gradient.addColorStop(0, '#F7FEE7')
      gradient.addColorStop(0.3, '#ECFCCB')
      gradient.addColorStop(0.7, '#D9F99D')
      gradient.addColorStop(1, '#BEF264')
      
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.roundRect(x, drawY, width, height, 14)
      ctx.fill()
      
      ctx.strokeStyle = '#FEFCE8'
      ctx.lineWidth = 3.5
      ctx.stroke()
      
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.beginPath()
        ctx.arc(x + 12 + i * 18, drawY + height / 2, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
      
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 'rgba(132, 204, 22, 0.2)'
        ctx.beginPath()
        ctx.arc(x + 20 + i * 20, drawY + height / 2 + 2, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.beginPath()
    ctx.roundRect(x + 6, drawY + 3, width - 12, height / 3, 8)
    ctx.fill()
    
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }

  const drawCarrot = (ctx: CanvasRenderingContext2D, carrot: Collectible, time: number) => {
    if (carrot.collected) return
    
    const centerX = carrot.x + carrot.width / 2
    const centerY = carrot.y + carrot.height / 2
    const bounce = Math.sin(time * 3 + centerX) * 3
    const pulse = Math.sin(time * 4 + centerX) * 0.1 + 1
    const rotation = Math.sin(time * 2 + centerX) * 0.05
    
    ctx.save()
    ctx.translate(centerX, centerY + bounce)
    ctx.rotate(rotation)
    ctx.scale(pulse, pulse)
    ctx.translate(-centerX, -(centerY + bounce))
    
    ctx.shadowColor = 'rgba(249, 115, 22, 0.4)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 5
    
    const leafGradient = ctx.createLinearGradient(centerX, carrot.y - 8 + bounce, centerX, carrot.y + 4 + bounce)
    leafGradient.addColorStop(0, '#D9F99D')
    leafGradient.addColorStop(0.5, '#BEF264')
    leafGradient.addColorStop(1, '#84CC16')
    
    ctx.fillStyle = leafGradient
    ctx.beginPath()
    ctx.moveTo(centerX - 7, carrot.y + 2 + bounce)
    ctx.quadraticCurveTo(centerX - 5, carrot.y - 8 + bounce, centerX - 2, carrot.y + 2 + bounce)
    ctx.fill()
    
    ctx.beginPath()
    ctx.moveTo(centerX - 2, carrot.y + 2 + bounce)
    ctx.quadraticCurveTo(centerX + 1, carrot.y - 10 + bounce, centerX + 4, carrot.y + 2 + bounce)
    ctx.fill()
    
    ctx.beginPath()
    ctx.moveTo(centerX + 2, carrot.y + 2 + bounce)
    ctx.quadraticCurveTo(centerX + 5, carrot.y - 7 + bounce, centerX + 8, carrot.y + 2 + bounce)
    ctx.fill()
    
    const carrotGradient = ctx.createLinearGradient(centerX - carrot.width / 2, centerY + bounce, centerX + carrot.width / 2, centerY + bounce)
    carrotGradient.addColorStop(0, '#FDBA74')
    carrotGradient.addColorStop(0.3, '#FB923C')
    carrotGradient.addColorStop(0.7, '#F97316')
    carrotGradient.addColorStop(1, '#EA580C')
    
    ctx.fillStyle = carrotGradient
    ctx.beginPath()
    ctx.moveTo(centerX, carrot.y + bounce)
    ctx.lineTo(centerX + carrot.width * 0.3, centerY + bounce)
    ctx.lineTo(centerX + carrot.width * 0.18, carrot.y + carrot.height - 4 + bounce)
    ctx.lineTo(centerX - carrot.width * 0.18, carrot.y + carrot.height - 4 + bounce)
    ctx.lineTo(centerX - carrot.width * 0.3, centerY + bounce)
    ctx.closePath()
    ctx.fill()
    
    ctx.strokeStyle = '#C2410C'
    ctx.lineWidth = 2
    ctx.stroke()
    
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.6)'
    ctx.lineWidth = 1.2
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(centerX - 4, carrot.y + 8 + i * 5 + bounce)
      ctx.lineTo(centerX + 4, carrot.y + 10 + i * 5 + bounce)
      ctx.stroke()
    }
    
    const glowPulse = Math.sin(time * 6) * 0.2 + 0.3
    ctx.strokeStyle = `rgba(251, 146, 60, ${glowPulse})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(centerX, centerY + bounce, carrot.width * 0.7, 0, Math.PI * 2)
    ctx.stroke()
    
    ctx.restore()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
  }

  const render = (
    ctx: CanvasRenderingContext2D,
    data: typeof gameDataRef.current
  ) => {
    if (!data) return

    const { player, platforms, collectibles, cameraY, collectParticles, playerSquash } = data
    const time = performance.now() / 1000

    const bgGradient = ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.HEIGHT)
    bgGradient.addColorStop(0, '#E0F2FE')
    bgGradient.addColorStop(0.3, '#F0F9FF')
    bgGradient.addColorStop(0.6, '#FCE7F3')
    bgGradient.addColorStop(1, '#FDF4FF')
    ctx.fillStyle = bgGradient
    ctx.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT)
    
    const starPositions = [
      [80, 100], [320, 150], [150, 280], [380, 320], [50, 450],
      [250, 520], [100, 650], [350, 700], [180, 820], [290, 900]
    ]
    starPositions.forEach(([sx, sy], i) => {
      const offsetY = ((cameraY * 0.15 + sy) % (GAME_CONFIG.HEIGHT + 300))
      const twinkle = Math.sin(time * 2 + i) * 0.3 + 0.7
      ctx.fillStyle = `rgba(255, 255, 255, ${twinkle * 0.9})`
      ctx.shadowColor = `rgba(255, 255, 255, ${twinkle * 0.5})`
      ctx.shadowBlur = 4
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
    ctx.shadowBlur = 0
    
    const cloudY = [120, 280, 460, 620, 780]
    const cloudX = [60, 220, 340, 100, 300]
    cloudY.forEach((cy, i) => {
      const offsetY = ((cameraY * 0.2 + cy) % (GAME_CONFIG.HEIGHT + 250))
      const float = Math.sin(time * 0.5 + i * 2) * 4
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
      ctx.shadowColor = 'rgba(255, 255, 255, 0.6)'
      ctx.shadowBlur = 18
      ctx.beginPath()
      ctx.arc(cloudX[i], offsetY + float, 24, 0, Math.PI * 2)
      ctx.arc(cloudX[i] + 24, offsetY - 2 + float, 32, 0, Math.PI * 2)
      ctx.arc(cloudX[i] + 52, offsetY + float, 26, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    })

    ctx.save()
    ctx.translate(0, -cameraY)

    platforms.forEach((platform) => {
      drawPlatform(ctx, platform, time)
    })

    collectibles.forEach((carrot) => {
      drawCarrot(ctx, carrot, time)
    })
    
    collectParticles.forEach((particle) => {
      const alpha = particle.life / particle.maxLife
      ctx.fillStyle = `rgba(251, 146, 60, ${alpha})`
      ctx.shadowColor = `rgba(249, 115, 22, ${alpha * 0.5})`
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, 3 * alpha, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.fillStyle = `rgba(254, 215, 170, ${alpha * 0.8})`
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, 1.5 * alpha, 0, Math.PI * 2)
      ctx.fill()
    })
    ctx.shadowBlur = 0

    const idleBounce = Math.sin(time * 3) * 1.5
    drawBunny(ctx, player.x, player.y, player.width, player.height, playerSquash, idleBounce)

    ctx.restore()

    const heightProgress = data.startY - data.maxHeight
    const heightScore = Math.floor(heightProgress * GAME_CONFIG.SCORING.HEIGHT_FACTOR)
    const collectScore = data.carrotCount * GAME_CONFIG.SCORING.CARROT_POINTS
    const displayScore = heightScore + collectScore

    const hudGradient = ctx.createLinearGradient(GAME_CONFIG.WIDTH / 2 - 120, 12, GAME_CONFIG.WIDTH / 2 + 120, 12)
    hudGradient.addColorStop(0, 'rgba(255, 240, 245, 0.97)')
    hudGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.98)')
    hudGradient.addColorStop(1, 'rgba(252, 231, 243, 0.97)')
    ctx.fillStyle = hudGradient
    ctx.shadowColor = 'rgba(219, 39, 119, 0.2)'
    ctx.shadowBlur = 20
    ctx.shadowOffsetY = 4
    ctx.beginPath()
    ctx.roundRect(GAME_CONFIG.WIDTH / 2 - 120, 12, 240, 70, 20)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.25)'
    ctx.lineWidth = 2.5
    ctx.stroke()
    
    ctx.font = 'bold 22px Fredoka, sans-serif'
    const scoreGrad = ctx.createLinearGradient(0, 20, 0, 60)
    scoreGrad.addColorStop(0, '#EC4899')
    scoreGrad.addColorStop(1, '#DB2777')
    ctx.fillStyle = scoreGrad
    ctx.fillText('分數', GAME_CONFIG.WIDTH / 2 - 105, 40)
    
    ctx.font = 'bold 32px Fredoka, sans-serif'
    const numberGrad = ctx.createLinearGradient(0, 50, 0, 75)
    numberGrad.addColorStop(0, '#DB2777')
    numberGrad.addColorStop(1, '#BE185D')
    ctx.fillStyle = numberGrad
    ctx.fillText(`${displayScore}`, GAME_CONFIG.WIDTH / 2 - 105, 68)
    
    if (data.carrotCount > 0) {
      ctx.font = 'bold 20px Fredoka, sans-serif'
      const carrotGrad = ctx.createLinearGradient(0, 52, 0, 72)
      carrotGrad.addColorStop(0, '#F97316')
      carrotGrad.addColorStop(1, '#EA580C')
      ctx.fillStyle = carrotGrad
      ctx.fillText(`🥕 × ${data.carrotCount}`, GAME_CONFIG.WIDTH / 2 + 15, 55)
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
