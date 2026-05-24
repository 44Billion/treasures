import { DesktopHeader } from "@/components/DesktopHeader";
import { DittoIcon } from "@/components/icons/DittoIcon";

const TROLL_IMAGE_URL = "/treasure-trolls.png";

/** Deep, rich purple chosen as the page backdrop. The new troll image is a
 *  transparent PNG so it composites cleanly on any color we pick. */
const TROLL_PURPLE = "#3d1a5e";

/** Fun, saturated pop-art palette used for confetti, glows, and accents. */
const POP_COLORS = [
  "#ff3ea5", // hot pink
  "#ff7a1a", // orange
  "#ffd23f", // yellow
  "#3ddc97", // mint
  "#3ec1ff", // cyan
  "#a26dff", // violet
];

/** Generate a deterministic pseudo-random number for confetti placement so
 *  positions don't shift between renders. */
function rand(seed: number, salt: number): number {
  const x = Math.sin(seed * 9973 + salt * 31) * 10000;
  return x - Math.floor(x);
}

/** Floating pop-art confetti — colored circles & stars drifting up the page. */
function PopConfetti({ count = 28 }: { count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => {
    const color = POP_COLORS[i % POP_COLORS.length];
    const left = rand(i, 1) * 100;
    const size = 8 + rand(i, 2) * 18; // 8–26px
    const duration = 14 + rand(i, 3) * 12; // 14–26s
    const delay = -rand(i, 4) * 20;
    const drift = (rand(i, 5) - 0.5) * 30; // -15 to +15vw
    const rotate = rand(i, 6) * 720;
    const shape = rand(i, 7);
    const startTop = 100 + rand(i, 8) * 20; // start below viewport
    return { color, left, size, duration, delay, drift, rotate, shape, startTop, i };
  });

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
    >
      {pieces.map((p) => {
        // Pick shape: circle, square, star, sparkle
        let inner: React.ReactNode = null;
        if (p.shape < 0.4) {
          inner = (
            <span
              style={{
                width: p.size,
                height: p.size,
                background: p.color,
                borderRadius: "50%",
                boxShadow: `0 0 ${p.size * 0.6}px ${p.color}aa`,
                display: "block",
              }}
            />
          );
        } else if (p.shape < 0.65) {
          inner = (
            <span
              style={{
                width: p.size,
                height: p.size,
                background: p.color,
                borderRadius: 4,
                boxShadow: `0 0 ${p.size * 0.5}px ${p.color}aa`,
                display: "block",
                transform: "rotate(45deg)",
              }}
            />
          );
        } else {
          // Star/sparkle (CSS 4-pointed)
          inner = (
            <span
              style={{
                width: p.size,
                height: p.size,
                background: p.color,
                clipPath:
                  "polygon(50% 0%, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0% 50%, 40% 40%)",
                filter: `drop-shadow(0 0 ${p.size * 0.4}px ${p.color})`,
                display: "block",
              }}
            />
          );
        }

        return (
          <span
            key={p.i}
            style={{
              position: "absolute",
              top: `${p.startTop}%`,
              left: `${p.left}%`,
              animation: `troll-confetti-float ${p.duration}s linear ${p.delay}s infinite`,
              ["--drift" as never]: `${p.drift}vw`,
              ["--end-rot" as never]: `${p.rotate}deg`,
              willChange: "transform, opacity",
            }}
          >
            {inner}
          </span>
        );
      })}
    </div>
  );
}

/**
 * Teaser page for the upcoming "Treasure Trolls" feature.
 * A saturated purple aurora backdrop, pop-art confetti rising from below,
 * a bouncing troll centerpiece, gradient pop-art headline, an animated
 * Oslo-tree silhouette horizon, and drifting fog across the bottom.
 */
