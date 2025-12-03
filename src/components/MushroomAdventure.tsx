import { useEffect, useRef, useState } from "react";

type GameState = "menu" | "playing" | "win" | "dead";
type Platform = { x: number; y: number; w: number; h: number };
type EnemyType = "normal" | "fast" | "jumper" | "spiked";
type Enemy = { x: number; y: number; w: number; h: number; dir: 1 | -1; speed: number; alive: boolean; vy?: number; type: EnemyType; jumpTimer?: number };
type Coin = { x: number; y: number; r: number; taken: boolean };
type Flag = { x: number; y: number; h: number };
type PowerType = "star" | "feather" | "boot" | "heart";
type Powerup = { x: number; y: number; r: number; type: PowerType; taken: boolean };
type Level = {
  platforms: Platform[];
  enemies: Enemy[];
  coins: Coin[];
  powerups: Powerup[];
  flag: Flag;
  sky: { top: string; bottom: string };
};
type FloatingText = { x: number; y: number; text: string; life: number; color: string };

const WIDTH = 960;
const HEIGHT = 540;
const GRAVITY = 1800;
const BASE_SPEED = 320;
const JUMP_SPEED = 720;
const BEST_KEY = "mushroom-adventure-best";
const EXTRA_SECTION_BASE = 2400;
const EXTRA_SECTION_STEP = 300;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export default function MushroomAdventure({ onExit }: { onExit?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [gameState, setGameState] = useState<GameState>("menu");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [lives, setLives] = useState(3);
  const [levelIndex, setLevelIndex] = useState(0);

  const stateRef = useRef({
    player: { x: 80, y: HEIGHT - 140, w: 36, h: 48, vx: 0, vy: 0, onGround: false, jumps: 0 },
    cameraX: 0,
    platforms: LEVELS[0].platforms,
    enemies: LEVELS[0].enemies.map((e) => ({ ...e })),
    coins: LEVELS[0].coins.map((c) => ({ ...c })),
    powerups: LEVELS[0].powerups.map((p) => ({ ...p })),
    flag: LEVELS[0].flag,
    keys: { left: false, right: false, jump: false },
    invincibleTimer: 0,
    speedTimer: 0,
    featherTimer: 0,
    score: 0,
    lives: 3,
    levelIndex: 0,
    floatingTexts: [] as FloatingText[],
  });

  useEffect(() => {
    const stored = localStorage.getItem(BEST_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!Number.isNaN(parsed)) setBest(parsed);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = `${WIDTH}px`;
    canvas.style.height = `${HEIGHT}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const keys = stateRef.current.keys;
      if (e.key === "ArrowLeft" || e.key === "a") keys.left = true;
      if (e.key === "ArrowRight" || e.key === "d") keys.right = true;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") keys.jump = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const keys = stateRef.current.keys;
      if (e.key === "ArrowLeft" || e.key === "a") keys.left = false;
      if (e.key === "ArrowRight" || e.key === "d") keys.right = false;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") keys.jump = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [gameState]);

  useEffect(() => {
    if (gameState !== "playing") return;
    let lastTime = performance.now();
    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      update(dt);
      render();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [gameState]);

  const loadLevel = (index: number) => {
    const lvl = LEVELS[index];
    stateRef.current = {
      ...stateRef.current,
      player: { x: 80, y: HEIGHT - 140, w: 36, h: 48, vx: 0, vy: 0, onGround: false, jumps: 0 },
      cameraX: 0,
      platforms: lvl.platforms.map((p) => ({ ...p })),
      enemies: lvl.enemies.map((e) => ({ ...e, jumpTimer: Math.random() * 2 })),
      coins: lvl.coins.map((c) => ({ ...c })),
      powerups: lvl.powerups.map((p) => ({ ...p })),
      flag: lvl.flag,
      invincibleTimer: 0,
      speedTimer: 0,
      featherTimer: 0,
      levelIndex: index,
      floatingTexts: [],
    };
    setLevelIndex(index);
  };

  const resetGame = () => {
    stateRef.current.score = 0;
    stateRef.current.lives = 3;
    loadLevel(0);
    setScore(0);
    setLives(3);
    setGameState("playing");
  };

  const nextLevel = () => {
    const next = stateRef.current.levelIndex + 1;
    if (next >= LEVELS.length) {
      setGameState("win");
      setScore(stateRef.current.score);
      if (stateRef.current.score > best) {
        setBest(stateRef.current.score);
        localStorage.setItem(BEST_KEY, String(stateRef.current.score));
      }
    } else {
      loadLevel(next);
      setGameState("playing");
    }
  };

  const update = (dt: number) => {
    const s = stateRef.current;
    const p = s.player;
    const speedBoost = s.speedTimer > 0 ? 0.35 : 0;
    const move =
      (s.keys.left ? -1 : 0) + (s.keys.right ? 1 : 0);
    const maxSpeed = 500 * (1 + speedBoost);
    p.vx = clamp(p.vx * 0.9 + move * BASE_SPEED * (1 + speedBoost) * dt * 10, -maxSpeed, maxSpeed);

    const canDouble = s.featherTimer > 0;
    if (s.keys.jump) {
      if (p.onGround) {
        p.vy = -JUMP_SPEED;
        p.onGround = false;
        p.jumps = 1;
      } else if (canDouble && p.jumps < 2) {
        p.vy = -JUMP_SPEED * 0.9;
        p.jumps += 1;
      }
    }

    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // ground
    if (p.y + p.h > HEIGHT - 40) {
      p.y = HEIGHT - 40 - p.h;
      p.vy = 0;
      p.onGround = true;
      p.jumps = 0;
    } else {
      p.onGround = false;
    }

    // platforms
    s.platforms.forEach((plat) => {
      if (aabb(p, plat)) {
        const prevY = p.y - p.vy * dt;
        if (prevY + p.h <= plat.y + 6) {
          p.y = plat.y - p.h;
          p.vy = 0;
          p.onGround = true;
          p.jumps = 0;
        } else if (prevY >= plat.y + plat.h - 6) {
          p.y = plat.y + plat.h;
          p.vy = 10;
        } else if (p.x < plat.x) {
          p.x = plat.x - p.w;
          p.vx = 0;
        } else {
          p.x = plat.x + plat.w;
          p.vx = 0;
        }
      }
    });

    // enemies
    s.enemies.forEach((e) => {
      if (!e.alive) return;
      
      // Gravity
      e.vy = (e.vy || 0) + GRAVITY * dt;
      e.y += e.vy * dt;
      e.x += e.dir * e.speed * dt;

      // Jumper Logic
      if (e.type === "jumper") {
        e.jumpTimer = (e.jumpTimer || 0) - dt;
        if (e.jumpTimer <= 0 && e.vy === 0) { // Only jump if on ground
           e.vy = -600;
           e.jumpTimer = 1.5 + Math.random() * 1.5;
        }
      }

      let onGround = false;
      // Platform collision
      for (const plat of s.platforms) {
        if (aabb(e, plat)) {
           // Check if landing from above (allow some overlap tolerance)
           const prevY = e.y - e.vy * dt;
           if (prevY + e.h <= plat.y + 16 && e.vy >= 0) {
             e.y = plat.y - e.h;
             e.vy = 0;
             onGround = true;

             // Edge detection (Turn around if at edge)
             if (e.dir === -1 && e.x < plat.x) {
               e.x = plat.x;
               e.dir = 1;
             } else if (e.dir === 1 && e.x + e.w > plat.x + plat.w) {
               e.x = plat.x + plat.w - e.w;
               e.dir = -1;
             }
             break;
           }
        }
      }

      // Kill if fell off world
      if (e.y > HEIGHT + 100) {
        e.alive = false;
        return;
      }

      if (aabb(p, e)) {
        const stomp = p.vy > 120 && p.y + p.h - e.y < 26;
        if ((stomp && e.type !== "spiked") || s.invincibleTimer > 0) {
          e.alive = false;
          p.vy = -JUMP_SPEED * 0.6;
          s.score += e.type === "spiked" ? 100 : 50;
        } else {
          hitPlayer();
        }
      }
    });

    // coins
    s.coins.forEach((c) => {
      if (c.taken) return;
      const dx = p.x + p.w / 2 - c.x;
      const dy = p.y + p.h / 2 - c.y;
      if (dx * dx + dy * dy <= (c.r + 12) * (c.r + 12)) {
        c.taken = true;
        s.score += 10;
      }
    });

    // powerups
    s.powerups.forEach((pu) => {
      if (pu.taken) return;
      const dx = p.x + p.w / 2 - pu.x;
      const dy = p.y + p.h / 2 - pu.y;
      if (dx * dx + dy * dy <= (pu.r + 14) * (pu.r + 14)) {
        pu.taken = true;
        s.score += 20;
        let msg = "";
        let color = "#fff";
        if (pu.type === "star") { s.invincibleTimer = 8; msg = "無敵!"; color = "#facc15"; }
        if (pu.type === "boot") { s.speedTimer = 8; msg = "加速!"; color = "#22c55e"; }
        if (pu.type === "feather") { s.featherTimer = 10; msg = "二段跳!"; color = "#a855f7"; }
        if (pu.type === "heart") { s.lives += 1; msg = "生命+1"; color = "#ef4444"; }
        
        s.floatingTexts.push({
          x: pu.x,
          y: pu.y - 20,
          text: msg,
          life: 1.5,
          color,
        });
      }
    });

    // floating texts
    for (let i = s.floatingTexts.length - 1; i >= 0; i--) {
      const ft = s.floatingTexts[i];
      ft.life -= dt;
      ft.y -= 20 * dt;
      if (ft.life <= 0) {
        s.floatingTexts.splice(i, 1);
      }
    }

    s.invincibleTimer = Math.max(0, s.invincibleTimer - dt);
    s.speedTimer = Math.max(0, s.speedTimer - dt);
    s.featherTimer = Math.max(0, s.featherTimer - dt);

    // camera
    s.cameraX = clamp(p.x - WIDTH / 2 + p.w / 2, 0, Math.max(0, s.flag.x - 200));

    // win
    if (p.x > s.flag.x - 24) {
      const bonus = 150 + Math.max(0, 200 - Math.floor(p.y));
      s.score += bonus;
      nextLevel();
      return;
    }

    // fall death
    if (p.y > HEIGHT + 220) {
      hitPlayer();
    }
  };

  const hitPlayer = () => {
    const s = stateRef.current;
    if (s.invincibleTimer > 0) return;
    s.lives -= 1;
    if (s.lives <= 0) {
      setScore(s.score);
      setLives(0);
      setGameState("dead");
    } else {
      const lvl = LEVELS[s.levelIndex];
      s.player = { x: 80, y: HEIGHT - 140, w: 36, h: 48, vx: 0, vy: 0, onGround: false, jumps: 0 };
      s.cameraX = 0;
      s.enemies = lvl.enemies.map((e) => ({ ...e, jumpTimer: Math.random() * 2 }));
    }
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    const lvl = LEVELS[s.levelIndex];
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, lvl.sky.top);
    sky.addColorStop(1, lvl.sky.bottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // clouds
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    drawCloud(ctx, 120, 90 - (s.levelIndex % 3) * 10);
    drawCloud(ctx, 380, 60 + (s.levelIndex % 2) * 12);
    drawCloud(ctx, 700, 110);
    ctx.restore();

    ctx.save();
    ctx.translate(-s.cameraX, 0);

    // hills
    ctx.fillStyle = "rgba(82, 160, 120, 0.35)";
    ctx.beginPath();
    ctx.ellipse(260, HEIGHT - 20, 180, 90, 0, 0, Math.PI * 2);
    ctx.ellipse(740, HEIGHT - 10, 220, 100, 0, 0, Math.PI * 2);
    ctx.fill();

    // ground stripe
    ctx.fillStyle = "#b6e3a8";
    ctx.fillRect(-200, HEIGHT - 40, s.flag.x + 400, 80);

    // platforms
    s.platforms.forEach((p) => {
      ctx.fillStyle = "#8bd17a";
      roundRect(ctx, p.x, p.y, p.w, p.h, 6);
      ctx.fillStyle = "#6ab05f";
      roundRect(ctx, p.x, p.y, p.w, 8, 6);
    });

    // coins
    s.coins.forEach((c) => {
      if (c.taken) return;
      const coinGrad = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.r);
      coinGrad.addColorStop(0, "#fef3c7");
      coinGrad.addColorStop(1, "#f59e0b");
      ctx.fillStyle = coinGrad;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#d97706";
      ctx.stroke();
    });

    // powerups
    s.powerups.forEach((pu) => {
      if (pu.taken) return;
      drawPowerup(ctx, pu);
    });

    // enemies
    s.enemies.forEach((e) => {
      if (!e.alive) return;
      drawMushroomEnemy(ctx, e);
    });

    // flag
    ctx.fillStyle = "#f97316";
    ctx.fillRect(s.flag.x, s.flag.y, 12, s.flag.h);
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.moveTo(s.flag.x + 12, s.flag.y);
    ctx.lineTo(s.flag.x + 70, s.flag.y + 30);
    ctx.lineTo(s.flag.x + 12, s.flag.y + 60);
    ctx.closePath();
    ctx.fill();

    // player
    drawHero(ctx, s.player, s.invincibleTimer > 0, s.featherTimer > 0, s.keys.left ? -1 : s.keys.right ? 1 : 0, s.player.vy);

    // floating texts
    s.floatingTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, ft.life);
      ctx.fillStyle = ft.color;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.font = "bold 16px system-ui";
      ctx.textAlign = "center";
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    ctx.restore();

    // HUD
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(12, 12, WIDTH - 24, 54);
    ctx.fillStyle = "#0f172a";
    ctx.font = "16px system-ui";
    ctx.fillText(`分數: ${s.score}`, 24, 38);
    ctx.fillText(`生命: ${s.lives}`, 150, 38);
    ctx.fillText(`關卡: ${s.levelIndex + 1}/${LEVELS.length}`, 240, 38);
    ctx.fillText(`最佳: ${best}`, 380, 38);
    if (s.invincibleTimer > 0) ctx.fillText(`星星 ${s.invincibleTimer.toFixed(1)}s`, 520, 38);
    if (s.featherTimer > 0) ctx.fillText(`二段跳 ${s.featherTimer.toFixed(1)}s`, 650, 38);
    if (s.speedTimer > 0) ctx.fillText(`加速 ${s.speedTimer.toFixed(1)}s`, 800, 38);
  };

  const startGame = () => {
    resetGame();
    setGameState("playing");
  };

  const overlay = () => {
    if (gameState === "menu") {
      return (
        <Overlay>
          <h2 className="text-3xl font-bold text-emerald-800 mb-2">森林蘑菇冒險</h2>
          <p className="text-slate-700 mb-2">可愛橫向平台闖關，踩蘑菇怪、收硬幣、衝旗桿。</p>
          <p className="text-slate-600 mb-4 text-sm">操作：← → 移動，↑/W/空白鍵 跳躍，踩怪可得分，星星無敵、羽毛二段跳、靴子加速、愛心補生命。</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={startGame}
              className="rounded-full bg-emerald-500 text-white px-4 py-2 font-semibold shadow"
            >
              開始
            </button>
          </div>
        </Overlay>
      );
    }

    if (gameState === "win") {
      return (
        <Overlay>
          <h2 className="text-3xl font-bold text-emerald-800 mb-2">全部通關！</h2>
          <p className="text-slate-700 mb-2">總分 {score}</p>
          <p className="text-xs text-slate-600 mb-4">最佳：{best}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={resetGame}
              className="rounded-full bg-emerald-500 text-white px-4 py-2 font-semibold shadow"
            >
              再玩一次
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="rounded-full bg-white border border-emerald-200 px-4 py-2 font-semibold text-emerald-700 shadow"
              >
                回主選單
              </button>
            )}
          </div>
        </Overlay>
      );
    }

    if (gameState === "dead") {
      return (
        <Overlay>
          <h2 className="text-3xl font-bold text-rose-600 mb-2">失敗了！</h2>
          <p className="text-slate-700 mb-2">分數 {score}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={resetGame}
              className="rounded-full bg-emerald-500 text-white px-4 py-2 font-semibold shadow"
            >
              再試一次
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="rounded-full bg-white border border-emerald-200 px-4 py-2 font-semibold text-emerald-700 shadow"
              >
                回主選單
              </button>
            )}
          </div>
        </Overlay>
      );
    }

    return null;
  };

  return (
    <div
      className="relative flex items-center justify-center min-h-screen"
      style={{
        background:
          "radial-gradient(circle at 20% 20%, rgba(126,195,148,0.35), transparent 40%), radial-gradient(circle at 80% 10%, rgba(146,187,255,0.3), transparent 35%), #e9fdf3",
      }}
    >
      {onExit && (
        <button
          onClick={onExit}
          className="absolute left-6 top-6 z-20 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          ← 回遊戲列表
        </button>
      )}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          style={{
            borderRadius: "22px",
            boxShadow: "0 24px 60px rgba(16, 78, 50, 0.28)",
            border: "3px solid rgba(255,255,255,0.5)",
            background: "#c8f7e1",
          }}
        />
        {overlay()}
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30 backdrop-blur">
      <div className="rounded-3xl bg-white/95 border border-white/60 shadow-2xl px-6 py-6 text-center max-w-md">
        {children}
      </div>
    </div>
  );
}

function aabb(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function drawHero(ctx: CanvasRenderingContext2D, p: { x: number; y: number; w: number; h: number }, inv: boolean, feather: boolean, dir: number, vy: number) {
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2);

  // Squash and Stretch
  const stretch = Math.min(0.3, Math.abs(vy) / 1500);
  const scaleX = 1 - stretch * 0.5;
  const scaleY = 1 + stretch;
  ctx.scale(scaleX, scaleY);
  
  // Bobbing animation (idle)
  if (Math.abs(vy) < 50) {
    const bob = Math.sin(Date.now() / 150) * 2;
    ctx.translate(0, bob);
  }

  // Facing
  if (dir !== 0) {
    ctx.scale(dir, 1);
  }

  // Aura
  if (inv || feather) {
    ctx.fillStyle = inv ? "rgba(250, 204, 21, 0.4)" : "rgba(168, 85, 247, 0.28)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 36, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Cinnamoroll Style Hero ---

  // Tail (Curly Cinnamon Roll)
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-14, 6, 8, 0, Math.PI * 2);
  ctx.fill();
  // Tail swirl
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-14, 6, 4, 0, Math.PI * 1.5);
  ctx.stroke();

  // Body (White & Round)
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(0, 10, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Feet (Tiny white nubs)
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(-8, 20, 5, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(8, 20, 5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head (Large White Oval)
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(0, -4, 20, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears (Long, Floppy, White)
  // Animate ears based on Y velocity
  const earAngle = Math.min(0.5, Math.max(-0.5, vy / 1000));
  ctx.fillStyle = "#fff";
  
  // Left Ear
  ctx.save();
  ctx.translate(-16, -10);
  ctx.rotate(-0.2 - earAngle);
  ctx.beginPath();
  ctx.ellipse(-12, 0, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Right Ear
  ctx.save();
  ctx.translate(16, -10);
  ctx.rotate(0.2 + earAngle);
  ctx.beginPath();
  ctx.ellipse(12, 0, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Face
  // Eyes (Wide set, blue)
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.ellipse(-8, -2, 2.5, 3.5, 0, 0, Math.PI * 2);
  ctx.ellipse(8, -2, 2.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Highlights
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-9, -4, 1, 0, Math.PI * 2);
  ctx.arc(7, -4, 1, 0, Math.PI * 2);
  ctx.fill();

  // Blush (Pink)
  ctx.fillStyle = "rgba(244, 114, 182, 0.5)";
  ctx.beginPath();
  ctx.ellipse(-12, 2, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.ellipse(12, 2, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mouth (Tiny 'w' or smile)
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 1, 3, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.restore();
}

function drawPowerup(ctx: CanvasRenderingContext2D, pu: Powerup) {
  ctx.save();
  ctx.translate(pu.x, pu.y);
  
  // Float animation
  const floatY = Math.sin(Date.now() / 200) * 3;
  ctx.translate(0, floatY);

  // Glow
  const color = pu.type === "star" ? "#facc15" : pu.type === "feather" ? "#a855f7" : pu.type === "boot" ? "#22c55e" : "#ef4444";
  ctx.shadowColor = color;
  ctx.shadowBlur = 15;
  
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, 0, pu.r, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  
  if (pu.type === "star") {
    // Draw Star
    ctx.beginPath();
    for(let i=0; i<5; i++) {
        ctx.lineTo(Math.cos((18+i*72)/180*Math.PI)*10, -Math.sin((18+i*72)/180*Math.PI)*10);
        ctx.lineTo(Math.cos((54+i*72)/180*Math.PI)*4, -Math.sin((54+i*72)/180*Math.PI)*4);
    }
    ctx.closePath();
    ctx.fill();
  } else if (pu.type === "heart") {
    // Draw Heart
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(-6, -4, -12, 4, 0, 12);
    ctx.bezierCurveTo(12, 4, 6, -4, 0, 4);
    ctx.fill();
  } else if (pu.type === "boot") {
    // Draw Boot
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.lineTo(4, -6);
    ctx.lineTo(4, 4);
    ctx.lineTo(8, 4);
    ctx.quadraticCurveTo(8, 8, 4, 8);
    ctx.lineTo(-4, 8);
    ctx.closePath();
    ctx.fill();
  } else {
    // Draw Feather
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 10, Math.PI/4, 0, Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
}

function drawMushroomEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h / 2);

  // Stem
  ctx.fillStyle = "#fef3c7";
  roundRect(ctx, -10, 0, 20, 16, 4);

  // Cap Color based on type
  let capColor = "#ef4444"; // Normal (Red)
  if (e.type === "fast") capColor = "#3b82f6"; // Fast (Blue)
  if (e.type === "jumper") capColor = "#22c55e"; // Jumper (Green)
  if (e.type === "spiked") capColor = "#9333ea"; // Spiked (Purple)

  // Cap
  ctx.fillStyle = capColor;
  ctx.beginPath();
  ctx.arc(0, 0, 20, Math.PI, 0); // top half
  ctx.bezierCurveTo(20, 10, -20, 10, -20, 0);
  ctx.fill();

  // Spikes
  if (e.type === "spiked") {
    ctx.fillStyle = "#e9d5ff";
    ctx.beginPath();
    ctx.moveTo(0, -20); ctx.lineTo(-4, -28); ctx.lineTo(4, -28); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-14, -14); ctx.lineTo(-20, -20); ctx.lineTo(-10, -22); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -14); ctx.lineTo(20, -20); ctx.lineTo(10, -22); ctx.fill();
  }

  // Spots
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.arc(-10, -8, 4, 0, Math.PI * 2);
  ctx.arc(10, -6, 3, 0, Math.PI * 2);
  ctx.arc(0, -14, 3, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (Angry if spiked)
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  if (e.type === "spiked") {
     // Angry eyes
     ctx.moveTo(-8, 4); ctx.lineTo(-4, 8); ctx.lineTo(-8, 8);
     ctx.moveTo(8, 4); ctx.lineTo(4, 8); ctx.lineTo(8, 8);
  } else {
     ctx.arc(-6, 6, 2, 0, Math.PI * 2);
     ctx.arc(6, 6, 2, 0, Math.PI * 2);
  }
  ctx.fill();

  // Wings for Jumper
  if (e.type === "jumper") {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(-22, -4, 8, 4, -0.2, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(22, -4, 8, 4, 0.2, 0, Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.arc(x, y, 26, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x + 26, y - 26, 26, Math.PI, Math.PI * 2);
  ctx.arc(x + 52, y, 26, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
}

function extendLevel(base: Level, idx: number): Level {
  const extraOffset = base.flag.x + 200;
  const extraLength = EXTRA_SECTION_BASE + EXTRA_SECTION_STEP * idx;
  const newFlagX = extraOffset + extraLength;

  // Patterns
  const patterns = [
    // Pattern 0: Flat run with enemies
    (x: number, y: number, diff: number) => {
      const enemies: Enemy[] = [];
      // More enemies on higher difficulty
      const count = 1 + Math.floor(Math.random() * (1 + diff * 0.5)); 
      for(let i=0; i<count; i++) {
        enemies.push({ x: x + 100 + i * 80, y: y - 32, w: 36, h: 32, dir: -1, speed: 100, alive: true, type: "normal" });
      }
      return {
        plats: [{ x, y, w: 400, h: 16 }],
        enemies,
        coins: [{ x: x + 100, y: y - 40, r: 10, taken: false }, { x: x + 300, y: y - 40, r: 10, taken: false }]
      };
    },
    // Pattern 1: Stairs up
    (x: number, y: number, diff: number) => ({
      plats: [
        { x, y, w: 120, h: 16 },
        { x: x + 160, y: y - 60, w: 120, h: 16 },
        { x: x + 320, y: y - 120, w: 120, h: 16 }
      ],
      enemies: [{ x: x + 360, y: y - 120 - 32, w: 36, h: 32, dir: 1, speed: 80, alive: true, type: diff > 2 ? "jumper" : "normal" }],
      coins: [{ x: x + 60, y: y - 40, r: 10, taken: false }, { x: x + 220, y: y - 100, r: 10, taken: false }, { x: x + 380, y: y - 160, r: 10, taken: false }]
    }),
    // Pattern 2: Gap jump
    (x: number, y: number, diff: number) => ({
      plats: [
        { x, y, w: 100, h: 16 },
        { x: x + 250, y: y, w: 100, h: 16 }
      ],
      enemies: diff > 1 ? [{ x: x + 270, y: y - 32, w: 36, h: 32, dir: 1, speed: 120, alive: true, type: "fast" }] : [],
      coins: [{ x: x + 175, y: y - 60, r: 10, taken: false }]
    }),
    // Pattern 3: Tunnel (low ceiling)
    (x: number, y: number, diff: number) => ({
      plats: [
        { x, y, w: 400, h: 16 },
        { x, y: y - 100, w: 400, h: 40 } // Ceiling
      ],
      enemies: [{ x: x + 200, y: y - 32, w: 36, h: 32, dir: 1, speed: 120, alive: true, type: diff > 3 ? "spiked" : "fast" }],
      coins: [{ x: x + 50, y: y - 30, r: 10, taken: false }, { x: x + 350, y: y - 30, r: 10, taken: false }]
    })
  ];

  const platforms = base.platforms.map((p, i) =>
    i === 0 ? { ...p, w: Math.max(p.w, newFlagX + 400) } : { ...p },
  );
  
  const enemies: Enemy[] = base.enemies.map((e) => ({ ...e, type: "normal" as EnemyType }));
  const coins: Coin[] = base.coins.map((c) => ({ ...c }));
  const powerups: Powerup[] = base.powerups.map((p) => ({ ...p }));

  let currentX = extraOffset;
  let currentY = HEIGHT - 160;

  while (currentX < newFlagX - 200) {
    // Difficulty scaling
    // Level 0: Pattern 0 only
    // Level 1: Pattern 0, 1
    // Level 2: Pattern 0, 1, 2
    // Level 3+: All patterns
    const availablePatterns = Math.min(patterns.length, idx + 1);
    const patIdx = Math.floor(Math.random() * availablePatterns);
    
    const pat = patterns[patIdx](currentX, currentY, idx);
    
    // Add pattern elements
    pat.plats.forEach(p => platforms.push(p as Platform));
    pat.enemies.forEach(e => {
        // Randomize enemy type based on level index (difficulty)
        let type: EnemyType = "normal";
        const roll = Math.random();
        if (idx >= 1 && roll < 0.3) type = "fast";
        if (idx >= 2 && roll < 0.2) type = "jumper";
        if (idx >= 3 && roll < 0.15) type = "spiked";
        // Override if pattern specified a type, otherwise use random
        if (e.type === "normal" && type !== "normal") e.type = type;
        
        enemies.push(e as Enemy);
    });
    pat.coins.forEach(c => coins.push(c as Coin));

    // Chance for powerup
    if (Math.random() < 0.25) {
      const types: PowerType[] = ["boot", "feather", "star", "heart"];
      const type = types[Math.floor(Math.random() * types.length)];
      powerups.push({ x: currentX + 50, y: currentY - 80, r: 14, type, taken: false });
    }

    currentX += 450;
    // Randomize Y slightly for next segment, keep within bounds
    currentY = clamp(currentY + (Math.random() > 0.5 ? 40 : -40), HEIGHT - 300, HEIGHT - 100);
  }

  return {
    ...base,
    platforms,
    enemies,
    coins,
    powerups,
    flag: { ...base.flag, x: newFlagX },
  };
}

const BASE_LEVELS: Level[] = [
  {
    sky: { top: "#c8f7e1", bottom: "#e8f3ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 2400, h: 40 },
      { x: 200, y: HEIGHT - 140, w: 120, h: 16 },
      { x: 420, y: HEIGHT - 210, w: 150, h: 16 },
      { x: 680, y: HEIGHT - 180, w: 160, h: 16 },
    ],
    enemies: [
      { x: 260, y: HEIGHT - 72, w: 36, h: 32, dir: -1, speed: 70, alive: true, type: "normal" },
    ],
    coins: [
      { x: 160, y: HEIGHT - 200, r: 10, taken: false },
      { x: 420, y: HEIGHT - 260, r: 10, taken: false },
      { x: 720, y: HEIGHT - 220, r: 10, taken: false },
    ],
    powerups: [{ x: 640, y: HEIGHT - 220, r: 14, type: "boot", taken: false }],
    flag: { x: 950, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#d9f0ff", bottom: "#eef6ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 2600, h: 40 },
      { x: 240, y: HEIGHT - 170, w: 140, h: 16 },
      { x: 520, y: HEIGHT - 240, w: 180, h: 16 },
      { x: 840, y: HEIGHT - 180, w: 160, h: 16 },
      { x: 1120, y: HEIGHT - 130, w: 160, h: 16 },
    ],
    enemies: [
      { x: 300, y: HEIGHT - 74, w: 36, h: 32, dir: 1, speed: 80, alive: true, type: "normal" },
      { x: 880, y: HEIGHT - 212, w: 36, h: 32, dir: -1, speed: 70, alive: true, type: "normal" },
    ],
    coins: [
      { x: 250, y: HEIGHT - 210, r: 10, taken: false },
      { x: 520, y: HEIGHT - 280, r: 10, taken: false },
      { x: 1120, y: HEIGHT - 170, r: 10, taken: false },
    ],
    powerups: [{ x: 980, y: HEIGHT - 220, r: 14, type: "feather", taken: false }],
    flag: { x: 1280, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#f7e9ff", bottom: "#f2f9ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 2600, h: 40 },
      { x: 300, y: HEIGHT - 160, w: 120, h: 16 },
      { x: 520, y: HEIGHT - 220, w: 140, h: 16 },
      { x: 780, y: HEIGHT - 260, w: 160, h: 16 },
      { x: 1040, y: HEIGHT - 200, w: 160, h: 16 },
      { x: 1300, y: HEIGHT - 150, w: 160, h: 16 },
    ],
    enemies: [
      { x: 560, y: HEIGHT - 252, w: 36, h: 32, dir: 1, speed: 90, alive: true, type: "normal" },
      { x: 1320, y: HEIGHT - 182, w: 36, h: 32, dir: -1, speed: 100, alive: true, type: "normal" },
    ],
    coins: [
      { x: 320, y: HEIGHT - 200, r: 10, taken: false },
      { x: 780, y: HEIGHT - 300, r: 10, taken: false },
      { x: 1300, y: HEIGHT - 190, r: 10, taken: false },
    ],
    powerups: [{ x: 900, y: HEIGHT - 320, r: 14, type: "star", taken: false }],
    flag: { x: 1520, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#e4f7e7", bottom: "#f5fff2" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 2800, h: 40 },
      { x: 260, y: HEIGHT - 200, w: 140, h: 16 },
      { x: 520, y: HEIGHT - 140, w: 140, h: 16 },
      { x: 760, y: HEIGHT - 190, w: 140, h: 16 },
      { x: 1000, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 1280, y: HEIGHT - 180, w: 160, h: 16 },
      { x: 1520, y: HEIGHT - 130, w: 180, h: 16 },
    ],
    enemies: [
      { x: 540, y: HEIGHT - 72, w: 36, h: 32, dir: -1, speed: 110, alive: true, type: "normal" },
      { x: 1300, y: HEIGHT - 212, w: 36, h: 32, dir: 1, speed: 100, alive: true, type: "normal" },
    ],
    coins: [
      { x: 280, y: HEIGHT - 240, r: 10, taken: false },
      { x: 760, y: HEIGHT - 230, r: 10, taken: false },
      { x: 1280, y: HEIGHT - 220, r: 10, taken: false },
      { x: 1520, y: HEIGHT - 170, r: 10, taken: false },
    ],
    powerups: [{ x: 1180, y: HEIGHT - 280, r: 14, type: "boot", taken: false }],
    flag: { x: 1760, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#d9f0ff", bottom: "#eef6ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3000, h: 40 },
      { x: 280, y: HEIGHT - 160, w: 160, h: 16 },
      { x: 560, y: HEIGHT - 200, w: 140, h: 16 },
      { x: 840, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 1120, y: HEIGHT - 280, w: 140, h: 16 },
      { x: 1400, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 1680, y: HEIGHT - 200, w: 140, h: 16 },
      { x: 1960, y: HEIGHT - 160, w: 160, h: 16 },
    ],
    enemies: [
      { x: 620, y: HEIGHT - 232, w: 36, h: 32, dir: -1, speed: 120, alive: true, type: "normal" },
      { x: 1420, y: HEIGHT - 272, w: 36, h: 32, dir: 1, speed: 120, alive: true, type: "normal" },
      { x: 1980, y: HEIGHT - 192, w: 36, h: 32, dir: -1, speed: 100, alive: true, type: "normal" },
    ],
    coins: [
      { x: 560, y: HEIGHT - 240, r: 10, taken: false },
      { x: 1120, y: HEIGHT - 320, r: 10, taken: false },
      { x: 1680, y: HEIGHT - 240, r: 10, taken: false },
      { x: 1960, y: HEIGHT - 200, r: 10, taken: false },
    ],
    powerups: [{ x: 1520, y: HEIGHT - 300, r: 14, type: "star", taken: false }],
    flag: { x: 2160, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#f7e9ff", bottom: "#f2f9ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3200, h: 40 },
      { x: 260, y: HEIGHT - 120, w: 160, h: 16 },
      { x: 620, y: HEIGHT - 180, w: 180, h: 16 },
      { x: 900, y: HEIGHT - 220, w: 140, h: 16 },
      { x: 1180, y: HEIGHT - 260, w: 140, h: 16 },
      { x: 1460, y: HEIGHT - 210, w: 160, h: 16 },
      { x: 1740, y: HEIGHT - 180, w: 180, h: 16 },
      { x: 2020, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 2300, y: HEIGHT - 200, w: 180, h: 16 },
    ],
    enemies: [
      { x: 280, y: HEIGHT - 72, w: 36, h: 32, dir: -1, speed: 90, alive: true, type: "normal" },
      { x: 960, y: HEIGHT - 252, w: 36, h: 32, dir: 1, speed: 110, alive: true, type: "normal" },
      { x: 1760, y: HEIGHT - 212, w: 36, h: 32, dir: -1, speed: 120, alive: true, type: "normal" },
    ],
    coins: [
      { x: 620, y: HEIGHT - 220, r: 10, taken: false },
      { x: 1180, y: HEIGHT - 300, r: 10, taken: false },
      { x: 1740, y: HEIGHT - 220, r: 10, taken: false },
      { x: 2020, y: HEIGHT - 280, r: 10, taken: false },
    ],
    powerups: [{ x: 1320, y: HEIGHT - 320, r: 14, type: "feather", taken: false }],
    flag: { x: 2520, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#e4f7e7", bottom: "#f5fff2" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3400, h: 40 },
      { x: 320, y: HEIGHT - 200, w: 160, h: 16 },
      { x: 620, y: HEIGHT - 140, w: 140, h: 16 },
      { x: 900, y: HEIGHT - 220, w: 160, h: 16 },
      { x: 1160, y: HEIGHT - 260, w: 140, h: 16 },
      { x: 1440, y: HEIGHT - 220, w: 180, h: 16 },
      { x: 1720, y: HEIGHT - 180, w: 160, h: 16 },
      { x: 2000, y: HEIGHT - 160, w: 140, h: 16 },
      { x: 2240, y: HEIGHT - 220, w: 160, h: 16 },
      { x: 2500, y: HEIGHT - 260, w: 140, h: 16 },
    ],
    enemies: [
      { x: 360, y: HEIGHT - 232, w: 36, h: 32, dir: 1, speed: 120, alive: true, type: "normal" },
      { x: 1480, y: HEIGHT - 252, w: 36, h: 32, dir: -1, speed: 130, alive: true, type: "normal" },
      { x: 2260, y: HEIGHT - 252, w: 36, h: 32, dir: 1, speed: 140, alive: true, type: "normal" },
    ],
    coins: [
      { x: 320, y: HEIGHT - 240, r: 10, taken: false },
      { x: 900, y: HEIGHT - 260, r: 10, taken: false },
      { x: 1720, y: HEIGHT - 220, r: 10, taken: false },
      { x: 2500, y: HEIGHT - 300, r: 10, taken: false },
    ],
    powerups: [{ x: 1860, y: HEIGHT - 320, r: 14, type: "star", taken: false }],
    flag: { x: 2720, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#d9f0ff", bottom: "#eef6ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3600, h: 40 },
      { x: 360, y: HEIGHT - 160, w: 160, h: 16 },
      { x: 680, y: HEIGHT - 210, w: 160, h: 16 },
      { x: 940, y: HEIGHT - 250, w: 160, h: 16 },
      { x: 1200, y: HEIGHT - 190, w: 160, h: 16 },
      { x: 1460, y: HEIGHT - 150, w: 160, h: 16 },
      { x: 1720, y: HEIGHT - 200, w: 180, h: 16 },
      { x: 2000, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 2280, y: HEIGHT - 200, w: 160, h: 16 },
      { x: 2560, y: HEIGHT - 160, w: 160, h: 16 },
    ],
    enemies: [
      { x: 380, y: HEIGHT - 192, w: 36, h: 32, dir: -1, speed: 120, alive: true, type: "normal" },
      { x: 1220, y: HEIGHT - 222, w: 36, h: 32, dir: 1, speed: 140, alive: true, type: "normal" },
      { x: 2020, y: HEIGHT - 272, w: 36, h: 32, dir: -1, speed: 150, alive: true, type: "normal" },
    ],
    coins: [
      { x: 360, y: HEIGHT - 200, r: 10, taken: false },
      { x: 940, y: HEIGHT - 290, r: 10, taken: false },
      { x: 1720, y: HEIGHT - 240, r: 10, taken: false },
      { x: 2280, y: HEIGHT - 240, r: 10, taken: false },
    ],
    powerups: [{ x: 1340, y: HEIGHT - 280, r: 14, type: "feather", taken: false }],
    flag: { x: 2800, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#f7e9ff", bottom: "#f2f9ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 3800, h: 40 },
      { x: 380, y: HEIGHT - 140, w: 160, h: 16 },
      { x: 720, y: HEIGHT - 200, w: 160, h: 16 },
      { x: 1040, y: HEIGHT - 240, w: 160, h: 16 },
      { x: 1320, y: HEIGHT - 280, w: 160, h: 16 },
      { x: 1600, y: HEIGHT - 220, w: 180, h: 16 },
      { x: 1880, y: HEIGHT - 180, w: 180, h: 16 },
      { x: 2160, y: HEIGHT - 220, w: 160, h: 16 },
      { x: 2440, y: HEIGHT - 260, w: 160, h: 16 },
      { x: 2720, y: HEIGHT - 200, w: 180, h: 16 },
      { x: 3000, y: HEIGHT - 160, w: 180, h: 16 },
    ],
    enemies: [
      { x: 760, y: HEIGHT - 232, w: 36, h: 32, dir: -1, speed: 130, alive: true, type: "normal" },
      { x: 1620, y: HEIGHT - 252, w: 36, h: 32, dir: 1, speed: 150, alive: true, type: "normal" },
      { x: 2460, y: HEIGHT - 292, w: 36, h: 32, dir: -1, speed: 160, alive: true, type: "normal" },
    ],
    coins: [
      { x: 720, y: HEIGHT - 240, r: 10, taken: false },
      { x: 1320, y: HEIGHT - 320, r: 10, taken: false },
      { x: 1880, y: HEIGHT - 220, r: 10, taken: false },
      { x: 2720, y: HEIGHT - 240, r: 10, taken: false },
    ],
    powerups: [{ x: 2100, y: HEIGHT - 300, r: 14, type: "star", taken: false }],
    flag: { x: 3220, y: HEIGHT - 180, h: 180 },
  },
  {
    sky: { top: "#e4f7e7", bottom: "#f5fff2" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 4000, h: 40 },
      { x: 420, y: HEIGHT - 190, w: 160, h: 16 },
      { x: 760, y: HEIGHT - 140, w: 160, h: 16 },
      { x: 1080, y: HEIGHT - 220, w: 160, h: 16 },
      { x: 1360, y: HEIGHT - 260, w: 160, h: 16 },
      { x: 1640, y: HEIGHT - 220, w: 180, h: 16 },
      { x: 1920, y: HEIGHT - 200, w: 180, h: 16 },
      { x: 2200, y: HEIGHT - 240, w: 180, h: 16 },
      { x: 2480, y: HEIGHT - 280, w: 160, h: 16 },
      { x: 2760, y: HEIGHT - 240, w: 180, h: 16 },
      { x: 3040, y: HEIGHT - 200, w: 180, h: 16 },
    ],
    enemies: [
      { x: 440, y: HEIGHT - 222, w: 36, h: 32, dir: 1, speed: 140, alive: true, type: "normal" },
      { x: 1100, y: HEIGHT - 252, w: 36, h: 32, dir: -1, speed: 160, alive: true, type: "normal" },
      { x: 2220, y: HEIGHT - 272, w: 36, h: 32, dir: 1, speed: 170, alive: true, type: "normal" },
      { x: 2780, y: HEIGHT - 272, w: 36, h: 32, dir: -1, speed: 180, alive: true, type: "normal" },
    ],
    coins: [
      { x: 420, y: HEIGHT - 230, r: 10, taken: false },
      { x: 1080, y: HEIGHT - 260, r: 10, taken: false },
      { x: 1920, y: HEIGHT - 240, r: 10, taken: false },
      { x: 2760, y: HEIGHT - 280, r: 10, taken: false },
    ],
    powerups: [{ x: 1680, y: HEIGHT - 300, r: 14, type: "feather", taken: false }],
    flag: { x: 3300, y: HEIGHT - 180, h: 180 },
  },
];

const LEVELS = BASE_LEVELS.map((lvl, index) => extendLevel(lvl, index));
