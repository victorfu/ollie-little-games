import { useEffect, useRef, useState } from "react";

type GameState = "menu" | "playing" | "win" | "dead";
type Platform = { x: number; y: number; w: number; h: number };
type Enemy = { x: number; y: number; w: number; h: number; dir: 1 | -1; speed: number; alive: boolean };
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

const WIDTH = 960;
const HEIGHT = 540;
const GRAVITY = 1800;
const BASE_SPEED = 320;
const JUMP_SPEED = 720;
const BEST_KEY = "mushroom-adventure-best";
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
      player: { x: 80, y: HEIGHT - 140, w: 36, h: 48, vx: 0, vy: 0, onGround: false, jumps: 0 },
      cameraX: 0,
      platforms: lvl.platforms.map((p) => ({ ...p })),
      enemies: lvl.enemies.map((e) => ({ ...e })),
      coins: lvl.coins.map((c) => ({ ...c })),
      powerups: lvl.powerups.map((p) => ({ ...p })),
      flag: lvl.flag,
      keys: { left: false, right: false, jump: false },
      invincibleTimer: 0,
      speedTimer: 0,
      featherTimer: 0,
    };
    setLevelIndex(index);
  };

  const resetGame = () => {
    loadLevel(0);
    setScore(0);
    setLives(3);
    setGameState("playing");
  };

  const nextLevel = () => {
    const next = levelIndex + 1;
    if (next >= LEVELS.length) {
      setGameState("win");
      if (score > best) {
        setBest(score);
        localStorage.setItem(BEST_KEY, String(score));
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
    p.vx = clamp(p.vx * 0.9 + move * BASE_SPEED * (1 + speedBoost) * dt * 10, -500, 500);

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
      e.x += e.dir * e.speed * dt;
      const edgeLeft = e.x < 0;
      const edgeRight = e.x + e.w > s.flag.x + 120;
      if (edgeLeft || edgeRight) e.dir *= -1;
      if (aabb(p, e)) {
        const stomp = p.vy > 120 && p.y + p.h - e.y < 26;
        if (stomp || s.invincibleTimer > 0) {
          e.alive = false;
          p.vy = -JUMP_SPEED * 0.6;
          setScore((sc) => sc + 50);
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
        setScore((sc) => sc + 10);
      }
    });

    // powerups
    s.powerups.forEach((pu) => {
      if (pu.taken) return;
      const dx = p.x + p.w / 2 - pu.x;
      const dy = p.y + p.h / 2 - pu.y;
      if (dx * dx + dy * dy <= (pu.r + 14) * (pu.r + 14)) {
        pu.taken = true;
        setScore((sc) => sc + 20);
        if (pu.type === "star") s.invincibleTimer = 8;
        if (pu.type === "boot") s.speedTimer = 8;
        if (pu.type === "feather") s.featherTimer = 10;
        if (pu.type === "heart") setLives((l) => l + 1);
      }
    });

    s.invincibleTimer = Math.max(0, s.invincibleTimer - dt);
    s.speedTimer = Math.max(0, s.speedTimer - dt);
    s.featherTimer = Math.max(0, s.featherTimer - dt);

    // camera
    s.cameraX = clamp(p.x - WIDTH / 2 + p.w / 2, 0, Math.max(0, s.flag.x - 200));

    // win
    if (p.x > s.flag.x - 24) {
      const bonus = 150 + Math.max(0, 200 - Math.floor(p.y));
      setScore((sc) => sc + bonus);
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
    setLives((l) => {
      const next = l - 1;
      if (next <= 0) {
        setGameState("dead");
      } else {
        const lvl = LEVELS[levelIndex];
        stateRef.current.player = { x: 80, y: HEIGHT - 140, w: 36, h: 48, vx: 0, vy: 0, onGround: false, jumps: 0 };
        stateRef.current.cameraX = 0;
        stateRef.current.enemies = lvl.enemies.map((e) => ({ ...e }));
      }
      return next;
    });
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    const lvl = LEVELS[levelIndex];
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, lvl.sky.top);
    sky.addColorStop(1, lvl.sky.bottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // clouds
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    drawCloud(ctx, 120, 90 - (levelIndex % 3) * 10);
    drawCloud(ctx, 380, 60 + (levelIndex % 2) * 12);
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
      ctx.save();
      ctx.translate(pu.x, pu.y);
      ctx.scale(1.1, 1.1);
      ctx.beginPath();
      ctx.fillStyle =
        pu.type === "star"
          ? "#facc15"
          : pu.type === "feather"
            ? "#a855f7"
            : pu.type === "boot"
              ? "#22c55e"
              : "#ef4444";
      ctx.arc(0, 0, pu.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "14px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        pu.type === "star" ? "★" : pu.type === "feather" ? "羽" : pu.type === "boot" ? "靴" : "♥",
        0,
        1,
      );
      ctx.restore();
    });

    // enemies
    s.enemies.forEach((e) => {
      if (!e.alive) return;
      ctx.fillStyle = "#f87171";
      roundRect(ctx, e.x, e.y, e.w, e.h, 8);
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(e.x + 10, e.y + 12, 5, 0, Math.PI * 2);
      ctx.arc(e.x + 26, e.y + 12, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(e.x + 10, e.y + 12, 2, 0, Math.PI * 2);
      ctx.arc(e.x + 26, e.y + 12, 2, 0, Math.PI * 2);
      ctx.fill();
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
    drawHero(ctx, s.player, s.invincibleTimer > 0, s.featherTimer > 0);

    ctx.restore();

    // HUD
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(12, 12, WIDTH - 24, 54);
    ctx.fillStyle = "#0f172a";
    ctx.font = "16px system-ui";
    ctx.fillText(`分數: ${score}`, 24, 38);
    ctx.fillText(`生命: ${lives}`, 150, 38);
    ctx.fillText(`關卡: ${levelIndex + 1}/${LEVELS.length}`, 240, 38);
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

function drawHero(ctx: CanvasRenderingContext2D, p: { x: number; y: number; w: number; h: number }, inv: boolean, feather: boolean) {
  ctx.save();
  ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
  const aura = inv ? "rgba(250, 204, 21, 0.4)" : feather ? "rgba(168, 85, 247, 0.28)" : "rgba(255,255,255,0)";
  if (inv || feather) {
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.ellipse(0, 4, 24, 28, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const bodyGrad = ctx.createLinearGradient(0, -20, 0, 30);
  bodyGrad.addColorStop(0, "#93c5fd");
  bodyGrad.addColorStop(1, "#3b82f6");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 6, 18, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  const headGrad = ctx.createLinearGradient(0, -34, 0, -4);
  headGrad.addColorStop(0, "#dbeafe");
  headGrad.addColorStop(1, "#bfdbfe");
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.ellipse(0, -18, 16, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(-6, -20, 2.8, 0, Math.PI * 2);
  ctx.arc(6, -20, 2.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f97316";
  ctx.fillRect(-14, -6, 28, 8);
  ctx.fillRect(4, 0, 10, 12);

  ctx.fillStyle = "#1e3a8a";
  ctx.beginPath();
  ctx.ellipse(-8, 22, 8, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(8, 22, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();

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

const LEVELS: Level[] = [
  {
    sky: { top: "#c8f7e1", bottom: "#e8f3ff" },
    platforms: [
      { x: 0, y: HEIGHT - 40, w: 2400, h: 40 },
      { x: 200, y: HEIGHT - 140, w: 120, h: 16 },
      { x: 420, y: HEIGHT - 210, w: 150, h: 16 },
      { x: 680, y: HEIGHT - 180, w: 160, h: 16 },
    ],
    enemies: [
      { x: 260, y: HEIGHT - 72, w: 36, h: 32, dir: -1, speed: 70, alive: true },
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
      { x: 300, y: HEIGHT - 74, w: 36, h: 32, dir: 1, speed: 80, alive: true },
      { x: 880, y: HEIGHT - 212, w: 36, h: 32, dir: -1, speed: 70, alive: true },
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
      { x: 560, y: HEIGHT - 252, w: 36, h: 32, dir: 1, speed: 90, alive: true },
      { x: 1320, y: HEIGHT - 182, w: 36, h: 32, dir: -1, speed: 100, alive: true },
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
      { x: 540, y: HEIGHT - 72, w: 36, h: 32, dir: -1, speed: 110, alive: true },
      { x: 1300, y: HEIGHT - 212, w: 36, h: 32, dir: 1, speed: 100, alive: true },
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
      { x: 620, y: HEIGHT - 232, w: 36, h: 32, dir: -1, speed: 120, alive: true },
      { x: 1420, y: HEIGHT - 272, w: 36, h: 32, dir: 1, speed: 120, alive: true },
      { x: 1980, y: HEIGHT - 192, w: 36, h: 32, dir: -1, speed: 100, alive: true },
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
      { x: 280, y: HEIGHT - 72, w: 36, h: 32, dir: -1, speed: 90, alive: true },
      { x: 960, y: HEIGHT - 252, w: 36, h: 32, dir: 1, speed: 110, alive: true },
      { x: 1760, y: HEIGHT - 212, w: 36, h: 32, dir: -1, speed: 120, alive: true },
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
      { x: 360, y: HEIGHT - 232, w: 36, h: 32, dir: 1, speed: 120, alive: true },
      { x: 1480, y: HEIGHT - 252, w: 36, h: 32, dir: -1, speed: 130, alive: true },
      { x: 2260, y: HEIGHT - 252, w: 36, h: 32, dir: 1, speed: 140, alive: true },
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
      { x: 380, y: HEIGHT - 192, w: 36, h: 32, dir: -1, speed: 120, alive: true },
      { x: 1220, y: HEIGHT - 222, w: 36, h: 32, dir: 1, speed: 140, alive: true },
      { x: 2020, y: HEIGHT - 272, w: 36, h: 32, dir: -1, speed: 150, alive: true },
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
      { x: 760, y: HEIGHT - 232, w: 36, h: 32, dir: -1, speed: 130, alive: true },
      { x: 1620, y: HEIGHT - 252, w: 36, h: 32, dir: 1, speed: 150, alive: true },
      { x: 2460, y: HEIGHT - 292, w: 36, h: 32, dir: -1, speed: 160, alive: true },
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
      { x: 440, y: HEIGHT - 222, w: 36, h: 32, dir: 1, speed: 140, alive: true },
      { x: 1100, y: HEIGHT - 252, w: 36, h: 32, dir: -1, speed: 160, alive: true },
      { x: 2220, y: HEIGHT - 272, w: 36, h: 32, dir: 1, speed: 170, alive: true },
      { x: 2780, y: HEIGHT - 272, w: 36, h: 32, dir: -1, speed: 180, alive: true },
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
