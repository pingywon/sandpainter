#!/usr/bin/env python3
"""Package a release: dist/Sandpainter-v<version>.zip, ready to attach to a GitHub release.

    python3 tools/make_release.py 1.0.0

Rebuilds Sandpainter.html first, then zips it with the element guide and a
plain-text READ ME FIRST into one folder called Sandpainter.
"""
import pathlib
import sys
import zipfile

import build_standalone

README = """SANDPAINTER  v{version}
=====================

HOW TO PLAY
  Double-click "Sandpainter.html".
  It opens in your web browser. That's it: nothing to install,
  and no internet needed.

LEARN THE ELEMENTS
  Double-click "Element-Guide.html" to see what every element does
  and what happens when they meet.

THE BASICS
  Pick an element on the left, then click and drag on the black canvas.
  Right-click and drag (or hold Shift and drag) to erase.
  Space pauses.  Ctrl+Z undoes.  G flips gravity.
  Click the ? in the top-right corner for every key.

YOUR SAVES
  Save slots are kept inside the web browser you played in.
  Open the game in a different browser and your saves won't be there.

Made from https://github.com/pingywon/sandpainter
"""


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: python3 tools/make_release.py <version>   e.g. 1.0.0")
    version = sys.argv[1].lstrip("v")
    root = pathlib.Path(__file__).resolve().parent.parent
    # src/version.js is the one source of truth: it feeds the page footer, and a
    # release that disagrees with it would ship a page lying about its version.
    if f"'{version}'" not in (root / "src" / "version.js").read_text():
        raise SystemExit(f"src/version.js does not say {version} - update the one source of truth first")
    build_standalone.main()
    out = root / "dist" / f"Sandpainter-v{version}.zip"
    out.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(root / "Sandpainter.html", "Sandpainter/Sandpainter.html")
        z.write(root / "Element-Guide.html", "Sandpainter/Element-Guide.html")
        z.writestr("Sandpainter/READ ME FIRST.txt", README.format(version=version).replace("\n", "\r\n"))
    print(f"wrote {out.relative_to(root)} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
