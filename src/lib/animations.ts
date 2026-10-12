import data from "@/data/animations.json";
import hdData from "@/data/hd-animations.json";
import { ACTION_IDS, type ActionId, type AnimationStyle } from "@/lib/showcase-query";

export type Animation = {
  id: ActionId; label: string; gif: string; poster: string; frames: string[];
  frameCount: number; durations: number[]; sha256: string; frameSha256?: string[];
};
export type AnimationVariant = { size: [number, number]; sheet: string; actions: Animation[] };
type RawVariant = { size: number[]; sheet: string; actions: (Omit<Animation, "id"> & { id: string })[] };
type HDRecord = { id: string; variants: Record<"chibi" | "original", RawVariant> };

function parseVariant(variant: RawVariant, id: string, size: number): AnimationVariant {
  if (variant.actions.length !== ACTION_IDS.length || variant.size.length !== 2
    || variant.size[0] !== size || variant.size[1] !== size) throw new Error(`Incomplete animations for ${id}`);
  const actions = variant.actions.map((action, index): Animation => {
    if (action.id !== ACTION_IDS[index] || action.frames.length !== 4 || action.frameCount !== 4
      || action.durations.length !== 4 || action.durations.some((ms) => ms <= 0)
      || (action.frameSha256 && action.frameSha256.length !== 4)) throw new Error(`Invalid action for ${id}/${action.id}`);
    return { ...action, id: ACTION_IDS[index] };
  });
  return { size: [size, size], sheet: variant.sheet, actions };
}

const pixels = new Map(data.characters.map((character) => [character.id,
  new Map([48, 96].map((size) => [size, parseVariant(character.variants[String(size) as "48" | "96"], character.id, size)]))] as const));
const illustrations = new Map<string, AnimationVariant>();
for (const character of hdData.characters as HDRecord[]) {
  for (const style of ["chibi", "original"] as const) {
    illustrations.set(`${character.id}:${style}`, parseVariant(character.variants[style], character.id, 512));
  }
}

export function hasHdAnimations(id: string): boolean {
  return illustrations.has(`${id}:chibi`) && illustrations.has(`${id}:original`);
}

export function getAnimations(id: string, size: 48 | 96, style: AnimationStyle = "pixel"): AnimationVariant {
  const variant = style === "pixel" ? pixels.get(id)?.get(size) : illustrations.get(`${id}:${style}`);
  if (!variant) throw new Error(`Missing animations for ${id}/${style}/${size}`);
  return variant;
}

export function frameUrl(animation: Animation, frame: number): string {
  return `${animation.frames[frame]}?v=${(animation.frameSha256?.[frame] ?? animation.sha256).slice(0, 12)}`;
}
