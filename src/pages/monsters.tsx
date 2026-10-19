import { useState } from "react";
import { Link } from "react-router";
import data from "@/data/monsters.json";
import { FramePlayer } from "@/components/animation-viewer";
import { parseVariant } from "@/lib/animations";
import type { ActionId } from "@/lib/showcase-query";

const catalog = data.monsters.map((monster) => ({
  ...monster,
  variants: {
    "48": parseVariant(monster.variants["48"], monster.id, 48),
    "96": parseVariant(monster.variants["96"], monster.id, 96),
    chibi: parseVariant(monster.variants.chibi, monster.id, 512),
    original: parseVariant(monster.variants.original, monster.id, 512),
  },
}));
type Variant = "48" | "96" | "chibi" | "original";
const styles: [Variant, string][] = [["original", "高清正常"], ["chibi", "高清 Q 版"], ["48", "48px 像素"], ["96", "96px 像素"]];

export default function Monsters() {
  const [selected, setSelected] = useState(catalog[0].id);
  const [style, setStyle] = useState<Variant>("chibi");
  const [action, setAction] = useState<ActionId>("idle");
  const [playing, setPlaying] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const monster = catalog.find((item) => item.id === selected)!;
  const variant = monster.variants[style];
  const animation = variant.actions.find((item) => item.id === action)!;
  const pixel = style === "48" || style === "96";
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <Link to="/" className="text-[#f0b830] underline">← 冒險角色</Link>
      <header><h1 className="text-3xl font-bold">怪物圖鑑</h1><p className="mt-3 text-[#c4c4e4]">兩隻小怪與一隻 Boss，查看造型、播放動作或逐格檢查。</p></header>
      <div className="motion-actions" role="group" aria-label="選擇怪物">
        {catalog.map((item) => <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{item.nameZh} · {item.role}</button>)}
      </div>
      <section className="flex flex-col gap-5" aria-label={monster.nameZh}>
        <h2 className="text-2xl font-bold">{monster.nameZh} <small>{monster.elementLabel}屬性 · {monster.nameEn}</small></h2>
        <p>{monster.summary}</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {styles.map(([key, label]) => <figure className="art-panel" key={key}>
            <figcaption>{label}</figcaption><img src={monster.art[key]} alt={`${monster.nameZh} ${label}`} className={`aspect-square w-full object-contain ${key === "48" || key === "96" ? "[image-rendering:pixelated]" : ""}`} />
            <a href={monster.art[key]} download className="underline">下載 PNG ↓</a>
          </figure>)}
        </div>
        <div className="motion-actions" role="group" aria-label="動畫風格">
          {styles.map(([key, label]) => <button key={key} type="button" aria-pressed={style === key} onClick={() => setStyle(key)}>{label}</button>)}
        </div>
        <div className="animation-viewer">
          <div className="motion-actions" role="group" aria-label="選擇動作">
            {variant.actions.map((item) => <button key={item.id} type="button" aria-pressed={action === item.id} onClick={() => setAction(item.id)}>{item.label}</button>)}
          </div>
          <FramePlayer key={`${monster.id}-${style}-${action}`} animation={animation} name={monster.nameZh} size={variant.size[0]} scale={style === "48" ? 4 : 2} pixelated={pixel} playing={playing} setPlaying={setPlaying} />
          <div className="animation-downloads">
            <a href={animation.gif} download className="download-primary">下載 {animation.label} GIF ↓</a>
            <a href={variant.sheet} download>下載完整動作表 PNG ↓</a>
          </div>
        </div>
      </section>
    </main>
  );
}
