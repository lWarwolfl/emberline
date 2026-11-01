# EMBERLINE

![EMBERLINE cover art: the wordmark on a dark grid, crossed by an ember filament](assets/og-image.png)

An offline pixel runner with procedural encounters, five changing environments,
original synthesized sound, and an endless score. UI direction follows the
Hermes Claude Design skill used for the original game. The hosted build installs
as an app and keeps playing with no network after the first load.

The game source uses strict TypeScript. ESLint and Prettier cover the project,
and the checked-in browser bundle keeps offline and double-click launching available.

## Play

Double-click **Play.cmd** for a dedicated Edge window, or open **index.html** in a
modern browser. No build, package installation, server, or network is needed.
Keep the whole folder together: the HTML loads the committed `dist/game.js` bundle.
The TypeScript source is in `src/`; only editing requires Node and a build.

| Key        | Action                                            |
| ---------- | ------------------------------------------------- |
| Space / Up | Jump again in air; 2 normally, 3 with Triple Jump |
| Shift      | Dash through enemies; jump over ground hazards    |
| X / J      | Punch or shoot with the selected weapon           |
| L          | Open character, gear and difficulty setup         |
| P          | Pause / resume                                    |
| F          | Fullscreen / windowed                             |
| M          | Sound on / off                                    |
| Enter      | Start / retry / resume                            |

The default difficulty has three integrity points. Embers are the coins: collecting
them gives a combo bonus, helps recharge your dash, and adds difficulty-scaled
coins to your saved spendable balance. Score awards appear at pickups, destroyed targets and cleared hazards.
Losing window focus pauses the run. Touch buttons are included.

## Version 6: crossfire and shortcuts

- **Thirteen coin trails:** new zigzag, double arc, diamond, helix, ripple and ladder routes.
- **Eight enemies:** Sentry turrets and Wasps fire red/pink bolts after a 0.65-second dotted aim warning. Their aim locks during the warning: jump away or dash through the bolt to deflect it. Armored Beetles and drifting Wisps add new ground and air silhouettes. Shooters unlock from sector 3; Wasps arrive at sector 5.
- **More pressure over time:** speed growth rises about 10%, with a small increase in encounter frequency. Escorts, squads and crossfire groups unlock as sectors progress; squads grow from two to four enemies. Enemy spacing and simultaneous firing warnings remain bounded.
- **Four new skins:** Copper lynx (2,000), Lunar moth (2,800), Deep relay diver (3,500) and Signal specter (4,200). Each has a distinct head/helmet silhouette and the same player hitbox.
- **Three new guns:** Needle repeater (3,600; fast single shots), Nova fan (4,400; five-bolt spread), and Prism railgun (5,200; pierces up to three targets). Steel hazards still stop every weapon.
- **Level-10 progression:** Dash, Jump height and Attack damage now reach L10. Existing L0–L5 prices and stats are unchanged. L6–L10 cost 750 / 1,000 / 1,250 / 1,500 / 1,750 coins. Advanced tiers have smaller increments; damage caps at ×2.6 and dash stays below ×1.8. Triple Jump remains a one-time unlock.
- **Rare shortcuts:** every generated encounter has a combined **5%** chance of a portal or jump pad, split equally. Walk into a portal to skip 650m; a pad launches you and skips 350m, followed by a short speed burst. Both clear the skipped dangers and bullets, protect the arrival, and award distance score. Skipped coins are not collected. Devices have animated pixel art, particles, sound and local action labels; reduced motion keeps a restrained cue, and the devices stay visible with particle effects disabled.

Your wallet, owned equipment and existing upgrade levels carry over. Open the shop to buy new equipment or continue past level five. Purchases still apply to the next run's upgrade snapshot.

## Version 5.3: seamless mobile shell and installable PWA

Phones get one full-height surface instead of stacked page chrome: edge-to-edge
stage, compact score/best/pace readout, four toolbar actions, a particle toggle,
and three large thumb controls. The setup dialog becomes a full-screen sheet.
Safe-area insets cover notches and home bars, and the page never scrolls or
rubber-bands. Landscape keeps the complete 2:1 playfield centred between a
single-row HUD and the touch deck.

On HTTPS the game registers `sw.js`, caches the compiled game and static assets and installs
from the browser's app menu. After the first visit it opens offline. `file://`
launches skip service-worker registration, so Play.cmd is unchanged.

