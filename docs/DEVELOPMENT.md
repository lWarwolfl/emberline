# Editing and extending EMBERLINE

## Architecture and state flow

`main` creates `App`. App reads Input actions, updates Engine, consumes its event
queue, updates UI/Audio/Particles, then asks Renderer to draw. Engine depends only
on Config, Random, Difficulty and Generator; it has no DOM, storage or audio access.
The source is strict TypeScript with typed module imports. `npm run build`
checks the game and worker and bundles the browser entry point into `dist/game.js`.
Regression tests and scripts are also TypeScript, checked by `tsconfig.tools.json`
and executed with `node --import tsx`. The entry point exposes the existing `Emberline` namespace
and optional `EmberlineDebug` API. Players use committed build output and need no
installed runtime dependencies.

State belongs to the engine. Renderer never changes it. Engine events are
consumed once by App with `state.events.splice(0)`. Cosmetic randomness must stay
out of the gameplay RNG. Generation, pace and scenery use independent seeded RNG
streams, so adding a firefly cannot change the next hazard.

## Tune speed and difficulty

Edit `src/config.ts`:

- `speed.start`: initial logical pixels per second.
- `speed.growth`: strength of logarithmic long-term acceleration.
- `speed.growthSeconds`: time scale of that increase.
- `speed.acceleration` / `deceleration`: maximum rate of a pace transition.
- `sectorSeconds`: when environments change and new content unlocks.
- `generation.minimumGapSeconds`: lower limit on recovery between chunks.

Edit pace multipliers and names in `src/content.ts`. `difficulty.ts` chooses
phases from a shuffled bag and gradually approaches the selected target speed.
The safety-speed calculation uses the largest configured pace multiplier, and
includes the fastest enemy's relative motion in its spacing budget.
Changes to a pace never teleport or instantly speed up an obstacle.

## Add an obstacle

1. Add a definition to `Content.obstacles` in `src/content.ts`. Give it a unique
   `id`, `w`, `h`, first eligible `unlock` sector and relative `weight`.
2. Add a same-named draw function to the `hazards` registry in `src/sprites.ts`.
   The supplied object has `x`, `y`, `w`, `h`. Keep damaging art inside its box.
3. Test it with `npm test` and preview it in developer mode.

Ground hazards always align to the floor and cannot be destroyed by a dash.
Existing hazards top out at 31px. The basic first jump rises about 29px, so the
second jump is needed for the tallest hazards. Taller hazards require new
reachability checks and matching encounter design.
Early sectors deliberately use simple obstacles before introducing taller ones.

## Add an enemy

Add a definition in `Content.enemies` and a draw function in `sprites.enemies`.
`altitude` is measured upward from the floor to the top of the body. `amplitude`
and `frequency` control sine-wave vertical motion; `extraSpeed` is additional
leftward speed. Use zero amplitude for ground enemies. `generator.enemy()` sets
the starting phase and small altitude variation. All `kind: "enemy"` objects are
dashable; the engine does not special-case their sprite names.

Make a new movement rule in `Generator.move()` if sine motion is insufficient.
Update coin clearance and movement tests when adding a new motion envelope.
Avoid sudden position changes or hidden attacks without a readable warning.

## Add a coin pattern

Add its ID to `Content.coinPatterns`, then add a `coinPath` switch case in
`src/generator.ts`. Points are calculated across a chunk's width. Vertical
positions are clamped to the intended double-jump reward band. Each trail is
filtered against the full vertical motion envelope of hazards and enemies;
if fewer than two safe coins remain, a ground reward trail is placed afterward.
Keep this clearance guard when adding new patterns.

Coin positions are generated, drawn and collided at the same coordinates.
Coin shimmer changes its appearance, without moving its hitbox.

## Add an encounter

