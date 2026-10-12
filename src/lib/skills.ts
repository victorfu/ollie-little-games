import data from "@/data/skills.json";

export type SkillKind = "主動" | "被動" | "奧義";

export type Skill = {
  name: string;
  kind: SkillKind;
  detail: string;
};

export type SkillBranch = {
  icon: string;
  name: string;
  focus: string;
  motto: string;
  skills: Skill[];
};

export type ClassSkills = {
  role: string;
  element: string;
  damage: string;
  start: Skill[];
  branches: SkillBranch[];
};

const KINDS: SkillKind[] = ["主動", "被動", "奧義"];

// Emoji icons are hidden until custom skill/element icons are drawn; the data keeps them.
const stripIcons = (text: string) => text.replace(/(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️)️?\s?/gu, "");

function toSkill(classId: string, skill: { name: string; kind: string; detail: string }): Skill {
  if (!KINDS.includes(skill.kind as SkillKind)) throw new Error(`Invalid skill kind for ${classId}: ${skill.name}`);
  return { ...skill, kind: skill.kind as SkillKind, detail: stripIcons(skill.detail) };
}

// Mirrors section ④ of docs/rpg-design.md; update both together.
export const classSkills: Record<string, ClassSkills> = Object.fromEntries(
  Object.entries(data).map(([classId, entry]) => {
    if (entry.start.length !== 2 || entry.branches.length !== 3 || entry.branches.some((b) => b.skills.length !== 5)) {
      throw new Error(`Invalid skill tree shape for ${classId}`);
    }
    return [classId, {
      ...entry,
      element: stripIcons(entry.element),
      start: entry.start.map((skill) => toSkill(classId, skill)),
      branches: entry.branches.map((branch) => ({ ...branch, skills: branch.skills.map((skill) => toSkill(classId, skill)) })),
    }];
  }),
);

// Mirrors section ③ of docs/rpg-design.md; update both together.
const STATUS_GLOSSARY: Record<string, string> = {
  鼓舞: "物攻、魔攻 +25%",
  虛弱: "物攻、魔攻 −25%",
  堅守: "物防、魔防 +25%",
  破防: "物防、魔防 −25%",
  加速: "速度 +25%",
  緩速: "速度 −25%",
  燃燒: "每回合損失最大 HP 的 5%（火屬性狀態）",
  暈眩: "無法行動（地屬性狀態）",
  沉睡: "無法行動；受到傷害就會醒來（月屬性狀態）",
  擊退: "被吹開，下一次行動延後；即時制另會中斷施法（風屬性狀態）",
  致盲: "攻擊有 50% 機率落空（光屬性狀態）",
  束縛: "無法移動，閃避率歸零（影屬性狀態）",
  再生: "每回合回復最大 HP 的 5%",
  護盾: "吸收一定量的傷害，吸收量由技能決定",
  隱身: "敵人無法指定為目標；自己出手或受到範圍攻擊時現形",
  不屈: "不會被暈眩、沉睡、擊退或束縛",
  嘲諷: "只能攻擊施放者",
  沉默: "無法使用技能，只能普通攻擊",
  淨化: "解除我方身上所有減益",
  驅散: "解除敵方身上所有增益",
};
const DURATIONS: [string, string][] = [["（短）", "短：持續 1 回合"], ["（中）", "中：持續 2 回合"], ["（長）", "長：持續 3 回合"]];

export type GlossaryEntry = { term: string; meaning: string };

/** Status effects and durations mentioned in a skill's detail, in order of first appearance. */
export function glossaryFor(detail: string): GlossaryEntry[] {
  const statuses = Object.keys(STATUS_GLOSSARY)
    .filter((term) => detail.includes(term))
    .sort((a, b) => detail.indexOf(a) - detail.indexOf(b))
    .map((term) => ({ term, meaning: STATUS_GLOSSARY[term] }));
  const durations = DURATIONS.filter(([mark]) => detail.includes(mark));
  return durations.length === 0 ? statuses
    : [...statuses, { term: "持續時間", meaning: durations.map(([, text]) => text).join("・") }];
}