## New in version 5: capped upgrades and balance

The shop opens on **Upgrades**. Each row emphasizes your level, the next benefit,
and the price. A five-segment meter shows progress; advanced stats are under
**Details**. Available coins stay beside the heading. Buying preserves scroll
position and focus. Maxed upgrades cannot be bought again.

| Upgrade       | Limit             | Coin costs              |
| ------------- | ----------------- | ----------------------- |
| Dash          | Level 5           | 100, 200, 300, 400, 500 |
| Jump height   | Level 5           | 100, 200, 300, 400, 500 |
| Attack damage | Level 5           | 100, 200, 300, 400, 500 |
| Triple Jump   | One-time, level 1 | 5,000                   |

Each normal track costs 1,500 coins to max. Upgrades apply on the next run;
buying while paused cannot change current stats. Triple Jump adds one more jump
using Space/Up or the touch control. Landing restores all jumps.

Abilities start at level zero. Dash begins with a short 1.18× burst, an 18px
lunge and 2.80s recharge. Even at level 5 it stays below the old 1.8× dash.
Jump coils gradually increase first- and second-jump height. Damage starts at
×1 and gains 20% per level, capped at ×2. Each dash damages an enemy once per
burst, rather than repeatedly on every frame. Tougher enemies and stacked crates
retain meaningful durability; scatter pellets have lower individual damage.
The starter double jump remains usable for ordinary generated encounters.

| Item                                |    New coin price |
| ----------------------------------- | ----------------: |
| Relay bot / Moon hare / Dust ranger | 500 / 900 / 1,500 |
| Signal ribbons / Storm mantle       |         250 / 600 |
| Twin rockets / Arc coil             |         400 / 800 |
| Pulse blaster / Scatter gun         |     1,200 / 2,400 |

Existing coins and bought gear carry over without being charged again. New
upgrades start at zero. Coin rewards remain 1 / 2 / 3 on preset difficulties;
**Custom still earns zero coins**, even with upgrades or Triple Jump.

## Earned-coin shop

Open **SHOP & UPGRADES** or press **L**. The outfitter now sells skins, capes,
jetpacks and weapons using coins earned in runs. Preview any item; a locked
preview does not change your equipped gear. Use **BUY & EQUIP** to buy once,
then swap owned items for free. The button shows how many more coins you need
when funds are short. Purchases and the remaining wallet persist after reload.

| Difficulty   | Coins per pickup |
| ------------ | ---------------: |
| Night stroll |                1 |
| Courier      |                2 |
| Overdrive    |                3 |
| Custom       |                0 |

Custom is score-only practice, including custom settings harder than Overdrive.
The reward rate is captured when a run starts; changing the pending difficulty
while paused cannot change its earnings. Score/combo bonuses are separate from
coins, and the local pickup popup shows the exact currency award.

The fox, Ember cape, Ember jetpack, impact glove and no-gear options are free.
Other prices are listed above and shown before purchase.
Existing collected coins become the spendable balance without a reset. Old
non-starter selections need purchasing before they can be equipped in this version.

Prices live in `src/economy.ts`; reward rates live in `src/loadout.ts`. There are
no real-money purchases, accounts or network services.

## New in version 3

Open **SHOP & UPGRADES** before starting, **SHOP / SETUP** from the toolbar,
or press **L**. The preview animates your actual character and equipment. Choices
autosave. Character, cape and jetpack variants have equal movement stats;
the version 4 shop controls which items you own.

- Four characters: Ember fox, Relay bot, Moon hare and Dust ranger.
- Three cloth styles plus no cape. Capes have animated, shaded cloth columns,
  with a fixed shoulder attachment and a moving free edge. Wind, jumps and dashes
  change the silhouette. Jetpacks have single, twin and coil variants, plus none.
- Three real weapons: a short-range impact glove, a precise pulse blaster,
  and a three-bolt scatter gun. Use X/J, click the playfield or use the attack button.
  Bright-seam crates/barriers/stacks break; steel-marked pipes, spikes and reactors
  resist attacks. Enemies can be destroyed; their durability and your damage
  upgrade determine how many hits they take.
- Dash boosts world travel and lunges the courier forward. The camera then catches
  up smoothly. Version 5 starts it at a basic level and caps its upgrades. Ground
  hazards must be jumped or attacked separately.
