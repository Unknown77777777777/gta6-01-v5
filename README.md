# Costa Sol — Open-World Crime

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Unknown77777777777/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/Unknown77777777777/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01).
Lena Cruz owes Marco Venn $2000. Nine story missions across Costa Sol pay it back — and then take the city.

## Play

Open `game/index.html` in desktop Chrome (serve `game/` with any static server, e.g. `python3 -m http.server`).

- **WASD / Arrows** — walk and drive (Shift to run, Space for handbrake)
- **E** — steal / enter / exit a car, advance dialogue, finish the final mission
- **F** — shoot (aim with the mouse), **1–4** switch weapons
- **R** — change radio station, **V** — vigilante (in a car, no heat), **M** — mute

## What is in the game

- A 4800×3600 explorable city: 8 named districts, beach, harbour, marina, parks and plazas
- 9 story missions (M1–M9) with briefing/debrief dialogue, GPS waypoint arrow + live distance, timers
- Traffic AI and pedestrians, 10 vehicle classes (Compact, Sedan, Sports, Police, Motorcycle, Truck, Van, Ambulance, Taxi, Limo)
- Wanted level 0–5 stars: police pursuit, roadblocks (3+), spike strips (4+), hideouts that clear heat
- Combat: pistol, shotgun, SMG and rifle with pickups, muzzle flash and bullet tracers
- 2.5D neo-noir look: extruded building roofs with camera parallax, procedural textures, day/night cycle, headlights, police siren glow, streetlamps
- Game feel: skid marks, vehicle damage smoke/fire/explosions, screen shake, particles, floating text
- Procedural WebAudio radio: 3 stations (Costa Synthwave, Harbor Lo-Fi, Police Scanner)
- Side work: taxi fares, 8 hidden packages, stunt jumps, street races, vigilante, paramedic
- HUD with money, debt, health, wanted stars, clock, speed, objective, minimap and GPS arrow
- Save / load via localStorage; start screen; complete screen

## Tech

Static files under `game/`, no build step, no network requests, no external assets.
All visuals and audio are procedural from the game's own code. `main.ts` copies
`game/` and `screenshots/` to the output directory and writes `dossier.json`.

## License

SPDX-License-Identifier: MIT — see `LICENSE`.
