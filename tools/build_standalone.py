#!/usr/bin/env python3
"""Build Sandpainter.html: the whole app in one file you can double-click.

Browsers refuse to load ES modules from a file:// page, which is the only
reason the source version needs `python -m http.server`. This merges every
module under src/ into one classic script (each module becomes a function,
each import becomes a lookup), inlines styles.css, and embeds the fonts from
tools/fonts so the file also works offline. Run it after editing src/,
styles.css or index.html.
"""
import base64
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
SRC = root / "src"
FONTS = root / "tools" / "fonts"

IMPORT_NAMED = re.compile(r"import\s*\{([^}]*)\}\s*from\s*'([^']+)';")
IMPORT_NS = re.compile(r"import\s+\*\s+as\s+(\w+)\s+from\s*'([^']+)';")
EXPORT_DECL = re.compile(r"^export\s+((?:async\s+)?function\*?|class|const)\s+(\w+)", re.M)
EXPORT_LIST = re.compile(r"^export\s*\{([^}]*)\};?[ \t]*$", re.M)

# family, style, weight, file
FONT_FACES = [
    ("Fraunces", "normal", "300 700", "Fraunces.woff2"),
    ("Fraunces", "italic", "300 700", "Fraunces-Italic.woff2"),
    ("IBM Plex Mono", "normal", "400", "IBMPlexMono-Regular.woff2"),
    ("IBM Plex Mono", "italic", "400", "IBMPlexMono-Italic.woff2"),
    ("IBM Plex Mono", "normal", "500", "IBMPlexMono-Medium.woff2"),
    ("IBM Plex Mono", "normal", "600", "IBMPlexMono-SemiBold.woff2"),
]


def bundle(entry):
    order, done, visiting = [], {}, set()

    def load(path):
        key = path.relative_to(SRC).as_posix()
        if key in done:
            return key
        if key in visiting:
            raise SystemExit(f"import cycle through {key}")
        visiting.add(key)
        text = path.read_text(encoding="utf-8")

        def dep(spec):
            return load((path.parent / spec).resolve())

        def named(m):
            k = dep(m.group(2))
            names = [n.strip() for n in m.group(1).split(",") if n.strip()]
            binds = ", ".join(n.replace(" as ", ": ") for n in names)
            return f"const {{ {binds} }} = __mods[{k!r}];"

        text = IMPORT_NAMED.sub(named, text)
        text = IMPORT_NS.sub(lambda m: f"const {m.group(1)} = __mods[{dep(m.group(2))!r}];", text)
        exports = [m.group(2) for m in EXPORT_DECL.finditer(text)]
        text = EXPORT_DECL.sub(lambda m: f"{m.group(1)} {m.group(2)}", text)
        for m in EXPORT_LIST.finditer(text):
            exports += [n.strip() for n in m.group(1).split(",") if n.strip()]
        text = EXPORT_LIST.sub("", text)
        left = re.search(r"^\s*(import|export)\b.*", text, re.M)
        if left:
            raise SystemExit(f"{key}: unhandled module syntax: {left.group(0).strip()}")

        visiting.discard(key)
        done[key] = True
        order.append(
            f"/* ---- {key} ---- */\n__mods[{key!r}] = (() => {{\n{text.rstrip()}\n"
            f"return {{ {', '.join(exports)} }};\n}})();\n"
        )
        return key

    load(SRC / entry)
    js = "'use strict';\nconst __mods = {};\n" + "\n".join(order)
    if "</script" in js.lower():
        raise SystemExit("bundle contains </script, which would end the inline script early")
    return js


def font_css():
    rules = []
    for family, style, weight, name in FONT_FACES:
        data = base64.b64encode((FONTS / name).read_bytes()).decode("ascii")
        rules.append(
            f"@font-face{{font-family:'{family}';font-style:{style};font-weight:{weight};"
            f"font-display:swap;src:url(data:font/woff2;base64,{data}) format('woff2');}}"
        )
    return "\n".join(rules)


def main():
    html = (root / "index.html").read_text(encoding="utf-8")
    css = (root / "styles.css").read_text(encoding="utf-8")
    js = bundle("main.js")

    html = re.sub(r"[ \t]*<link[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n", "", html)
    html = re.sub(r'[ \t]*<script id="file-warning">.*?</script>\n', "", html, flags=re.S)
    style = f"<style>\n{font_css()}\n{css}</style>"
    html = html.replace('<link rel="stylesheet" href="styles.css" />', style)
    html = html.replace('<script type="module" src="src/main.js"></script>', f"<script>\n{js}</script>")
    for leftover in ("styles.css", "src/main.js", "fonts.googleapis", 'id="file-warning"'):
        if leftover in html:
            raise SystemExit(f"index.html changed shape: {leftover!r} was not replaced")

    notice = (
        "<!--\n  Sandpainter, the one-file version. Double-click to play; no server needed.\n"
        "  Built by tools/build_standalone.py from https://github.com/pingywon/sandpainter\n"
        "  Fonts: Fraunces and IBM Plex Mono, SIL Open Font License 1.1 (see tools/fonts/).\n-->\n"
    )
    html = html.replace("<!doctype html>\n", "<!doctype html>\n" + notice, 1)
    out = root / "Sandpainter.html"
    out.write_text(html, encoding="utf-8", newline="\n")
    print(f"wrote {out.relative_to(root)} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