- A faster default difficulty ramp, plus Night stroll, Courier and Overdrive
  presets. Custom controls tune starting pace, escalation, density and integrity.
  Changing difficulty during a paused run affects the next run; gear updates now.
- Coins are saved as they are collected, including during an unfinished run.
  The top counter is spendable coins; the stage counter is the current run's earnings.
  Local action labels show exact score bonuses, including the coin combo bonus.

## What changed in version 2

- **Speed:** a rising baseline plus randomized cruise, surge and breather phases.
  Transitions accelerate and decelerate smoothly. Speed and pace are shown live.
- **Six hazards:** crates, spikes, barriers, stacked crates, pipes and reactors.
- **Four enemies:** hovering drones, ground crawlers, drifting jellies and bats.
  They have distinct sprites, altitudes, motion and relative speeds.
- **Five backgrounds:** city, foundry, forest, frozen mountains and desert ruins.
  Each has different structures, palette and weather. Sectors crossfade scenery.
- **Seven coin trails:** ground, arc, staircase, high, wave, split and scatter.
- **Mixed generation:** six encounter templates combine randomized variants,
  coin trails, positions and gaps. Shuffle bags prevent immediate template/trail
  repeats. New hazards and templates unlock over the first four sectors.
- **Editable source:** simulation, generation, presentation and input are separate.

## Edit the game

Install development dependencies with `npm ci`, edit the TypeScript in `src/`,
then run `npm run build` and refresh. The build checks strict types and bundles `dist/game.js` and `sw.js`.
Tests run directly from typed source through the tsx loader.
The browser bundle is a classic script, so `file://` launching still works.
Commit the generated `dist/game.js` and `sw.js` with any source changes.

```text
index.html                Screen structure and compiled game entry point
style.css                 Formatted responsive UI styles
sw.js                     Generated offline service worker
dist/game.js              Generated browser bundle (committed)
Play.cmd                  Windows dedicated-window launcher
src/
  config.ts               Speed, physics, dash and timing constants
  loadout.ts              Character/gear/weapon catalogs, difficulty presets and validation
  economy.ts              Prices, owned items, wallet migration, permanent purchases
  upgrades.ts             Capped progression, upgrade costs and run-stat formulas
  upgrade-panel.ts        Level/benefit/price UI with optional details
  combat.ts               Punch hitboxes, projectile movement, armor and destruction
  enemy-fire.ts           Locked-aim warnings and hostile projectiles
  traversal.ts            Portals, jump pads, safe skipping and travel effects
  cloth.ts                Pure animated cape geometry
  content.ts              Hazard/enemy definitions, biomes, paces, pattern catalog
  random.ts               Seeded RNG, weighted choices and shuffle bags
  difficulty.ts           Smooth speed phases, sector and biome transitions
  generator.ts            Encounter assembly, coin paths and clearance rules
  engine.ts               Pure simulation, movement, collision and scoring
  pixel.ts                Shared pixel primitives and color mixing
  backgrounds.ts          Parallax geometry, weather and theme crossfades
  sprites.ts              Courier, hazard, enemy and coin drawing registries
  renderer.ts             Scene composition; no gameplay rules
  audio.ts                Original Web Audio sound synthesis
  particles.ts            Bounded particle system
  popups.ts               Local score/action labels with bounded lifetime
  wardrobe.ts             Accessible setup tabs, preview and custom difficulty controls
  storage.ts              Safe best-score and preference persistence
  ui.ts                   HUD, overlays and announcements
  input.ts                Keyboard, touch and focus handling
  pwa.ts                  Service-worker registration (HTTP/HTTPS only)
  app.ts                  Coordinates simulation, presentation and UI
  main.ts                 Browser entry point and optional debug hook
  types.ts                Shared game-state, save, equipment and rendering contracts
  dom.ts                  Required, typed DOM element lookup
  service-worker.ts       Offline precache source
tests/                    Node regression and generation tests
scripts/build.ts         TypeScript checks and deterministic browser/worker build
scripts/browser-check.ts Optional Edge/Chromium integration checks
scripts/gear-browser-check.ts Gear, difficulty, coins and combat integration checks
scripts/shop-browser-check.ts Purchases, insufficient funds and difficulty reward integration
scripts/upgrades-browser-check.ts Level caps, purchases, persistence and actual Triple Jump
docs/DEVELOPMENT.md        Recipes for extending content and tuning the game
```

