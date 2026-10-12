"""Package the built-in imagegen artwork into Next.js app icons.

Run: rpg-sprites/.venv/bin/python scripts/build_favicon.py
Only resizes/encodes the saved artwork and clears its flat backdrop; does not draw or generate images.
"""
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BACKDROP = (25, 20, 48)  # #181530 plum backdrop used in favicon-prompt.txt
BACKDROP_TOLERANCE = 18  # backdrop noise is ±3; the dark outline is ~40 away


def clear_backdrop(image):
    """Make the backdrop connected to the image edges transparent.

    Only pixels reachable from the border through backdrop-colored pixels are
    cleared, so interior dark tones (outline, eyes, nose) are kept.
    """
    width, height = image.size
    pixels = image.load()

    def is_backdrop(x, y):
        r, g, b, _ = pixels[x, y]
        return (
            (r - BACKDROP[0]) ** 2 + (g - BACKDROP[1]) ** 2 + (b - BACKDROP[2]) ** 2
            <= BACKDROP_TOLERANCE**2
        )

    seen = set()
    queue = deque(
        [(x, 0) for x in range(width)]
        + [(x, height - 1) for x in range(width)]
        + [(0, y) for y in range(height)]
        + [(width - 1, y) for y in range(height)]
    )
    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or not (0 <= x < width and 0 <= y < height):
            continue
        seen.add((x, y))
        if not is_backdrop(x, y):
            continue
        pixels[x, y] = (0, 0, 0, 0)
        queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return image


def main():
    with Image.open(ROOT / "assets/branding/favicon-master.png") as source:
        # ICO frames are stored as RGBA PNGs.
        image = clear_backdrop(source.convert("RGBA"))
    if image.width != image.height:
        raise ValueError("Favicon source must be square")
    app = ROOT / "public"
    image.resize((256, 256), Image.Resampling.LANCZOS).save(
        app / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)]
    )
    for filename, size in (("icon.png", 512), ("apple-icon.png", 180)):
        image.resize((size, size), Image.Resampling.LANCZOS).save(app / filename)
    with Image.open(app / "favicon.ico") as favicon:
        expected = {(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)}
        if favicon.ico.sizes() != expected:
            raise ValueError("Missing favicon sizes")
    print("Built favicon.ico (16/32/48/64/256), icon.png (512), apple-icon.png (180)")


if __name__ == "__main__":
    main()
