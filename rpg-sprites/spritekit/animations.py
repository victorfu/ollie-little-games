"""Split built-in imagegen action sheets and encode transparent pixel GIFs.

No poses are drawn or synthesized here. All 32 poses come from the saved sheet.
"""
from __future__ import annotations

import io
import json
import hashlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

from . import config

ROOT = config.ROOT / "generated" / "animations"
ACTION_IDS = ("idle", "walk", "run", "slash", "thrust", "block", "hurt", "fall")
LABELS = ("待機", "走路", "跑步", "揮擊", "突刺", "防禦", "受傷", "倒地")
DURATIONS = ((260, 200, 260, 200), (140,) * 4, (90,) * 4,
             (180, 100, 100, 240), (180, 140, 100, 240),
             (180, 140, 160, 240), (180, 120, 160, 240), (180, 160, 160, 900))
ATTACK_LABELS = {
    "ember_knight": ("揮劍", "突刺"), "martial_artist": ("勾拳", "直拳"),
    "moon_witch": ("月光揮擊", "月光彈"), "forest_ranger": ("射箭", "蓄力射擊"),
    "sun_cleric": ("日光揮擊", "日光彈"), "shadow_rogue": ("雙刃斬", "匕首突刺"),
}


def components(mask: np.ndarray) -> list[dict]:
    """8-connected alpha components using horizontal runs (no extra dependency)."""
    parents, runs, previous = [], [], []

    def root(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    for y, line in enumerate(mask):
        edges = np.flatnonzero(np.diff(np.pad(line.astype(np.int8), (1, 1))))
        current = []
        for left, right in zip(edges[::2], edges[1::2]):
            i = len(parents)
            parents.append(i)
            runs.append((y, int(left), int(right)))
            for pl, pr, pi in previous:
                if pl <= right and pr >= left:
                    parents[root(pi)] = root(i)
            current.append((int(left), int(right), i))
        previous = current
    groups = {}
    for i, (y, left, right) in enumerate(runs):
        group = groups.setdefault(root(i), {"area": 0, "box": [mask.shape[1], mask.shape[0], 0, 0], "runs": []})
        group["area"] += right - left
        box = group["box"]
        box[0], box[1] = min(box[0], left), min(box[1], y)
        box[2], box[3] = max(box[2], right), max(box[3], y + 1)
        group["runs"].append((y, left, right))
    return list(groups.values())


def box_distance(a: list[int], b: list[int]) -> int:
    dx = max(0, a[0] - b[2], b[0] - a[2])
    dy = max(0, a[1] - b[3], b[1] - a[3])
    return dx * dx + dy * dy


def component_edges(component: dict) -> np.ndarray:
    left, top, right, bottom = component["box"]
    mask = np.zeros((bottom - top, right - left), dtype=bool)
    for y, x1, x2 in component["runs"]:
        mask[y - top, x1 - left:x2 - left] = True
    interior = np.zeros_like(mask)
    interior[1:-1, 1:-1] = (mask[1:-1, 1:-1] & mask[:-2, 1:-1] & mask[2:, 1:-1]
                            & mask[1:-1, :-2] & mask[1:-1, 2:])
    ys, xs = np.where(mask & ~interior)
    return np.column_stack((xs + left, ys + top)).astype(np.int32)


def closest_body(component: dict, bodies: list[dict], edges: list[np.ndarray]) -> int:
    # Bounding boxes alone can assign a spell fragment to a neighboring pose.
    # Compare actual silhouette edges; boxes are only a lower bound for pruning.
    rough = [box_distance(component["box"], body["box"]) for body in bodies]
    points = component_edges(component)
    best, owner = float("inf"), 0
    for i in sorted(range(len(bodies)), key=lambda i: rough[i]):
        if rough[i] > best:
            break
        for start in range(0, len(points), 32):
            distance = int(((points[start:start + 32, None, :] - edges[i][None, :, :]) ** 2).sum(axis=2).min())
            if distance < best:
                best, owner = distance, i
    return owner


def split_sheet(source: Path, row_count: int = 8, preserve_alpha: bool = False,
                column_count: int = 4) -> tuple[list[list[Image.Image]], dict]:
    with Image.open(source) as image:
        sheet = image.convert("RGBA")
    pixels = np.asarray(sheet)
    mask = pixels[:, :, 3] >= 128
    if not np.any(pixels[:, :, 3] == 0) or not mask.any():
        raise ValueError(f"{source}: requires visible art on a transparent background")
    if abs(sheet.height / sheet.width - row_count / column_count) > .05:
        raise ValueError(f"{source}: expected a {column_count}-column / {row_count}-row sheet")
    # Long blades and spell effects may extend past an ideal cell boundary.
    # Connected-alpha regions preserve the complete generated pose, whereas
    # blindly cutting a uniform grid would truncate equipment or mix neighbors.
    groups = [c for c in components(mask) if c["area"] >= 8]
    bodies = sorted(groups, key=lambda c: c["area"], reverse=True)[:column_count * row_count]
    by_row = [[] for _ in range(row_count)]
    for body in bodies:
        center_y = (body["box"][1] + body["box"][3]) / 2
        row = max(0, min(row_count - 1, round(center_y / (sheet.height / row_count) - .5)))
        by_row[row].append(body)
    if any(len(row) != column_count for row in by_row):
        raise ValueError(f"{source}: expected {column_count} separate character bodies in each of {row_count} rows")
    bodies = [body for row in by_row for body in sorted(row, key=lambda c: c["box"][0])]
    assigned = [[body] for body in bodies]
    edges = [component_edges(body) for body in bodies]
    for c in groups:
        if any(c is body for body in bodies):
            continue
        assigned[closest_body(c, bodies, edges)].append(c)
    poses, checks = [], []
    for row in range(row_count):
        main = bodies[row * column_count:row * column_count + column_count]
        baseline = max(c["box"][3] for c in main)
        row_poses = []
        for col in range(column_count):
            pieces = assigned[row * column_count + col]
            center = (main[col]["box"][0] + main[col]["box"][2]) / 2
            if abs(center - (col + .5) * sheet.width / column_count) > sheet.width / column_count * .48:
                raise ValueError(f"{source}: action {row} has overlapping or misplaced figures")
            box = (min(c["box"][0] for c in pieces), min(c["box"][1] for c in pieces),
                   max(c["box"][2] for c in pieces), max(c["box"][3] for c in pieces))
            if preserve_alpha:
                box = (max(0, box[0] - 2), max(0, box[1] - 2),
                       min(sheet.width, box[2] + 2), min(sheet.height, box[3] + 2))
            art = np.zeros((box[3] - box[1], box[2] - box[0], 4), dtype=np.uint8)
            owned = np.zeros(art.shape[:2], dtype=np.uint8) if preserve_alpha else None
            for c in pieces:
                for y, left, right in c["runs"]:
                    art[y - box[1], left - box[0]:right - box[0]] = pixels[y, left:right]
                    if preserve_alpha:
                        owned[y - box[1], left - box[0]:right - box[0]] = 255
                    else:
                        art[y - box[1], left - box[0]:right - box[0], 3] = 255
            if preserve_alpha:
                support = np.asarray(Image.fromarray(owned).filter(ImageFilter.MaxFilter(5))) > 0
                original = pixels[box[1]:box[3], box[0]:box[2]]
                art[support] = original[support]
            # One cell center and one baseline per action, never per-pose scale.
            origin = (box[0] - round((col + .5) * sheet.width / column_count), box[1] - baseline)
            row_poses.append((Image.fromarray(art), origin))
        poses.append(row_poses)
        checks.append({"action": ACTION_IDS[row],
                       "sourceRow": [min(c["box"][1] for c in main), baseline],
                       "mainAreas": [c["area"] for c in main]})
    left = min(origin[0] for row in poses for _, origin in row)
    top = min(origin[1] for row in poses for _, origin in row)
    right = max(origin[0] + image.width for row in poses for image, origin in row)
    bottom = max(origin[1] + image.height for row in poses for image, origin in row)
    frames = []
    for row in poses:
        prepared = []
        for image, origin in row:
            frame = Image.new("RGBA", (right - left, bottom - top))
            frame.paste(image, (origin[0] - left, origin[1] - top))
            prepared.append(frame)
        frames.append(prepared)
    return frames, {"sourceSize": list(sheet.size), "sharedBounds": [left, top, right, bottom], "rows": checks}


def pixel_frames(rows: list[list[Image.Image]], size: int) -> list[list[Image.Image]]:
    if size not in (48, 96):
        raise ValueError("Supported animation sizes are 48 and 96")
    width, height = rows[0][0].size
    factor = min((size - 4) / width, (size - 4) / height)
    target = (max(1, round(width * factor)), max(1, round(height * factor)))
    sampled = []
    for row in rows:
        frames = []
        for frame in row:
            if frame.size != (width, height):
                raise ValueError("Animation frames must share one canvas and scale")
            small = frame.resize(target, Image.Resampling.NEAREST)
            canvas = Image.new("RGBA", (size, size))
            canvas.paste(small, ((size - target[0]) // 2, size - 2 - target[1]))
            frames.append(canvas)
        sampled.append(frames)
    visible = np.concatenate([np.asarray(frame)[np.asarray(frame)[:, :, 3] > 0, :3]
                              for row in sampled for frame in row])
    palette_image = Image.fromarray(visible.reshape(1, -1, 3)).quantize(
        colors=24, method=Image.Quantize.MAXCOVERAGE, kmeans=4)
    colors = np.array(palette_image.getpalette()[:24 * 3], dtype=np.int32).reshape(-1, 3)
    palette = [0, 0, 0] + colors.astype(int).flatten().tolist()
    palette += [0] * (768 - len(palette))
    result = []
    for row in sampled:
        frames = []
        for image in row:
            rgba = np.asarray(image)
            rgb = rgba[:, :, :3].astype(np.int32)
            distances = ((rgb[:, :, None, :] - colors[None, None, :, :]) ** 2).sum(axis=3)
            indices = (distances.argmin(axis=2) + 1).astype(np.uint8)
            indices[rgba[:, :, 3] == 0] = 0
            frame = Image.fromarray(indices).convert("P")
            frame.putpalette(palette)
            frame.info["transparency"] = 0
            frames.append(frame)
        result.append(frames)
    return result


def gif_bytes(frames: list[Image.Image], durations: tuple[int, ...]) -> bytes:
    output = io.BytesIO()
    frames[0].save(output, format="GIF", save_all=True, append_images=frames[1:],
                   duration=durations, loop=0, transparency=0, background=0,
                   disposal=2, optimize=False)
    content = output.getvalue()
    with Image.open(io.BytesIO(content)) as gif:
        if gif.n_frames != 4:
            raise ValueError("Each GIF must retain four actual distinct pose frames")
        for i in range(4):
            gif.seek(i)
            if gif.info["duration"] != durations[i] or gif.disposal_method != 2:
                raise ValueError("GIF timing/disposal did not survive encoding")
            if gif.convert("RGBA").tobytes() != frames[i].copy().convert("RGBA").tobytes():
                raise ValueError("GIF frames differ from source poses (palette or disposal)")
    return content


def prepare_character(cid: str) -> tuple[dict, dict[str, bytes], dict]:
    source = ROOT / "sheets" / f"{cid}.png"
    rows, report = split_sheet(source)
    item = {"id": cid, "sourceFile": config.rel(source), "sourceSha256": config.sha256_file(source), "variants": {}}
    files = {}
    cls = cid.rsplit("_", 1)[0]
    for size in (48, 96):
        sampled = pixel_frames(rows, size)
        variant = {"size": [size, size], "actions": []}
        strip = Image.new("RGBA", (size * 4, size * 8))
        for row, action in enumerate(ACTION_IDS):
            frames = sampled[row]
            label = ATTACK_LABELS[cls][row - 3] if row in (3, 4) else LABELS[row]
            prefix = f"characters/animations/{size}/{cid}/{action}"
            content = gif_bytes(frames, DURATIONS[row])
            png_paths = []
            for i, frame in enumerate(frames):
                path = f"{prefix}-{i}.png"
                output = io.BytesIO()
                frame.copy().convert("RGBA").save(output, format="PNG")
                files[path] = output.getvalue()
                png_paths.append("/" + path)
                strip.paste(frame.copy().convert("RGBA"), (i * size, row * size))
            files[prefix + ".gif"] = content
            variant["actions"].append({"id": action, "label": label, "gif": "/" + prefix + ".gif",
                                        "poster": png_paths[0], "frames": png_paths, "frameCount": 4,
                                        "durations": list(DURATIONS[row]), "sha256": hashlib.sha256(content).hexdigest()})
        output = io.BytesIO()
        strip.save(output, format="PNG")
        path = f"characters/animations/{size}/{cid}/sheet.png"
        files[path] = output.getvalue()
        variant["sheet"] = "/" + path
        item["variants"][str(size)] = variant
    return item, files, report


def run(dest: Path) -> int:
    cast = json.loads((config.ROOT / "generated" / "manifest.json").read_text())["classes"]
    items, files, reports = [], {}, []
    # Fully prepare and validate every character before replacing any exports.
    for char in cast:
        for gender in ("male", "female"):
            cid = f'{char["id"]}_{gender}'
            item, prepared, report = prepare_character(cid)
            items.append(item)
            files.update(prepared)
            reports.append({"id": cid, **report})
    for relative, content in files.items():
        path = dest / "public" / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    data = dest / "src/data/animations.json"
    data.parent.mkdir(parents=True, exist_ok=True)
    data.write_text(json.dumps({"generator": "Codex built-in imagegen", "model": None,
                                "actions": list(ACTION_IDS), "characters": items}, indent=2, ensure_ascii=False) + "\n")
    report_path = dest / "public/characters/animations/generation-report.json"
    report_path.write_text(json.dumps({"characters": reports, "gifs": len(items) * 8 * 2,
                                       "framesPerAction": 4, "colorsPerCharacter": 24,
                                       "disposal": 2, "loop": 0}, indent=2) + "\n")
    print(f"Exported {len(items)} characters, {len(items) * 16} transparent GIFs to {dest / 'public/characters/animations'}")
    return 0
