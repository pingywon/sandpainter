# Sandpainter

A falling-sand painting toy: a modern remake of Artsology's Sandpainting Game v2.
Four spigots pour from the top, thirty elements react (fire, water, oil, lava, ice,
plants, explosives, acid, clone blocks), and you paint into the mix with a brush.

Written from scratch in plain HTML, CSS and ES modules. No build step, no dependencies.

## Run it

Modules need to be served over http, so start any static server in this folder:

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173/. On Windows the command is `python` instead of `python3`.

## Controls

| Key | Action |
|---|---|
| Drag | Paint the selected element |
| Right-drag or Shift-drag | Erase |
| `Space` | Pause / play |
| `.` | Step one frame |
| `Ctrl+Z` | Undo the last stroke |
| `[` `]` | Brush smaller / larger |
| `-` `+` | Slower / faster |
| `1`..`9` | Quick-pick the first nine elements |
| `E` `R` | Eraser / Random |
| `G` | Flip gravity |
| `C` (twice) | Clear |

The rail on the right has speed, pause, undo, gravity, a wind slider, three local save
slots (browser storage) and a PNG snapshot.

## Layout

```
index.html            page markup
styles.css            dark atelier theme
src/main.js           bootstrap, frame loop, pointer painting, app API
src/engine/world.js   cell grid and RNG
src/engine/ids.js     element ids and flag tables
src/engine/behaviors.js  shared movement and reaction rules
src/engine/elements.js   the element registry (what each element is and does)
src/engine/simulation.js one simulation step
src/engine/spigots.js    the four pourers
src/engine/brush.js      painting
src/engine/history.js    undo stack
src/engine/storage.js    save slots, PNG snapshot
src/render/renderer.js   palette and pixel rendering, brush cursor
src/ui/*.js              tray, rail, spigot bar, shortcuts
tools/build_artifact.py  regenerates dist/sandpainter.html
dist/sandpainter.html    index.html without the document wrapper, for publishing as a claude.ai artifact
```

## Adding an element

1. Add an id in `src/engine/ids.js`.
2. Add a `def(...)` in `src/engine/elements.js` with colour, flags, density and an
   `update` function composed from the helpers in `behaviors.js`.
3. Put the id in `TRAY` (and `SPIGOT_OPTIONS` if spigots may pour it).

`window.sandpainter` exposes the app in the console: `sandpainter.tick(100)` runs
steps, `sandpainter.paint(x0, y0, x1, y1, id, size)` paints.
