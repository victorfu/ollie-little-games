"""Verify animation completeness, source fidelity and transparent GIF playback."""
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image

from spritekit import animations


class AnimationExportTest(unittest.TestCase):
    def test_two_column_pose_sheet_preserves_art_crossing_a_grid_line(self):
        pixels = np.zeros((96, 96, 4), dtype=np.uint8)
        boxes = [(10, 4, 35, 51), (60, 4, 85, 45), (10, 59, 35, 90), (60, 56, 85, 91)]
        for i, (left, top, right, bottom) in enumerate(boxes):
            pixels[top:bottom, left:right] = (50 + i * 40, 120, 180, 255)
        with TemporaryDirectory() as tmp:
            source = Path(tmp) / "run.png"
            Image.fromarray(pixels).save(source)
            rows, _ = animations.split_sheet(source, row_count=2, column_count=2, preserve_alpha=True)
        self.assertEqual([len(row) for row in rows], [2, 2])
        for frame, (left, top, right, bottom) in zip((im for row in rows for im in row), boxes):
            self.assertEqual(np.count_nonzero(np.asarray(frame)[:, :, 3]), (right - left) * (bottom - top))

    def test_all_characters_actions_sizes_and_gif_frames(self):
        with TemporaryDirectory() as tmp:
            dest = Path(tmp)
            self.assertEqual(animations.run(dest), 0)
            manifest = json.loads((dest / "src/data/animations.json").read_text())
            self.assertEqual(len(manifest["characters"]), 12)
            self.assertEqual(len({c["id"] for c in manifest["characters"]}), 12)
            gifs = list((dest / "public/characters/animations").rglob("*.gif"))
            self.assertEqual(len(gifs), 192)
            for character in manifest["characters"]:
                source = animations.config.ROOT / character["sourceFile"]
                self.assertEqual(character["sourceSha256"], animations.config.sha256_file(source))
                for size in (48, 96):
                    variant = character["variants"][str(size)]
                    self.assertEqual(variant["size"], [size, size])
                    self.assertEqual([a["id"] for a in variant["actions"]], list(animations.ACTION_IDS))
                    for row, action in enumerate(variant["actions"]):
                        path = dest / "public" / action["gif"].lstrip("/")
                        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), action["sha256"])
                        with Image.open(path) as gif:
                            self.assertEqual(gif.size, (size, size))
                            self.assertEqual(gif.n_frames, 4)
                            self.assertEqual(gif.info["loop"], 0)
                            seen = set()
                            for i in range(4):
                                gif.seek(i)
                                rgba = gif.convert("RGBA")
                                self.assertEqual(gif.info["duration"], animations.DURATIONS[row][i])
                                self.assertEqual(gif.disposal_method, 2)
                                with Image.open(dest / "public" / action["frames"][i].lstrip("/")) as png:
                                    # Decoder composition must match complete poses,
                                    # including pixels erased by the preceding frame.
                                    self.assertEqual(rgba.tobytes(), png.convert("RGBA").tobytes())
                                pixels = np.asarray(rgba)
                                self.assertEqual(set(np.unique(pixels[:, :, 3])), {0, 255})
                                self.assertFalse(np.any(pixels[0, :, 3]) or np.any(pixels[-1, :, 3]))
                                self.assertFalse(np.any(pixels[:, 0, 3]) or np.any(pixels[:, -1, 3]))
                                self.assertLessEqual(len({tuple(p[:3]) for p in pixels.reshape(-1, 4) if p[3]}), 24)
                                seen.add(rgba.tobytes())
                            self.assertGreaterEqual(len(seen), 3, f'{character["id"]}/{action["id"]} is static')

    def test_missing_sheet_leaves_existing_exports_untouched(self):
        with TemporaryDirectory() as tmp:
            dest = Path(tmp)
            manifest = dest / "src/data/animations.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text("existing manifest")
            gif = dest / "public/characters/animations/48/ember_knight_male/idle.gif"
            gif.parent.mkdir(parents=True)
            gif.write_bytes(b"existing gif")
            real_prepare = animations.prepare_character

            def missing(cid):
                if cid == "ember_knight_female":
                    raise FileNotFoundError(cid)
                return real_prepare(cid)

            with patch.object(animations, "prepare_character", side_effect=missing):
                with self.assertRaises(FileNotFoundError):
                    animations.run(dest)
            self.assertEqual(manifest.read_text(), "existing manifest")
            self.assertEqual(gif.read_bytes(), b"existing gif")

    def test_disconnected_effect_uses_silhouette_instead_of_neighbor_box(self):
        mask = np.zeros((40, 70), dtype=bool)
        # A U-shaped neighbor's bounding box contains the fragment, but its
        # visible edges are farther away than the actual owner's right edge.
        mask[3:36, 5:8] = True
        mask[3:6, 5:35] = True
        mask[33:36, 5:35] = True
        mask[10:30, 43:53] = True
        mask[18:22, 38:40] = True
        groups = animations.components(mask)
        bodies = sorted(sorted(groups, key=lambda c: c["area"], reverse=True)[:2], key=lambda c: c["box"][0])
        fragment = min(groups, key=lambda c: c["area"])
        self.assertEqual(animations.closest_body(fragment, bodies, [animations.component_edges(b) for b in bodies]), 1)

    def test_rejects_opaque_or_empty_animation_source(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "bad.png"
            for fill in ((0, 0, 0, 255), (0, 0, 0, 0)):
                Image.new("RGBA", (80, 160), fill).save(path)
                with self.assertRaises(ValueError):
                    animations.split_sheet(path)
