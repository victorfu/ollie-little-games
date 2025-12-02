# PRD - Ollie Little Games

Reality product description derived from the current codebase. React 19 + Vite app that renders three canvas mini-games behind a simple router-driven hub. No backend or auth; all progress is stored in `localStorage`.

## Hub experience
- Landing route `/` shows a shelf with cards for Bunny Jumper, Meteor Glider, and 森林蘑菇冒險.
- Reads best scores from `localStorage` keys: `bunnyJumperBestScore`, `meteor-glider-best`, `mushroom-adventure-best`.
- Card buttons route to `/bunny`, `/meteor`, `/mushroom`; each game screen offers a back-to-hub button.

## Game specs
### Bunny Jumper (endless vertical)
- Canvas 480x800. States: menu → playing → game over. Difficulty slider scales vertical platform gaps (1.0–1.6x).
- Core loop: auto-bounce on landing; move horizontally to climb while camera follows upward. Falling below camera ends the run unless shield is active.
- Platforms: static, moving (horizontal drift), breakable (delayed fall), vanishing (single-use). Distribution tightens with height.
- Hazards: gust lanes that push horizontally; stompable critters on platforms.
- Collectibles: carrots (35% spawn) worth 50 points with a combo window; particle effects on pickup.
- Powerups (3% spawn): flight (hover upward), super jump (higher bounce), magnet (pulls carrots), shield (one-time fall save). Timers tracked per type.
- Scoring: height climbed * 0.5 + carrot combo bonuses. Best persisted to `localStorage`.
- Controls: ←/→ or A/D. No touch gestures are wired in the current build.

### Meteor Glider (meteor dodge)
- Canvas 480x720. States: menu, playing, paused, game over; HUD shows score, best, fuel bar, dash cooldown.
- Movement: horizontal drift with friction and periodic wind shifts. Dashes consume 25 fuel (max 100), last 0.24s, 1.2s cooldown.
- Spawning: meteors fall faster over time; collisions end the run. Fuel cells drop on a timer, pulse, and refill dash fuel while granting score.
- Effects: screen shake and particle bursts on near misses, dash, and pickups.
- Scoring: time survived plus pickups; best saved to `meteor-glider-best`.
- Controls: ←/→ or A/D to steer; Space/Shift/K (or on-screen Dash) to dash. Pointer/touch left/right halves also steer.

### 森林蘑菇冒險 (side-scrolling platformer)
- Canvas 960x540. States: menu → playing → win or dead overlays. Three lives; HUD shows score, lives, level index, best, and active timers.
- Levels: 10 handcrafted layouts (platforms, enemies, coins, powerups, flag position). Camera follows player on the x-axis up to the flag region.
- Player: run and jump; double-jump when feather timer is active. Stomping enemies awards points; falling or taking damage costs a life.
- Powerups: star (invincibility), boot (speed), feather (double jump), heart (+1 life). Coins add 10 points; powerups add 20; stomps add 50; flag grants a bonus and advances.
- Win/lose: final flag triggers win overlay and best-score persistence; losing all lives shows dead overlay with retry and hub buttons.
- Controls: ←/→ or A/D to move; ↑/W/Space to jump/double-jump.

## Non-functional notes
- No audio, backend, or analytics. Assets are drawn procedurally on canvas; backgrounds use CSS gradients.
- Canvases render at fixed logical sizes and are visually scaled via CSS; browser zoom affects perceived resolution.
- Local storage is the only persistence; clearing it resets best scores across all games.