Add an ID/unlock pair in `Content.patterns`, then implement its assembly case in
`Generator.spawn()`. Compose existing `obstacle()` and `enemy()` constructors.
Use the computed safety speed for spacing. Never generate multiple hazards at
the same horizontal coordinate in both the ground lane and the escape lane.
The first three templates are hurdle, patrol and coin-break; later sectors add
steps, mixed ground/enemy encounters and convoys. Convoys reserve dash recharge
time. Each chunk's entire occupied width is included before the next recovery gap.

Shuffle bags cover all eligible templates/trails before refilling, and prevent
an immediate repeat across refills. Weighted choices also avoid repeating the
same obstacle/enemy variant when there is more than one eligible definition.

## Add a background

Add a biome entry with a complete palette to `Content.biomes`. Add a geometry
branch in `Backgrounds.structure` and a weather branch in `Backgrounds.weather`
if needed. Existing city buildings, factories, trees, mountains and ruins are
different silhouettes rather than palette swaps. All palettes use the same keys
for interpolation. Scenery shapes are hashed by run seed and world coordinate,
so they stay stable while scrolling. Biomes use their own shuffle bag.

## Debugging a repeatable route

Open `index.html?seed=level-check&dev=1`. In the browser console:

```js
const { app, engine, generator } = EmberlineDebug;
app.start();
app.pause();
const state = app.state;
state.biome = state.previousBiome = "forest";
state.biomeBlend = 1;
state.sector = 5;
state.objects = [];
generator.spawn(state);
app.draw();
```

`state.lastEncounter` reports its template, trail, variants, gap and width.
`state.seed` identifies the run. Reload and provide the same seed to reproduce
choices. Remove `dev=1` for normal play. Main recreates the state on retry, so
read `app.state` again after starting another run.

## Tests and formatting

`npm test` checks physics, scoring, collision, pace transitions, shuffle coverage,
seed reproducibility, movement bounds, storage failures, cleanup, and 10,000
generated chunks. A bounded timing search also checks damage-free routes through
18 representative encounters at three speeds. These checks are not a universal
proof that an arbitrary new content definition remains beatable.

The optional browser suite checks actual scripts loaded from `file://`, controls,
sound-node generation, effects, mode changes, saves, all five scene renderings,
all content sprites and the narrow viewport. It fails on JavaScript exceptions.

Run `npm ci` once, then `npm run format` to format all supported files.
`npm run check` runs Prettier verification, ESLint, strict type checks, the build
and all Node tests. Use `npx playwright install chromium` and `npm run test:browser`
for browser verification. CI also checks that generated files match their source.

Shared simulation and UI contracts live in `src/types.ts`; `src/dom.ts` provides
typed, required element lookup. External save values enter as `unknown` and are
sanitized before entering game state. Browser and service-worker TypeScript use
separate DOM/WebWorker libraries. Keep strict checking enabled; fix type errors
instead of suppressing them. Regression tests, browser suites, asset/metadata generators and build scripts
are strict TypeScript and are linted and formatted alongside the game source.

## Safe changes

Keep storage keys (`emberline.best`, `emberline.muted`, `emberline.effects`) stable.
Import new modules from their consumers; the bundler resolves dependency order.
Run `npm run build` after changes and commit `dist/game.js` and `sw.js` with the
source. No server or build tools are needed just to play the committed game.
Use `Config` instead of duplicating balance numbers in presentation code.

## Version 3: equipment, difficulty and combat

`src/loadout.ts` owns the equipment catalogs, weapon damage/cooldowns, three
difficulty presets and custom-setting bounds. `Loadout.sanitize()` validates all
saved input. `Engine.create(seed, loadout)` captures a separate `state.rules`
snapshot and integrity total. Equipment can change in a paused run, but its
difficulty snapshot stays unchanged until retry. This prevents menu changes from
rewriting live physics or health. Tune integrity in the difficulty catalog, not
in a second health constant.

`Wardrobe` uses a native modal dialog, a keyboard-accessible tablist and radio
options. Ranges switch to custom difficulty. Selection saves automatically under
`emberline.loadout`. The live preview draws the same sprites as gameplay at 2×
logical scale; it does not use a separate illustration. Gear is cosmetic except
for weapons. The committed browser game needs no build step or dependencies to play.

