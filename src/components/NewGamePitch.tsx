type NewGamePitchProps = {
  onBack: () => void;
  onJumpIntoBunny: () => void;
  onPlayMeteor: () => void;
};

type Concept = {
  id: string;
  name: string;
  hook: string;
  loop: string;
  challenge: string;
  vibe: string;
  selected?: boolean;
};

const CONCEPTS: Concept[] = [
  {
    id: "meteor-glider",
    name: "Meteor Glider",
    selected: true,
    hook: "Thread a glider through falling meteors with short dash boosts.",
    loop: "Tilt left/right to dodge, tap to dash through gaps, collect fuel cells to keep boosts alive.",
    challenge:
      "Meteors accelerate, wind pushes the ship, and safe corridors shrink over time.",
    vibe: "Arcade neon, crunchy sfx, dramatic screen shakes on near-misses.",
  },
  {
    id: "garden-sprinter",
    name: "Garden Sprinter",
    hook: "Race a tiny fox around a looped garden, pulling off drift turns.",
    loop: "Auto-run forward, hold to charge a drift, release to sling around corners and snag flowers for combos.",
    challenge: "Tighter turns, puddles that slow you, and bees that force lane swaps.",
    vibe: "Sunny afternoon palette, soft shadows, cozy leaf particles.",
  },
  {
    id: "echo-drops",
    name: "Echo Drops",
    hook: "Drop bouncing notes that ping outward; match echoes to the beat.",
    loop: "Tap to drop notes onto lanes, bounce timing earns streaks, build a layered melody as you survive.",
    challenge: "Pattern speed ramps up, occasional off-beat traps, and bonus chords to chase.",
    vibe: "Minimal grid, bold color blobs, springy synth UI sounds.",
  },
];

export default function NewGamePitch({
  onBack,
  onJumpIntoBunny,
  onPlayMeteor,
}: NewGamePitchProps) {
  return (
    <div
      className="min-h-screen text-slate-900"
      style={{
        background:
          "linear-gradient(135deg, #ecf5ff 0%, #fef6ff 40%, #f3fff7 100%)",
      }}
    >
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-800 shadow-md backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            ← Back to list
          </button>
          <button
            type="button"
            onClick={onJumpIntoBunny}
            className="rounded-full bg-slate-900 text-white px-4 py-2 text-sm font-semibold shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            Play Bunny Jumper
          </button>
          <button
            type="button"
            onClick={onPlayMeteor}
            className="rounded-full bg-amber-500 text-white px-4 py-2 text-sm font-semibold shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            Launch Meteor Glider
          </button>
        </div>

        <header className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            New game planning
          </p>
          <h1 className="text-4xl font-bold mt-2">Pick what we build next</h1>
          <p className="text-slate-600 mt-3 max-w-3xl text-base">
            Three quick pitches below. Tell me which one you want and I&apos;ll
            lock the scope, set a milestone list, and start building the first
            playable slice.
          </p>
        </header>

        <div className="grid gap-6 mt-8 md:grid-cols-2">
          {CONCEPTS.map((concept) => (
            <article
              key={concept.id}
              className="rounded-3xl bg-white/90 border border-white/80 shadow-xl p-6 flex flex-col gap-3 backdrop-blur"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{concept.name}</h2>
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  {concept.selected && (
                    <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-1">
                      Selected
                    </span>
                  )}
                  <span>Prototype ready in ~2 days</span>
                </span>
              </div>
              <p className="text-slate-700">{concept.hook}</p>
              <div className="rounded-2xl bg-slate-900 text-white text-sm p-4 leading-relaxed">
                <span className="font-semibold text-amber-200">Core loop: </span>
                {concept.loop}
              </div>
              <div className="grid gap-2 text-sm text-slate-700">
                <div className="rounded-xl bg-slate-100/80 px-3 py-2">
                  ⚡ Skill curve: {concept.challenge}
                </div>
                <div className="rounded-xl bg-slate-100/80 px-3 py-2">
                  🎨 Feel: {concept.vibe}
                </div>
              </div>
              <div className="text-xs text-slate-500">
                Want this one? Say “build {concept.name}” and I&apos;ll draft the
                task breakdown next.
              </div>
            </article>
          ))}
        </div>

        <section className="mt-10 rounded-3xl border border-white/80 bg-white/90 shadow-xl p-6 backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Build path
              </p>
              <h2 className="text-2xl font-bold">How we&apos;ll ship it</h2>
              <p className="text-slate-600 mt-1 text-sm">
                A small loop first, polish later. Pick a concept and I&apos;ll
                deliver these steps in order.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                1 day: core controls
              </span>
              <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-semibold">
                2 days: scoring + juice
              </span>
              <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold">
                1 day: UI + polish
              </span>
            </div>
          </div>
          <div className="grid gap-3 mt-4 md:grid-cols-3 text-sm text-slate-700">
            <div className="rounded-2xl bg-slate-100/80 px-4 py-3">
              <div className="font-semibold mb-1">1) Prototype loop</div>
              Controls, movement feel, a single obstacle type, and a temporary
              score counter.
            </div>
            <div className="rounded-2xl bg-slate-100/80 px-4 py-3">
              <div className="font-semibold mb-1">2) Difficulty pass</div>
              Add two modifiers, pacing curve, feedback (particles, sfx cues),
              and pause/reset UX.
            </div>
            <div className="rounded-2xl bg-slate-100/80 px-4 py-3">
              <div className="font-semibold mb-1">3) Final layer</div>
              Menu art, onboarding tooltip, lightweight achievements, and a
              best-score shelf on the hub.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
