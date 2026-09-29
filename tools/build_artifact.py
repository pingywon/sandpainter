#!/usr/bin/env python3
"""Build dist/sandpainter.html for publishing as a claude.ai artifact.

The artifact host wraps the page in its own <!doctype>/<html>/<head>/<body>
skeleton, so this strips those from index.html and drops the charset and
viewport metas the skeleton already supplies. Run it after editing index.html.
"""
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
src = (root / "index.html").read_text(encoding="utf-8")
head = re.search(r"<head>(.*?)</head>", src, re.S).group(1)
body = re.search(r"<body>(.*?)</body>", src, re.S).group(1)
keep = [
    line for line in head.splitlines()
    if line.strip() and "charset" not in line and 'name="viewport"' not in line
]
out = root / "dist" / "sandpainter.html"
out.parent.mkdir(exist_ok=True)
out.write_text("\n".join(keep) + "\n" + body, encoding="utf-8", newline="\n")
print(f"wrote {out.relative_to(root)}")
