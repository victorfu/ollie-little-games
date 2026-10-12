"""Check illustrated animation coverage, native detail and GIF transparency."""
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image

from spritekit import animations, hdanimations


class HDAnimationTest(unittest.TestCase):
    def test_registration_removes_sheet_drift_without_rescaling_art(self):
        source = animations.config.ROOT.parent / "public/characters/animations/hd/original/ember_knight_female/idle-0.png"
        with Image.open(source) as image:
            reference = image.convert("RGBA")
        moved = Image.new("RGBA", reference.size)
        moved.paste(reference, (-60, -7))
        self.assertEqual(hdanimations.registration_offset(reference, moved), (60, 7))
        frames, offsets = hdanimations.register_action([reference, moved])
        self.assertEqual(offsets, [[0, 0], [60, 7]])
        np.testing.assert_array_equal(np.asarray(frames[0]), np.asarray(frames[1]))
        # Running bounce remains part of the pose; registration cannot move y.
        dx, dy = hdanimations.registration_offset(reference, moved, horizontal_only=True)
        self.assertLessEqual(abs(dx - 60), 3)
        self.assertEqual(dy, 0)

    def test_source_equipment_and_feet_are_not_clipped_at_canvas_edges(self):
        sources = sorted((hdanimations.ROOT / "sheets").rglob("*.png"))
        self.assertEqual(len(sources), 96)
        for source in sources:
            with self.subTest(source=source.name, style=source.parent.name):
                with Image.open(source) as image:
                    visible = np.asarray(image.convert("RGBA"))[:, :, 3] >= 128
                self.assertFalse(visible[0].any() or visible[-1].any()
                                 or visible[:, 0].any() or visible[:, -1].any(),
                                 f"{source}: visible art meets the source boundary")

    def test_full_hd_cast_and_styles(self):
        with TemporaryDirectory() as tmp:
            dest = Path(tmp)
            self.assertEqual(hdanimations.run(dest), 0)
            data = json.loads((dest / "src/data/hd-animations.json").read_text())
            self.assertEqual(len(data["characters"]), 12)
            self.assertEqual(len({c["id"] for c in data["characters"]}), 12)
            self.assertEqual(len(list((dest / "public/characters/animations/hd").rglob("*.gif"))), 192)
            report = json.loads((dest / "public/characters/animations/hd/generation-report.json").read_text())
            self.assertEqual(len(report["characters"]), 24)
            for item in report["characters"]:
                self.assertLessEqual(item["outputScale"], 1)
                self.assertEqual(len(item["sources"]), 4)
                for source in item["sources"]:
                    self.assertLessEqual(source["nativeScale"], 1)
                    self.assertGreaterEqual(source["sourceSize"][0], 1536)
                    self.assertEqual(source["sourceSha256"], animations.config.sha256_file(animations.config.ROOT / source["sourceFile"]))
            for character in data["characters"]:
                self.assertEqual(set(character["variants"]), {"chibi", "original"})
                for variant in character["variants"].values():
                    self.assertEqual(variant["size"], [512, 512])
                    self.assertEqual([a["id"] for a in variant["actions"]], list(animations.ACTION_IDS))
                    for row, action in enumerate(variant["actions"]):
                        with Image.open(dest / "public" / action["gif"].lstrip("/")) as gif:
                            self.assertEqual(gif.size, (512, 512))
                            self.assertEqual(gif.n_frames, 4)
                            self.assertEqual(gif.info["loop"], 0)
                            seen = set()
                            for i in range(4):
                                gif.seek(i)
                                self.assertEqual(gif.info["duration"], animations.DURATIONS[row][i])
                                self.assertEqual(gif.disposal_method, 2)
                                decoded = np.asarray(gif.convert("RGBA"))
                                with Image.open(dest / "public" / action["frames"][i].lstrip("/")) as png:
                                    self.assertEqual(png.size, (512, 512))
                                    original = np.asarray(png.convert("RGBA"))
                                    if i == 0:
                                        anchor = png.convert("RGBA")
                                    elif action["id"] == "idle" or (variant["style"] == "chibi"
                                                                            and action["id"] == "run"):
                                        dx, dy = hdanimations.registration_offset(anchor, png.convert("RGBA"), horizontal_only=True)
                                        self.assertLessEqual(abs(dx), 4)
                                        self.assertEqual(dy, 0)
                                # GIF has binary transparency; PNG preserves soft
                                # edges. Both must depict the same complete pose.
                                np.testing.assert_array_equal(decoded[:, :, 3] > 0, original[:, :, 3] >= 128)
                                self.assertFalse(original[0, :, 3].any() or original[-1, :, 3].any())
                                self.assertFalse(original[:, 0, 3].any() or original[:, -1, 3].any())
                                seen.add(decoded.tobytes())
                            self.assertGreaterEqual(len(seen), 3)

    def test_chibi_frames_retain_full_color_and_soft_alpha(self):
        variant, files, report = hdanimations.prepare_character("ember_knight_female", "chibi")
        path = variant["actions"][3]["frames"][2].lstrip("/")
        with Image.open(io.BytesIO(files[path])) as png:
            pixels = np.asarray(png)
            self.assertGreater(len(np.unique(pixels[pixels[:, :, 3] > 0, :3], axis=0)), 256)
            self.assertGreater(len(np.unique(pixels[:, :, 3])), 2)
        self.assertLessEqual(report["outputScale"], 1)

    def test_black_art_is_not_mistaken_for_transparency(self):
        frames = []
        for i in range(4):
            pixels = np.zeros((8, 8, 4), dtype=np.uint8)
            pixels[2:4, i + 1:i + 3, 3] = 255
            frames.append(Image.fromarray(pixels))
        content = animations.gif_bytes(hdanimations.gif_palette(frames), (100,) * 4)
        with Image.open(io.BytesIO(content)) as gif:
            for i in range(4):
                gif.seek(i)
                np.testing.assert_array_equal(np.asarray(gif.convert("RGBA"))[:, :, 3], np.asarray(frames[i])[:, :, 3])

    def test_missing_hd_board_preserves_existing_exports(self):
        with TemporaryDirectory() as tmp:
            dest = Path(tmp)
            data = dest / "src/data/hd-animations.json"
            data.parent.mkdir(parents=True)
            data.write_text("existing HD data")
            gif = dest / "public/characters/animations/hd/chibi/ember_knight_male/idle.gif"
            gif.parent.mkdir(parents=True)
            gif.write_bytes(b"existing GIF")
            with patch.object(hdanimations, "prepare_character", side_effect=FileNotFoundError("missing HD source")):
                with self.assertRaises(FileNotFoundError):
                    hdanimations.run(dest)
            self.assertEqual(data.read_text(), "existing HD data")
            self.assertEqual(gif.read_bytes(), b"existing GIF")
