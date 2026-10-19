"""Export saved imagegen monster artwork using the character pipeline codecs."""
from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path

from PIL import Image

from . import animations, config, hdanimations, webexport

ROOT = config.ROOT / 'generated/monsters'


def png(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format='PNG')
    return stream.getvalue()


def encode_actions(cid: str, variant: str, rows: list, labels: list) -> tuple[dict, dict]:
    size = rows[0][0].width
    prefix = f'monsters/animations/{variant}/{cid}'
    files, actions = {}, []
    sheet = Image.new('RGBA', (size * 4, size * 8))
    for row, action in enumerate(animations.ACTION_IDS):
        frames = rows[row]
        indexed = hdanimations.gif_palette(frames) if size == 512 else frames
        content = animations.gif_bytes(indexed, animations.DURATIONS[row])
        gif_path = f'{prefix}/{action}.gif'
        files[gif_path] = content
        paths, hashes = [], []
        for i, frame in enumerate(frames):
            path = f'{prefix}/{action}-{i}.png'
            rgba = frame.convert('RGBA')
            files[path] = png(rgba)
            hashes.append(hashlib.sha256(files[path]).hexdigest())
            paths.append('/' + path)
            sheet.paste(rgba, (i * size, row * size))
        actions.append(dict(id=action, label=labels[row], gif='/' + gif_path,
                            poster=paths[0], frames=paths, frameCount=4,
                            frameSha256=hashes, durations=list(animations.DURATIONS[row]),
                            sha256=hashlib.sha256(content).hexdigest()))
    sheet_path = prefix + '/sheet.png'
    files[sheet_path] = png(sheet)
    return dict(size=[size, size], sheet='/' + sheet_path, actions=actions), files


def prepare() -> tuple[dict, dict, dict]:
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    files, items, checks = {}, [], []
    contact = {size: Image.new('RGBA', (size * 3, size)) for size in (48, 96)}
    for index, monster in enumerate(manifest['monsters']):
        cid = monster['id']
        item = {**monster, 'generationModel': None, 'variants': {}, 'art': {}}
        sources = {}
        for style in ('original', 'chibi'):
            source = ROOT / style / f'{cid}.png'
            with Image.open(source) as image:
                if image.convert('RGBA').getchannel('A').getextrema()[0] != 0:
                    raise ValueError(f'{source}: requires transparency')
            path = f'monsters/{style}/{cid}.png'
            files[path] = source.read_bytes()
            sources[style] = dict(file=config.rel(source), sha256=config.sha256_file(source))
            item['art'][style] = '/' + path
        master = ROOT / 'masters/chibi' / f'{cid}.png'
        sources['pixel'] = dict(file=config.rel(master), sha256=config.sha256_file(master))
        for size in (48, 96):
            sprite = webexport.pixelize(master, size)
            colors, bounds = webexport.inspect_sprite(sprite, cid, size)
            path = f'monsters/{cid}.png' if size == 48 else f'monsters/96/{cid}.png'
            files[path] = png(sprite)
            item['art'][str(size)] = '/' + path
            preview = f'monsters/previews/{size}/{cid}.png'
            files[preview] = png(sprite.resize((288, 288), Image.Resampling.NEAREST))
            contact[size].paste(sprite, (index * size, 0))
            checks.append(dict(id=cid, size=size, colors=len(colors), bounds=bounds))
        sheet_source = ROOT / 'animations/sheets' / f'{cid}.png'
        rows, report = animations.split_sheet(sheet_source)
        sources['pixelAnimations'] = dict(file=config.rel(sheet_source), sha256=config.sha256_file(sheet_source), **report)
        for size in (48, 96):
            item['variants'][str(size)], prepared = encode_actions(cid, str(size), animations.pixel_frames(rows, size), monster['actionLabels'])
            files.update(prepared)
        hd_reports = {}
        for style in ('chibi', 'original'):
            hd_rows, hd_reports[style] = hdanimations.illustrated_frames(cid, style, ROOT / 'hd-animations')
            item['variants'][style], prepared = encode_actions(cid, 'hd/' + style, hd_rows, monster['actionLabels'])
            files.update(prepared)
        item['sources'] = sources
        checks.append(dict(id=cid, hd=hd_reports, pixel=report))
        items.append(item)
        print(f'Prepared monster: {cid}', flush=True)
    for size, sheet in contact.items():
        files[f'monsters/contact-sheet-{size}.png'] = png(sheet.resize((864, 288), Image.Resampling.NEAREST))
    data = dict(generator='Codex built-in imagegen', model=None, monsters=items)
    report = dict(monsters=checks, gifs=len(items) * 8 * 4, frames=len(items) * 8 * 4 * 4,
                  framesPerAction=4, pixelColors=24, hdFrameSize=[512, 512], sourceUpscaling=False,
                  disposal=2, loop=0)
    return data, files, report


def run(dest: Path) -> int:
    # All sources, frames and GIF decoding are checked before replacing outputs.
    data, files, report = prepare()
    files['monsters/generation-report.json'] = (json.dumps(report, indent=2, ensure_ascii=False) + '\n').encode()
    for relative, content in files.items():
        path = dest / 'public' / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
    path = dest / 'src/data/monsters.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
    print(f'Exported {len(data["monsters"])} monsters and {report["gifs"]} GIFs')
    return 0
