import { useEffect, useRef, useState } from "react";

type GameState = "menu" | "playing" | "win" | "dead";
type Platform = { x: number; y: number; w: number; h: number };
type Enemy = { x: number; y: number; w: number; h: number; dir: 1 | -1; speed: number; alive: boolean };
type Coin = { x: number; y: number; r: number; taken: boolean };

const WIDTH = 960;
const HEIGHT = 540;
const GRAVITY = 1800;
const MOVE_SPEED = 320;
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
  const [winTime, setWinTime] = useState(0);

  const stateRef = useRef({
    player: { x: 80, y: HEIGHT - 140, w: 36, h: 48, vx: 0, vy: 0, onGround: false },
    cameraX: 0,
    platforms: buildPlatforms(),
    enemies: buildEnemies(),
    coins: buildCoins(),
    flag: { x: 1800, y: HEIGHT - 180, h: 180 },
    keys: { left: false, right: false, jump: false },
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

  const resetGame = () => {
    stateRef.current = {
      player: { x: 80, y: HEIGHT - 140, w: 36, h: 48, vx: 0, vy: 0, onGround: false },
      cameraX: 0,
      platforms: buildPlatforms(),
      enemies: buildEnemies(),
      coins: buildCoins(),
      flag: { x: 1800, y: HEIGHT - 180, h: 180 },
      keys: { left: false, right: false, jump: false },
    };
    setScore(0);
    setLives(3);
    setGameState("playing");
  };

  const update = (dt: number) => {
    const s = stateRef.current;
    const p = s.player;
    const speed = MOVE_SPEED;
    const accel = 16;
    const move =
      (s.keys.left ? -1 : 0) + (s.keys.right ? 1 : 0);
    p.vx = p.vx * (1 - dt * accel) + move * speed * dt * accel;
    if (Math.abs(p.vx) < 5) p.vx = 0;

    if (s.keys.jump && p.onGround) {
      p.vy = -JUMP_SPEED;
      p.onGround = false;
    }

    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // simple ground
    if (p.y + p.h > HEIGHT - 40) {
      p.y = HEIGHT - 40 - p.h;
      p.vy = 0;
      p.onGround = true;
    } else {
      p.onGround = false;
    }

    // platforms
    s.platforms.forEach((plat) => {
      if (aabb(p, plat)) {
        // vertical resolve
        const prevY = p.y - p.vy * dt;
        if (prevY + p.h <= plat.y + 4) {
          p.y = plat.y - p.h;
          p.vy = 0;
          p.onGround = true;
        } else if (prevY >= plat.y + plat.h - 4) {
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
      // turn at platform edges
      const beneath = s.platforms.find(
        (plat) =>
          e.x + e.w / 2 > plat.x &&
          e.x + e.w / 2 < plat.x + plat.w &&
          Math.abs(e.y + e.h - plat.y) < 4,
      );
      if (!beneath) e.dir *= -1;
      // bounds
      if (e.x < 0 || e.x + e.w > 2400) e.dir *= -1;

      if (aabb(p, e)) {
        // check stomp
        const falling = p.vy > 100;
        if (falling && p.y + p.h - e.y < 28) {
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
      if (dx * dx + dy * dy < (c.r + 10) * (c.r + 10)) {
        c.taken = true;
        setScore((sc) => sc + 10);
      }
    });

    // camera follow
    s.cameraX = clamp(p.x - WIDTH / 2 + p.w / 2, 0, 1400);

    // win
    if (p.x > s.flag.x - 20) {
      if (gameState === "playing") {
        setGameState("win");
        setWinTime(performance.now());
        const bonus = Math.max(0, 200 - Math.floor((p.x / 10)));
        const total = score + bonus;
        setScore(total);
        if (total > best) {
          setBest(total);
          localStorage.setItem(BEST_KEY, String(total));
        }
      }
    }

    // fall death
    if (p.y > HEIGHT + 200) {
      hitPlayer();
    }
  };

  const hitPlayer = () => {
    setLives((l) => {
      const next = l - 1;
      if (next <= 0) {
        setGameState("dead");
      } else {
        // reset player position
        const s = stateRef.current;
        s.player.x = 80;
        s.player.y = HEIGHT - 140;
        s.player.vx = 0;
        s.player.vy = 0;
        s.cameraX = 0;
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
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, "#c8f7e1");
    sky.addColorStop(1, "#e8f3ff");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.translate(-s.cameraX, 0);

    // ground stripe
    ctx.fillStyle = "#b2e3a4";
    ctx.fillRect(-200, HEIGHT - 40, 2600, 80);

    // platforms
    ctx.fillStyle = "#8bd17a";
    s.platforms.forEach((p) => {
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "#6ab05f";
      ctx.fillRect(p.x, p.y, p.w, 8);
      ctx.fillStyle = "#8bd17a";
    });

    // coins
    s.coins.forEach((c) => {
      if (c.taken) return;
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f59e0b";
      ctx.stroke();
    });

    // enemies
    s.enemies.forEach((e) => {
      if (!e.alive) return;
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(e.x, e.y, e.w, e.h);
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
    const p = s.player;
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#1e3a8a";
    ctx.fillRect(p.x, p.y + p.h - 12, p.w, 12);
    ctx.fillStyle = "#fff";
    ctx.fillRect(p.x + 6, p.y + 10, 10, 10);
    ctx.fillRect(p.x + 20, p.y + 10, 10, 10);
    ctx.fillStyle = "#111";
    ctx.fillRect(p.x + 10, p.y + 14, 4, 4);
    ctx.fillRect(p.x + 24, p.y + 14, 4, 4);

    ctx.restore();

    // HUD
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(12, 12, WIDTH - 24, 50);
    ctx.fillStyle = "#0f172a";
    ctx.font = "16px system-ui";
    ctx.fillText(`分數: ${score}`, 24, 40);
    ctx.fillText(`生命: ${lives}`, 160, 40);
    ctx.fillText(`最佳: ${best}`, 260, 40);
  };

  const startGame = () => {
    resetGame();
  };

  const overlay = () => {
    if (gameState === "menu") {
      return (
        <Overlay>
          <h2 className="text-3xl font-bold text-emerald-800 mb-2">森林蘑菇冒險</h2>
          <p className="text-slate-700 mb-4">踩蘑菇怪、收硬幣，衝向終點旗桿！</p>
          <p className="text-slate-600 mb-4 text-sm">操作：← → 移動，↑/W/空白鍵 跳躍。</p>
          <div className="flex gap-3">
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
          <h2 className="text-3xl font-bold text-emerald-800 mb-2">通關！</h2>
          <p className="text-slate-700 mb-2">分數 {score}</p>
          <div className="flex gap-3">
            <button
              onClick={resetGame}
              className="rounded-full bg-emerald-500 text-white px-4 py-2 font-semibold shadow"
            >
              再玩一次
            </button>
            <button
              onClick={() => setGameState("menu")}
              className="rounded-full bg-white border border-emerald-200 px-4 py-2 font-semibold text-emerald-700 shadow"
            >
              回主選單
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">最佳紀錄：{best}</p>
        </Overlay>
      );
    }

    if (gameState === "dead") {
      return (
        <Overlay>
          <h2 className="text-3xl font-bold text-rose-600 mb-2">失敗了！</h2>
          <p className="text-slate-700 mb-2">分數 {score}</p>
          <div className="flex gap-3">
            <button
              onClick={resetGame}
              className="rounded-full bg-emerald-500 text-white px-4 py-2 font-semibold shadow"
            >
              再試一次
            </button>
            <button
              onClick={() => setGameState("menu")}
              className="rounded-full bg-white border border-emerald-200 px-4 py-2 font-semibold text-emerald-700 shadow"
            >
              回主選單
            </button>
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

function aabb(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function buildPlatforms(): Platform[] {
  return [
    { x: 0, y: HEIGHT - 40, w: 2400, h: 40 },
    { x: 200, y: HEIGHT - 140, w: 120, h: 16 },
    { x: 380, y: HEIGHT - 220, w: 150, h: 16 },
    { x: 620, y: HEIGHT - 180, w: 180, h: 16 },
    { x: 900, y: HEIGHT - 260, w: 140, h: 16 },
    { x: 1100, y: HEIGHT - 160, w: 120, h: 16 },
    { x: 1250, y: HEIGHT - 120, w: 140, h: 16 },
    { x: 1450, y: HEIGHT - 200, w: 160, h: 16 },
    { x: 1650, y: HEIGHT - 240, w: 140, h: 16 },
  ];
}

function buildEnemies(): Enemy[] {
  return [
    { x: 260, y: HEIGHT - 72, w: 36, h: 32, dir: -1, speed: 70, alive: true },
    { x: 660, y: HEIGHT - 72, w: 36, h: 32, dir: 1, speed: 80, alive: true },
    { x: 1180, y: HEIGHT - 192, w: 36, h: 32, dir: -1, speed: 90, alive: true },
    { x: 1500, y: HEIGHT - 232, w: 36, h: 32, dir: 1, speed: 90, alive: true },
  ];
}

function buildCoins(): Coin[] {
  const coins: Coin[] = [];
  const addRow = (startX: number, y: number, count: number, gap = 28) => {
    for (let i = 0; i < count; i++) {
      coins.push({ x: startX + i * gap, y, r: 10, taken: false });
    }
  };
  addRow(160, HEIGHT - 200, 4);
  addRow(420, HEIGHT - 260, 4);
  addRow(720, HEIGHT - 220, 4);
  addRow(1000, HEIGHT - 300, 4);
  addRow(1320, HEIGHT - 180, 5);
  addRow(1580, HEIGHT - 250, 4);
  return coins;
}
