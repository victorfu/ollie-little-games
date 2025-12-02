# Ollie Little Games

A tiny React + TypeScript shelf of browser-sized canvas games. Launch from the in-app hub and jump between three mini experiences without installs.

## Quick start
- `npm install` once to pull dependencies.
- `npm run dev` to start Vite and open the hub.
- `npm run build` for a production bundle; `npm run preview` to serve it.
- `npm run lint` to check code style.

## Games
- **Bunny Jumper** – Endless vertical jumper. Bounce off static/moving/breakable/vanishing clouds, dodge gust lanes and critters, collect carrots for combo points, and grab powerups (flight, super jump, magnet, shield). Score = height climbed + carrot bonuses; best stored in `localStorage` under `bunnyJumperBestScore`. Controls: ←/→ or A/D. Difficulty slider adjusts platform gaps.
- **Meteor Glider** – Glide through falling meteors with a dash meter. Wind pushes the ship, meteors speed up over time, and fuel cells refill dash energy while adding points. States: menu, playing, paused, game over with best score saved to `meteor-glider-best`. Controls: ←/→ or A/D to steer, Space/Shift/K to dash; tap left/right halves or the on-screen Dash button on touch.
- **森林蘑菇冒險** – Side-scrolling platformer with 10 handcrafted levels. Run, jump, and double-jump (with feather), stomp red mush enemies, collect coins, and pick up powerups (star invincibility, boot speed, feather double jump, heart extra life). Three lives, level bonus when reaching the flag; best saved to `mushroom-adventure-best`. Controls: ←/→ or A/D to move, ↑/W/Space to jump.

## Project notes
- Built with Vite, React 19, and plain canvas rendering; styles live in `src/main.css`, `src/index.css`, and `src/styles`.
- Entry: `src/main.tsx` mounts `App.tsx`, which routes between the hub and each game component.
- Best scores persist locally only; clearing browser storage resets them.
