# EMBERLINE design

## One room link

Primary surface: Configure. The party dialog's job is to get a name and one
shared link, not to teach a handshake. Host a room is the single setup action.
The link and its code appear only after that action, as the result. Join is one
field that accepts the link or the room code. The lobby stays a secondary
inspect column. Charcoal, parchment, ember, square controls and the existing
type stay. No second path, no step list, no feature tiles.

Slop diagnostic: 0/10. The composition is a form, not a hero.

## Acquisition, personal records and compact controls

The game remains a Command / Inspect surface. The header now groups the single
Emberline mark and earned coins; the inventory uses fixed 40px slots. A labeled
CONTROLS button opens a Configure-style field guide with keyboard actions and the
particle setting, replacing the small disclosure. Ground pull has its own touch
target and small downward pixel chevrons that remain visible with particles off.

Equipment purchases reveal an ACQUIRED stamp over the pinned preview, a single
mint sweep and radial pixel sparks. The celebration consumes no layout space and
never captures input. Upgrades retain their level feedback and use only a brief
metallic clank. A personal-record banner sits above the approach lane, pairs the
real score with a separate fanfare, and triggers once per round after beating an
existing record. Timers advance independently of paused gameplay so shop effects
always finish. Reduced motion removes the sweep, scale and sparks while retaining
the result; particle preferences independently control sparks.

All three sounds are original deterministic synthesis: 2.00s purchase jingle,
0.28s upgrade impact, 1.60s record fanfare. Cached Web Audio buffers share the mute
gain with other game sounds. Exported WAVs match the samples used in-game.

Source design audit: 0/10 generic-design tells; effects support real achievements
within the existing square pixel vocabulary. Live browser visual QA remains
unrun under the loaded Emberline skill's standing restriction.

## Playfield-first cabinet and pinned outfitter

Primary surface: Command / Inspect. The previous expansion stacked a masthead,
statistics, account notice, inventory, keyboard legend and settings around the
canvas. Diagnosis: 1/10 generic-design tells, wrong surface hierarchy: supporting
controls competed with the game for height. The revision combines statistics,
coins and account access into one header and menus/powers into one bottom dock.
Keyboard help and particle preferences use a disclosure above the dock. The shell
uses the viewport width with small gutters and the existing height-aware stage.

The account button permanently reads “Save across devices” with login/create
account help; transient connection status no longer replaces that explanation.
Signed-in users see account/cloud-save help instead. The dialog also explains
continuing on another device and the 30-second sync interval.

The outfitter is a Configure surface with a fixed preview region, independently
scrolling choices, and a persistent purchase/coin/Ready footer. On phones the
preview becomes a compact pinned row above the category tabs. The buy button lives
outside the replaceable tab panel, retaining its purchase validation and focus.

Post-change source audit: 0/10 tells. Existing charcoal/parchment/mint typography,
pixel art and square controls remain. Browser fixtures now assert canvas size and
preview/purchase visibility across scrolling. Those rendered checks are unrun:
the Emberline skill prohibits live browser verification in this session.

## Account and route expansion

The account dialog uses a Configure surface: labeled username/password fields,
clear registration and recovery modes, download action for the backup code, and
explicit cloud/device choices on a conflict. Account access in the compact header
explains cross-device saving and reports signed-in sync state. Charcoal,
parchment, amber, mint, Impact and Consolas retain the existing visual vocabulary.

The Command / Inspect game surface gains a compact three-slot FIFO inventory,
an activation button and an active-effect timer. Rarity is written in pickup labels
and represented in pixel borders; healing hearts use distinct one/two-pip art.
Platforms render behind couriers, evolution marks above enemies, and Titan/flight
effects remain visible with particles disabled and reduced motion enabled.

Design diagnostic before final review: 0/10 generic-design tells. The account form
and ordered inventory prioritize their actions without feature tiles, accent rails,
blur, gradient surfaces or a new type system. Static layout contracts and renderer
tests verify structure; live browser visual QA remains unrun under the Emberline
skill's standing no-browser restriction.

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
installed app opens offline, and `src/pwa.ts` registers it only over HTTP(S).
`file://` play is unchanged.

Re-audit: 0/10 generic-design tells. No gradients used as decoration (the shell
wash follows the scene's own light), no glass, no icon toppers, no centered
marketing stack. The only accent remains ember orange on actions and coins.
Portrait 390×844, landscape 844×390, the setup sheet and the offline reload were
inspected in Edge with no console exceptions.

## Monitor-fit play cabinet

Primary surface: Command / Inspect. The shell uses the full available dynamic
viewport height in both windowed and fullscreen modes. Header, readouts, party
health, beacon trail and controls keep their own space; a size-contained flex
region gives the remaining height to the playfield. Container units preserve
the 2:1 desktop scene without pushing controls below the monitor. Portrait
keeps the existing approach-lane crop; short landscape hides secondary copy.
Buttons retain 44px targets and the existing square charcoal/ember styling.
A mint native progress trail shows distance to the next 5000m revive beacon.

Design audit: 0/10 generic-design tells; no new cards, decorative gradients,
fonts, icons or dependencies. Verified with static markup checks and builds;
rendered layout was not inspected under the no-live-browser constraint.

## Hosting modal: shared Configure surface

The party dialog reuses the outfitter's charcoal/parchment/ember tokens, Impact
heading, Consolas body, square controls and native dialog semantics. Connection
setup occupies the main column; a separate crew inspector shows connection status,
roster and host responsibilities. The body scrolls while header and actions remain
available. Phones use the same full-height sheet and safe-area footer as setup.

LAN is expanded first. Direct invites are the second disclosure and a Configure
procedure: one side is selected, then only that side's numbered steps and actions
are shown. The current step is ink; the others stay quiet. Host and join never
share one mixed control row. A page that is not the LAN relay does not open a
dead socket; it opens these host or join steps instead. Network limits stay beside
the method. Team-play instructions are optional. All existing party IDs, transport
behavior and host/guest permissions remain.

Source-based design audit: 0/10 generic-design tells. No feature grid, accent rail,
icon toppers, blur, or centered marketing stack. The role choice is two actions,
and the procedure is a single column. Static markup checks cover the structure.

## Compact co-op instruments

Claude Design surface: Command / Inspect. Keep the gameplay canvas dominant.
The in-game party strip uses one line per courier: HP or DOWN, then name and
order. Upgrade details remain in the Party menu and the full status is
available on hover. Existing parchment/mint/down-state colors and Consolas stay
unchanged; no new controls or decorative panels. Names truncate rather than wrap.
Four columns on desktop and two on narrow screens bound the HUD height.

Source-based slop audit: 0/10; no listed tells introduced. CSS regression checks
verify density rules, not rendered fit. Live GUI verification remains unrun.
Beacons are 5000 world-distance units apart and do not clear the current route.
