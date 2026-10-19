"""Verify the actual exported monster assets, not just declared counts."""
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image

from spritekit import animations, config, monsters


class MonsterAssetsTest(unittest.TestCase):
    def test_complete_exported_catalog_and_decoded_gifs(self):
        root = config.ROOT.parent
        data = json.loads((root / 'src/data/monsters.json').read_text())
        self.assertEqual({m['id'] for m in data['monsters']}, {'moondew_slime', 'mossrock_grunt', 'eclipse_treant'})
        count = 0
        for monster in data['monsters']:
            for key, size in [('48', 48), ('96', 96), ('chibi', 512), ('original', 512)]:
                variant = monster['variants'][key]
                self.assertEqual(variant['size'], [size, size])
                self.assertEqual([a['id'] for a in variant['actions']], list(animations.ACTION_IDS))
                for row, action in enumerate(variant['actions']):
                    count += 1
                    self.assertEqual(action['durations'], list(animations.DURATIONS[row]))
                    with Image.open(root / 'public' / action['gif'].lstrip('/')) as gif:
                        self.assertEqual(gif.n_frames, 4)
                        self.assertEqual(gif.size, (size, size))
                        self.assertEqual(gif.info['loop'], 0)
                        distinct = set()
                        for i, path in enumerate(action['frames']):
                            frame_path = root / 'public' / path.lstrip('/')
                            self.assertEqual(hashlib.sha256(frame_path.read_bytes()).hexdigest(), action['frameSha256'][i])
                            with Image.open(frame_path) as frame:
                                rgba = np.array(frame.convert('RGBA'))
                            self.assertTrue((rgba[:, :, 3] == 0).any())
                            self.assertTrue((rgba[:, :, 3] >= 128).any())
                            self.assertFalse((rgba[0, :, 3] >= 128).any() or (rgba[-1, :, 3] >= 128).any()
                                             or (rgba[:, 0, 3] >= 128).any() or (rgba[:, -1, 3] >= 128).any())
                            if size < 512:
                                self.assertLessEqual(len(np.unique(rgba[rgba[:, :, 3] > 0, :3], axis=0)), 24)
                                self.assertEqual(set(np.unique(rgba[:, :, 3])), {0, 255})
                            distinct.add(rgba.tobytes())
                            gif.seek(i)
                            self.assertEqual(gif.info['duration'], action['durations'][i])
                            self.assertEqual(gif.disposal_method, 2)
                            np.testing.assert_array_equal(np.array(gif.convert('RGBA'))[:, :, 3] > 0, rgba[:, :, 3] >= 128)
                        self.assertEqual(len(distinct), 4)
        self.assertEqual(count, 96)

    def test_missing_sources_do_not_overwrite_existing_export(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            output = root / 'src/data/monsters.json'
            output.parent.mkdir(parents=True)
            output.write_text('existing catalog')
            with patch.object(monsters, 'ROOT', root / 'missing'):
                with self.assertRaises(FileNotFoundError):
                    monsters.run(root)
            self.assertEqual(output.read_text(), 'existing catalog')
            self.assertFalse((root / 'public').exists())
