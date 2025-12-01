import { useEffect, useRef, useState } from "react";
import { GAME_CONFIG } from "@/lib/constants";
import {
  GameState,
  Player,
  Platform,
  Collectible,
  PlatformType,
} from "@/lib/types";
import {
  checkCollision,
  clamp,
  randomInt,
  getBestScore,
  setBestScore,
} from "@/lib/game-utils";
import {
  createPlatform,
  createCarrot,
  selectPlatformType,
  getGapRange,
} from "@/lib/game-objects";

type CollectParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
};
type BackgroundStar = {
  x: number;
  y: number;
  size: number;
  twinkleSpeed: number;
  phase: number;
};
type FloatingDecor = {
  x: number;
  y: number;
  size: number;
  speed: number;
  type: "heart" | "star" | "flower";
  rotation: number;
};

type GameData = {
  player: Player;
  platforms: Platform[];
  collectibles: Collectible[];
  cameraY: number;
  startY: number;
  maxHeight: number;
  carrotCount: number;
  keys: Record<string, boolean>;
  lastTime: number;
  playerSquash: number;
  playerLandTime: number;
  collectParticles: CollectParticle[];
  bgStars: BackgroundStar[];
  floatingDecor: FloatingDecor[];
};

export default function BunnyJumper() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.Menu);
  const [currentScore, setCurrentScore] = useState(0);
  const [bestScore, setBestScoreState] = useState(0);
  const gameLoopRef = useRef<number | undefined>(undefined);
  const gameDataRef = useRef<GameData | undefined>(undefined);

  useEffect(() => {
    setBestScoreState(getBestScore());
  }, []);

  const initGame = () => {
    const player: Player = {
      x: GAME_CONFIG.WIDTH / 2 - GAME_CONFIG.PLAYER.WIDTH / 2,
      y: GAME_CONFIG.HEIGHT * GAME_CONFIG.PLAYER.START_Y_RATIO,
      width: GAME_CONFIG.PLAYER.WIDTH,
      height: GAME_CONFIG.PLAYER.HEIGHT,
      velocity: { x: 0, y: 0 },
      onGround: false,
    };

    const platforms: Platform[] = [];
    const collectibles: Collectible[] = [];
    let currentY = GAME_CONFIG.HEIGHT - 80;

    const startPlatform = createPlatform(
      GAME_CONFIG.WIDTH / 2 - GAME_CONFIG.PLATFORM.WIDTH / 2,
      currentY,
      PlatformType.Static,
    );
    platforms.push(startPlatform);

    for (let i = 1; i < GAME_CONFIG.INITIAL_PLATFORMS; i++) {
      const gapRange = getGapRange(0);
      const gap = randomInt(gapRange.min, gapRange.max);
      currentY -= gap;

      const x = randomInt(
        GAME_CONFIG.MARGIN_X,
        GAME_CONFIG.WIDTH - GAME_CONFIG.MARGIN_X - GAME_CONFIG.PLATFORM.WIDTH,
      );

      const platformType = i < 3 ? PlatformType.Static : selectPlatformType(0);
      const platform = createPlatform(x, currentY, platformType);
      platforms.push(platform);

      if (Math.random() < GAME_CONFIG.COLLECTIBLE.SPAWN_CHANCE) {
        collectibles.push(
          createCarrot(
            platform.x +
              platform.width / 2 -
              GAME_CONFIG.COLLECTIBLE.CARROT_SIZE / 2,
            platform.y,
          ),
        );
      }
    }

    player.y = startPlatform.y - GAME_CONFIG.PLAYER.HEIGHT - 5;

    // Generate background stars
    const bgStars: BackgroundStar[] = [];
    for (let i = 0; i < 40; i++) {
      bgStars.push({
        x: Math.random() * GAME_CONFIG.WIDTH,
        y: Math.random() * GAME_CONFIG.HEIGHT,
        size: Math.random() * 2 + 1,
        twinkleSpeed: Math.random() * 2 + 1,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Generate floating decorations
    const floatingDecor: FloatingDecor[] = [];
    const decorTypes: Array<"heart" | "star" | "flower"> = [
      "heart",
      "star",
      "flower",
    ];
    for (let i = 0; i < 8; i++) {
      floatingDecor.push({
        x: Math.random() * GAME_CONFIG.WIDTH,
        y: Math.random() * GAME_CONFIG.HEIGHT,
        size: Math.random() * 12 + 8,
        speed: Math.random() * 20 + 10,
        type: decorTypes[Math.floor(Math.random() * decorTypes.length)],
        rotation: Math.random() * Math.PI * 2,
      });
    }

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
      bgStars,
      floatingDecor,
    };
  };

  const startGame = () => {
    initGame();
    setGameState(GameState.Playing);
    setCurrentScore(0);
  };

  const handleRestart = () => {
    startGame();
  };

  const handleMenu = () => {
    setGameState(GameState.Menu);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameDataRef.current) return;
      gameDataRef.current.keys[e.key.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!gameDataRef.current) return;
      gameDataRef.current.keys[e.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (gameState !== GameState.Playing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gameLoop = (time: number) => {
      if (!gameDataRef.current) return;

      const data = gameDataRef.current;
      const deltaTime = Math.min((time - data.lastTime) / 1000, 0.05);
      data.lastTime = time;

      updateGame(deltaTime, data);
      render(ctx, data);

      const heightProgress = data.startY - data.maxHeight;
      const heightScore = Math.floor(
        heightProgress * GAME_CONFIG.SCORING.HEIGHT_FACTOR,
      );
      const collectScore = data.carrotCount * GAME_CONFIG.SCORING.CARROT_POINTS;
      const totalScore = heightScore + collectScore;
      setCurrentScore(totalScore);

      if (data.player.y > data.cameraY + GAME_CONFIG.HEIGHT + 100) {
        const best = getBestScore();
        if (totalScore > best) {
          setBestScore(totalScore);
          setBestScoreState(totalScore);
        }
        setGameState(GameState.GameOver);
        return;
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState]);

  const updateGame = (deltaTime: number, data: GameData) => {
    const { player, platforms, collectibles, keys } = data;

    let moveX = 0;
    if (keys["arrowleft"] || keys["a"]) moveX -= 1;
    if (keys["arrowright"] || keys["d"]) moveX += 1;

    player.velocity.x = moveX * GAME_CONFIG.MOVE_SPEED;
    player.velocity.y += GAME_CONFIG.GRAVITY * deltaTime;

    player.x += player.velocity.x * deltaTime;
    player.y += player.velocity.y * deltaTime;
    player.x = clamp(player.x, 0, GAME_CONFIG.WIDTH - player.width);

    player.onGround = false;

    platforms.forEach((platform) => {
      if (platform.isBreaking && platform.breakTimer !== undefined) {
        platform.breakTimer -= deltaTime * 1000;
        if (platform.breakTimer <= 0) {
          platform.x = -1000;
          platform.y = -1000;
        }
      }

      if (platform.movingData) {
        const { baseX, range, speed, direction } = platform.movingData;
        platform.x += direction * speed * deltaTime;

        if (platform.x < baseX - range / 2) {
          platform.x = baseX - range / 2;
          platform.movingData.direction = 1;
        } else if (platform.x > baseX + range / 2) {
          platform.x = baseX + range / 2;
          platform.movingData.direction = -1;
        }
      }

      const playerBottom = player.y + player.height;
      const playerPrevBottom = playerBottom - player.velocity.y * deltaTime;
      const platformTop = platform.y;

      if (
        !platform.isBreaking &&
        player.velocity.y > 0 &&
        checkCollision(player, platform) &&
        playerPrevBottom <= platformTop &&
        playerBottom >= platformTop
      ) {
        player.velocity.y = -GAME_CONFIG.JUMP_FORCE;
        player.onGround = true;
        player.y = platform.y - player.height;

        data.playerSquash = 1.4;
        data.playerLandTime = performance.now() / 1000;

        if (platform.type === PlatformType.Breakable) {
          platform.isBreaking = true;
          platform.breakTimer = GAME_CONFIG.PLATFORM.BREAK_DELAY;
        }
      }
    });

    const timeSinceLand = performance.now() / 1000 - data.playerLandTime;
    if (player.onGround) {
      data.playerSquash = 1.4;
    } else if (data.playerLandTime > 0 && timeSinceLand < 0.15) {
      data.playerSquash = 1.4 - (timeSinceLand / 0.15) * 0.4;
    } else {
      data.playerSquash = 1;
    }

    collectibles.forEach((carrot) => {
      if (!carrot.collected && checkCollision(player, carrot)) {
        carrot.collected = true;
        data.carrotCount++;
        const centerX = carrot.x + carrot.width / 2;
        const centerY = carrot.y + carrot.height / 2;
        const colors = ["#FF6B9D", "#FFB347", "#87CEEB", "#DDA0DD", "#98FB98"];
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.35;
          data.collectParticles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * (60 + Math.random() * 40),
            vy: Math.sin(angle) * (60 + Math.random() * 40) - 40,
            life: 1,
            maxLife: 0.8 + Math.random() * 0.4,
            color: colors[Math.floor(Math.random() * colors.length)],
          });
        }
      }
    });

    data.collectibles = data.collectibles.filter(
      (carrot) =>
        !carrot.collected && carrot.y <= data.cameraY + GAME_CONFIG.HEIGHT + 80,
    );

    for (let i = data.collectParticles.length - 1; i >= 0; i--) {
      const particle = data.collectParticles[i];
      particle.life -= deltaTime;
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.vy += 200 * deltaTime;

      if (particle.life <= 0) {
        data.collectParticles.splice(i, 1);
      }
    }

    data.maxHeight = Math.min(data.maxHeight, player.y);

    if (player.y < data.cameraY + GAME_CONFIG.HEIGHT * 0.4) {
      data.cameraY = player.y - GAME_CONFIG.HEIGHT * 0.4;
    }

    const heightProgress = data.startY - data.maxHeight;
    const gapRange = getGapRange(heightProgress);

    platforms.forEach((platform, index) => {
      if (platform.y > data.cameraY + GAME_CONFIG.HEIGHT + 50) {
        const newY = data.cameraY - randomInt(gapRange.min, gapRange.max);
        const newX = randomInt(
          GAME_CONFIG.MARGIN_X,
          GAME_CONFIG.WIDTH - GAME_CONFIG.MARGIN_X - GAME_CONFIG.PLATFORM.WIDTH,
        );
        const newType = selectPlatformType(heightProgress);
        const newPlatform = createPlatform(newX, newY, newType);
        platforms[index] = newPlatform;

        if (Math.random() < GAME_CONFIG.COLLECTIBLE.SPAWN_CHANCE) {
          data.collectibles.push(
            createCarrot(
              newPlatform.x +
                newPlatform.width / 2 -
                GAME_CONFIG.COLLECTIBLE.CARROT_SIZE / 2,
              newPlatform.y,
            ),
          );
        }
      }
    });
  };

  // 繪製可愛小兔子角色 - 新設計：直立耳朵、小花裝飾、棉花尾巴、肉球腳掌
  const drawRabbit = (
    ctx: CanvasRenderingContext2D,
    player: Player,
    squash: number,
    time: number,
  ) => {
    const width = player.width;
    const height = player.height;
    const centerX = player.x + width / 2;
    const centerY = player.y + height / 2;
    const bounce = Math.sin(time * 4) * 2;
    const earWiggle = Math.sin(time * 3) * 0.05;

    ctx.save();
    ctx.translate(centerX, centerY + bounce);
    ctx.scale(1 / squash, squash);
    ctx.translate(-centerX, -(centerY + bounce));

    // 陰影
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.beginPath();
    ctx.ellipse(
      centerX,
      player.y + height + 8 + bounce,
      20,
      6,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // 棉花球尾巴（在身體後面）
    const tailX = centerX + 22;
    const tailY = centerY + 8 + bounce;
    const tailWobble = Math.sin(time * 5) * 2;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(tailX + tailWobble, tailY, 8, 0, Math.PI * 2);
    ctx.fill();
    // 尾巴蓬鬆細節
    ctx.fillStyle = "#FFF8F0";
    ctx.beginPath();
    ctx.arc(tailX + tailWobble - 3, tailY - 3, 4, 0, Math.PI * 2);
    ctx.arc(tailX + tailWobble + 4, tailY - 2, 3, 0, Math.PI * 2);
    ctx.arc(tailX + tailWobble + 2, tailY + 4, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // 左耳（直立，帶微微擺動）
    ctx.save();
    ctx.translate(centerX - 14, player.y - 5 + bounce);
    ctx.rotate(-0.15 + earWiggle);
    // 外耳
    const leftEarGrad = ctx.createLinearGradient(-8, -25, 8, 0);
    leftEarGrad.addColorStop(0, "#FFF8F0");
    leftEarGrad.addColorStop(0.5, "#FFFAF5");
    leftEarGrad.addColorStop(1, "#F5E6D3");
    ctx.fillStyle = leftEarGrad;
    ctx.beginPath();
    ctx.ellipse(0, -12, 8, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    // 內耳粉色
    const innerEarGrad = ctx.createLinearGradient(0, -20, 0, 0);
    innerEarGrad.addColorStop(0, "#FFCCD5");
    innerEarGrad.addColorStop(1, "#FFB6C1");
    ctx.fillStyle = innerEarGrad;
    ctx.beginPath();
    ctx.ellipse(0, -10, 4.5, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 右耳（直立，帶微微擺動）
    ctx.save();
    ctx.translate(centerX + 14, player.y - 5 + bounce);
    ctx.rotate(0.15 - earWiggle);
    // 外耳
    const rightEarGrad = ctx.createLinearGradient(-8, -25, 8, 0);
    rightEarGrad.addColorStop(0, "#FFF8F0");
    rightEarGrad.addColorStop(0.5, "#FFFAF5");
    rightEarGrad.addColorStop(1, "#F5E6D3");
    ctx.fillStyle = rightEarGrad;
    ctx.beginPath();
    ctx.ellipse(0, -12, 8, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    // 內耳粉色
    ctx.fillStyle = innerEarGrad;
    ctx.beginPath();
    ctx.ellipse(0, -10, 4.5, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 圓圓蓬鬆身體
    const bodyGrad = ctx.createRadialGradient(
      centerX - 8,
      centerY - 8 + bounce,
      0,
      centerX,
      centerY + bounce,
      width * 0.58,
    );
    bodyGrad.addColorStop(0, "#FFFFFF");
    bodyGrad.addColorStop(0.4, "#FFFAF5");
    bodyGrad.addColorStop(0.7, "#FFF8F0");
    bodyGrad.addColorStop(1, "#F5E6D3");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(
      centerX,
      centerY + 5 + bounce,
      width * 0.5,
      height * 0.46,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // 白色肚子
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(
      centerX,
      centerY + 12 + bounce,
      width * 0.3,
      height * 0.26,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // 蓬鬆胸毛細節
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.beginPath();
    ctx.arc(centerX - 8, centerY + 5 + bounce, 4, 0, Math.PI * 2);
    ctx.arc(centerX + 8, centerY + 5 + bounce, 4, 0, Math.PI * 2);
    ctx.arc(centerX, centerY + 2 + bounce, 5, 0, Math.PI * 2);
    ctx.fill();

    // 大圓眼睛（動漫風格）
    // 眼白
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(centerX - 10, centerY - 5 + bounce, 7, 8, 0, 0, Math.PI * 2);
    ctx.ellipse(centerX + 10, centerY - 5 + bounce, 7, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 瞳孔（深棕色）
    ctx.fillStyle = "#2D1810";
    ctx.beginPath();
    ctx.ellipse(centerX - 10, centerY - 4 + bounce, 5, 6.5, 0, 0, Math.PI * 2);
    ctx.ellipse(centerX + 10, centerY - 4 + bounce, 5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 眼睛高光（大）
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(centerX - 12, centerY - 7 + bounce, 3, 0, Math.PI * 2);
    ctx.arc(centerX + 8, centerY - 7 + bounce, 3, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛高光（中）
    ctx.beginPath();
    ctx.arc(centerX - 8, centerY - 2 + bounce, 1.8, 0, Math.PI * 2);
    ctx.arc(centerX + 12, centerY - 2 + bounce, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛高光（小星星）
    ctx.beginPath();
    ctx.arc(centerX - 13, centerY - 3 + bounce, 1, 0, Math.PI * 2);
    ctx.arc(centerX + 7, centerY - 3 + bounce, 1, 0, Math.PI * 2);
    ctx.fill();

    // 粉紅圓形腮紅
    ctx.fillStyle = "rgba(255, 182, 193, 0.6)";
    ctx.beginPath();
    ctx.arc(centerX - 20, centerY + 2 + bounce, 5, 0, Math.PI * 2);
    ctx.arc(centerX + 20, centerY + 2 + bounce, 5, 0, Math.PI * 2);
    ctx.fill();

    // 小三角鼻子
    ctx.fillStyle = "#FFB0B0";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY + 3 + bounce);
    ctx.lineTo(centerX - 4, centerY + 8 + bounce);
    ctx.lineTo(centerX + 4, centerY + 8 + bounce);
    ctx.closePath();
    ctx.fill();
    // 鼻子高光
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    ctx.ellipse(centerX - 1, centerY + 5 + bounce, 1.5, 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // ω 形嘴巴
    ctx.strokeStyle = "#D4A0A0";
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(centerX - 6, centerY + 11 + bounce);
    ctx.quadraticCurveTo(
      centerX - 3,
      centerY + 15 + bounce,
      centerX,
      centerY + 12 + bounce,
    );
    ctx.quadraticCurveTo(
      centerX + 3,
      centerY + 15 + bounce,
      centerX + 6,
      centerY + 11 + bounce,
    );
    ctx.stroke();

    // 小腳掌（帶肉球）
    // 左腳
    ctx.fillStyle = "#FFF0E8";
    ctx.beginPath();
    ctx.ellipse(
      centerX - 12,
      centerY + height * 0.4 + bounce,
      9,
      6,
      -0.2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    // 左腳肉球
    ctx.fillStyle = "#FFCCD5";
    ctx.beginPath();
    ctx.ellipse(
      centerX - 12,
      centerY + height * 0.42 + bounce,
      4,
      2.5,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX - 16, centerY + height * 0.38 + bounce, 2, 0, Math.PI * 2);
    ctx.arc(centerX - 12, centerY + height * 0.36 + bounce, 2, 0, Math.PI * 2);
    ctx.arc(centerX - 8, centerY + height * 0.38 + bounce, 2, 0, Math.PI * 2);
    ctx.fill();

    // 右腳
    ctx.fillStyle = "#FFF0E8";
    ctx.beginPath();
    ctx.ellipse(
      centerX + 12,
      centerY + height * 0.4 + bounce,
      9,
      6,
      0.2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    // 右腳肉球
    ctx.fillStyle = "#FFCCD5";
    ctx.beginPath();
    ctx.ellipse(
      centerX + 12,
      centerY + height * 0.42 + bounce,
      4,
      2.5,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.beginPath();
    ctx.arc(centerX + 8, centerY + height * 0.38 + bounce, 2, 0, Math.PI * 2);
    ctx.arc(centerX + 12, centerY + height * 0.36 + bounce, 2, 0, Math.PI * 2);
    ctx.arc(centerX + 16, centerY + height * 0.38 + bounce, 2, 0, Math.PI * 2);
    ctx.fill();

    // 頭頂小花裝飾
    const flowerX = centerX + 8;
    const flowerY = player.y - 28 + bounce;
    const flowerBob = Math.sin(time * 3) * 1.5;

    // 花瓣（粉色）
    ctx.fillStyle = "#FFB6C1";
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const petalX = flowerX + Math.cos(angle) * 5;
      const petalY = flowerY + flowerBob + Math.sin(angle) * 5;
      ctx.beginPath();
      ctx.ellipse(petalX, petalY, 4, 6, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    // 花心（黃色）
    ctx.fillStyle = "#FFE066";
    ctx.beginPath();
    ctx.arc(flowerX, flowerY + flowerBob, 4, 0, Math.PI * 2);
    ctx.fill();
    // 花心高光
    ctx.fillStyle = "#FFF8DC";
    ctx.beginPath();
    ctx.arc(flowerX - 1, flowerY - 1 + flowerBob, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // 繪製雲朵平台
  const drawPlatform = (
    ctx: CanvasRenderingContext2D,
    platform: Platform,
    time: number,
  ) => {
    const { x, y, width, height, type, isBreaking } = platform;
    const float = Math.sin(time * 1.5 + x * 0.01) * 2;
    const drawY = y + float;

    ctx.save();

    if (type === PlatformType.Moving) {
      // 紫色彩虹雲
      ctx.shadowColor = "rgba(186, 135, 255, 0.4)";
      ctx.shadowBlur = 15;
      const grad = ctx.createLinearGradient(x, drawY, x + width, drawY);
      grad.addColorStop(0, "#E8D5FF");
      grad.addColorStop(0.5, "#DFC7FF");
      grad.addColorStop(1, "#D4B8FF");
      ctx.fillStyle = grad;

      // 雲朵形狀
      ctx.beginPath();
      ctx.arc(x + 20, drawY + height / 2, 14, 0, Math.PI * 2);
      ctx.arc(x + width / 2, drawY + height / 2 - 3, 18, 0, Math.PI * 2);
      ctx.arc(x + width - 20, drawY + height / 2, 14, 0, Math.PI * 2);
      ctx.fill();

      // 星星裝飾
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      drawStar(ctx, x + width / 2, drawY + height / 2, 5, 3);
    } else if (type === PlatformType.Breakable) {
      // 粉色棉花糖雲
      ctx.shadowColor = "rgba(255, 182, 193, 0.4)";
      ctx.shadowBlur = 12;
      const grad = ctx.createLinearGradient(x, drawY, x + width, drawY);
      grad.addColorStop(0, "#FFE4EC");
      grad.addColorStop(0.5, "#FFD6E0");
      grad.addColorStop(1, "#FFC8D7");
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.arc(x + 18, drawY + height / 2, 12, 0, Math.PI * 2);
      ctx.arc(x + width / 2, drawY + height / 2 - 2, 16, 0, Math.PI * 2);
      ctx.arc(x + width - 18, drawY + height / 2, 12, 0, Math.PI * 2);
      ctx.fill();

      if (isBreaking) {
        ctx.globalAlpha = 0.6 + Math.sin(time * 20) * 0.3;
      }
    } else {
      // 普通白色蓬鬆雲
      ctx.shadowColor = "rgba(135, 206, 235, 0.3)";
      ctx.shadowBlur = 12;
      const grad = ctx.createLinearGradient(
        x,
        drawY - 5,
        x,
        drawY + height + 5,
      );
      grad.addColorStop(0, "#FFFFFF");
      grad.addColorStop(0.5, "#F8FCFF");
      grad.addColorStop(1, "#E8F4FC");
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.arc(x + 15, drawY + height / 2 + 2, 13, 0, Math.PI * 2);
      ctx.arc(x + 35, drawY + height / 2 - 4, 16, 0, Math.PI * 2);
      ctx.arc(x + width / 2, drawY + height / 2 - 2, 18, 0, Math.PI * 2);
      ctx.arc(x + width - 35, drawY + height / 2 - 4, 16, 0, Math.PI * 2);
      ctx.arc(x + width - 15, drawY + height / 2 + 2, 13, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  // 繪製星星輔助函數
  const drawStar = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    outerR: number,
    innerR: number,
  ) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outerAngle = Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const innerAngle = outerAngle + Math.PI / 5;
      if (i === 0) {
        ctx.moveTo(
          cx + outerR * Math.cos(outerAngle),
          cy - outerR * Math.sin(outerAngle),
        );
      } else {
        ctx.lineTo(
          cx + outerR * Math.cos(outerAngle),
          cy - outerR * Math.sin(outerAngle),
        );
      }
      ctx.lineTo(
        cx + innerR * Math.cos(innerAngle),
        cy - innerR * Math.sin(innerAngle),
      );
    }
    ctx.closePath();
    ctx.fill();
  };

  // 繪製愛心輔助函數
  const drawHeart = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
  ) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.3);
    ctx.bezierCurveTo(
      cx - size * 0.5,
      cy - size * 0.3,
      cx - size,
      cy + size * 0.3,
      cx,
      cy + size,
    );
    ctx.bezierCurveTo(
      cx + size,
      cy + size * 0.3,
      cx + size * 0.5,
      cy - size * 0.3,
      cx,
      cy + size * 0.3,
    );
    ctx.fill();
  };

  // 繪製花朵輔助函數
  const drawFlower = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
  ) => {
    const petalCount = 5;
    for (let i = 0; i < petalCount; i++) {
      const angle = (i * Math.PI * 2) / petalCount;
      const px = cx + Math.cos(angle) * size * 0.4;
      const py = cy + Math.sin(angle) * size * 0.4;
      ctx.beginPath();
      ctx.ellipse(px, py, size * 0.35, size * 0.2, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#FFE066";
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.2, 0, Math.PI * 2);
    ctx.fill();
  };

  // 繪製收集物 - 閃亮寶石
  const drawCollectible = (
    ctx: CanvasRenderingContext2D,
    item: Collectible,
    time: number,
  ) => {
    if (item.collected) return;
    const centerX = item.x + item.width / 2;
    const centerY = item.y + item.height / 2;
    const float = Math.sin(time * 3 + centerX * 0.1) * 4;
    const rotate = Math.sin(time * 2) * 0.15;
    const pulse = 1 + Math.sin(time * 4) * 0.1;

    ctx.save();
    ctx.translate(centerX, centerY + float);
    ctx.rotate(rotate);
    ctx.scale(pulse, pulse);

    // 光暈
    ctx.shadowColor = "rgba(255, 215, 0, 0.6)";
    ctx.shadowBlur = 20;

    // 鑽石形狀
    const size = 14;
    const grad = ctx.createLinearGradient(-size, -size, size, size);
    grad.addColorStop(0, "#FFE566");
    grad.addColorStop(0.3, "#FFD700");
    grad.addColorStop(0.6, "#FFC125");
    grad.addColorStop(1, "#FFB347");
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.7, -size * 0.3);
    ctx.lineTo(size * 0.7, size * 0.3);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.7, size * 0.3);
    ctx.lineTo(-size * 0.7, -size * 0.3);
    ctx.closePath();
    ctx.fill();

    // 高光
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, -size * 0.6);
    ctx.lineTo(size * 0.1, -size * 0.6);
    ctx.lineTo(size * 0.2, -size * 0.2);
    ctx.lineTo(-size * 0.2, -size * 0.2);
    ctx.closePath();
    ctx.fill();

    // 閃爍星星
    ctx.fillStyle = "#FFFFFF";
    const sparkleSize = 3 + Math.sin(time * 6) * 1.5;
    drawStar(ctx, size * 0.5, -size * 0.5, sparkleSize, sparkleSize * 0.4);

    ctx.restore();
  };

  const render = (ctx: CanvasRenderingContext2D, data: GameData) => {
    const time = performance.now() / 1000;
    const {
      player,
      platforms,
      collectibles,
      cameraY,
      collectParticles,
      playerSquash,
      bgStars,
      floatingDecor,
    } = data;

    ctx.clearRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);

    // 漸層天空背景
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.HEIGHT);
    skyGrad.addColorStop(0, "#E8F6FF");
    skyGrad.addColorStop(0.3, "#D4EDFC");
    skyGrad.addColorStop(0.5, "#FFE8F0");
    skyGrad.addColorStop(0.7, "#FFF0E8");
    skyGrad.addColorStop(1, "#FFF5E6");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);

    // 背景閃爍星星
    bgStars.forEach((star) => {
      const twinkle =
        Math.sin(time * star.twinkleSpeed + star.phase) * 0.4 + 0.6;
      ctx.fillStyle = `rgba(255, 215, 180, ${twinkle * 0.6})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * twinkle, 0, Math.PI * 2);
      ctx.fill();
    });

    // 漂浮裝飾
    floatingDecor.forEach((decor) => {
      const floatY = decor.y + Math.sin(time * 0.8 + decor.x * 0.01) * 15;
      const floatX =
        ((decor.x + time * decor.speed) % (GAME_CONFIG.WIDTH + 40)) - 20;
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.translate(floatX, floatY);
      ctx.rotate(decor.rotation + time * 0.2);

      if (decor.type === "heart") {
        ctx.fillStyle = "#FFB6C1";
        drawHeart(ctx, 0, 0, decor.size);
      } else if (decor.type === "star") {
        ctx.fillStyle = "#FFE066";
        drawStar(ctx, 0, 0, decor.size, decor.size * 0.4);
      } else {
        ctx.fillStyle = "#DDA0DD";
        drawFlower(ctx, 0, 0, decor.size);
      }
      ctx.restore();
    });

    // 遠景雲朵
    for (let i = 0; i < 3; i++) {
      const cloudX = ((time * 8 + i * 200) % (GAME_CONFIG.WIDTH + 150)) - 75;
      const cloudY = 60 + i * 120;
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.beginPath();
      ctx.arc(cloudX, cloudY, 25 + i * 5, 0, Math.PI * 2);
      ctx.arc(cloudX + 30, cloudY - 8, 30 + i * 5, 0, Math.PI * 2);
      ctx.arc(cloudX + 55, cloudY, 25 + i * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(0, -cameraY);

    platforms.forEach((platform) => drawPlatform(ctx, platform, time));
    collectibles.forEach((item) => drawCollectible(ctx, item, time));

    // 粒子效果
    collectParticles.forEach((particle) => {
      const alpha = particle.life / particle.maxLife;
      const size = 4 * alpha;
      ctx.fillStyle = particle.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      ctx.fill();

      // 小高光
      ctx.fillStyle = "#FFFFFF";
      ctx.globalAlpha = alpha * 0.6;
      ctx.beginPath();
      ctx.arc(
        particle.x - size * 0.3,
        particle.y - size * 0.3,
        size * 0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    drawRabbit(ctx, player, playerSquash, time);

    ctx.restore();

    // 分數 UI
    const heightProgress = data.startY - data.maxHeight;
    const heightScore = Math.floor(
      heightProgress * GAME_CONFIG.SCORING.HEIGHT_FACTOR,
    );
    const collectScore = data.carrotCount * GAME_CONFIG.SCORING.CARROT_POINTS;
    const displayScore = heightScore + collectScore;

    // 分數面板
    ctx.save();

    // 面板背景
    const panelX = GAME_CONFIG.WIDTH / 2 - 100;
    const panelY = 15;
    const panelW = 200;
    const panelH = 60;

    ctx.shadowColor = "rgba(255, 182, 193, 0.4)";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 16);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 182, 193, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 分數文字
    ctx.fillStyle = "#FF6B9D";
    ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("分數", GAME_CONFIG.WIDTH / 2 - 40, panelY + 24);

    ctx.fillStyle = "#E85A8F";
    ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
    ctx.fillText(`${displayScore}`, GAME_CONFIG.WIDTH / 2 - 40, panelY + 50);

    // 寶石計數
    ctx.fillStyle = "#FFB347";
    ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
    ctx.fillText("💎", GAME_CONFIG.WIDTH / 2 + 40, panelY + 24);
    ctx.fillStyle = "#E8973D";
    ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
    ctx.fillText(
      `${data.carrotCount}`,
      GAME_CONFIG.WIDTH / 2 + 40,
      panelY + 48,
    );

    ctx.restore();
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen"
      style={{
        background:
          "linear-gradient(135deg, #ffeef8 0%, #e8f4fc 50%, #fff5e6 100%)",
      }}
    >
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={GAME_CONFIG.WIDTH}
          height={GAME_CONFIG.HEIGHT}
          style={{
            borderRadius: "24px",
            boxShadow:
              "0 25px 80px rgba(255, 150, 180, 0.25), 0 10px 30px rgba(135, 206, 235, 0.15)",
            border: "4px solid rgba(255, 255, 255, 0.8)",
          }}
        />

        {gameState === GameState.Menu && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(20px)",
                borderRadius: "28px",
                padding: "40px 36px",
                boxShadow:
                  "0 20px 60px rgba(255, 150, 180, 0.2), 0 8px 24px rgba(0, 0, 0, 0.08)",
                border: "2px solid rgba(255, 200, 210, 0.5)",
                textAlign: "center",
                maxWidth: "320px",
                width: "85%",
              }}
            >
              {/* 兔子圖示 */}
              <div
                style={{
                  marginBottom: "16px",
                  filter: "drop-shadow(0 4px 12px rgba(255,182,193,0.4))",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="120"
                  height="120"
                  viewBox="0 0 80 80"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* 左耳 */}
                  <ellipse
                    cx="28"
                    cy="18"
                    rx="8"
                    ry="18"
                    fill="url(#earGrad)"
                  />
                  <ellipse
                    cx="28"
                    cy="20"
                    rx="4"
                    ry="11"
                    fill="url(#innerEarGrad)"
                  />
                  {/* 右耳 */}
                  <ellipse
                    cx="52"
                    cy="18"
                    rx="8"
                    ry="18"
                    fill="url(#earGrad)"
                  />
                  <ellipse
                    cx="52"
                    cy="20"
                    rx="4"
                    ry="11"
                    fill="url(#innerEarGrad)"
                  />
                  {/* 棉花尾巴 */}
                  <circle cx="62" cy="52" r="6" fill="#FFFFFF" />
                  <circle cx="60" cy="50" r="3" fill="#FFF8F0" />
                  {/* 身體 */}
                  <ellipse
                    cx="40"
                    cy="50"
                    rx="22"
                    ry="20"
                    fill="url(#bodyGrad)"
                  />
                  {/* 肚子 */}
                  <ellipse cx="40" cy="55" rx="13" ry="11" fill="#FFFFFF" />
                  {/* 眼白 */}
                  <ellipse cx="32" cy="45" rx="6" ry="7" fill="#FFFFFF" />
                  <ellipse cx="48" cy="45" rx="6" ry="7" fill="#FFFFFF" />
                  {/* 瞳孔 */}
                  <ellipse cx="32" cy="46" rx="4.5" ry="5.5" fill="#2D1810" />
                  <ellipse cx="48" cy="46" rx="4.5" ry="5.5" fill="#2D1810" />
                  {/* 眼睛高光 */}
                  <circle cx="30" cy="43" r="2.5" fill="#FFFFFF" />
                  <circle cx="46" cy="43" r="2.5" fill="#FFFFFF" />
                  <circle cx="33" cy="48" r="1.2" fill="#FFFFFF" />
                  <circle cx="49" cy="48" r="1.2" fill="#FFFFFF" />
                  {/* 腮紅 */}
                  <circle cx="22" cy="50" r="4" fill="rgba(255,182,193,0.6)" />
                  <circle cx="58" cy="50" r="4" fill="rgba(255,182,193,0.6)" />
                  {/* 鼻子 */}
                  <path d="M40 50 L36 56 L44 56 Z" fill="#FFB0B0" />
                  {/* 嘴巴 */}
                  <path
                    d="M34 59 Q37 63 40 60 Q43 63 46 59"
                    stroke="#D4A0A0"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                  {/* 小花 */}
                  <ellipse
                    cx="54"
                    cy="22"
                    rx="3"
                    ry="4.5"
                    fill="#FFB6C1"
                    transform="rotate(-36 54 22)"
                  />
                  <ellipse
                    cx="58"
                    cy="26"
                    rx="3"
                    ry="4.5"
                    fill="#FFB6C1"
                    transform="rotate(36 58 26)"
                  />
                  <ellipse
                    cx="54"
                    cy="30"
                    rx="3"
                    ry="4.5"
                    fill="#FFB6C1"
                    transform="rotate(108 54 30)"
                  />
                  <ellipse
                    cx="50"
                    cy="28"
                    rx="3"
                    ry="4.5"
                    fill="#FFB6C1"
                    transform="rotate(180 50 28)"
                  />
                  <ellipse
                    cx="50"
                    cy="24"
                    rx="3"
                    ry="4.5"
                    fill="#FFB6C1"
                    transform="rotate(-108 50 24)"
                  />
                  <circle cx="52" cy="26" r="3" fill="#FFE066" />
                  <circle cx="51" cy="25" r="1" fill="#FFF8DC" />
                  {/* Gradients */}
                  <defs>
                    <linearGradient
                      id="earGrad"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#FFF8F0" />
                      <stop offset="100%" stopColor="#F5E6D3" />
                    </linearGradient>
                    <linearGradient
                      id="innerEarGrad"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#FFCCD5" />
                      <stop offset="100%" stopColor="#FFB6C1" />
                    </linearGradient>
                    <radialGradient id="bodyGrad" cx="40%" cy="30%" r="70%">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="50%" stopColor="#FFF8F0" />
                      <stop offset="100%" stopColor="#F5E6D3" />
                    </radialGradient>
                  </defs>
                </svg>
              </div>

              {/* 標題 */}
              <h1
                style={{
                  fontSize: "32px",
                  fontWeight: "700",
                  background:
                    "linear-gradient(135deg, #FF6B9D 0%, #C44569 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  marginBottom: "8px",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                跳跳兔
              </h1>

              {/* 副標題 */}
              <p
                style={{
                  color: "#888",
                  fontSize: "15px",
                  marginBottom: "24px",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                跳上雲端，收集寶石！
              </p>

              {/* 開始遊戲按鈕 */}
              <button
                onClick={startGame}
                style={{
                  width: "100%",
                  padding: "16px 32px",
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#fff",
                  background:
                    "linear-gradient(135deg, #FF6B9D 0%, #FF8A80 100%)",
                  border: "none",
                  borderRadius: "16px",
                  cursor: "pointer",
                  boxShadow: "0 8px 24px rgba(255, 107, 157, 0.4)",
                  transition: "all 0.2s ease",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 12px 32px rgba(255, 107, 157, 0.5)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 24px rgba(255, 107, 157, 0.4)";
                }}
              >
                ▶ 開始遊戲
              </button>

              {/* 最高分 */}
              {bestScore > 0 && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "12px 20px",
                    background:
                      "linear-gradient(135deg, #FFF5F7 0%, #FFF0F3 100%)",
                    borderRadius: "12px",
                    color: "#E85A8F",
                    fontSize: "15px",
                    fontWeight: "600",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                  }}
                >
                  👑 最高分：{bestScore}
                </div>
              )}

              {/* 操作說明 */}
              <p
                style={{
                  marginTop: "20px",
                  color: "#aaa",
                  fontSize: "13px",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                ← → 或 A D 移動
              </p>
            </div>
          </div>
        )}

        {gameState === GameState.GameOver && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(20px)",
                borderRadius: "28px",
                padding: "40px 36px",
                boxShadow:
                  "0 20px 60px rgba(255, 150, 180, 0.2), 0 8px 24px rgba(0, 0, 0, 0.08)",
                border: "2px solid rgba(255, 200, 210, 0.5)",
                textAlign: "center",
                maxWidth: "340px",
                width: "85%",
              }}
            >
              <div style={{ fontSize: "56px", marginBottom: "12px" }}>✨</div>
              <h2
                style={{
                  fontSize: "28px",
                  fontWeight: "700",
                  color: "#FF6B9D",
                  marginBottom: "20px",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                }}
              >
                遊戲結束
              </h2>

              <div
                style={{
                  background:
                    "linear-gradient(135deg, #FFF8FA 0%, #FFF0F5 100%)",
                  borderRadius: "16px",
                  padding: "20px",
                  marginBottom: "24px",
                }}
              >
                <p
                  style={{
                    color: "#999",
                    fontSize: "14px",
                    marginBottom: "4px",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                  }}
                >
                  你的分數
                </p>
                <p
                  style={{
                    fontSize: "48px",
                    fontWeight: "700",
                    background:
                      "linear-gradient(135deg, #FF6B9D 0%, #FF8A80 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                  }}
                >
                  {currentScore}
                </p>
                <p
                  style={{
                    color: "#ccc",
                    fontSize: "13px",
                    marginTop: "8px",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                  }}
                >
                  最高分：{bestScore}
                </p>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <button
                  onClick={handleRestart}
                  style={{
                    flex: 1,
                    padding: "14px 16px",
                    fontSize: "15px",
                    fontWeight: "600",
                    color: "#fff",
                    background:
                      "linear-gradient(135deg, #FF6B9D 0%, #FF8A80 100%)",
                    border: "none",
                    borderRadius: "14px",
                    cursor: "pointer",
                    boxShadow: "0 6px 20px rgba(255, 107, 157, 0.35)",
                    transition: "all 0.2s ease",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    whiteSpace: "nowrap",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  🔄 再玩一次
                </button>
                <button
                  onClick={handleMenu}
                  style={{
                    flex: 1,
                    padding: "14px 16px",
                    fontSize: "15px",
                    fontWeight: "600",
                    color: "#FF6B9D",
                    background: "#FFF5F8",
                    border: "2px solid #FFD6E0",
                    borderRadius: "14px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    whiteSpace: "nowrap",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = "#FFF0F5";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "#FFF5F8";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  🏠 主選單
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