`Cloth.sample()` produces shaded vertical columns behind the shoulder. The
attachment remains fixed while phase moves along the length. Character vertical
velocity, pace and dash affect lift; a reduced-motion preference reduces waves.
New cape definitions need color/shade/trim, length and width. Sprite routines
implement ribbons and notched cloth, character silhouettes and jetpack exhaust.

Dash changes `state.runSpeed` and `player.x`; `state.speed` remains the baseline
pace. Distance, scenery and entities use the boosted run speed. The courier
advances, then returns to the camera anchor as it catches up. Collision checks
sweep relative object/player movement, including the dash lunge. Cleared hazards
cannot damage the player again while the camera recenters.

`Combat` owns punch range/duration, per-attack hit guards, projectile lifetime,
interception, and target durability. It awards score exactly once on destruction
and emits the exact award in the action event. Attacks resolve before body
collisions, so a timely punch can save the run. Ground-hazard durability is in
`Combat.armor`: a missing entry means armored/unbreakable. Enemy durability is
defined by `Combat.durability`. Add a weapon to Loadout and its sprite/attack
implementation together, then test range, cooldown, damage and cleanup.

Action events can carry `points`, `coins` and `label`. `App` consumes them once,
adds collected coins to its BigInt bank and saves once per event batch under
`emberline.economy` (the previous `emberline.coins` key is migration input). Run coins remain `state.embers`. `Popups` renders at each action
location and expires independently from particle effects; turning particles off
does not hide score feedback. The best score spans all difficulty presets.

The Node suite covers combat, real dash displacement, cape geometry, difficulty
rules/validation, coin storage and popup lifetime in addition to the route tests.
Both browser suites run with `npm run test:browser`, covering setup controls,
saved equipment, custom sliders, local score labels and actual projectile hits.

## Version 4: prices, ownership and difficulty rewards

`Economy.prices` in `src/economy.ts` defines category-qualified item costs. Zero
means a starter/free choice. `Economy.create(saves)` loads the canonical snapshot,
or migrates the legacy coin count once. The snapshot saves BigInt balance as a
decimal string and ownership as `category:id` keys. A purchase writes debit and
ownership together under `emberline.economy`, so they cannot be saved separately.

`buy(group, id)` validates IDs, rejects insufficient balances and is idempotent
for owned items. `enforce(loadout)` replaces unowned saved equipment with free
starters; App calls it both at startup and when applying choices. The pure engine
does not enforce ownership, which keeps simulation fixtures and previews usable.
This is local game progression, not a server-backed or tamper-proof currency.

Wardrobe keeps a locked preview separate from the actual equipped selection.
Previewing never grants ownership or equips an item. The purchase button clearly
shows price or missing funds; after a successful buy it equips the item and
announces the purchase. The wallet header and shop both read the same balance.

Difficulty definitions have `coinReward`: easy 1, standard 2, hard 3. Custom
always resolves to 0. This is copied into `state.rules` at run creation, so changing
the pending loadout difficulty cannot increase current earnings. Each pickup
still gives score/combo/recharge benefits, even with zero currency reward.
`state.pickups` counts collected objects; `state.embers` counts the run's earned
currency. Events carry the actual award, and App credits it once after consumption.

`tests/economy.test.ts` checks migrations, ownership, double purchases, invalid
IDs, insufficient funds, exact large balances, all reward rates and live-run
isolation. The shop browser suite earns funds through actual pickup events,
purchases an item, re-equips it freely, reloads to verify ownership, and checks
all four difficulty payouts, locked previews and the narrow layout.

## Version 5: capped progression and simplified upgrade UI

