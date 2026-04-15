import { useState, useEffect, useCallback } from "react";

const HERO_IMAGES = [
  { src: "/hero/forest.webp", alt: "Mountain lake vista through pine trees" },
  { src: "/hero/park.webp", alt: "Lush tropical park with banyan trees" },
  { src: "/hero/desert.webp", alt: "Desert trail with saguaro cactus" },
];

const CYCLE_MS = 8000;
const FADE_MS = 3000;

export function HeroGallery({ className = "" }: { className?: string }) {
  const [active, setActive] = useState(0);

  const advance = useCallback(() => {
    setActive((i) => (i + 1) % HERO_IMAGES.length);
  }, []);

  useEffect(() => {
    const id = setInterval(advance, CYCLE_MS);
    return () => clearInterval(id);
  }, [advance]);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {HERO_IMAGES.map((img, i) => (
        <div
          key={img.src}
          className="absolute inset-0"
          style={{
            opacity: i === active ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease-in-out`,
          }}
        >
          {/* Each image continuously pans via CSS animation — no JS transform swaps */}
          <img
            src={img.src}
            alt={img.alt}
            className={`absolute inset-0 w-full h-full object-cover hero-pan-${i % 2 === 0 ? "right" : "left"}`}
            loading={i === 0 ? "eager" : "lazy"}
            decoding={i === 0 ? "sync" : "async"}
          />
        </div>
      ))}

      {/* Dark gradient overlay for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/40" />

      {/* Film grain noise texture */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.3 }}>
        <filter id="hero-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#hero-grain)" />
      </svg>
    </div>
  );
}
