import data from "@/data/characters.json";

export type PixelAsset = {
  image: string;
  size: [number, number];
  pivot: [number, number];
  colors: string[];
  sha256: string;
};

export type Character = {
  id: string;
  classId: string;
  gender: "male" | "female";
  genderLabel: string;
  nameEn: string;
  nameZh: string;
  tagline: string;
  summary: string;
  tags: string[];
  image: string;
  originalImage: string;
  originalSha256: string;
  originalSize: [number, number];
  chibiImage: string;
  chibiSha256: string;
  chibiSize: [number, number];
  pixel96: PixelAsset;
  size: [number, number];
  pivot: [number, number];
  colors: string[];
  sourceFile: string;
  sha256: string;
  status: string;
};

// Derived by `uv run python sprites.py export-web` (rpg-sprites). Do not edit by hand.
export const characters: Character[] = data.map((character): Character => {
  if (character.gender !== "male" && character.gender !== "female") {
    throw new Error(`Invalid gender for ${character.id}`);
  }
  if (character.size.length !== 2 || character.pivot.length !== 2 || character.originalSize.length !== 2
    || character.chibiSize.length !== 2 || character.pixel96.size.length !== 2 || character.pixel96.pivot.length !== 2) {
    throw new Error(`Invalid sprite dimensions for ${character.id}`);
  }
  return {
    ...character,
    gender: character.gender,
    size: [character.size[0], character.size[1]],
    originalSize: [character.originalSize[0], character.originalSize[1]],
    pivot: [character.pivot[0], character.pivot[1]],
    chibiSize: [character.chibiSize[0], character.chibiSize[1]],
    pixel96: {
      ...character.pixel96,
      size: [character.pixel96.size[0], character.pixel96.size[1]],
      pivot: [character.pixel96.pivot[0], character.pixel96.pivot[1]],
    },
  };
});
