import { useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useActiveProfileTheme, type DittoThemeColors, type DittoThemeFont } from '@/hooks/useActiveProfileTheme';

/** Check if an HSL background represents a dark theme (luminance < 0.2). */
function isDarkBackground(hsl: string): boolean {
  const parts = hsl.trim().replace(/%/g, '').split(/\s+/).map(Number);
  const h = parts[0], s = parts[1] / 100, l = parts[2] / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const [r, g, b] = [f(0), f(8), f(4)];
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance < 0.2;
}

function toLinear(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Adjust lightness of an HSL string. */
function adjustLightness(hsl: string, delta: number): string {
  const parts = hsl.trim().replace(/%/g, '').split(/\s+/).map(Number);
  const l = Math.max(0, Math.min(100, parts[2] + delta));
  return `${parts[0]} ${parts[1]}% ${Math.round(l * 10) / 10}%`;
}

/** Get a contrast foreground (white or dark) for a given background. */
function contrastForeground(bgHsl: string): string {
  return isDarkBackground(bgHsl) ? '0 0% 100%' : '222.2 84% 4.9%';
}

/**
 * Derive the full set of CSS custom properties from 3 core Ditto theme colors.
 * Mirrors the derivation logic from Ditto's `deriveTokensFromCore()`.
 */
function deriveCssVars(colors: DittoThemeColors): Record<string, string> {
  const { background, text, primary } = colors;
  const dark = isDarkBackground(background);

  // Parse primary hue/saturation for border derivation
  const pParts = primary.trim().replace(/%/g, '').split(/\s+/).map(Number);
  const pH = pParts[0];
  const pS = pParts[1];

  const card = dark ? adjustLightness(background, 2) : background;
  const popover = dark ? adjustLightness(background, 2) : background;
  const secondary = dark ? adjustLightness(background, 8) : adjustLightness(background, -4);
  const muted = dark ? adjustLightness(background, 8) : adjustLightness(background, -4);
  const border = dark
    ? `${pH} ${Math.round(pS * 0.4)}% 30%`
    : `${pH} ${Math.round(pS * 0.5)}% 82%`;

  // Muted foreground: dimmer text
  const fParts = text.trim().replace(/%/g, '').split(/\s+/).map(Number);
  const mutedFg = dark
    ? `${fParts[0]} ${Math.max(fParts[1] - 20, 0)}% ${Math.max(fParts[2] - 30, 40)}%`
    : `${fParts[0]} ${Math.max(fParts[1] - 30, 0)}% ${Math.min(fParts[2] + 35, 55)}%`;

  const primaryFg = contrastForeground(primary);
  const destructive = dark ? '0 72% 51%' : '0 84.2% 60.2%';
  const destructiveFg = dark ? '0 0% 95%' : '210 40% 98%';

  return {
    '--background': background,
    '--foreground': text,
    '--card': card,
    '--card-foreground': text,
    '--popover': popover,
    '--popover-foreground': text,
    '--primary': primary,
    '--primary-foreground': primaryFg,
    '--secondary': secondary,
    '--secondary-foreground': text,
    '--muted': muted,
    '--muted-foreground': mutedFg,
    '--accent': primary,
    '--accent-foreground': primaryFg,
    '--destructive': destructive,
    '--destructive-foreground': destructiveFg,
    '--border': border,
    '--input': border,
    '--ring': primary,
    '--success': dark ? '152 48% 45%' : '152 55% 36%',
    '--success-foreground': '0 0% 100%',
  };
}

// ─── Font Loading ─────────────────────────────────────────────────────

const STYLE_ID_FONT_FACES = 'ditto-font-faces';
const STYLE_ID_BODY_FONT = 'ditto-body-font';
const STYLE_ID_TITLE_FONT = 'ditto-title-font';

/** Load a font via Google Fonts CSS link element. */
function loadGoogleFont(family: string, linkId: string): void {
  if (document.getElementById(linkId)) return;
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@300;400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

/** Inject a @font-face rule (or Google Fonts link) and apply a global font-family override. */
function applyFont(
  font: DittoThemeFont | undefined,
  styleId: string,
  cssSelector: string,
) {
  const existing = document.getElementById(styleId) as HTMLStyleElement | null;
  const linkId = styleId + '-link';

  if (!font) {
    existing?.remove();
    document.getElementById(linkId)?.remove();
    return;
  }

  let css = '';
  if (font.url) {
    // Remote font file -- inject @font-face
    const format = font.url.endsWith('.woff2') ? 'woff2'
      : font.url.endsWith('.woff') ? 'woff'
      : font.url.endsWith('.ttf') ? 'truetype'
      : font.url.endsWith('.otf') ? 'opentype'
      : 'woff2';
    css += `@font-face { font-family: "${font.family}"; src: url("${font.url}") format("${format}"); font-display: swap; }\n`;
  } else {
    // No URL -- try Google Fonts as a fallback
    loadGoogleFont(font.family, linkId);
  }
  css += `${cssSelector} { font-family: "${font.family}", "Inter Variable", "Inter", system-ui, sans-serif !important; }`;

  let el = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = styleId;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

function cleanupFonts() {
  [STYLE_ID_FONT_FACES, STYLE_ID_BODY_FONT, STYLE_ID_TITLE_FONT].forEach(id => {
    document.getElementById(id)?.remove();
    document.getElementById(id + '-link')?.remove();
  });
}

/**
 * Injects dynamic CSS custom properties and fonts when the "ditto" theme is active.
 * The variables are derived from the user's kind 16767 active profile theme event.
 *
 * This component renders nothing — it only produces a side effect via useEffect.
 * Mount it inside the provider tree, after NostrProvider is available.
 */
export function DittoThemeInjector() {
  const { resolvedTheme } = useTheme();
  const { profileTheme } = useActiveProfileTheme();

  // CSS custom properties + dark/light detection
  useEffect(() => {
    if (resolvedTheme !== 'ditto' || !profileTheme) {
      const existing = document.getElementById('ditto-theme-vars');
      if (existing) existing.remove();
      document.documentElement.classList.remove('ditto-dark');
      return;
    }

    const dark = isDarkBackground(profileTheme.colors.background);

    // Toggle ditto-dark class for dark/light awareness
    if (dark) {
      document.documentElement.classList.add('ditto-dark');
    } else {
      document.documentElement.classList.remove('ditto-dark');
    }

    const vars = deriveCssVars(profileTheme.colors);
    const cssText = Object.entries(vars)
      .map(([k, v]) => `${k}: ${v};`)
      .join(' ');

    let el = document.getElementById('ditto-theme-vars') as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = 'ditto-theme-vars';
      document.head.appendChild(el);
    }
    // Derive a hue-rotate filter to tint the green Treasures logo toward the theme primary.
    // Original logo hue is ~152deg (green). We shift to the primary hue.
    const primaryParts = profileTheme.colors.primary.trim().replace(/%/g, '').split(/\s+/).map(Number);
    const primaryHue = primaryParts[0] || 0;
    const hueShift = primaryHue - 152; // green logo baseline
    const logoFilter = `sepia(1) hue-rotate(${hueShift}deg) saturate(2.5) brightness(0.85)`;

    // Image inversion for dark ditto themes (mirrors dark:invert behavior)
    const darkImageRule = dark
      ? '.ditto-dark .ditto-invert { filter: invert(1); mix-blend-mode: normal; }'
      : '.ditto .ditto-invert { mix-blend-mode: multiply; }';

    el.textContent = `.ditto { ${cssText} }\n.ditto .ditto-logo { filter: ${logoFilter}; }\n${darkImageRule}`;

    return () => {
      el?.remove();
      document.documentElement.classList.remove('ditto-dark');
    };
  }, [resolvedTheme, profileTheme]);

  // Font injection
  useEffect(() => {
    if (resolvedTheme !== 'ditto' || !profileTheme) {
      cleanupFonts();
      return;
    }

    // Body font: applies to all text under .ditto
    applyFont(profileTheme.font, STYLE_ID_BODY_FONT, '.ditto');

    // Title font: applies to headings under .ditto
    applyFont(
      profileTheme.titleFont,
      STYLE_ID_TITLE_FONT,
      '.ditto h1, .ditto h2, .ditto h3, .ditto h4, .ditto h5, .ditto h6',
    );

    return () => {
      cleanupFonts();
    };
  }, [resolvedTheme, profileTheme]);

  return null;
}
