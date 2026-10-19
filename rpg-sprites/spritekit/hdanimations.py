"""Export native illustrated poses as 512px full-color PNG frames and GIFs."""
from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

from . import animations, config

ROOT = config.ROOT / "generated/hd-animations"
STYLES = ("chibi", "original")
SIZE = 512


def registration_offset(reference: Image.Image, frame: Image.Image, horizontal_only: bool = False) -> tuple[int, int]:
    """Match head/upper torso, rather than the weapon/cape or sheet cell center.

    Translation only: retain the generated pose, scale and running bounce.
    """
    def search(scale, offsets):
        size = reference.width // scale
        ref = np.asarray(reference.resize((size, size), Image.Resampling.BOX)).astype(np.float32) / 255
        current = np.asarray(frame.resize((size, size), Image.Resampling.BOX)).astype(np.float32) / 255
        left, top, right, bottom = reference.getbbox()
        inset = (right - left) * .18
        x0, x1 = int((left + inset) / scale), int((right - inset) / scale)
        y0, y1 = int(top / scale), int((top + (bottom - top) * .42) / scale)
        target = ref[y0:y1, x0:x1]
        weight = target[:, :, 3]
        best, chosen = float("inf"), (0, 0)
        for dx, dy in offsets:
            sx, sy = x0 - dx // scale, y0 - dy // scale
            if sx < 0 or sy < 0 or sx + target.shape[1] > size or sy + target.shape[0] > size:
                continue
            patch = current[sy:sy + target.shape[0], sx:sx + target.shape[1]]
            difference = ((target[:, :, :3] - patch[:, :, :3]) ** 2).mean(axis=2)
            difference += (target[:, :, 3] - patch[:, :, 3]) ** 2 * 2
            score = float((difference * weight).sum() / weight.sum())
            if score < best:
                best, chosen = score, (dx, dy)
        return chosen

    ys = [0] if horizontal_only else range(-12, 13, 4)
    dx, dy = search(4, ((x, y) for x in range(-128, 129, 4) for y in ys))
    return search(1, ((x, y) for x in range(dx - 3, dx + 4)
                      for y in ([0] if horizontal_only else range(dy - 3, dy + 4))))


def register_action(frames: list[Image.Image], horizontal_only: bool = False) -> tuple[list[Image.Image], list[list[int]]]:
    shifts = [(0, 0)] + [registration_offset(frames[0], frame, horizontal_only) for frame in frames[1:]]
    boxes = [tuple(v + shift[i % 2] for i, v in enumerate(frame.getbbox()))
             for frame, shift in zip(frames, shifts)]
    left, top = min(b[0] for b in boxes), min(b[1] for b in boxes)
    right, bottom = max(b[2] for b in boxes), max(b[3] for b in boxes)
    if right - left > SIZE - 2 or bottom - top > SIZE - 2:
        raise ValueError("Registered animation does not fit the canvas")
    common_x = max(1 - left, min(0, SIZE - 1 - right))
    common_y = max(1 - top, min(0, SIZE - 1 - bottom))
    result, offsets = [], []
    for frame, (dx, dy) in zip(frames, shifts):
        dx, dy = dx + common_x, dy + common_y
        aligned = Image.new("RGBA", frame.size)
        aligned.paste(frame, (dx, dy))
        result.append(aligned)
        offsets.append([dx, dy])
    return result, offsets


