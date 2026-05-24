import { DesktopHeader } from "@/components/DesktopHeader";
import { DittoIcon } from "@/components/icons/DittoIcon";

const TROLL_IMAGE_URL = "/treasure-trolls.png";

/** Deep, rich purple chosen as the page backdrop. The new troll image is a
 *  transparent PNG so it composites cleanly on any color we pick. */
const TROLL_PURPLE = "#3d1a5e";

/**
 * Teaser page for the upcoming "Treasure Trolls" feature.
 * Solid purple background that matches the image. The image is centered
 * at a comfortable size with text below announcing the Oslo, Norway hunt.
 * Animated fog rolls along the bottom edge of the page.
 */
export default function TreasuresTrolls() {
  return (
    <>
      <DesktopHeader />

      <div
        className="relative min-h-screen w-full overflow-hidden flex flex-col items-center justify-start px-4 pt-10 md:pt-16 pb-32"
        style={{ background: TROLL_PURPLE }}
      >
        {/* PageHero-style dotted trail lines, sitting at the bottom of the
            z-stack so they're behind the trolls, trees, and fog. */}
        <svg
          className="pointer-events-none absolute inset-0 w-full h-full z-0 opacity-[0.12] text-white"
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

        {/* "BitPopArt x Treasures" presenter line at the top */}
        <div
          className="relative z-10 mb-6 md:mb-8 text-center text-xl md:text-3xl font-black uppercase tracking-[0.18em] text-white"
          style={{
            textShadow: [
              // thick black stroke (~4px)
              "-4px -4px 0 #000", "4px -4px 0 #000", "-4px 4px 0 #000", "4px 4px 0 #000",
              "-4px 0 0 #000", "4px 0 0 #000", "0 -4px 0 #000", "0 4px 0 #000",
              "-4px -2px 0 #000", "4px -2px 0 #000", "-4px 2px 0 #000", "4px 2px 0 #000",
              "-2px -4px 0 #000", "2px -4px 0 #000", "-2px 4px 0 #000", "2px 4px 0 #000",
              // soft drop shadow
              "0 6px 10px rgba(0,0,0,0.5)",
            ].join(", "),
          }}
        >
          BitPopArt <span className="text-purple-200">×</span> Treasures
        </div>

        {/* Centered image — sized comfortably for the page */}
        <img
          src={TROLL_IMAGE_URL}
          alt="Treasure Trolls"
          loading="eager"
          className="relative z-10 block w-full max-w-2xl md:max-w-3xl h-auto"
        />

        {/* Text below the image */}
        <div className="relative z-10 mt-10 md:mt-12 text-center max-w-3xl mx-auto px-4">
          <h1
            className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight text-white mb-6"
            style={{
              textShadow: [
                // thick black stroke (~6px)
                "-6px -6px 0 #000", "6px -6px 0 #000", "-6px 6px 0 #000", "6px 6px 0 #000",
                "-6px 0 0 #000", "6px 0 0 #000", "0 -6px 0 #000", "0 6px 0 #000",
                "-6px -3px 0 #000", "6px -3px 0 #000", "-6px 3px 0 #000", "6px 3px 0 #000",
                "-3px -6px 0 #000", "3px -6px 0 #000", "-3px 6px 0 #000", "3px 6px 0 #000",
                // soft drop shadow
                "0 10px 20px rgba(0,0,0,0.5)",
              ].join(", "),
            }}
          >
            12 Trolls Hidden Across Oslo
          </h1>
          <p className="text-lg md:text-2xl font-semibold text-white leading-relaxed [text-shadow:0_2px_6px_rgba(0,0,0,0.55)]">
            A mythical journey through Oslo, Norway is beginning shortly. Twelve
            trolls lie waiting in the city's quiet corners.
            <br />
            Find them all.
          </p>

          {/* Credit buttons — link to the artist's site and Ditto profile */}
          <div className="mt-8 md:mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://www.bitpopart.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white text-purple-900 hover:bg-purple-50 transition-colors px-5 py-2.5 text-sm md:text-base font-bold uppercase tracking-wider shadow-lg shadow-black/40"
            >
              <img
                src="https://www.bitpopart.com/B-Funny_avatar_orange.svg"
                alt=""
                aria-hidden="true"
                className="h-5 w-5 md:h-6 md:w-6"
              />
              bitpopart.com
            </a>
            <a
              href="https://ditto.pub/npub1gwa27rpgum8mr9d30msg8cv7kwj2lhav2nvmdwh3wqnsa5vnudxqlta2sz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border-2 border-white/90 text-white hover:bg-white/10 transition-colors px-5 py-2.5 text-sm md:text-base font-bold uppercase tracking-wider shadow-lg shadow-black/40 backdrop-blur-sm"
            >
              <DittoIcon className="h-4 w-4 md:h-5 md:w-5" />
              BitPopArt on Ditto
            </a>
          </div>
        </div>

        {/* Oslo trees lining the bottom of the page. Darken blend on the
            container so the purple bleeds through the silhouettes. Taller
            now, with a large gradient fade at the top so the treeline melts
            up into the page. Sits below the fog so the fog drifts in front
            of the treeline. */}
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

        {/* Fog along the bottom of the page */}
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
        `}</style>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[28rem] md:h-[36rem] z-[5] overflow-hidden"
        >
          {/* Back fog layer — slow, broad. Layers are oversized well past
              the sway amplitude so the edges never enter the viewport. */}
          <div
            className="absolute -left-[60%] -right-[60%] bottom-0 h-full"
            style={{
              background:
                "radial-gradient(ellipse at 50% 100%, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.14) 35%, rgba(255,255,255,0) 70%)",
              filter: "blur(22px)",
              animation: "troll-fog-drift 16s ease-in-out infinite",
            }}
          />
          {/* Middle fog layer — medium */}
          <div
            className="absolute -left-[60%] -right-[60%] bottom-0 h-3/4"
            style={{
              background:
                "radial-gradient(ellipse at 30% 100%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 65%), radial-gradient(ellipse at 75% 100%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 60%)",
              filter: "blur(16px)",
              animation: "troll-fog-drift-rev 12s ease-in-out infinite",
            }}
          />
          {/* Front fog layer — denser, closer to the bottom edge */}
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
