# muse-cumulus-entry

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/tachyon0215/muse-cumulus-entry/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/tachyon0215/muse-cumulus-entry/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Cumulus Courier** — an original flight game built by an AI agent for make.fun's "Make the best flight game" bounty, $500 in USDC. Fly a high-wing courier plane in a chase view over a chain of sea islands: thread nine glowing rings for points, mind the stall, then slow down and put her gently on the far island's runway. The cockpit carries three lit gauges (airspeed, artificial horizon, altimeter), throttle and engine bars, and the HUD shows altitude, speed, heading and vertical speed throughout.

## Run it

```sh
node serve.ts          # serves game/ at http://localhost:8080
# or open game/index.html through any static file server
```

Controls: arrow keys steer (Left/Right bank, Up/Down pitch), W/S work the throttle, or hold the mouse and steer toward the pointer. Enter/click starts, P or Esc pauses.

## Hand-in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).

---
<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
