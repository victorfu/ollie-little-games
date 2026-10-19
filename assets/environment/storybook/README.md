# Storybook forest art

Generated through Codex's built-in `image_gen` tool, using the user's requested GPT-Image2 route. No API key, API CLI, or SVG was used. The tool did not return an actual model-version identifier; `manifest.json` records the request and leaves `reportedModel` null.

PNG masters are retained here. Runtime WebP files are in `public/environment/storybook/`. `scripts/encode-forest-art.mjs` only re-encodes the PNGs with the browser WebP encoder (quality 90), retaining their original dimensions and transparency; it does not generate or redraw image contents.

| Asset | Art direction | Runtime use |
| --- | --- | --- |
| ground | Overhead sage moss, clover, gouache/paper texture | Forest floor |
| path | Warm cream-ochre soil, tiny pebbles and leaf impressions | Walking areas and battle clearing |
| trees | Three rounded woodland trees, moss and cream flowers, transparent background | Forest canopy and battle backdrop |
| chest | Matching closed/open wooden chests in two equal-width cells, transparent background | Chest states, cropped at render time |
| camp | Amber fire, logs and mossy stone ring, transparent background | Campsites and camp panel illustration |

`manifest.json` includes dimensions, original PNG SHA-256 hashes, transparency corner checks and runtime file sizes. Combined WebP payload is approximately 2.66 MB, versus 13.36 MB for the original PNG files. Original files returned by image generation remain in the Codex generated-images directory as well.

Rendering uses a cached terrain canvas, a soft road mask based on the existing collision grid, and subtle camp lighting (static under reduced-motion preference). This changes presentation, not map coordinates or collision rules.
