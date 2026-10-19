#!/usr/bin/env python3
"""Current generated-character pipeline: export-web and source checks."""
import argparse
import json
from pathlib import Path

from spritekit import animations, config, hdanimations, monsters, webexport


def doctor() -> int:
    root = webexport.GENERATED
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    missing = []
    for character in manifest["classes"]:
        for gender in ("female", "male"):
            cid = f'{character["id"]}_{gender}'
            for relative in (
                f"masters/chibi/{cid}.png", f"illustrations/{cid}.png", f"chibi/{cid}.png",
                f"prompts/chibi/{cid}_pixel.txt", f"prompts/chibi/{cid}_illustration.txt",
                f"animations/sheets/{cid}.png", f"animations/prompts/{cid}.txt",
            ):
                if not (root / relative).is_file():
                    missing.append(relative)
    print("characters:", ", ".join(c["nameZh"] for c in manifest["classes"]))
    print("source:", root)
    print("pixel output: 48x48 + 96x96 chibi, up to 24 colors each; normal and chibi HD art preserved separately")
    print("animation output: 12 characters x 8 actions x 2 sizes, four frames per GIF")
    for relative in missing:
        print("missing:", relative)
    print("source files:", "complete" if not missing else "incomplete")
    return 2 if missing else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("doctor", help="check the current twelve characters and their source files")
    export = commands.add_parser("export-web", help="export normal/chibi HD art, 48px and 96px sprites, previews and web data")
    export.add_argument("--dest", type=Path, default=config.ROOT.parent, help="Next.js app root (default: repo root)")
    animation_export = commands.add_parser("export-animations", help="export 48px/96px action GIFs and frame sheets")
    animation_export.add_argument("--dest", type=Path, default=config.ROOT.parent, help="Next.js app root")
    hd_export = commands.add_parser("export-hd-animations", help="export illustrated normal/chibi 512px GIFs and full-color frames")
    hd_export.add_argument("--dest", type=Path, default=config.ROOT.parent, help="Next.js app root")
    monster_export = commands.add_parser("export-monsters", help="export all three monster styles and action animations")
    monster_export.add_argument("--dest", type=Path, default=config.ROOT.parent, help="app root")
    args = parser.parse_args()
    if args.command == "doctor":
        return doctor()
    if args.command == "export-monsters":
        return monsters.run(args.dest)
    if args.command == "export-hd-animations":
        return hdanimations.run(args.dest)
    return animations.run(args.dest) if args.command == "export-animations" else webexport.run(args.dest)


if __name__ == "__main__":
    raise SystemExit(main())
