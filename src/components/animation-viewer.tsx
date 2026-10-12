import { useEffect, useState, useSyncExternalStore } from "react";
import { Sprite } from "@/components/sprite";
import { frameUrl, getAnimations, type Animation } from "@/lib/animations";
import type { Character } from "@/lib/characters";
import type { ActionId, AnimationStyle } from "@/lib/showcase-query";

function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const readReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const serverReducedMotion = () => true;

export function AnimationViewer({ character, size, action, scale, style, onAction }: {
  character: Character; size: 48 | 96; action: ActionId; scale: number; style: AnimationStyle; onAction: (id: ActionId) => void;
}) {
  const variant = getAnimations(character.id, size, style);
  const current = variant.actions.find((item) => item.id === action)!;
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, serverReducedMotion);
  const [playPreference, setPlayPreference] = useState<boolean | null>(null);
  const playing = playPreference ?? !reducedMotion;
  const name = `${character.nameZh}・${character.genderLabel}`;
  const styleName = style === "pixel" ? "Q版像素" : style === "chibi" ? "高清Q版" : "高清正常";

  return (
    <div className="animation-viewer">
      <div className="motion-actions" role="group" aria-label="選擇動作">
        {variant.actions.map((item) => <button type="button" key={item.id} aria-pressed={item.id === action}
          onClick={() => onAction(item.id)}><strong>{item.label}</strong><small>{item.id.toUpperCase()}</small></button>)}
      </div>
      <FramePlayer key={`${character.id}-${style}-${variant.size[0]}-${action}`} animation={current} size={variant.size[0]} scale={scale}
        pixelated={style === "pixel"}
        name={name} playing={playing} setPlaying={setPlayPreference} />
      <div className="animation-downloads">
        <a href={`${current.gif}?v=${current.sha256.slice(0, 12)}`} download={`${name}-${styleName}-${current.label}-${variant.size[0]}px.gif`}
          className="download-primary">下載 {current.label} GIF ↓</a>
        <a href={variant.sheet} download={`${name}-${styleName}-全部動作-${variant.size[0]}px.png`}>下載全部動作表 PNG ↓</a>
      </div>
    </div>
  );
}

function FramePlayer({ animation, name, size, scale, pixelated, playing, setPlaying }: {
  animation: Animation; name: string; size: number; scale: number; pixelated: boolean; playing: boolean; setPlaying: (value: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Cache the same four poses encoded in the downloadable GIF.
    let active = true;
    const loaded = animation.frames.map((_, frame) => {
      const image = new window.Image();
      image.src = frameUrl(animation, frame);
      return image.decode().catch(() => undefined);
    });
    Promise.all(loaded).then(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [animation]);

  useEffect(() => {
    if (!playing || !ready) return;
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % animation.frameCount), animation.durations[index]);
    return () => window.clearTimeout(timer);
  }, [animation, index, playing, ready]);

  const selectFrame = (value: number) => {
    setPlaying(false);
    setIndex(value);
  };

  return (
    <>
      <figure className="art-panel">
        <figcaption>{animation.label}<span>{size} × {size} · {animation.frameCount} 格 · {(animation.durations.reduce((a, b) => a + b, 0) / 1000).toFixed(2)} 秒</span></figcaption>
        <div className="art-display">
          <div style={{ width: pixelated ? size * scale : "min(400px, calc(100cqw - 32px))", aspectRatio: "1 / 1", flexShrink: 0 }}>
            <AnimationFrame src={frameUrl(animation, index)} pixelated={pixelated}
              alt={`${name} ${animation.label}動畫，第 ${index + 1} 格`} size={size} className="w-full max-w-none" />
          </div>
        </div>
      </figure>
      <div className="motion-controls">
        <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? "暫停動畫" : "播放動畫"}>
          {playing ? "暫停 ‖" : "播放 ▶"}</button>
        <button type="button" aria-label="上一格" onClick={() => selectFrame((index + animation.frameCount - 1) % animation.frameCount)}>←</button>
        <span>第 {index + 1} / {animation.frameCount} 格</span>
        <button type="button" aria-label="下一格" onClick={() => selectFrame((index + 1) % animation.frameCount)}>→</button>
      </div>
      <div className="motion-frames" role="group" aria-label="逐格檢視">
        {animation.frames.map((src, frame) => <button type="button" key={src} aria-pressed={frame === index}
          aria-label={`檢視第 ${frame + 1} 格`} onClick={() => selectFrame(frame)}>
          <AnimationFrame src={frameUrl(animation, frame)} pixelated={pixelated} alt="" size={size} />
          <span>{frame + 1}<small>{animation.durations[frame]} ms</small></span>
        </button>)}
      </div>
    </>
  );
}

function AnimationFrame({ src, alt, size, pixelated, className = "" }: {
  src: string; alt: string; size: number; pixelated: boolean; className?: string;
}) {
  return pixelated ? <Sprite src={src} alt={alt} size={[size, size]} className={className} />
    : <img src={src} alt={alt} width={size} height={size} draggable={false}
      className={`h-auto select-none [image-rendering:auto] ${className}`} />;
}
