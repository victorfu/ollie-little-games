"""Verify the generated cast export cannot regress to legacy art."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image

from spritekit import webexport


class GeneratedExportTest(unittest.TestCase):
    def test_export_contains_both_genders_and_only_removes_known_legacy_files(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            pub = root / "public/characters"
            pub.mkdir(parents=True)
            (pub / "ember_knight.png").write_bytes(b"old")
            (pub / "unrelated.png").write_bytes(b"keep")
            (pub / "frost_wolf_knight_male.png").write_bytes(b"retired")
            (pub / "80").mkdir()
            (pub / "80/ember_knight_female.png").write_bytes(b"replaced size")
            self.assertEqual(webexport.run(root), 0)
            data_path = root / "src/data/characters.json"
            original = data_path.read_bytes()
            data = json.loads(original)
            self.assertEqual(len(data), 12)
            self.assertEqual(len({c["sha256"] for c in data}), 12)
            self.assertEqual(len({c["classId"] for c in data}), 6)
            self.assertIn("martial_artist", {c["classId"] for c in data})
            self.assertNotIn("frost_wolf_knight", {c["classId"] for c in data})
            for cid in {c["classId"] for c in data}:
                self.assertEqual({c["gender"] for c in data if c["classId"] == cid}, {"male", "female"})
            for c in data:
                original_png = root / "public" / c["originalImage"].lstrip("/")
                source = webexport.GENERATED / "illustrations" / f'{c["id"]}.png'
                self.assertEqual(original_png.read_bytes(), source.read_bytes())
                self.assertEqual(c["originalSha256"], webexport.config.sha256_file(source))
                pixel_master = webexport.GENERATED / "masters" / "chibi" / f'{c["id"]}.png'
                self.assertNotEqual(original_png.read_bytes(), pixel_master.read_bytes())
                with Image.open(original_png) as image:
                    self.assertEqual(list(image.size), c["originalSize"])
                with Image.open(root / "public" / c["image"].lstrip("/")) as im:
                    pixels = np.asarray(im)
                    self.assertEqual(im.size, (48, 48))
                    self.assertEqual(set(np.unique(pixels[:, :, 3])), {0, 255})
                    self.assertEqual(im.getbbox()[3], 46)
                    self.assertLessEqual(len({tuple(p[:3]) for p in pixels.reshape(-1, 4) if p[3]}), 24)
                    with Image.open(pub / "previews" / f'{c["id"]}.png') as preview:
                        expected = im.resize((288, 288), Image.Resampling.NEAREST)
                        self.assertEqual(preview.size, (288, 288))
                        self.assertEqual(preview.tobytes(), expected.tobytes())
                chibi_source = webexport.GENERATED / "chibi" / f'{c["id"]}.png'
                chibi_png = root / "public" / c["chibiImage"].lstrip("/")
                self.assertEqual(chibi_png.read_bytes(), chibi_source.read_bytes())
                self.assertEqual(c["chibiSha256"], webexport.config.sha256_file(chibi_source))
                self.assertNotEqual(chibi_png.read_bytes(), original_png.read_bytes())
                with Image.open(chibi_png) as chibi:
                    self.assertEqual(list(chibi.size), c["chibiSize"])
                self.assertIn("masters/chibi/", c["sourceFile"])
                self.assertEqual(c["sourceSha256"], webexport.config.sha256_file(pixel_master))
                variant96 = c["pixel96"]
                self.assertEqual(variant96["size"], [96, 96])
                self.assertEqual(variant96["pivot"], [48, 92])
                path96 = root / "public" / variant96["image"].lstrip("/")
                self.assertEqual(variant96["sha256"], webexport.config.sha256_file(path96))
                with Image.open(path96) as im:
                    pixels96 = np.asarray(im)
                    self.assertEqual(im.size, (96, 96))
                    self.assertEqual(set(np.unique(pixels96[:, :, 3])), {0, 255})
                    self.assertEqual(im.getbbox()[3], 92)
                    self.assertLessEqual(len({tuple(p[:3]) for p in pixels96.reshape(-1, 4) if p[3]}), 24)
                    # The large asset preserves independently sampled Q-version detail.
                    with Image.open(root / "public" / c["image"].lstrip("/")) as small:
                        self.assertNotEqual(im.tobytes(), small.resize((96, 96), Image.Resampling.NEAREST).tobytes())
                    with Image.open(pub / "previews/96" / f'{c["id"]}.png') as preview:
                        self.assertEqual(preview.tobytes(), im.resize((288, 288), Image.Resampling.NEAREST).tobytes())
            self.assertFalse((pub / "ember_knight.png").exists())
            self.assertFalse((pub / "frost_wolf_knight_male.png").exists())
            self.assertFalse((pub / "80/ember_knight_female.png").exists())
            self.assertEqual((pub / "unrelated.png").read_bytes(), b"keep")
            webexport.run(root)
            self.assertEqual(data_path.read_bytes(), original)

    def test_missing_master_does_not_replace_current_export(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            data_path = root / "src/data/characters.json"
            data_path.parent.mkdir(parents=True)
            data_path.write_text("existing export")
            real_pixelize = webexport.pixelize

            def missing_second(source, *args):
                if source.name == "ember_knight_female.png":
                    raise FileNotFoundError(source)
                return real_pixelize(source, *args)

            with patch.object(webexport, "pixelize", side_effect=missing_second):
                with self.assertRaises(FileNotFoundError):
                    webexport.run(root)
            self.assertEqual(data_path.read_text(), "existing export")
            self.assertFalse((root / "public/characters").exists())

    def test_small_eye_accents_survive_palette_reduction(self):
        source = webexport.GENERATED / "masters/chibi/ember_knight_female.png"
        for size in (48, 96):
            with self.subTest(size=size):
                pixels = np.asarray(webexport.pixelize(source, size)).astype(int)
                # This guardian has green irises and no green clothing/equipment.
                # The former frequency-based palette turned both irises brown.
                green = ((pixels[:, :, 1] > pixels[:, :, 0] * 1.2)
                         & (pixels[:, :, 1] > pixels[:, :, 2] * 1.2)
                         & (pixels[:, :, 3] > 0))
                self.assertGreaterEqual(int(green.sum()), 2)

    def test_missing_chibi_hd_does_not_replace_current_export(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            data_path = root / "src/data/characters.json"
            data_path.parent.mkdir(parents=True)
            data_path.write_text("existing export")
            real_open = Image.open

            def missing_chibi(path, *args, **kwargs):
                if Path(path).parent == webexport.GENERATED / "chibi":
                    raise FileNotFoundError(path)
                return real_open(path, *args, **kwargs)

            with patch.object(Image, "open", side_effect=missing_chibi):
                with self.assertRaises(FileNotFoundError):
                    webexport.run(root)
            self.assertEqual(data_path.read_text(), "existing export")
            self.assertFalse((root / "public/characters").exists())
