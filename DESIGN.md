# EMBERLINE design

Designed using the user's requested Hermes `claude-design` skill, found at
`C:/Users/work/AppData/Local/hermes/skills/creative/claude-design/SKILL.md`.

Primary surface: Command / Inspect. Keyboard-driven play occupies the main
composition, with immediate score, integrity and dash feedback. A restrained
instrument bar frames the pixel scene. Start, pause and retry form one coherent
flow with a single dominant action each.

Palette: charcoal green #101514, warm parchment #ece6d6, ember #ffae62,
muted sage #a4afa4 and signal mint #b6dbc3. Sharp edges suit pixel geometry.
Impact supplies a compact arcade title; Consolas carries readable instruments.
No remote font dependency. Scenery is rendered at 480×240 with nearest-neighbor
scaling. Sprite shapes, palette, pixel composition and sounds are original.

Motion: jump dust, directional dash trails, pickup sparks, drone fragments and
damage feedback communicate actions. Reduced motion disables flashes and shake;
the particle toggle provides a separate effects preference.

Design self-audit: 0/10 generic-design tells. No tech gradient, default violet,
feature grid, accent rails, glass blur, decorative statistics, icon toppers,
centered stack, default UI typeface, or mismatched surface. The menu is deliberately
left-aligned over the actual city scene, keeping the courier visible on the right.

## Version 2

The interface keeps the same composition and adds a live pace/speed instrument.
New scenery has distinct city, industrial, forest, mountain and ruin silhouettes,
with a complete shared palette schema for smooth transitions. Enemy shapes and
motion communicate different behaviors. Procedural trails vary rewards while
maintaining clearance from the entire vertical enemy motion envelope.

Source is organized by responsibility under `src/`, with editable balance and
content catalogs. The game still loads locally without a bundler or server.

## Version 3: Configure surface

Applied Hermes's Claude Design skill to the preparation UI. The primary surface
is Configure: one animated profile preview beside tabbed choices, descriptive
radio rows, then custom ranges for difficulty. The game retains its separate
Command / Inspect surface. The preparation dialog uses the existing charcoal,
parchment and amber tokens, sharp edges, clear focus, native modal semantics,
and a persistent Ready action. Equipment choices autosave; copy explains that
difficulty changes apply on the next run.

Design diagnosis before final polish: 0/10 generic-design tells. No generic
feature grid, marketing hero in the configuration screen, icon toppers, blur,
accent rails or default violet. The preview directly supports selection and uses
the real animated sprites. Visual review prompted a larger 2× sprite preview,
higher action-score placement and tighter menu typography on narrow screens.

## Version 4: earned-coin outfitter

The Configure surface now distinguishes owned/equipped items from locked
previews. Rows display prices or ownership; one Buy & Equip action shows cost or
missing funds. The same animated preview remains available before purchase,
with an explicit Not Owned label. Wallet balance and difficulty reward rates
are visible beside the choices. The mobile dialog retains a pinned Ready action
and a scrollable catalog. No extra confirmation layer is needed for earned
in-game currency. Visual audit: the existing 0/10 generic-design diagnosis holds.

## Version 5: upgrade hierarchy redesign

Applied the Hermes Claude Design skill again after the user's usability feedback.
Primary surface: Configure. Diagnosis before repair: the first upgrade screen
read like a stat inspector (wrong-surface tell, 1/10) and buried level and price
among technical paragraphs. It also spent space on an unrelated character preview.

The revised screen gives upgrades the full width, with a visible coin balance,
level pips, one current-to-next benefit and a strong price action. Details are
opt-in; Triple Jump is clearly one-time and every cap is shown. Purchasing keeps
scroll position and focus. Owned/locked gear and price labels remain legible in
the other tabs. Re-audit: 0/10 tells. The composition now supports configuration
and purchasing directly. Desktop and mobile screenshots were inspected.

## Version 6: mobile shell and installed app

Applied the Hermes Claude Design skill to the phone layout. Primary surface stays
Command / Inspect; the mobile composition is one cabinet, not a page of stacked
panels. Diagnosis before repair: the old narrow layout stacked masthead, wrapped
readouts, a four-button grid, a bordered 4:3 screen, footer instructions, a
subfooter and a separate touch row. That read as a responsive website (2/10
tells: wrong surface, divided composition) and left the player scanning chrome
between thumb and courier.

The rebuild removes every gutter and border between regions: full-height shell,
safe-area padding, 44px masthead, one score/best/pace line, one toolbar row, an
edge-to-edge 4:3 stage, a slim particle toggle and three 64px thumb controls.
The stage is a letterboxed screen inside a continuous dark cabinet, which is the
correct trade for keeping the full 480×240 playfield and the approach lane
readable in portrait. The setup dialog becomes a full-screen sheet with a pinned
READY action. Landscape keeps the complete 2:1 playfield centred, hides the
masthead and footer, and compresses the HUD to one row.

The PWA layer is intentionally invisible: no install banner, no new chrome. The
manifest and icons already existed; `sw.js` now caches the editable source so the
installed app opens offline, and `src/pwa.js` registers it only over HTTP(S).
`file://` play is unchanged.

Re-audit: 0/10 generic-design tells. No gradients used as decoration (the shell
wash follows the scene's own light), no glass, no icon toppers, no centered
marketing stack. The only accent remains ember orange on actions and coins.
Portrait 390×844, landscape 844×390, the setup sheet and the offline reload were
inspected in Edge with no console exceptions.
