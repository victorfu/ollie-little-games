import { useState } from "react";
import { classSkills, glossaryFor, type Skill } from "@/lib/skills";

const KIND_CLASS: Record<Skill["kind"], string> = { 主動: "active", 被動: "passive", 奧義: "ultimate" };
const TIER_LABELS = ["主動", "被動", "主動", "被動", "奧義"];

type Located = { id: string; skill: Skill; place: string };

function SkillNode({ skill, selected, onSelect, style }: {
  skill: Skill; selected: boolean; onSelect: () => void; style?: React.CSSProperties;
}) {
  return (
    <button type="button" style={style} aria-pressed={selected} aria-controls="skill-detail" onClick={onSelect}
      className={`st-node st-${KIND_CLASS[skill.kind]} ${selected ? "selected" : ""}`}>
      {skill.name}
    </button>
  );
}

export function SkillTree({ classId }: { classId: string }) {
  const tree = classSkills[classId];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!tree) return null;

  const located: Located[] = [
    ...tree.start.map((skill, i) => ({ id: `start-${i}`, skill, place: "起始技能" })),
    ...tree.branches.flatMap((b) => b.skills.map((skill, i) => ({ id: `${b.name}-${i}`, skill, place: `${b.name}・第 ${i + 1} 層` }))),
  ];
  // Selection is kept by position id; switching class falls back to the first starting skill.
  const current = located.find((l) => l.id === selectedId) ?? located[0];
  const parts = current.skill.detail.split("｜");
  const mp = parts[0].startsWith("MP ") ? parts.shift() : null;
  const glossary = glossaryFor(current.skill.detail);
  const node = (id: string, skill: Skill, style?: React.CSSProperties) => (
    <SkillNode key={id} skill={skill} style={style} selected={id === current.id}
      onSelect={() => setSelectedId(id)} />
  );

  return (
    <section className="skill-tree" aria-labelledby="skill-tree-title">
      <header className="skill-tree-heading">
        <h3 id="skill-tree-title">技能樹 <span>17 SKILLS</span></h3>
        <ul className="character-tags">
          <li>{tree.role}</li><li>本命屬性 {tree.element}</li><li>{tree.damage}傷害</li>
        </ul>
      </header>

      <div className="st-grid">
        <div className="st-start">
          <span className="st-start-label">起始技能</span>
          <div>{tree.start.map((skill, i) => node(`start-${i}`, skill))}</div>
        </div>
        <div className="st-fork" aria-hidden />
        {tree.branches.map((branch, b) => (
          <div key={`line-${branch.name}`} className="st-line" style={{ gridColumn: b + 2 }} aria-hidden />
        ))}
        {tree.branches.map((branch, b) => (
          <div key={branch.name} className="st-branch" style={{ gridColumn: b + 2 }} title={branch.motto}>
            <strong>{branch.name}</strong><span>{branch.focus}</span>
          </div>
        ))}
        {TIER_LABELS.map((label, t) => (
          <span key={t} className="st-tier" style={{ gridRow: t + 4 }}>{t + 1}<small>{label}</small></span>
        ))}
        {tree.branches.flatMap((branch, b) =>
          branch.skills.map((skill, t) => node(`${branch.name}-${t}`, skill, { gridColumn: b + 2, gridRow: t + 4 })))}
      </div>

      <div id="skill-detail" className={`st-detail st-detail-${KIND_CLASS[current.skill.kind]}`} aria-live="polite">
        <div className="st-detail-head">
          <strong>{current.skill.name}</strong>
          <span className="st-badge">{current.skill.kind}</span>
          <span className="st-place">{current.place}</span>
          {mp && <span className="st-badge st-mp">{mp}</span>}
        </div>
        <ul>{parts.map((part, i) => <li key={i}>{part}</li>)}</ul>
        {glossary.length > 0 && (
          <dl className="st-glossary">
            {glossary.map(({ term, meaning }) => (
              <div key={term}><dt>{term}</dt><dd>{meaning}</dd></div>
            ))}
          </dl>
        )}
      </div>
      <p className="skill-note">方形＝主動・虛線圓角＝被動・金色＝奧義（每場戰鬥限用一次）。點選技能查看數值，數字為 Lv1 試算。</p>
    </section>
  );
}
