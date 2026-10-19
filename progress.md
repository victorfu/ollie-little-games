Original prompt: 更新已確認的防禦、戰後回血、復活與 Boss 打斷規則，開始實作戰鬥規則核心。

- Scope: independent TypeScript battle engine; no gameplay UI in this phase.
- Use existing assets later; no new image generation required.
- Updated design: defense halves direct damage until next own start, victory restores 20% HP (dead revive at 20% without double heal), revival preserves only unspent slots, boss interruption exposes core through its next weak strike.
- Added src/game/catalog.ts (six classes / 18 skills) and battle.ts (pure, serializable seeded command engine). Added docs/battle-core.md for API and provisional edge cases. No UI integration yet.
- Tests: 21 passing, including 18 skills, 20 roster combinations (construction only, not balance), invalid-command atomicity, ordering, status ticks, revival, inventory precedence, boss interruption, stun delay, victory/defeat and pure settlement.
- npm run lint and final npm run build passed, with existing >500 kB bundle warning. git diff --check passed. Test source typecheck uses TypeScript 6 --ignoreConfig when providing explicit files.
- Skill Playwright client attempted but fails before launch: ERR_MODULE_NOT_FOUND for playwright from the installed skill script. No screenshots generated. Pure engine is tested through Node; browser gameplay validation belongs to UI integration.
- TODO: next approved phase is selectable combat prototype with actual intents and small-monster AI; balance fixture numbers later. Add render_game_to_text and advanceTime with that UI. Implement treasures and adventure save/reward transactions in their phase.

## Playable prototype

- Added /adventure and homepage entry: six-select-three, gender choice, recommended party, three encounters, command/target/confirmation flow, estimates, speed previews, item UI, status explanations, victory/defeat/retry, keyboard and responsive touch layout.
- Uses existing HD chibi PNG/GIF assets. Forest is a temporary canvas scene (no generated images or SVG), ready for later art replacement.
- Small-monster AI and intent share logic; rock guard announces heavy target. Fixed guard/break opposition so post-heavy exposure is applied after removing guard.
- Added render_game_to_text and discrete advanceTime hook for turn-based interaction automation.
- 23 engine tests pass. Browser flow verified using bundled Playwright with installed Chrome: gender/selection cap, cancellation without resource loss, stealth, slow preview, mixed victory, retry, mobile layout and asset loading. Extended flow verifies keyboard, Escape, defense, healing supply consumption, rock cycle, defeat and full recovery on retry.
- Executed installed skill client via an ignored local copy with only Playwright import/executable paths adapted. Inspected desktop selection/battle/preview and mobile screenshots under .playwright-mcp. Existing Google Fonts request is blocked by network policy; local font fallback works. No application page errors.
- Next: Boss gameplay/polish per approved order, then exploration segment. No treasure or save system yet. Development server: http://127.0.0.1:5180/adventure.

## Boss battle

- Fourth encounter now offers eclipse treant with existing HD chibi assets, shared bossIntent/execution target selection, charge/shield banner, interruption feedback, exposure and phase-two glow/two-target strikes. Increased Boss arena height after inspecting a clipped intent bubble.
- No-healer public-state policy: all 10 teams x 30 seeds = 300 wins, max 7 rounds. Separate guardian/ranger/witch defend-blast policy: 30 wins, 51 explosions endured. Limited camp supplies only; no future RNG peeking. Tests committed in tests/boss-balance.test.ts.
- Browser test .playwright-mcp/boss.mjs passed: no-healer actual UI victory, damage shield break, exposure, second phase, mobile overflow and assets. Inspected charge/mobile/phase-two screenshots. Skill client also run (local bundled-runtime import/Chrome executable adaptation).
- Rule suite now 26 tests. Test-source TypeScript check passed. Next step is exploration-to-combat segment, not yet implemented.

## Exploration segment

