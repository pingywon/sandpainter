# Sandpainter

A browser falling-sand toy: a modern remake of Artsology's "Sandpainting Game v2"
(https://artsology.com/sandpainting-game2.php, which runs Josh Don's GPL "Project Sand").
Our engine is written from scratch; only the mechanics are borrowed, so no GPL code is here.

The owner works on this from two machines (a Windows desktop and a headless Debian box).
Claude Code memory does not sync between them, so project context lives in this file.
Keep it current when something non-obvious is learned.

## Decisions already made

- Scope: faithful remake of the original (4 spigots, the original element set, brush
  sizes, speed) plus pause/step, undo, gravity flip, wind, local save slots, PNG snapshot,
  and new elements snow, acid, seed/stem/bloom, clone.
- Look: "dark atelier". Charcoal workspace, amber accent (`--amber #f5a524`), Fraunces
  italic for the wordmark and headings, IBM Plex Mono for UI. Particles are the hero.
  Design tokens live on `:root` in `styles.css`, with a light override.
- Stack: plain HTML, CSS and ES modules. No build step, no dependencies, no framework.
  Keep it that way unless the owner asks otherwise.

## Run

ES modules need http, not `file://`.

```bash
python3 -m http.server 5173            # Debian (use `python` on Windows)
```

On the headless box, view it from another machine with an SSH tunnel:
`ssh -L 5173:localhost:5173 <debian-host>`, then open http://localhost:5173/ locally.

## Architecture

| File | Job |
|---|---|
| `src/engine/world.js` | Grid storage only: `cells`, `shade`, `aux`, `stamp` Uint8Arrays; `set`/`move`/`swap`; xorshift RNG (`rand`, `chance(pct)`, `randInt`) |
| `src/engine/ids.js` | Element id constants, flag bits, and the `FLAGS`/`DENSITY`/`IGNITE` tables (kept here to avoid an import cycle) |
| `src/engine/behaviors.js` | Reusable rules: `fallPowder`, `flowLiquid`, `riseGas`, `explode`, `produce`, `tryIgnite`, neighbour queries |
| `src/engine/elements.js` | The registry. Every element is one `def(id, {...})` with colour, flags, density, ignite chance and an `update` function. Also `TRAY`, `SPIGOT_OPTIONS`, RANDOM pool |
| `src/engine/simulation.js` | One step: spigots emit, then every non-empty cell updates once, far side of gravity first, x sweep alternating per frame |
| `src/engine/spigots.js`, `brush.js`, `history.js`, `storage.js` | Pourers, painting, undo snapshots, save slots + PNG snapshot |
| `src/render/renderer.js` | Precomputed palette (element x 8 shades) blitted into ImageData; brush ring cursor |
| `src/ui/*.js` | Tray, controls rail, spigot bar, keyboard shortcuts. UI talks only to the `app` API in `main.js` |
| `src/main.js` | Bootstrap, pointer painting, frame loop, event bus, `app` API |

Engine conventions:

- `update(x, y, i, world, params)`; `i = y * w + x`. Behaviour helpers return `true` when
  they changed the cell so they chain with `||`.
- `stamp` parity makes each cell update at most once per step. `move`/`swap`/`produce`
  stamp the destination.
- `params`: `{ element, brush, speed, gravity (+1 down / -1 up), wind (-100..100), paused }`.
- Flags drive generic behaviour: `F_HOT` ignites and melts, `F_FUEL` keeps fire alive,
  `F_INDESTRUCTIBLE` survives acid and blasts.
- The frame loop runs on requestAnimationFrame with a 45 ms timer fallback, because some
  embedded panes never fire rAF.

## Adding an element

1. New id in `ids.js`.
2. `def(...)` in `elements.js`, composing its `update` from `behaviors.js`.
3. Add it to `TRAY` (and `SPIGOT_OPTIONS` if spigots may pour it). The renderer palette
   and tray build themselves from the registry.

## Testing

There is no test runner. Verify in a browser console against the live page:
`window.sandpainter` is the app API. `sandpainter.params.paused = true`, then
`sandpainter.paint(x0, y0, x1, y1, id, size)` and `sandpainter.tick(n)` run the engine
deterministically enough to count cells before and after. Import ids with
`await import('/src/engine/ids.js')`.

Scenarios checked so far, all passing: sand piles, water levels, oil floats, fire on oil
burns out completely (30/30 single-pixel sparks), plant burns, gunpowder and C-4 blasts,
fuse carries flame to C-4, lava + water gives rock and steam, cryo freezes water, plants
grow into water, seeds bloom on wet soil, acid eats sand but not wall, clone copies water,
gravity flip, wind drift, concrete sets, save/load round-trip, undo. About 1.4 ms per step
with ~17k grains. No horizontal scroll at 375 px wide.

## Known behaviour (not bugs)

- Fire rises. Fire painted in the air above fuel floats away without igniting it; it has
  to touch the fuel.
- Liquid sideways flow uses an in-place sweep, so a freshly poured, unsettled pool can
  shift its whole top row one cell in a single step. It makes liquids level quickly. If it
  ever looks wrong, randomise the sweep direction per row in `simulation.js`.

## Publishing

Live artifact (private to the owner): https://claude.ai/artifact/WmkzidJeNKFS4PSmmjqjkM

The artifact host wraps pages in its own html/head/body, so publish the generated
`dist/sandpainter.html` (run `python3 tools/build_artifact.py` after editing `index.html`)
with `root` set to the repo and every `styles.css` and `src/**/*.js` file listed in
`files`. It declares the `downloads` capability; the snapshot dialog saves through
`claude.use('downloads')` inside the viewer and falls back to a plain link elsewhere.
