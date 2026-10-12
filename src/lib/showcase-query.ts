export const ACTION_IDS = ["idle", "walk", "run", "slash", "thrust", "block", "hurt", "fall"] as const;
export type ActionId = typeof ACTION_IDS[number];
export type AnimationStyle = "pixel" | "chibi" | "original";

export type ShowcaseSelection = {
  classId: string;
  gender: "male" | "female";
  mode: "pixel" | "original" | "chibi" | "compare" | "animation";
  background: "paper" | "night" | "checker";
  zoom: number;
  pixelSize: 48 | 96;
  action: ActionId;
  animationStyle: AnimationStyle;
};

// 96 is the current large size; "80" is a legacy shared-link value that maps to it.
const LARGE_PIXEL_SIZES = ["96", "80"];

export function readSelection(params: Pick<URLSearchParams, "get">, classIds: string[]): ShowcaseSelection {
  const classId = params.get("class");
  const mode = params.get("view");
  const background = params.get("bg");
  const zoom = params.get("zoom");
  const action = params.get("action");
  const art = params.get("art");
  return {
    classId: classId && classIds.includes(classId) ? classId : classIds[0],
    gender: params.get("gender") === "male" ? "male" : "female",
    mode: mode === "pixel" || mode === "original" || mode === "chibi" || mode === "animation" ? mode : "compare",
    background: background === "night" || background === "checker" ? background : "paper",
    zoom: zoom && ["1", "2", "3", "4", "6", "8", "10"].includes(zoom) ? Number(zoom) : 0,
    pixelSize: LARGE_PIXEL_SIZES.includes(params.get("size") ?? "") ? 96 : 48,
    action: ACTION_IDS.includes(action as ActionId) ? action as ActionId : "idle",
    animationStyle: art === "chibi" || art === "original" ? art : "pixel",
  };
}

export function writeSelection(url: URL, selection: ShowcaseSelection): URL {
  const result = new URL(url);
  result.searchParams.set("class", selection.classId);
  result.searchParams.set("gender", selection.gender);
  result.searchParams.set("view", selection.mode);
  result.searchParams.set("bg", selection.background);
  result.searchParams.set("zoom", selection.zoom === 0 ? "auto" : String(selection.zoom));
  result.searchParams.set("size", String(selection.pixelSize));
  if (selection.mode === "animation" || selection.action !== "idle") result.searchParams.set("action", selection.action);
  else result.searchParams.delete("action");
  if (selection.animationStyle !== "pixel") result.searchParams.set("art", selection.animationStyle);
  else result.searchParams.delete("art");
  return result;
}
