type Props = {
  src: string;
  alt: string;
  size: [number, number];
  className?: string;
};

// Pixel art is scaled with nearest-neighbor so it stays crisp.
export function Sprite({ src, alt, size, className = "" }: Props) {
  return (
    <img
      src={src}
      alt={alt}
      width={size[0]}
      height={size[1]}
      draggable={false}
      className={`h-auto select-none [image-rendering:pixelated] ${className}`}
    />
  );
}
