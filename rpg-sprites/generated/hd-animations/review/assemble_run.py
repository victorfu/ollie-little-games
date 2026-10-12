"""Assemble imagegen's isolated 2x2 run poses; preserve the shooting row.

Run before replacing the source board; this only crops/downsamples generated art.
"""
from pathlib import Path
from PIL import Image
from spritekit import animations


def assemble(board_path: Path, run_path: Path, dest: Path, connected: bool = False, row_gap: int = 0) -> None:
    board = Image.open(board_path).convert("RGBA")
    run = Image.open(run_path).convert("RGBA")
    if run.width != run.height or run.width < 1024:
        raise ValueError("Expected a native square 2x2 run board")
    half = run.width // 2
    row_end = board.width // 4
    lower_height = (board.width + 3) // 4
    lower = board.crop((0, board.height - lower_height, board.width, board.height))
    top = Image.new("RGBA", (board.width, row_end))
    if connected:
        rows, _ = animations.split_sheet(run_path, row_count=2, column_count=2, preserve_alpha=True)
        poses = [pose for row in rows for pose in row]
        factor = min((board.width // 4 - 8) / poses[0].width,
                     (row_end - 8) / poses[0].height, (board.width // 4) / half)
        # The existing lower-row hats can also cross the nominal grid line.
        # Keep the previously split poses, not a rectangular half-sheet crop.
        old_rows, report = animations.split_sheet(board_path, row_count=2, preserve_alpha=True)
        lower = Image.new("RGBA", (board.width, old_rows[1][0].height))
        for i, frame in enumerate(old_rows[1]):
            lower.alpha_composite(frame, (round((i + .5) * board.width / 4) + report["sharedBounds"][0], 0))
        lower_height = lower.height
    for i in range(4):
        x, y = i % 2 * half, i // 2 * half
        frame = poses[i] if connected else run.crop((x, y, x + half, y + half))
        left, right = round(i * board.width / 4), round((i + 1) * board.width / 4)
        if connected:
            frame = frame.resize((round(frame.width * factor), round(frame.height * factor)), Image.Resampling.LANCZOS)
            top.paste(frame, (left + (right - left - frame.width) // 2, row_end - 4 - frame.height))
        else:
            frame = frame.resize((right - left, row_end), Image.Resampling.LANCZOS)
            top.paste(frame, (left, 0))
    result = Image.new("RGBA", (board.width, row_end + row_gap + lower_height))
    result.paste(top, (0, 0))
    result.paste(lower, (0, row_end + row_gap))
    result.save(dest)
