# breachline-tactical-fps

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/ahteenstudio/breachline-tactical-fps/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/ahteenstudio/breachline-tactical-fps/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

BREACHLINE is a neon tactical FPS that runs offline in a desktop browser from static files. You are VEX, a lone breach operative in Kestrel Yard, a derelict neon district held by a rogue security squad. Five rounds, first to three: eliminate all four units, or plant the spike at site A or B and defend it until detonation. Credits earned from kills and round wins buy rifles, a sniper, plate armor and medkits between rounds.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Click to deploy, WASD to move, mouse to aim, click to fire, R to reload, E to plant the spike, Shift to sprint, right mouse to zoom with the sniper.

## How it plays

- **Rounds:** best of 5, first to 3. A 90-second round timer; if it expires with no spike planted, the round is lost.
- **The spike:** carry it to site A or B, hold E for 3 seconds to plant, then defend it for 12 seconds until detonation. A living bot will push the site and channel a 4-second defuse.
- **The squad:** four rogue units per round that patrol, hunt on sight or sound, strafe while firing in bursts, and converge on a planted spike. They get sharper and tougher every round.
- **The shop:** buy phase between rounds — VK-7 Vandal rifle (₡900), Lance Longshot sniper (₡1400), plate vest (₡500), medkit (₡300). Kills pay ₡300, round wins ₡600, planting ₡300.
- **Feedback:** HUD with health, armor, ammo, credits, round timer and score pips, a live minimap, kill feed, hitmarkers, damage flash, tracers, sparks and synthesized WebAudio sound — no audio files ship with the game.

## Tech

Three.js 0.187.0 vendored under `game/vendor/three/`, plain ES modules, no build step, no network requests. The source is split by job: `config.js` (balance), `world.js` (map and collision), `bots.js` (squad AI), `weapons.js` (firing and damage), `render.js` (scene and models), `effects.js` (tracers and sparks), `audio.js` (synth sound), `hud.js` (DOM HUD and shop), `shots.js` (screenshot presets) and `main.js` (match state machine).

---

<sub>Entered on [make.fun](https://make.fun/?ref=ws6grq2c&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