## Reset saved progress

Open the shop with **L**, choose **Settings**, then **Reset Progress**. The first
click shows a confirmation; **Keep My Progress** or Escape cancels it. Confirming
**Reset & Restart** removes coins, purchased gear, upgrade levels, best score and
equipped loadout/difficulty, ends the current run and returns to the title screen.
Sound and particle preferences are kept. Only this browser's EMBERLINE save is
affected; unrelated site data is never cleared.

## Website metadata and preview assets

Configured public URL: **https://emberline.sinakheiri.dev/**. Title, description,
canonical URL, Open Graph and X/Twitter cards are saved directly in the HTML head,
along with `VideoGame` structured data. Social-image URLs are absolute; game,
favicon and app-icon paths remain local so Desktop launching continues to work.

- `assets/og-image.png`: 1200×630 designed cover, also the repo preview.
- `assets/preview-square.png`: 1080×1080 designed square cover.
- `PREVIEW.png`: copy of the wide cover for tools that expect a root preview.
- `assets/favicon.svg` and `favicon.ico`: browser favicons, with PNG fallbacks.
- `assets/icon-180.png`: Apple touch icon.
- 192px/512px icons plus a padded maskable icon for the web manifest.
- `site.webmanifest`, `robots.txt`, and `sitemap.xml`: static app/crawl metadata.

Edit `site.config.json`, then run `npm run metadata` to update the HTML metadata,
manifest and crawl files. `npm run assets` regenerates the icons and both cover
images (vector HTML/CSS rendered to PNG, not game screenshots); it needs the
same optional Playwright setup as browser tests.
The generated image files are already included, so playing needs no tools.
Upload the entire folder when deploying; the absolute sharing URLs expect assets
under `/assets/` on the configured domain, and `sw.js` must stay at the root so
its scope covers the game. `sw.js` precaches the page, stylesheet, manifest,
icons and `dist/game.js`. Edit `src/service-worker.ts` and bump its `CACHE` name whenever a cached file
changes, then rebuild, otherwise installed clients keep the previous build. Service workers
require HTTP or HTTPS; the local Desktop version already runs offline and
skips registration on `file://`.

## Development checks

With Node 24 installed:

```sh
npm ci
npm run format           # Format all supported project files
npm run check            # Prettier, ESLint, strict TypeScript, build and Node tests
npx playwright install chromium
npm run test:browser     # File launcher, gameplay, shop, upgrades, reset and offline PWA
```

`npm run lint:fix` applies automatic lint fixes. `npm run format:check`,
`npm run lint`, and `npm run typecheck` are available independently.
ESLint uses a flat config, TypeScript recommended rules, and Prettier-compatible
rules. Prettier settings live in `.prettierrc.json`. Dependencies are locked in
`package-lock.json`; none are needed by players.

Browser tests use Playwright's Chromium by default. Set `BROWSER_CHANNEL=msedge`
or `BROWSER_CHANNEL=chrome` to use an installed browser. For an external Playwright
installation, set `PLAYWRIGHT_MODULE` to its module directory. Set
`BROWSER_EXECUTABLE_PATH` to test a custom Chromium executable. Screenshots go to
ignored `test-results/`. CI runs the same checks and rejects stale generated files.

## Reproducible runs

Open `index.html?seed=my-route` to replay the same procedural choices. Reproducing
the exact outcome also requires the same difficulty, equipment and input timing. Normal launches use a
fresh random seed. Add `&dev=1` to expose the documented debug API; no debug
interface or cheat controls appear in the normal game.

Speed rises without a fixed ceiling; score uses `BigInt` and has no numeric cap.
Spacing scales with speed and future acceleration, and collisions use small
simulation steps plus swept horizontal checks. This is a casual endless game,
not a formally proven solvable platformer at arbitrarily large run durations.

## Static deployment

`npm run build:site` builds the game and creates a clean `public/` directory
containing the HTML, stylesheet, compiled game and worker, manifest, icons and
other public assets. `vercel.json` selects that command and output directory.
Development sources, tests and dependencies are excluded. Node is pinned to 24.x
so local checks, CI and Vercel use the same major version.

The deployment tests verify every script and worker-cache asset exists in the
package and stale output is removed. The PWA browser suite serves `public/` and
verifies an actual offline reload. The other browser suites still open the
committed root `index.html` through `file://` to preserve double-click playback.
