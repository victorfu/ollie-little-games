import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { SkillTree } from "@/components/skill-tree";
import { Sprite } from "@/components/sprite";
import { AnimationViewer } from "@/components/animation-viewer";
import { hasHdAnimations } from "@/lib/animations";
import type { Character } from "@/lib/characters";
import { readSelection, writeSelection, type ShowcaseSelection } from "@/lib/showcase-query";

type Mode = ShowcaseSelection["mode"];
type Background = "paper" | "night" | "checker";
const MODES: { id: Mode; label: string }[] = [
  { id: "pixel", label: "像素圖" },
  { id: "original", label: "高清正常" },
  { id: "chibi", label: "高清 Q 版" },
  { id: "compare", label: "並排比較" },
  { id: "animation", label: "動作動畫" },
];

export function Showcase({ characters }: { characters: Character[] }) {
  const classes = useMemo(() => characters.filter((c) => c.gender === "male"), [characters]);
  const classIds = useMemo(() => classes.map((c) => c.classId), [classes]);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selection = readSelection(searchParams, classIds);
  const { gender, mode, background, zoom, pixelSize } = selection;
  const index = classIds.indexOf(selection.classId);
  const updateSelection = useCallback((patch: Partial<ShowcaseSelection>) => {
    const currentUrl = new URL(window.location.href);
    const next = writeSelection(currentUrl, { ...readSelection(currentUrl.searchParams, classIds), ...patch });
    if (next.href !== currentUrl.href) navigate({ search: next.search });
  }, [classIds, navigate]);
  const setIndex = (value: number) => updateSelection({ classId: classIds[value] });
  const setGender = (value: Character["gender"]) => updateSelection({ gender: value });
  const setMode = (value: Mode) => updateSelection({ mode: value,
    ...(value === "animation" && (mode === "chibi" || mode === "original") ? { animationStyle: mode } : {}) });
  const setBackground = (value: Background) => updateSelection({ background: value });
  const setZoom = (value: number) => updateSelection({ zoom: value });
  const [width, setWidth] = useState(0);
  const [copied, setCopied] = useState<{ hex: string; ok: boolean } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const count = classes.length;
  const current = characters.find((c) => c.classId === classes[index].classId && c.gender === gender)!;
  const pixel = pixelSize === 96 ? current.pixel96 : current;
  const pixelImage = `${pixel.image}?v=${pixel.sha256.slice(0, 12)}`;
  const showsPixel = mode === "pixel" || mode === "compare";
  const showsMotion = mode === "animation";
  const hdAvailable = hasHdAnimations(current.id);
  const animationStyle = hdAvailable ? selection.animationStyle : "pixel";
  const showsPixelControls = showsPixel || (showsMotion && animationStyle === "pixel");
  const step = useCallback((direction: number) => {
    const active = readSelection(new URLSearchParams(window.location.search), classIds);
    const nextIndex = (classIds.indexOf(active.classId) + direction + classIds.length) % classIds.length;
    updateSelection({ classId: classIds[nextIndex] });
  }, [classIds, updateSelection]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.metaKey || event.ctrlKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("button, a, input, select, textarea, summary, [contenteditable]")) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        step(event.key === "ArrowRight" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const compareColumns = mode === "compare" && width >= 660 ? 3 : 1;
  const fit = Math.max(1, Math.min(Math.floor(400 / pixel.size[1]), Math.floor((width / compareColumns - 40) / pixel.size[0])));
  const pixelScale = zoom === 0 ? fit : Math.min(zoom, fit);
  const fileName = `${current.nameZh}-${current.genderLabel}`;
  const originalImage = `${current.originalImage}?v=${current.originalSha256.slice(0, 12)}`;
  const chibiImage = `${current.chibiImage}?v=${current.chibiSha256.slice(0, 12)}`;

  async function copy(hex: string) {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied({ hex, ok: true });
    } catch {
      setCopied({ hex, ok: false });
    }
  }

  return (
    <div className="character-browser">
      <nav className="profession-nav" aria-label="選擇職業">
        <div className="section-label">選擇職業 <span>{count} CLASSES</span></div>
        <div className="profession-list">
          {classes.map((profession, i) => (
            <button key={profession.classId} type="button" className={`profession-button ${i === index ? "selected" : ""}`}
              aria-pressed={i === index} onClick={() => setIndex(i)}>
              <Sprite src={characters.find((c) => c.classId === profession.classId && c.gender === gender)!.image}
                alt="" size={profession.size} className="profession-thumb" />
              <span><strong>{profession.nameZh}</strong><small>{profession.tagline}</small></span>
              <span className="profession-arrow" aria-hidden>›</span>
            </button>
          ))}
        </div>
        <p className="nav-hint">切換職業時，會保留你的性別與顯示選擇。</p>
      </nav>

      <section className="character-workspace" aria-label="角色預覽">
        <header className="character-heading">
          <div aria-live="polite">
            <p className="character-english">{current.nameEn}</p>
            <h2>{current.nameZh}<span>{current.genderLabel}性</span></h2>
          </div>
          <div className="segmented" role="group" aria-label="角色性別">
            <button type="button" aria-pressed={gender === "male"} onClick={() => setGender("male")}>男性</button>
            <button type="button" aria-pressed={gender === "female"} onClick={() => setGender("female")}>女性</button>
          </div>
        </header>

        <div className="preview-toolbar">
          <div className="segmented view-modes" role="group" aria-label="圖片顯示方式">
            {MODES.map((item) => <button type="button" key={item.id} aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}>{item.label}</button>)}
          </div>
          {((showsMotion && hdAvailable) || showsPixelControls) && <div className="toolbar-options">
            {showsMotion && hdAvailable && <div className="segmented compact" role="group" aria-label="動畫風格">
              <button type="button" aria-pressed={animationStyle === "pixel"} onClick={() => updateSelection({ animationStyle: "pixel" })}>像素</button>
              <button type="button" aria-pressed={animationStyle === "chibi"} onClick={() => updateSelection({ animationStyle: "chibi" })}>高清 Q 版</button>
              <button type="button" aria-pressed={animationStyle === "original"} onClick={() => updateSelection({ animationStyle: "original" })}>高清正常</button>
            </div>}
            {showsPixelControls && <div className="segmented compact" role="group" aria-label="像素尺寸">
              <button type="button" aria-pressed={pixelSize === 48} onClick={() => updateSelection({ pixelSize: 48 })}>48×48</button>
              <button type="button" aria-pressed={pixelSize === 96} onClick={() => updateSelection({ pixelSize: 96 })}>96×96</button>
            </div>}
          </div>}
        </div>

        <div ref={stageRef} style={{ gridTemplateColumns: `repeat(${compareColumns}, minmax(0, 1fr))` }}
          className={`art-stage backdrop-${background} ${mode === "compare" ? "comparing" : ""} ${compareColumns > 1 ? "comparing-wide" : ""}`}>
          {showsMotion && <AnimationViewer character={current} size={pixelSize} action={selection.action}
            style={animationStyle} scale={pixelScale} onAction={(action) => updateSelection({ action })} />}
          {showsPixel && (
            <figure className="art-panel">
              <figcaption>Q 版像素圖 <span>{pixel.size.join(" × ")}</span></figcaption>
              <div className="art-display">
                <div style={{ width: pixel.size[0] * pixelScale, height: pixel.size[1] * pixelScale, flexShrink: 0 }}>
                  <Sprite src={pixelImage} alt={`${current.nameZh}・${current.genderLabel}性 ${pixelSize}×${pixelSize} 像素圖`} size={pixel.size} className="w-full max-w-none" />
                </div>
              </div>
            </figure>
          )}
          {(mode === "chibi" || mode === "compare") && (
            <figure className="art-panel">
              <figcaption>高清 Q 版 <span>{current.chibiSize.join(" × ")}</span></figcaption>
              <div className="art-display">
                <img key={chibiImage} src={chibiImage} alt={`${current.nameZh}・${current.genderLabel}性高清 Q 版`}
                  width={current.chibiSize[0]} height={current.chibiSize[1]} loading="eager" draggable={false} className="original-art" />
              </div>
            </figure>
          )}
          {(mode === "original" || mode === "compare") && (
            <figure className="art-panel">
              <figcaption>高清正常版 <span>{current.originalSize[0]} × {current.originalSize[1]}</span></figcaption>
              <div className="art-display">
                <img key={originalImage} src={originalImage} alt={`${current.nameZh}・${current.genderLabel}性高解析原圖`}
                  width={current.originalSize[0]} height={current.originalSize[1]} loading="eager" draggable={false} className="original-art" />
              </div>
            </figure>
          )}
        </div>

        <div className="stage-controls">
          <div className="paging"><button type="button" aria-label="上一個職業" onClick={() => step(-1)}>←</button>
            <span>{index + 1} / {count}</span><button type="button" aria-label="下一個職業" onClick={() => step(1)}>→</button></div>
          <label className="background-picker">背景
            <span className="select-control">
            <select value={background} onChange={(e) => setBackground(e.target.value as Background)}>
              <option value="paper">淺色</option><option value="night">深色</option><option value="checker">透明格</option>
            </select>
            </span>
          </label>
          {showsPixelControls && <label className="background-picker">像素倍率
            <span className="select-control">
            <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
              <option value={0}>自動符合</option><option value={1}>1×</option><option value={2}>2×</option><option value={3}>3×</option><option value={4}>4×</option><option value={6}>6×</option><option value={8}>8×</option><option value={10}>10×</option>
            </select>
            </span><span className="actual-scale">目前 {pixelScale}×</span>
          </label>}
        </div>

        <div className="character-info">
          <div><p>{current.summary}</p><ul className="character-tags">{current.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul></div>
          <div className="downloads">
            <a href={chibiImage} download={`${fileName}-高清Q版.png`} className="download-primary">下載高清 Q 版 ↓</a>
            <div className="download-sizes" role="group" aria-label="其他下載格式">
              <a href={originalImage} download={`${fileName}-高清正常.png`}>高清正常</a>
              <a href={`${current.image}?v=${current.sha256.slice(0, 12)}`} download={`${fileName}-48px.png`}>48×48</a>
              <a href={`${current.pixel96.image}?v=${current.pixel96.sha256.slice(0, 12)}`} download={`${fileName}-96px.png`}>96×96</a>
            </div>
            <ShareLink key={searchParams.toString()} selection={selection}>
              <a href={chibiImage} target="_blank" rel="noreferrer" className="open-original">新分頁 ↗</a>
            </ShareLink>
          </div>
        </div>

        <SkillTree classId={current.classId} />

        {!showsMotion && <details className="asset-details" key={`${current.id}-${pixelSize}`}>
          <summary>素材資訊與色盤</summary>
          <p>像素圖：{pixel.size.join("×")} · {pixel.colors.length} 色 · 透明 PNG · 腳底基準 ({pixel.pivot.join(", ")})</p>
          <p>高清正常：{current.originalSize.join("×")} · 高清 Q 版：{current.chibiSize.join("×")} · 像素圖以 Q 版造型製作。</p>
          <div className="palette">{pixel.colors.map((hex) => <button key={hex} type="button" title={hex}
            aria-label={`複製色碼 ${hex}`} style={{ backgroundColor: hex }} onClick={() => copy(hex)} />)}</div>
          <p aria-live="polite">{!copied ? "點選色塊複製色碼" : !copied.ok ? "無法複製，請手動選取色碼" : pixel.colors.includes(copied.hex) ? `${copied.hex} 已複製` : "點選色塊複製色碼"}</p>
        </details>}
      </section>
    </div>
  );
}

function ShareLink({ selection, children }: { selection: ShowcaseSelection; children?: React.ReactNode }) {
  const [result, setResult] = useState<{ url: string; copied: boolean } | null>(null);

  async function copyLink() {
    const url = writeSelection(new URL(window.location.href), selection).href;
    try {
      await navigator.clipboard.writeText(url);
      setResult({ url, copied: true });
    } catch {
      setResult({ url, copied: false });
    }
  }

  return (
    <div className="share-control">
      <div className="share-row">
        <button type="button" onClick={copyLink} className="share-button">複製連結</button>
        {children}
      </div>
      {result && <p role="status" className="share-status">{result.copied ? "已複製目前角色與展示設定" : "請複製下方連結"}</p>}
      {result && !result.copied && <input aria-label="分享連結" readOnly value={result.url}
        className="share-url" onFocus={(event) => event.target.select()} />}
    </div>
  );
}
