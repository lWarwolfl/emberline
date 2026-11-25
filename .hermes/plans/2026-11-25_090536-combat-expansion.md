# Combat expansion implementation plan

> For Hermes: Use subagent-driven-development to implement this plan task by task, with independent review before commits.

Goal: implement all requested gameplay, visual and progression changes, then verify, commit separately and push.
Architecture: deterministic TypeScript simulation shared between solo and co-op, Canvas pixel rendering, existing native dialogs and BigInt economy. Preserve prior donation functionality and cloud saves.

## Complete scope and acceptance checklist

1. Heart: retain red heart silhouette and rarity identity, remove rectangular background/frame, matching the icon-only powerups. Reduced motion retains the full cue.
2. Ships: reduce seeded offer probability from 75% to approximately 20% per eligible sector. Keep glowing, missable boarding pickups and deterministic placement. Check statistical frequency across seeds and no automatic boarding.
3. D movement: measure equal-duration A/D displacement, lower the common keyed strafe rate to 95 px/s, preserve equal left/right speed, A release position and D return behavior. Apply in solo, party formation and guest prediction; dash retains its separate speed.
4. Death donation CTA: Claude Design Command/Inspect results surface; run-again stays primary. Add an ember-colored secondary donation invitation on every final death/party wipe, opening existing donation dialog. Hide during play, pause and countdown. Supporters get collection/equip wording. No forced popup or change to verified donation rules.
5. Bosses: seeded randomized selection without consecutive repeats; at least four distinct boss identities, sprites and attack patterns (aimed burst, fan with safe gap, ground wave, alternating lanes). Each boss gets its OWN visually distinct health bar, name and accurate current/max HP. Preserve common boss lifecycle detection, score, biome progression, party scaling and snapshot state. Telegraph attacks, freeze aim before firing, maintain reachable gaps and recovery windows. Bound projectile counts and avoid unavoidable overlapping patterns.
6. Rechargeable shield: hold K (plus touch hold) raises a rechargeable shield; release lowers it. Distinct from the temporary Prism Shield pickup. Limited capacity drains while held and on blocked damage; recharge only while lowered after a delay. Empty shield requires some recovery before reuse. No permanent invulnerability and no reward for blocking. Add three cosmetic styles and a shield upgrade track to the shop; preserve old saves with level zero defaults. Show charge meter and active/broken cues. Clear held input on blur/dialog/death and support co-op action allowlists, serialization, prediction and personal charge.
7. Enemies: at least three new types including a suicide bomber; distinct telegraphed attacks and movement. Bomber arms visibly, locks its approach, explodes once with a dodgeable radius; killing it during warning cancels the attack. No accidental offscreen explosions, duplicate damage or unlimited chain reactions. Unlock gradually; preserve coin clearance, seeded generation and early-run fairness.

## Execution sequence and likely paths

A. Small presentation/balance changes and death CTA: src/sprites.ts, ships.ts, config.ts, ui.ts, app.ts, index.html, style.css; existing input/party/ship tests and new source/DOM checks.
B. Shield primitives and progression: new src/shield.ts; types.ts, engine.ts, party.ts, party-sync.ts, party-session.ts, input.ts, app.ts, renderer.ts, economy.ts, loadout.ts, upgrades.ts, upgrade-panel.ts, wardrobe.ts, storage.ts as needed. Keep shared damage interception in one helper. Add focused solo/co-op/recharge/shop/save tests.
C. Boss/enemy simulation: new src/bosses.ts and enemy-behaviors.ts; content.ts, difficulty.ts, generator.ts, enemy-fire.ts, combat.ts, types.ts, engine.ts, party.ts. Use explicit boss identity/maxHP metadata while retaining variant boss for existing lifecycle checks. Add seeded identity, telegraph, damage-once, projectile-limit, kill-cancellation and safe-route checks.
D. Boss/enemy/shield visuals and HUD: sprites.ts, renderer.ts, ui.ts, index.html, style.css; inspect existing tokens. Boss-specific health bar silhouettes/palette are required, not just a shared recolor. Motion-off retains danger shapes and health/charge cues.
E. Integration: preserve JSON snapshots and guest interpolation, account/cloud saves, offline play, donation entitlements, old loadouts, platform traps and shields during ships. Document controls/balance in README.md and DESIGN.md.

## Verification and delivery

Run closest Node suites after each implementation unit, then npm run check and npm run build:site. Check formatting and git diff --check. Update worker cache once and rebuild dist/game.js/sw.js. Independently review all source changes, fix blockers and re-review. Browser/GUI checks remain unrun under the standing restriction; report this honestly. Preserve unrelated work, stage explicit paths, split coherent commits, compare generated outputs and verify origin/main equals local HEAD after pushing. No deployment claim without verification.

## Working assumptions and balance risks

K is unassigned and will be the hold-shield key. Any new style is cosmetic; upgrades use earned coins, never donation power. Starting shield works without a purchase; upgrades improve capacity/recharge within caps. Numbers are initial tuning targets and must pass dodgeability/old-save tests. Final death means whole-party wipe, not a single downed courier while teammates continue. Boss health bars differ by visible silhouette/segments as well as color, with numeric accessibility text. Changes to damage resolution must not double-hit or bypass existing temporary shield and invincibility semantics.

## Added requirements before delivery

8. Prevent accidental replay from Space, including native Space activation of a
   focused retry/start button after death. Preserve Space as jump during play,
   Enter as explicit replay, intentional click/touch replay and other accessible
   button keyboard controls. Verify the native default action is prevented on
   the retry button rather than relying on a simulation-only guard.
9. Make round results prominent on the death screen: separate bold POINTS and
   COINS EARNED values for the completed round. Use state.score and round coin
   earnings, not wallet balance or lifetime best; preserve exact BigInt score
   formatting. Give both totals stronger hierarchy than descriptive copy while
   retaining replay primary and donation secondary. Check solo and final party
   wipe, portrait/landscape fit, and labels/accessibility.
