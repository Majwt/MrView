/**
 * Gets the color value of a CSS variable, parses it as OKLCH, and converts it to a hex string.
 * Assumes all the css variables used for theming are defined in OKLCH format (e.g., "oklch(0.5 0.1 240 / 10%)").
 *
 */
export function cssVarColor(name: string) {
  const color = getComputedStyle(document.documentElement).getPropertyValue(name);

  const oklch = parseOklch(color);

  return oklchToHex(oklch);
}

function getFqdnSuffix(fqdn: string): string {
  const parts = fqdn.split(".").filter(Boolean);
  return parts.length ? parts[parts.length - 1].toLowerCase() : fqdn.toLowerCase();
}

export function fqdnToColor(fqdn: string): string {
  const suffix = getFqdnSuffix(fqdn);
  let hash = 0;
  for (let i = 0; i < suffix.length; i += 1) {
    hash = (hash * 48 + suffix.charCodeAt(i)) >>> 0;
  }
  const r = 64 + (hash & 0x7f);
  const g = 64 + ((hash >>> 8) & 0x7f);
  const b = 64 + ((hash >>> 16) & 0x7f);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export function cssVarColorRgba(name: string, alpha?: number): string {
  const color = getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const oklch = parseOklch(color);
  const oklchWithAlpha = {
    ...oklch,
    alpha: alpha !== undefined ? alpha : oklch.alpha,
  };

  const rgba = rgbaToString(oklchToRgb(oklchWithAlpha));
  return rgba;
}
function rgbaToString({ r, g, b, a }: Rgba): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

type Rgba = {
  r: number;
  g: number;
  b: number;
  a: number;
};
type Oklch = {
  l: number;
  c: number;
  h: number;
  alpha: number;
};

export function parseOklch(input: string): Oklch {
  const match = input.match(
    /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/i,
  );

  if (!match) {
    throw new Error(`Invalid OKLCH color: ${input}`);
  }

  const parsePercent = (value: string): number =>
    value.endsWith("%") ? Number(value.slice(0, -1)) / 100 : Number(value);

  return {
    l: parsePercent(match[1]),
    c: Number(match[2]),
    h: Number(match[3]),
    alpha: match[4] ? parsePercent(match[4]) : 1,
  };
}
export function oklchToRgb(oklch: Oklch): Rgba {
  const hRad = (oklch.h * Math.PI) / 180;

  const a = Math.cos(hRad) * oklch.c;
  const b = Math.sin(hRad) * oklch.c;

  const l_ = oklch.l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = oklch.l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = oklch.l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;

  const r = +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const blue = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;

  const toSrgb = (x: number) => (x >= 0.0031308 ? 1.055 * x ** (1 / 2.4) - 0.055 : 12.92 * x);

  const clamp = (x: number) => Math.min(255, Math.max(0, Math.round(toSrgb(x) * 255)));

  return {
    r: clamp(r),
    g: clamp(g),
    b: clamp(blue),
    a: oklch.alpha,
  };
}

export function oklchToHex(oklch: Oklch): string {
  const { r, g, b } = oklchToRgb(oklch);

  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
