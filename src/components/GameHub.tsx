import { useEffect, useMemo, useState } from "react";
import { getBestScore } from "@/lib/game-utils";

type GameHubProps = {
  onPlayBunny: () => void;
  onPlayMeteor: () => void;
};

type GameCard = {
  id: "bunny" | "meteor";
  title: string;
  blurb: string;
  accent: string;
  status: string;
  actionLabel: string;
  gradient: string;
  meta?: string;
};

const METEOR_BEST_KEY = "meteor-glider-best";
export default function GameHub({ onPlayBunny, onPlayMeteor }: GameHubProps) {
  const [bunnyBest, setBunnyBest] = useState<number | null>(null);
  const [meteorBest, setMeteorBest] = useState<number | null>(null);

  useEffect(() => {
    setBunnyBest(getBestScore());
    const stored = localStorage.getItem(METEOR_BEST_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!Number.isNaN(parsed)) setMeteorBest(parsed);
    }
  }, []);

  const cards: GameCard[] = useMemo(
    () => [
      {
        id: "bunny",
        title: "Bunny Jumper",
        blurb: "Bounce through a pastel sky, snagging carrots and chasing combos.",
        accent: "text-pink-500",
        status: bunnyBest && bunnyBest > 0 ? `Best: ${bunnyBest}` : "Playable",
        actionLabel: "Play now",
        gradient:
          "linear-gradient(145deg, rgba(255,214,230,0.9), rgba(212,235,255,0.95))",
        meta: "Arcade",
      },
      {
        id: "meteor",
        title: "Meteor Glider",
        blurb:
          "Steer a glider through falling meteors, dash through gaps, and collect fuel cells.",
        accent: "text-amber-600",
        status:
          meteorBest && meteorBest > 0 ? `Best: ${meteorBest}` : "Playable",
        actionLabel: "Play now",
        gradient:
          "linear-gradient(145deg, rgba(255,243,224,0.95), rgba(223,241,255,0.92))",
        meta: "Arcade",
      },
    ],
    [bunnyBest, meteorBest],
  );

  return (
    <div
      className="min-h-screen text-slate-900"
      style={{
        background:
          "radial-gradient(circle at 20% 20%, #ffe4f2 0, transparent 25%), radial-gradient(circle at 80% 10%, #e0f1ff 0, transparent 22%), radial-gradient(circle at 15% 75%, #e5ffe9 0, transparent 20%), #fdf9ff",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-14">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Ollie Little Games
            </p>
            <h1 className="text-4xl font-bold leading-tight mt-2">
              Choose a tiny game to play
            </h1>
            <p className="text-slate-600 mt-2 text-base max-w-2xl">
              A cozy shelf of browser-sized adventures. Jump in instantly—no installs.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-3 bg-white/80 backdrop-blur rounded-2xl border border-white/60 shadow-lg px-5 py-4">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pink-400 to-orange-300 text-white font-bold flex items-center justify-center shadow-md">
              {cards.length}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">
                Games on shelf
              </p>
              <p className="text-xs text-slate-500">
                Quick to load, easy to replay.
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 mt-10 md:grid-cols-2">
          {cards.map((card) => (
            <article
              key={card.id}
              className="relative overflow-hidden rounded-3xl border border-white/70 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl"
              style={{ background: card.gradient }}
            >
              <div className="absolute inset-0 opacity-30 pointer-events-none">
                <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/70 blur-3xl" />
                <div className="absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-white/60 blur-2xl" />
              </div>
              <div className="relative p-7 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-600 uppercase tracking-[0.1em]">
                    {card.status}
                  </div>
                  <div
                    className={`px-3 py-1 text-xs font-semibold rounded-full bg-white/70 border border-white/80 ${card.accent}`}
                  >
                    {card.meta}
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{card.title}</h2>
                  <p className="text-slate-600 mt-1">{card.blurb}</p>
                </div>

                {card.id === "bunny" && (
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1">
                      <span className="text-lg">🥕</span>
                      Endless jumper
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1">
                      <span className="text-lg">⚡</span>
                      Keyboard or touch
                    </span>
                  </div>
                )}

                {card.id === "meteor" && (
                  <div className="flex items-center gap-3 text-sm text-slate-700">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1">
                      <span className="text-lg">☄️</span>
                      Dodge meteors
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1">
                      <span className="text-lg">⚡</span>
                      Dash bursts
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={
                      card.id === "bunny"
                        ? onPlayBunny
                        : onPlayMeteor
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 text-white px-4 py-3 text-sm font-semibold shadow-lg transition hover:shadow-xl hover:-translate-y-[2px]"
                  >
                    {card.actionLabel}
                    <span aria-hidden>→</span>
                  </button>
                  <span className="text-xs text-slate-600">
                    Plays in browser, no installs.
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
