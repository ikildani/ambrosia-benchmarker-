// Inline SVG logos for PDF report rendering
// Based on /public/logo-white.svg and /public/logo-color.svg
// Gradient IDs are prefixed to avoid collision when multiple logos appear on the same page.

/**
 * Full white logo (icon + wordmark) for dark backgrounds (e.g. cover page header).
 * "Ambrosia" in white Cormorant Garamond, "Ventures" in light purple Libre Franklin.
 */
export function logoFullWhite(width: number = 200): string {
  const height = Math.round(width * (96 / 580));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580 96" width="${width}" height="${height}">
    <defs>
      <linearGradient id="lw-gc" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#72e8f7"/>
        <stop offset="50%" stop-color="#5fd4e3"/>
        <stop offset="100%" stop-color="#9499d1"/>
      </linearGradient>
      <linearGradient id="lw-gg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#5fd4e3"/>
        <stop offset="100%" stop-color="#9499d1"/>
      </linearGradient>
    </defs>
    <g transform="translate(8, 4) scale(0.92)">
      <path d="M30 8 C30 8, 48 22, 30 38 C12 54, 48 70, 30 88" fill="none" stroke="url(#lw-gc)" stroke-width="3.8" stroke-linecap="round"/>
      <path d="M54 8 C54 8, 36 22, 54 38 C72 54, 36 70, 54 88" fill="none" stroke="url(#lw-gc)" stroke-width="3.8" stroke-linecap="round"/>
      <line x1="34" y1="23" x2="50" y2="23" stroke="url(#lw-gc)" stroke-width="2.4" stroke-linecap="round" opacity="0.6"/>
      <line x1="28" y1="42" x2="56" y2="42" stroke="url(#lw-gc)" stroke-width="2.4" stroke-linecap="round" opacity="0.4"/>
      <line x1="34" y1="61" x2="50" y2="61" stroke="url(#lw-gc)" stroke-width="2.4" stroke-linecap="round" opacity="0.6"/>
      <line x1="28" y1="78" x2="56" y2="78" stroke="url(#lw-gc)" stroke-width="2.4" stroke-linecap="round" opacity="0.4"/>
      <g transform="translate(56, 32)">
        <circle cx="16" cy="16" r="10" fill="none" stroke="url(#lw-gg)" stroke-width="3"/>
        <circle cx="16" cy="16" r="4" fill="url(#lw-gg)" opacity="0.35"/>
        <line x1="16" y1="0" x2="16" y2="5" stroke="url(#lw-gg)" stroke-width="2.8" stroke-linecap="round"/>
        <line x1="16" y1="27" x2="16" y2="32" stroke="url(#lw-gg)" stroke-width="2.8" stroke-linecap="round"/>
        <line x1="0" y1="16" x2="5" y2="16" stroke="url(#lw-gg)" stroke-width="2.8" stroke-linecap="round"/>
        <line x1="27" y1="16" x2="32" y2="16" stroke="url(#lw-gg)" stroke-width="2.8" stroke-linecap="round"/>
        <line x1="4.3" y1="4.3" x2="8" y2="8" stroke="url(#lw-gg)" stroke-width="2.4" stroke-linecap="round"/>
        <line x1="24" y1="24" x2="27.7" y2="27.7" stroke="url(#lw-gg)" stroke-width="2.4" stroke-linecap="round"/>
        <line x1="27.7" y1="4.3" x2="24" y2="8" stroke="url(#lw-gg)" stroke-width="2.4" stroke-linecap="round"/>
        <line x1="8" y1="24" x2="4.3" y2="27.7" stroke="url(#lw-gg)" stroke-width="2.4" stroke-linecap="round"/>
      </g>
      <path d="M76 24 C90 12, 102 24, 92 38" fill="none" stroke="url(#lw-gg)" stroke-width="2.4" stroke-linecap="round"/>
      <polygon points="92,33 96,40 89,39" fill="#9499d1" opacity="0.7"/>
    </g>
    <text x="120" y="60" font-family="'Cormorant Garamond', Georgia, 'Times New Roman', serif" font-size="38" font-weight="700" fill="#ffffff" letter-spacing="0.5">Ambrosia</text>
    <text x="340" y="60" font-family="'Libre Franklin', 'Helvetica Neue', Helvetica, sans-serif" font-size="28" font-weight="200" fill="#9499d1" letter-spacing="1">Ventures</text>
  </svg>`;
}

/**
 * Full color logo (icon + wordmark) for light backgrounds (e.g. methodology footer).
 * "Ambrosia" in dark navy Cormorant Garamond, "Ventures" in muted purple Libre Franklin.
 */
export function logoFullColor(width: number = 200): string {
  const height = Math.round(width * (96 / 580));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 580 96" width="${width}" height="${height}">
    <defs>
      <linearGradient id="lc-gc" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#5fd4e3"/>
        <stop offset="45%" stop-color="#3fb5c4"/>
        <stop offset="100%" stop-color="#2a2f72"/>
      </linearGradient>
      <linearGradient id="lc-gg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3fb5c4"/>
        <stop offset="100%" stop-color="#2a2f72"/>
      </linearGradient>
    </defs>
    <g transform="translate(8, 4) scale(0.92)">
      <path d="M30 8 C30 8, 48 22, 30 38 C12 54, 48 70, 30 88" fill="none" stroke="url(#lc-gc)" stroke-width="3.8" stroke-linecap="round"/>
      <path d="M54 8 C54 8, 36 22, 54 38 C72 54, 36 70, 54 88" fill="none" stroke="url(#lc-gc)" stroke-width="3.8" stroke-linecap="round"/>
      <line x1="34" y1="23" x2="50" y2="23" stroke="url(#lc-gc)" stroke-width="2.4" stroke-linecap="round" opacity="0.6"/>
      <line x1="28" y1="42" x2="56" y2="42" stroke="url(#lc-gc)" stroke-width="2.4" stroke-linecap="round" opacity="0.4"/>
      <line x1="34" y1="61" x2="50" y2="61" stroke="url(#lc-gc)" stroke-width="2.4" stroke-linecap="round" opacity="0.6"/>
      <line x1="28" y1="78" x2="56" y2="78" stroke="url(#lc-gc)" stroke-width="2.4" stroke-linecap="round" opacity="0.4"/>
      <g transform="translate(56, 32)">
        <circle cx="16" cy="16" r="10" fill="none" stroke="url(#lc-gg)" stroke-width="3"/>
        <circle cx="16" cy="16" r="4" fill="url(#lc-gg)" opacity="0.35"/>
        <line x1="16" y1="0" x2="16" y2="5" stroke="url(#lc-gg)" stroke-width="2.8" stroke-linecap="round"/>
        <line x1="16" y1="27" x2="16" y2="32" stroke="url(#lc-gg)" stroke-width="2.8" stroke-linecap="round"/>
        <line x1="0" y1="16" x2="5" y2="16" stroke="url(#lc-gg)" stroke-width="2.8" stroke-linecap="round"/>
        <line x1="27" y1="16" x2="32" y2="16" stroke="url(#lc-gg)" stroke-width="2.8" stroke-linecap="round"/>
        <line x1="4.3" y1="4.3" x2="8" y2="8" stroke="url(#lc-gg)" stroke-width="2.4" stroke-linecap="round"/>
        <line x1="24" y1="24" x2="27.7" y2="27.7" stroke="url(#lc-gg)" stroke-width="2.4" stroke-linecap="round"/>
        <line x1="27.7" y1="4.3" x2="24" y2="8" stroke="url(#lc-gg)" stroke-width="2.4" stroke-linecap="round"/>
        <line x1="8" y1="24" x2="4.3" y2="27.7" stroke="url(#lc-gg)" stroke-width="2.4" stroke-linecap="round"/>
      </g>
      <path d="M76 24 C90 12, 102 24, 92 38" fill="none" stroke="url(#lc-gg)" stroke-width="2.4" stroke-linecap="round"/>
      <polygon points="92,33 96,40 89,39" fill="#2a2f72" opacity="0.7"/>
    </g>
    <text x="120" y="60" font-family="'Cormorant Garamond', Georgia, 'Times New Roman', serif" font-size="38" font-weight="700" fill="#151a3d" letter-spacing="0.5">Ambrosia</text>
    <text x="340" y="60" font-family="'Libre Franklin', 'Helvetica Neue', Helvetica, sans-serif" font-size="28" font-weight="200" fill="#656a9e" letter-spacing="1">Ventures</text>
  </svg>`;
}