def illustrated_frames(cid: str, style: str, source_root: Path = ROOT) -> tuple[list[list[Image.Image]], dict]:
    pairs = []
    for pair in range(4):
        source = source_root / "sheets" / style / f"{cid}-{pair}.png"
        rows, report = animations.split_sheet(source, row_count=2, preserve_alpha=True)
        if report["sourceSize"][0] < 1536 or report["sourceSize"][1] < 768:
            raise ValueError(f"{source}: HD poses require at least 384 native pixels per cell")
        pairs.append((rows, report, source))
    # Normalize to the smallest native cell, then only downscale to fit 512px.
    # The larger output canvas never magnifies low-resolution source pixels.
    cell = min(report["sourceSize"][0] / 4 for _, report, _ in pairs)
    prepared, reports = [], []
    for rows, report, source in pairs:
        ratio = min(1., cell / (report["sourceSize"][0] / 4))
        left, top, _, _ = report["sharedBounds"]
        origin = (round(left * ratio), round(top * ratio))
        for row in rows:
            frames = []
            for frame in row:
                target = (max(1, round(frame.width * ratio)), max(1, round(frame.height * ratio)))
                frames.append((frame.resize(target, Image.Resampling.LANCZOS) if target != frame.size else frame, origin))
            prepared.append(frames)
        reports.append({"sourceFile": config.rel(source), "sourceSha256": config.sha256_file(source),
                        "nativeScale": ratio, **report})
    left = min(origin[0] for row in prepared for _, origin in row)
    top = min(origin[1] for row in prepared for _, origin in row)
    right = max(origin[0] + frame.width for row in prepared for frame, origin in row)
    bottom = max(origin[1] + frame.height for row in prepared for frame, origin in row)
    width, height = right - left, bottom - top
    factor = min(1., (SIZE - 16) / width, (SIZE - 16) / height)
    target = (max(1, round(width * factor)), max(1, round(height * factor)))
    result = []
    for row in prepared:
        frames = []
        for image, origin in row:
            shared = Image.new("RGBA", (width, height))
            shared.paste(image, (origin[0] - left, origin[1] - top))
            if shared.size != target:
                shared = shared.resize(target, Image.Resampling.LANCZOS)
            frame = Image.new("RGBA", (SIZE, SIZE))
            frame.paste(shared, ((SIZE - target[0]) // 2, SIZE - 8 - target[1]))
            # Canonical clear pixels improve compression and decoder comparison.
            pixels = np.array(frame)
            pixels[pixels[:, :, 3] == 0] = 0
            frames.append(Image.fromarray(pixels))
        result.append(frames)
    registration = {}
    # split_sheet already shares one floor baseline. Keep its vertical pose
    # motion; matching different facial expressions must not lift the feet.
    result[0], registration["idle"] = register_action(result[0], horizontal_only=True)
    if style == "chibi":
        result[2], registration["run"] = register_action(result[2], horizontal_only=True)
    return result, {"sources": reports, "sharedBounds": [left, top, right, bottom], "outputScale": factor,
                    "registrationOffsets": registration}


def gif_palette(frames: list[Image.Image]) -> list[Image.Image]:
    visible = np.concatenate([np.asarray(frame)[np.asarray(frame)[:, :, 3] >= 128, :3] for frame in frames])
    quantized = Image.fromarray(visible.reshape(1, -1, 3)).quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    colors = np.array(quantized.getpalette()[:255 * 3], dtype=np.int32).reshape(-1, 3)
    palette = Image.new("P", (1, 1))
    palette.putpalette([0, 0, 0] + colors.flatten().tolist())
    result = []
    for frame in frames:
        rgba = np.asarray(frame)
        indexed = frame.convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE)
        indices = np.array(indexed)
        # Index zero is reserved for transparency, including genuinely black art.
        black = (indices == 0) & (rgba[:, :, 3] >= 128)
        locations = np.argwhere(black)
        for start in range(0, len(locations), 1024):
            positions = locations[start:start + 1024]
            rgb = rgba[positions[:, 0], positions[:, 1], :3].astype(np.int32)
            choices = ((rgb[:, None, :] - colors[None, :, :]) ** 2).sum(axis=2).argmin(axis=1) + 1
            indices[positions[:, 0], positions[:, 1]] = choices.astype(np.uint8)
        indices[rgba[:, :, 3] < 128] = 0
        image = Image.fromarray(indices).convert("P")
        image.putpalette(palette.getpalette())
        image.info["transparency"] = 0
        result.append(image)
    return result


def prepare_character(cid: str, style: str) -> tuple[dict, dict[str, bytes], dict]:
    rows, report = illustrated_frames(cid, style)
    item = {"size": [SIZE, SIZE], "style": style, "actions": []}
    files = {}
    strip = Image.new("RGBA", (SIZE * 4, SIZE * 8))
    cls = cid.rsplit("_", 1)[0]
    for row, action in enumerate(animations.ACTION_IDS):
        prefix = f"characters/animations/hd/{style}/{cid}/{action}"
        frames = rows[row]
        content = animations.gif_bytes(gif_palette(frames), animations.DURATIONS[row])
        files[prefix + ".gif"] = content
        paths = []
        frame_hashes = []
        for i, frame in enumerate(frames):
            path = prefix + f"-{i}.png"
            output = io.BytesIO()
            frame.save(output, format="PNG")
            files[path] = output.getvalue()
            frame_hashes.append(hashlib.sha256(files[path]).hexdigest())
            paths.append("/" + path)
            strip.paste(frame, (i * SIZE, row * SIZE))
        label = animations.ATTACK_LABELS[cls][row - 3] if row in (3, 4) else animations.LABELS[row]
        item["actions"].append({"id": action, "label": label, "gif": "/" + prefix + ".gif", "poster": paths[0],
                                "frames": paths, "frameCount": 4, "durations": list(animations.DURATIONS[row]),
                                "frameSha256": frame_hashes,
                                "sha256": hashlib.sha256(content).hexdigest()})
    output = io.BytesIO()
    strip.save(output, format="PNG")
    sheet_path = f"characters/animations/hd/{style}/{cid}/sheet.png"
    files[sheet_path] = output.getvalue()
    item["sheet"] = "/" + sheet_path
    return item, files, report


def run(dest: Path) -> int:
    cast = json.loads((config.ROOT / "generated/manifest.json").read_text())["classes"]
    items, files, reports = [], {}, []
    # Validate all generated boards before writing any public HD export.
    for char in cast:
        for gender in ("male", "female"):
            cid = f'{char["id"]}_{gender}'
            variants = {}
            for style in STYLES:
                variant, prepared, report = prepare_character(cid, style)
                variants[style] = variant
                files.update(prepared)
                reports.append({"id": cid, "style": style, **report})
            items.append({"id": cid, "variants": variants})
            print(f"Prepared HD animations: {cid}", flush=True)
    for relative, content in files.items():
        path = dest / "public" / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    data = dest / "src/data/hd-animations.json"
    data.parent.mkdir(parents=True, exist_ok=True)
    data.write_text(json.dumps({"generator": "Codex built-in imagegen", "model": None, "characters": items},
                               indent=2, ensure_ascii=False) + "\n")
    report_path = dest / "public/characters/animations/hd/generation-report.json"
    report_path.write_text(json.dumps({"characters": reports, "gifs": 192, "frameSize": [SIZE, SIZE],
                                       "framesPerAction": 4, "pngColors": "full RGBA", "gifColors": 255,
                                       "sourceUpscaling": False, "disposal": 2, "loop": 0}, indent=2) + "\n")
    print(f"Exported 192 HD GIFs to {dest / 'public/characters/animations/hd'}")
    return 0
