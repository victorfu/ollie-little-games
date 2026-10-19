import { Showcase } from "@/components/showcase";
import { characters } from "@/lib/characters";
import { Link } from "react-router";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3">
        <p className="font-pixel text-[10px] tracking-wider text-[#f0b830]">OLLIE LITTLE GAMES</p>
        <h1 className="text-3xl font-bold sm:text-4xl">選擇你的冒險角色</h1>
        <p className="max-w-2xl leading-7 text-[#c4c4e4]">
          六種職業，十二位冒險者。每種職業都有獨立的男性與女性造型，
          選擇角色，比較高清正常版、高清 Q 版與 48×48、96×96 Q 版像素圖。
        </p>
      </header>
      <Link to="/monsters" className="text-[#f0b830] underline">查看怪物圖鑑 →</Link>
      <Showcase characters={characters} />
    </main>
  );
}