export default function TreasuresTrolls() {
  return (
    <>
      <DesktopHeader />

      <style>{`
        @keyframes troll-fog-drift {
          0%   { transform: translate3d(-18%, 0, 0); }
          50%  { transform: translate3d(18%, 0, 0); }
          100% { transform: translate3d(-18%, 0, 0); }
        }
        @keyframes troll-fog-drift-rev {
          0%   { transform: translate3d(16%, 0, 0); }
          50%  { transform: translate3d(-20%, 0, 0); }
          100% { transform: translate3d(16%, 0, 0); }
        }
        @keyframes troll-bounce {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-0.5deg); }
          50%      { transform: translate3d(0, -12px, 0) rotate(0.5deg); }
        }
        @keyframes troll-wiggle {
          0%, 100% { transform: rotate(-1.5deg); }
          50%      { transform: rotate(1.5deg); }
        }
        @keyframes troll-headline-pop {
          0%, 100% { transform: scale(1) rotate(-1deg); }
          50%      { transform: scale(1.02) rotate(1deg); }
        }
        @keyframes troll-aurora-shift {
          0%   { transform: translate3d(0, 0, 0) rotate(0deg); }
          50%  { transform: translate3d(2%, -3%, 0) rotate(2deg); }
          100% { transform: translate3d(0, 0, 0) rotate(0deg); }
        }
        @keyframes troll-confetti-float {
          0%   { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translate3d(var(--drift), -130vh, 0) rotate(var(--end-rot)); opacity: 0; }
        }
        @keyframes troll-sparkle-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      <div
        className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-start px-4 pt-10 md:pt-16 pb-32"
        style={{ background: TROLL_PURPLE }}
      >
        {/* Colorful aurora — large soft blobs that shift slowly. Sits above
            the base purple but below everything else. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        >
          <div
            className="absolute -top-32 -left-32 w-[55vw] h-[55vw] rounded-full blur-3xl opacity-60"
            style={{
              background:
                "radial-gradient(circle, #ff3ea5 0%, rgba(255,62,165,0) 70%)",
              animation: "troll-aurora-shift 18s ease-in-out infinite",
            }}
          />
          <div
            className="absolute -top-24 -right-32 w-[60vw] h-[60vw] rounded-full blur-3xl opacity-50"
            style={{
              background:
                "radial-gradient(circle, #3ec1ff 0%, rgba(62,193,255,0) 70%)",
              animation: "troll-aurora-shift 22s ease-in-out infinite reverse",
            }}
          />
          <div
            className="absolute top-1/3 left-1/4 w-[45vw] h-[45vw] rounded-full blur-3xl opacity-45"
            style={{
              background:
                "radial-gradient(circle, #ffd23f 0%, rgba(255,210,63,0) 70%)",
              animation: "troll-aurora-shift 24s ease-in-out infinite",
            }}
          />
          <div
            className="absolute bottom-1/4 right-1/4 w-[50vw] h-[50vw] rounded-full blur-3xl opacity-50"
            style={{
              background:
                "radial-gradient(circle, #3ddc97 0%, rgba(61,220,151,0) 70%)",
              animation: "troll-aurora-shift 20s ease-in-out infinite reverse",
            }}
          />
        </div>

        {/* PageHero-style dotted trail lines */}
        <svg
          className="pointer-events-none absolute inset-0 w-full h-full z-[1] opacity-[0.18] text-white"
          viewBox="0 0 200 100"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <path
            d="M -5,20 C 15,10 30,12 50,22 C 70,32 85,8 110,16 C 135,24 155,12 180,20 C 195,24 200,18 210,20"
            stroke="currentColor" strokeWidth="1.2" fill="none" strokeDasharray="4,3" strokeLinecap="round"
          />
          <path
            d="M -5,50 C 10,40 25,38 45,48 C 65,58 80,36 105,44 C 130,52 145,38 170,46 C 190,52 200,44 210,48"
            stroke="currentColor" strokeWidth="1" fill="none" strokeDasharray="3,4" strokeLinecap="round"
          />
          <path
            d="M -5,80 C 20,70 40,72 60,82 C 80,92 95,66 120,74 C 145,82 160,70 180,78 C 195,84 200,76 210,80"
            stroke="currentColor" strokeWidth="1.2" fill="none" strokeDasharray="4,3" strokeLinecap="round"
          />
          <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="137" y1="5" x2="143" y2="11" />
            <line x1="143" y1="5" x2="137" y2="11" />
            <line x1="42" y1="76" x2="48" y2="82" />
            <line x1="48" y1="76" x2="42" y2="82" />
          </g>
          <circle cx="50" cy="22" r="1.8" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <circle cx="120" cy="74" r="1.8" fill="none" stroke="currentColor" strokeWidth="0.8" />
        </svg>

        {/* Pop-art confetti drifting up across the page */}
        <PopConfetti count={32} />

        {/* "BitPopArt x Treasures" presenter line at the top */}
        <div
          className="relative z-10 mb-6 md:mb-8 text-center text-xl md:text-3xl font-black uppercase tracking-[0.18em] text-white"
          style={{
            textShadow: [
              "-4px -4px 0 #000", "4px -4px 0 #000", "-4px 4px 0 #000", "4px 4px 0 #000",
              "-4px 0 0 #000", "4px 0 0 #000", "0 -4px 0 #000", "0 4px 0 #000",
              "-4px -2px 0 #000", "4px -2px 0 #000", "-4px 2px 0 #000", "4px 2px 0 #000",
              "-2px -4px 0 #000", "2px -4px 0 #000", "-2px 4px 0 #000", "2px 4px 0 #000",
              "0 6px 10px rgba(0,0,0,0.5)",
            ].join(", "),
          }}
        >
          <span style={{ color: "#ffd23f" }}>BitPopArt</span>
          <span className="mx-2" style={{ color: "#ff3ea5" }}>×</span>
          <span style={{ color: "#3ec1ff" }}>Treasures</span>
        </div>

        {/* Centered image — wrapped in a wobble animator with a colorful
            glow halo behind it so the troll really pops off the page. */}
        <div className="relative z-10 w-full max-w-2xl md:max-w-3xl">
          {/* Color halo */}
          <div
            aria-hidden="true"
            className="absolute inset-0 blur-3xl opacity-70 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 30% 40%, #ff3ea5 0%, transparent 55%), radial-gradient(ellipse at 70% 60%, #3ec1ff 0%, transparent 55%), radial-gradient(ellipse at 50% 80%, #ffd23f 0%, transparent 60%)",
            }}
          />
          {/* Spinning sparkle accents */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-4 -left-2 md:-top-6 md:-left-6"
            style={{ animation: "troll-sparkle-spin 8s linear infinite" }}
          >
            <Sparkle size={48} color="#ffd23f" />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-2 right-0 md:-top-4 md:right-4"
            style={{ animation: "troll-sparkle-spin 11s linear infinite reverse" }}
          >
            <Sparkle size={38} color="#ff3ea5" />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-6 -right-4 md:bottom-12 md:-right-8"
            style={{ animation: "troll-sparkle-spin 9s linear infinite" }}
          >
            <Sparkle size={42} color="#3ddc97" />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-2 left-2 md:bottom-8 md:left-6"
            style={{ animation: "troll-sparkle-spin 13s linear infinite reverse" }}
          >
            <Sparkle size={36} color="#3ec1ff" />
          </div>

          <img
            src={TROLL_IMAGE_URL}
            alt="Treasure Trolls"
            loading="eager"
            className="relative block w-full h-auto"
            style={{
              animation: "troll-bounce 4.5s ease-in-out infinite",
              filter: "drop-shadow(0 16px 40px rgba(0,0,0,0.55))",
            }}
          />
        </div>

        {/* Text below the image */}
        <div className="relative z-10 mt-10 md:mt-12 text-center max-w-3xl mx-auto px-4">
          <h1
            className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mb-6 inline-block"
            style={{
              backgroundImage:
                "linear-gradient(180deg, #ffffff 0%, #ffd23f 35%, #ff7a1a 65%, #ff3ea5 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              filter: [
                "drop-shadow(-3px -3px 0 #000)",
                "drop-shadow(3px -3px 0 #000)",
                "drop-shadow(-3px 3px 0 #000)",
                "drop-shadow(3px 3px 0 #000)",
                "drop-shadow(-3px 0 0 #000)",
                "drop-shadow(3px 0 0 #000)",
                "drop-shadow(0 -3px 0 #000)",
                "drop-shadow(0 3px 0 #000)",
                "drop-shadow(0 10px 20px rgba(0,0,0,0.5))",
              ].join(" "),
              animation: "troll-headline-pop 5s ease-in-out infinite",
            }}
          >
            12 Trolls Hidden Across Oslo
          </h1>
          <p className="text-lg md:text-2xl font-semibold text-white leading-relaxed [text-shadow:0_2px_6px_rgba(0,0,0,0.55)]">
            A mythical journey through Oslo, Norway is beginning shortly. Twelve
            trolls lie waiting in the city's quiet corners.
            <br />
            <span
              className="inline-block font-black uppercase tracking-wider"
              style={{
                color: "#ffd23f",
                textShadow:
                  "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 4px 8px rgba(0,0,0,0.5)",
                animation: "troll-wiggle 2.5s ease-in-out infinite",
              }}
            >
              Find them all!
            </span>
          </p>

          {/* Credit buttons */}
          <div className="mt-8 md:mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://www.bitpopart.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full text-white hover:scale-105 active:scale-95 transition-transform px-5 py-2.5 text-sm md:text-base font-black uppercase tracking-wider shadow-lg shadow-black/50"
              style={{
                background:
                  "linear-gradient(135deg, #ff7a1a 0%, #ff3ea5 100%)",
                border: "2px solid #000",
              }}
            >
              <img
                src="https://www.bitpopart.com/B-Funny_avatar_orange.svg"
                alt=""
                aria-hidden="true"
                className="h-5 w-5 md:h-6 md:w-6 drop-shadow"
              />
              bitpopart.com
            </a>
            <a
              href="https://ditto.pub/npub1gwa27rpgum8mr9d30msg8cv7kwj2lhav2nvmdwh3wqnsa5vnudxqlta2sz"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 rounded-full text-white hover:scale-105 active:scale-95 transition-transform px-5 py-2.5 text-sm md:text-base font-black uppercase tracking-wider shadow-lg shadow-black/50"
              style={{
                background:
                  "linear-gradient(135deg, #3ec1ff 0%, #a26dff 100%)",
                border: "2px solid #000",
              }}
            >
              <DittoIcon className="h-5 w-5 md:h-6 md:w-6" />
              BitPopArt on Ditto
            </a>
          </div>
        </div>

        {/* Oslo trees lining the bottom of the page */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] h-[28rem] md:h-[36rem] overflow-hidden"
          style={{ mixBlendMode: "darken" }}
        >
          <img
            src="/oslo-trees.jpg"
            alt=""
            className="absolute inset-x-0 bottom-0 w-full h-full object-cover object-bottom"
            style={{
              WebkitMaskImage:
                "linear-gradient(to top, #000 30%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.4) 80%, rgba(0,0,0,0) 100%)",
              maskImage:
                "linear-gradient(to top, #000 30%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.4) 80%, rgba(0,0,0,0) 100%)",
            }}
          />
        </div>

        {/* Fog along the bottom */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[28rem] md:h-[36rem] z-[5] overflow-hidden"
        >
          <div
            className="absolute -left-[60%] -right-[60%] bottom-0 h-full"
            style={{
              background:
                "radial-gradient(ellipse at 50% 100%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.14) 35%, rgba(255,255,255,0) 70%)",
              filter: "blur(22px)",
              animation: "troll-fog-drift 16s ease-in-out infinite",
            }}
          />
          <div
            className="absolute -left-[60%] -right-[60%] bottom-0 h-3/4"
            style={{
              background:
                "radial-gradient(ellipse at 30% 100%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 65%), radial-gradient(ellipse at 75% 100%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 60%)",
              filter: "blur(16px)",
              animation: "troll-fog-drift-rev 12s ease-in-out infinite",
            }}
          />
          <div
            className="absolute -left-[60%] -right-[60%] bottom-0 h-1/2"
            style={{
              background:
                "linear-gradient(to top, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.16) 45%, rgba(255,255,255,0) 100%)",
              filter: "blur(12px)",
              animation: "troll-fog-drift 9s ease-in-out infinite",
            }}
          />
        </div>
      </div>
    </>
  );
}

/** Simple 4-pointed sparkle shape used around the troll image. */
function Sparkle({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      style={{ filter: `drop-shadow(0 0 ${size * 0.3}px ${color})` }}
    >
      <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" />
    </svg>
  );
}
