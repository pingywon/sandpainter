#!/usr/bin/env python3
"""Build index.html from src/index.src.html.

The page version comes from VERSION and the game version from the newest tag
on main, so the footer cannot drift from either.
"""
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "tools" / "game_version.txt"


def game_version():
    try:
        tag = subprocess.run(
            ["git", "-C", str(ROOT), "describe", "--tags", "--abbrev=0", "origin/main"],
            capture_output=True, text=True, check=True).stdout.strip()
        CACHE.write_text(tag.lstrip("v") + "\n")
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    return CACHE.read_text().strip()


page = (ROOT / "src" / "index.src.html").read_text(encoding="utf-8")
page = page.replace("{{VERSION}}", (ROOT / "VERSION").read_text().strip())
page = page.replace("{{GAME_VERSION}}", game_version())
assert "{{" not in page, "unfilled token left in the page"
(ROOT / "index.html").write_text(page, encoding="utf-8")
print("built index.html")
