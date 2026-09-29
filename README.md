# Sandpainter

A falling-sand painting toy. Four spigots pour from the top, and you paint into the
mix: sand, water, oil, lava, ice, plants, acid, explosives and more. 26 elements to
paint, 9 more they turn into, and they all react with each other.

A from-scratch remake of Artsology's Sandpainting Game v2.

## Play it

You don't need to install anything.

1. Open the [**Releases** page](https://github.com/pingywon/sandpainter/releases/latest)
   and download **`Sandpainter-v1.0.0.zip`** (under "Assets").
2. Unzip it.
   - **Windows:** right-click the zip, choose **Extract All**, then **Extract**.
   - **Mac:** double-click the zip.
3. Open the new **Sandpainter** folder and double-click **`Sandpainter.html`**.

It opens in your web browser (Chrome, Edge, Firefox or Safari) and works without internet.

If you already have this repository on your computer, skip the zip: double-click
`Sandpainter.html` in the top folder.

**Your saves** (the three save slots and the auto-save) are kept inside the browser you
played in. If you open the game in a different browser, they won't be there.

## Learn the elements

Double-click **`Element-Guide.html`**, which is in the same folder. It covers what every
element does, who floats on whom, how fast things burn, how big each explosion is, and
recipes to try. You can also open it from the **?** button inside the game.

## Controls

| Do this | What happens |
|---|---|
| Click and drag | Paint the element you picked on the left |
| Right-click and drag, or Shift and drag | Erase |
| `Space` | Pause / play |
| `.` | Move forward one tick |
| `Ctrl` + `Z` | Undo the last stroke |
| `[` and `]` | Smaller / bigger brush |
| `-` and `+` | Slower / faster |
| `1` to `9` | Pick one of the first nine elements |
| `E` / `R` | Eraser / Random |
| `G` | Flip gravity |
| `C` twice | Clear everything |

The panel on the right also has a wind slider, three save slots and a **Download PNG**
button for a picture of your painting.

## Changing the code

Everything above is for playing. This part is only for editing the game.

**Why there are two versions.** The source code lives in `src/` as separate JavaScript
files. Browsers refuse to load files like that from a page you double-clicked, so to run
the source version you need a tiny local web server. It doesn't do anything clever; it
only hands the files to the browser. `Sandpainter.html` is the same game with every file
merged into one, so it needs no server.

Run the source version:

```bash
python3 -m http.server 5173      # on Windows: python -m http.server 5173
```

then open http://localhost:5173/.

After changing anything in `src/`, `styles.css` or `index.html`, rebuild the one-file
version and commit it along with your change:

```bash
python3 tools/build_standalone.py
```

Check the element guide still matches the engine:

```bash
node tools/engine_checks.mjs
```

Make a release zip (it lands in `dist/`):

```bash
python3 tools/make_release.py 1.0.1
```

### What's where

```
Sandpainter.html         the one-file game (generated, do not edit by hand)
Element-Guide.html       the element guide (hand-written)
index.html               page markup for the source version
styles.css               the "dark atelier" look
src/main.js              start-up, frame loop, painting with the mouse, app API
src/engine/world.js      the grid of cells and the random number generator
src/engine/ids.js        element ids and property tables
src/engine/behaviors.js  shared rules: falling, flowing, rising, burning, exploding
src/engine/elements.js   every element: its colour, weight and what it does
src/engine/simulation.js one tick of the world
src/engine/spigots.js    the four pourers
src/engine/brush.js      painting
src/engine/history.js    undo
src/engine/storage.js    save slots and PNG pictures
src/render/renderer.js   drawing the grid to the screen
src/ui/*.js              the element tray, right-hand panel, spigot bar, keyboard keys
tools/                   build scripts, engine checks, embedded fonts
dist/sandpainter.html    the version published as a claude.ai artifact
```

### Adding an element

1. Add an id in `src/engine/ids.js`.
2. Add a `def(...)` in `src/engine/elements.js` with colour, flags, density and an
   `update` function built from the helpers in `behaviors.js`.
3. Put the id in `TRAY` (and `SPIGOT_OPTIONS` if spigots may pour it).
4. Add it to `Element-Guide.html`, then rebuild `Sandpainter.html`.

In the browser console, `window.sandpainter` is the app: `sandpainter.tick(100)` runs 100
ticks, `sandpainter.paint(x0, y0, x1, y1, id, size)` paints.

Fonts: Fraunces and IBM Plex Mono, under the SIL Open Font License 1.1 (`tools/fonts/`).