/**
 * Icon-only color logo (DNA helix + gear) for small uses like page headers.
 * Cropped viewBox with no text.
 */
export function logoIconColor(size: number = 22): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 96" width="${size}" height="${size}">
    <defs>
      <linearGradient id="li-gc" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#5fd4e3"/>
        <stop offset="45%" stop-color="#3fb5c4"/>
        <stop offset="100%" stop-color="#2a2f72"/>
      </linearGradient>
      <linearGradient id="li-gg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3fb5c4"/>
        <stop offset="100%" stop-color="#2a2f72"/>
      </linearGradient>
    </defs>
    <g transform="translate(8, 4) scale(0.92)">
      <path d="M30 8 C30 8, 48 22, 30 38 C12 54, 48 70, 30 88" fill="none" stroke="url(#li-gc)" stroke-width="3.8" stroke-linecap="round"/>
      <path d="M54 8 C54 8, 36 22, 54 38 C72 54, 36 70, 54 88" fill="none" stroke="url(#li-gc)" stroke-width="3.8" stroke-linecap="round"/>
      <line x1="34" y1="23" x2="50" y2="23" stroke="url(#li-gc)" stroke-width="2.4" stroke-linecap="round" opacity="0.6"/>
      <line x1="28" y1="42" x2="56" y2="42" stroke="url(#li-gc)" stroke-width="2.4" stroke-linecap="round" opacity="0.4"/>
      <line x1="34" y1="61" x2="50" y2="61" stroke="url(#li-gc)" stroke-width="2.4" stroke-linecap="round" opacity="0.6"/>
      <line x1="28" y1="78" x2="56" y2="78" stroke="url(#li-gc)" stroke-width="2.4" stroke-linecap="round" opacity="0.4"/>
      <g transform="translate(56, 32)">
        <circle cx="16" cy="16" r="10" fill="none" stroke="url(#li-gg)" stroke-width="3"/>
        <circle cx="16" cy="16" r="4" fill="url(#li-gg)" opacity="0.35"/>
        <line x1="16" y1="0" x2="16" y2="5" stroke="url(#li-gg)" stroke-width="2.8" stroke-linecap="round"/>
        <line x1="16" y1="27" x2="16" y2="32" stroke="url(#li-gg)" stroke-width="2.8" stroke-linecap="round"/>
        <line x1="0" y1="16" x2="5" y2="16" stroke="url(#li-gg)" stroke-width="2.8" stroke-linecap="round"/>
        <line x1="27" y1="16" x2="32" y2="16" stroke="url(#li-gg)" stroke-width="2.8" stroke-linecap="round"/>
        <line x1="4.3" y1="4.3" x2="8" y2="8" stroke="url(#li-gg)" stroke-width="2.4" stroke-linecap="round"/>
        <line x1="24" y1="24" x2="27.7" y2="27.7" stroke="url(#li-gg)" stroke-width="2.4" stroke-linecap="round"/>
        <line x1="27.7" y1="4.3" x2="24" y2="8" stroke="url(#li-gg)" stroke-width="2.4" stroke-linecap="round"/>
        <line x1="8" y1="24" x2="4.3" y2="27.7" stroke="url(#li-gg)" stroke-width="2.4" stroke-linecap="round"/>
      </g>
      <path d="M76 24 C90 12, 102 24, 92 38" fill="none" stroke="url(#li-gg)" stroke-width="2.4" stroke-linecap="round"/>
      <polygon points="92,33 96,40 89,39" fill="#2a2f72" opacity="0.7"/>
    </g>
  </svg>`;
}