- Added /forest and homepage entry with WASD/arrow movement, click BFS path, sampled three-member following, canvas camera/collision, contact encounter, chest, camp, bag tabs, leader selection, party swap, moss charm and single local save.
- Adventure now accepts optional session callbacks so exploration carries HP/MP/inventory/equipment into battle. Outcome saved immediately and idempotently; return button resumes the world. Standalone /adventure remains intact.
- Added src/game/exploration.ts pure save/world transactions and six rule tests. All 32 tests pass, including previous 330 no-healer Boss simulations. Build, lint and explicit test-source typecheck passed.
- Browser .playwright-mcp/forest.mjs verifies walk/follow, paused map, contact battle, midfight reload, victory return, chest idempotence, bag, click route, camp equip/swap, reload persistence and mobile overflow. Additional forest-storage.mjs passes blocked storage warning, corrupt save retention and mobile directional input. Inspected screenshots; fixed overlapping followers on spawn/return with spaced initial trails.
- Skill client executed on /forest. Existing Google Fonts external request remains network-blocked; no application page errors. No new images/SVG generated; scene uses code-drawn placeholder scenery and existing HD sprites.
- Details and boundaries in docs/exploration-prototype.md. Next approved phase: full map and flow (remaining encounters, branches, travel notes, Boss entry and ending/replay). One encounter/chest/camp only in this slice.

## Complete forest flow

- Expanded map to 2400x960: three mandatory battles, two optional branch battles/chests, two camps, two notes and explicit-confirm Boss entry. Added discovered-path map with numbered legend (fixed label overlaps after screenshot inspection).
- Implemented medicine kit healing bonus and dew pendant opening shield, per-person/per-treasure equipment uniqueness, ending snapshot, restored forest lamps, return-to-world and changed-party replay retaining treasures/equipment but resetting world/medicine.
- Save schema 2 uses the existing key and migrates schema 1, preserving loot/progress; old positions inside new choke walls move onto main path. Pending ending reloads correctly; replay cancellation returns to ending, avoiding a frozen world.
- Added five completion tests, total 37, including no-healer complete route, optional-skip route, replay/reward idempotence, checkpoint, migration, reachability and treasure effects. Previous 330 no-healer boss simulations retained.
- Added reusable scripts/forest-smoke.mjs and npm run test:forest-browser (PLAYWRIGHT_MODULE / CHROME_PATH / GAME_URL configurable). Verified actual UI traversal of all six encounters, both camps/notes/chests, boss confirmation, ending+reload, return, mobile ending, changed-party replay and replacement chest loot. Uses isolated browser storage.
- Ran installed skill client and inspected full-map, note, camp, ending and mobile screenshots. Existing Google Fonts request remains blocked; app uses local fallback. No page errors. Remaining planned work is final art/presentation, sound and human pacing/balance polish; complete gameplay flow is present.

## Storybook art and interface

- Used built-in image_gen only (no API key or SVG) for five raster assets: moss ground, soil path, tree cluster, two-state chest sheet, campfire. Requested GPT-Image2; actual version not returned, recorded as null in manifest rather than inferred.
- PNG masters and SHA-256 provenance in assets/environment/storybook; WebP runtime copies in public/environment/storybook (2.66 MB combined). Browser-only encoding script preserves dimensions/alpha; no content edits or API calls.
- Added cached ForestArt terrain renderer, soft road mask from unchanged walkability, generated chest states and reduced-motion-aware camp glow. Reused assets for battle scenery; preloaded existing character/monster animation frames to reduce initial flicker.
- Updated parchment panels, readable object labels, party HP bars, camp panel illustration, desktop controls and larger mobile directional/interaction pad. Adjusted old lamp positions to avoid covering encounter labels.
- Added scripts/forest-art-smoke.mjs / npm run test:forest-art: desktop and 390px DPR2 mobile assets, chest open/closed, camp, bag/panels, touch movement, reduced motion, overflow and page errors pass. Inspected resulting screenshots. Complete forest browser flow also passes after the new renderer/UI.
- Battle backdrop inspected after image decode; used object-fit: cover to preserve painted-tree proportions on narrow screens. Desktop/mobile mixed-battle UI regression passes. All 37 rule tests remain passing; image-generation output and packaging provenance documented in assets/environment/storybook/README.md.
