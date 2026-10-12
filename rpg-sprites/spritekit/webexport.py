"""Export the generated male/female cast. No network or generation calls."""
from __future__ import annotations

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from . import config

GENERATED = config.ROOT / "generated"
SIZE = 48
GROUND = 46
MAX_COLORS = 24


def pixelize(source: Path, size: int = SIZE) -> Image.Image:
    if size not in (48, 96):
        raise ValueError(f"Unsupported sprite size: {size}")
    ground = round(GROUND * size / SIZE)
    with Image.open(source) as image:
        master = image.convert("RGBA")
    alpha = master.getchannel("A")
    if alpha.getextrema()[0] != 0:
        raise ValueError(f"{source}: source requires a transparent background")
    bounds = alpha.point(lambda a: 255 if a >= 128 else 0).getbbox()
    if bounds is None:
        raise ValueError(f"{source}: empty image")
    cropped = master.crop(bounds)
    factor = min((size - round(4 * size / SIZE)) / cropped.width,
                 (ground - round(2 * size / SIZE)) / cropped.height)
    # The new sources are already coarse pixel artwork. Do not blend adjacent
    # color blocks or introduce smoothing colors when sampling the logical grid.
    small = cropped.resize(tuple(max(1, round(v * factor)) for v in cropped.size), Image.Resampling.NEAREST)
    alpha = small.getchannel("A").point(lambda a: 255 if a >= 128 else 0)
    visible = np.asarray(small.convert("RGB"))[np.asarray(alpha) > 0]
    strip = Image.fromarray(visible.reshape(1, -1, 3))
    # Preserve small contrasting accents (eyes, gems) instead of spending most
    # palette slots on the numerous similar hair/skin shades in generated art.
    palette = strip.quantize(colors=MAX_COLORS, method=Image.Quantize.MAXCOVERAGE, kmeans=4)
    sprite = small.convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE).convert("RGBA")
    sprite.putalpha(alpha)
    sprite = sprite.crop(sprite.getbbox())
    canvas = Image.new("RGBA", (size, size))
    canvas.paste(sprite, ((size - sprite.width) // 2, ground - sprite.height))
    pixels = np.array(canvas)
    pixels[pixels[:, :, 3] == 0] = 0
    return Image.fromarray(pixels)


def inspect_sprite(sprite: Image.Image, cid: str, size: int):
    pixels = np.asarray(sprite)
    colors = sorted({tuple(map(int, p[:3])) for p in pixels.reshape(-1, 4) if p[3]}, key=lambda c: (sum(c), c))
    bounds = sprite.getbbox()
    ground = round(GROUND * size / SIZE)
    if sprite.size != (size, size) or len(colors) > MAX_COLORS or set(np.unique(pixels[:, :, 3])) != {0, 255}:
        raise ValueError(f"{cid} {size}px: invalid dimensions/palette/alpha")
    if bounds is None or bounds[3] != ground or bounds[0] <= 0 or bounds[2] >= size:
        raise ValueError(f"{cid} {size}px: invalid placement")
    return colors, bounds


def run(dest: Path) -> int:
    manifest = json.loads((GENERATED / "manifest.json").read_text(encoding="utf-8"))
    prepared, items, checks = [], [], []
    for char in manifest["classes"]:
        for gender, label in (("male", "男"), ("female", "女")):
            cid = f'{char["id"]}_{gender}'
            source = GENERATED / "masters" / "chibi" / f"{cid}.png"
            # Dedicated low-resolution artwork can deliberately strengthen thin
            # features without replacing the shared source used by 96px sprites.
            source48 = GENERATED / "masters" / "chibi" / "48" / f"{cid}.png"
            if not source48.is_file():
                source48 = source
            original_source = GENERATED / "illustrations" / f"{cid}.png"
            chibi_source = GENERATED / "chibi" / f"{cid}.png"
            sprite = pixelize(source48)
            sprite96 = pixelize(source, 96)
            with Image.open(original_source) as original:
                original_size = list(original.size)
                original.verify()
            with Image.open(chibi_source) as chibi:
                chibi_size = list(chibi.size)
                chibi.verify()
            colors, bounds = inspect_sprite(sprite, cid, SIZE)
            colors96, bounds96 = inspect_sprite(sprite96, cid, 96)
            prepared.append((cid, sprite, sprite96))
            items.append({
                "id": cid, "classId": char["id"], "gender": gender, "genderLabel": label,
                "nameEn": char["nameEn"], "nameZh": char["nameZh"],
                "tagline": char["tagline"], "summary": char["summary"], "tags": char["tags"],
                "image": f"/characters/{cid}.png", "size": [SIZE, SIZE], "pivot": [SIZE // 2, GROUND],
                "pixel96": {
                    "image": f"/characters/96/{cid}.png", "size": [96, 96],
                    "pivot": [48, round(GROUND * 96 / SIZE)],
                    "colors": ["#%02x%02x%02x" % c for c in colors96],
                    "sourceFile": config.rel(source), "sourceSha256": config.sha256_file(source),
                },
                "chibiImage": f"/characters/chibi/{cid}.png", "chibiSize": chibi_size,
                "chibiSourceFile": config.rel(chibi_source), "chibiSha256": config.sha256_file(chibi_source),
                "originalImage": f"/characters/originals/{cid}.png", "originalSize": original_size,
                "originalSourceFile": config.rel(original_source),
                "originalSha256": config.sha256_file(original_source),
                "colors": ["#%02x%02x%02x" % c for c in colors],
                "sourceFile": config.rel(source48), "sourceSha256": config.sha256_file(source48),
                "status": "generated-chibi-pixel", "generationModel": None,
            })
            checks.append({"id": cid, "size": [SIZE, SIZE], "colors": len(colors),
                           "alpha": [0, 255], "bounds": bounds, "manualPixelCleanup": False})
            checks.append({"id": cid, "size": [96, 96], "colors": len(colors96),
                           "alpha": [0, 255], "bounds": bounds96, "manualPixelCleanup": False})
    if len(prepared) != 12 or len({cid for cid, _, _ in prepared}) != 12:
        raise ValueError("Expected six classes with two unique variants each")

    # Validate every source before touching the website export.
    pub = dest / "public" / "characters"
    pub.mkdir(parents=True, exist_ok=True)
    (pub / "originals").mkdir(exist_ok=True)
    (pub / "chibi").mkdir(exist_ok=True)
    (pub / "previews").mkdir(exist_ok=True)
    (pub / "96").mkdir(exist_ok=True)
    (pub / "previews" / "96").mkdir(exist_ok=True)
    for (cid, sprite, sprite96), item in zip(prepared, items):
        path = pub / f"{cid}.png"
        sprite.save(path)
        # README cannot rely on CSS image-rendering on GitHub. Save an exact
        # integer enlargement so the side-by-side documentation stays crisp.
        sprite.resize((SIZE * 6, SIZE * 6), Image.Resampling.NEAREST).save(pub / "previews" / f"{cid}.png")
        item["sha256"] = config.sha256_file(path)
        path96 = pub / "96" / f"{cid}.png"
        sprite96.save(path96)
        item["pixel96"]["sha256"] = config.sha256_file(path96)
        sprite96.resize((288, 288), Image.Resampling.NEAREST).save(pub / "previews" / "96" / f"{cid}.png")
        shutil.copy2(GENERATED / "illustrations" / f"{cid}.png", pub / "originals" / f"{cid}.png")
        shutil.copy2(GENERATED / "chibi" / f"{cid}.png", pub / "chibi" / f"{cid}.png")
    # Preview sheets only arrange the exported art; no additional art is drawn.
    for variant, scale, target in ((1, 5, pub / "contact-sheet.png"),
                                    (2, 3, pub / "96" / "contact-sheet.png")):
        side = (SIZE if variant == 1 else 96) * scale
        sheet = Image.new("RGB", (side * 6, (side + 24) * 2), "#e8e2d9")
        draw = ImageDraw.Draw(sheet)
        for i, (cid, sprite, sprite96) in enumerate(prepared):
            x, y = (i // 2) * side, (i % 2) * (side + 24)
            preview = (sprite if variant == 1 else sprite96).resize((side, side), Image.Resampling.NEAREST)
            sheet.paste(preview, (x, y), preview)
            draw.text((x + 4, y + side + 4), cid, fill="#292039")
        sheet.save(target)
    data_dir = dest / "src" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "characters.json").write_text(json.dumps(items, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    # Remove only the known superseded large exports, never unrelated files.
    for old_dir in (pub / "80", pub / "previews" / "80"):
        for cid, _, _ in prepared:
            (old_dir / f"{cid}.png").unlink(missing_ok=True)
        if old_dir.is_dir() and not any(old_dir.iterdir()):
            old_dir.rmdir()
    # Remove only known retired export names; never delete unrelated assets.
    for char in manifest["classes"]:
        (pub / f'{char["id"]}.png').unlink(missing_ok=True)
    for retired in manifest.get("retiredClasses", []):
        for gender in ("male", "female"):
            for asset_dir in (pub, pub / "originals", pub / "previews", pub / "96", pub / "previews" / "96"):
                (asset_dir / f"{retired}_{gender}.png").unlink(missing_ok=True)
    (pub / "generation-report.json").write_text(json.dumps({
        "generator": "Codex built-in imagegen", "model": "not exposed by tool", "variants": checks,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Exported {len(items)} generated character variants to {pub}")
    return 0