`src/upgrades.ts` defines three L0–L5 tracks (dash, jump and damage) and a separate
L0–L1 Triple Jump unlock. Normal next-level cost is `100 * (currentLevel + 1)`;
Triple Jump has a fixed 5,000-coin cost. Stats sanitize levels to their caps before
calculating any effect. Base values are in Config, incremental effects in Upgrades.
Engine receives `create(seed, loadout, upgradeLevels)` and copies a run snapshot.
Mid-run shop purchases affect the next created run, not the existing one.

Economy snapshot version 2 adds `upgrades` alongside balance/ownership. Version 1
migrates preserving all coins and already purchased equipment. Repricing never
charges an existing owner again. `upgrade(id, expectedLevel)` validates the cap,
funds and displayed level before debiting; stale clicks cannot buy another level.
Wallet, ownership and levels persist in the same single-key snapshot.

`src/upgrade-panel.ts` renders a focused full-width list. Each row contains level
pips, one current-to-next benefit and a price action; detailed stats are behind
native `details`. The character preview is hidden only on this tab. The panel
preserves scroll and keyboard focus after a purchase, and announces the result.
Upgrade state is a copy from Economy, never a UI-owned mutable save.

Dash damage is guarded per `dashId` so one burst cannot repeatedly drain enemy
HP. Punch/bolt/dash damage uses the same capped run multiplier. HP subtraction is
rounded to avoid floating-point residue at exact damage thresholds. Scatter has
three lower-damage pellets, keeping its total output near the other base weapons.
Triple Jump changes max jumps to three, with a weaker third impulse; landing
resets the count. HUD and touch labels reflect whether it is unlocked.

The representative encounter search uses level-zero movement and still finds
safe routes. Coin heights are capped to the basic double-jump band. The test
suite also checks exact 100–500 costs, caps, migration, stale clicks, real stat
effects, single-impact dashes, Triple Jump reset, and all previous zero-custom
currency rules. The upgrade browser suite buys all levels, checks maxed UI,
reloads and exercises three real jump inputs and upgraded combat.

## Resetting progress

Storage.resetProgress removes only the four progress keys: economy, coins,
loadout and best. Sound/particle preferences and unrelated origin data stay.
It snapshots the values first and attempts to restore partial removals if a
storage call fails. Failure returns false and does not restart the game.

The Settings tab requires a second explicit Reset & Restart click. Cancel or
Escape does not write storage, and reopening Settings starts unconfirmed.
After a successful reset App stops the old run and reloads, rebuilding its
in-memory economy/loadout/engine from defaults. Removing legacy coins prevents
migration from resurrecting an erased wallet. Reset tests use an isolated browser
context and cover cancellation, reload persistence and preferences.

## Version 5.3: mobile shell and PWA

The phone layout lives in the last `@media (max-width: 700px)` block in
`style.css`, with a landscape override below it. It is CSS-only: IDs, input
bindings and engine code are unchanged. The shell is `100dvh` with safe-area
padding and no page scroll; the stage keeps a 4:3 box so the 480×240 scene crops
sky at the sides rather than the approach lane. Do not switch the stage to
`object-fit: contain` (letterbox seam) or make it fill the height with `cover`
(the visible world narrows until hazards pop in at the screen edge).

`src/service-worker.ts` builds into `sw.js` and precaches the page, stylesheet,
manifest, icons and `dist/game.js`.
Assets are cache-first, navigation is network-first with the cached page as the
fallback. Bump `CACHE` for every release that changes a cached file; without a
bump an installed client keeps the old build. Rebuild after changing the worker. `src/pwa.ts` registers only on
HTTP(S), so `file://` launches and the browser suites stay silent. Add any new
script or asset to `ASSETS`; `tests/pwa.test.ts` compares the list with the
page's script tags and the filesystem.

iOS full-screen uses `apple-mobile-web-app-capable` and a translucent status bar,
which is why the shell pads the top safe area. Those metas are generated by
`scripts/update-metadata.ts`, not hand-edited. Verify the mobile layout at
390×844 and 844×390, the setup sheet at both widths, and an offline reload after
the service worker controls the page.

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
