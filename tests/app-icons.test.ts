import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const read = (path: string) => readFileSync(resolve(__dirname, '..', path));

type Rgba = [number, number, number, number];

/** Reads an `--name: r g b;` token from the light theme block of index.css. */
function themeToken(name: string): [number, number, number] {
  const css = read('src/index.css').toString();
  const match = css.match(new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+);`));
  if (!match) throw new Error(`--${name} not found in src/index.css`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

const hex = (rgb: number[]) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');

/** Minimal 8-bit PNG decoder (truecolour, truecolour+alpha, or palette). */
function decodePng(path: string) {
  const data = read(path);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colourType = 0;
  let palette: Buffer = Buffer.alloc(0);
  let paletteAlpha: Buffer = Buffer.alloc(0);
  const idat: Buffer[] = [];
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString('ascii', offset + 4, offset + 8);
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8) throw new Error(`${path}: unsupported bit depth ${body[8]}`);
      colourType = body[9];
    } else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') paletteAlpha = body;
    else if (type === 'IDAT') idat.push(body);
    offset += 12 + length;
  }
  const channels = { 2: 3, 3: 1, 6: 4 }[colourType];
  if (!channels) throw new Error(`${path}: unsupported colour type ${colourType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x];
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels] : 0;
      const p = left + up - upLeft;
      const [pa, pb, pc] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - upLeft)];
      const paeth = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      const predictor = [0, left, up, (left + up) >> 1, paeth][filter];
      pixels[y * stride + x] = (value + predictor) & 0xff;
    }
  }

  const pixel = (x: number, y: number): Rgba => {
    const i = y * stride + x * channels;
    if (colourType === 3) {
      const index = pixels[i];
      const alpha = index < paletteAlpha.length ? paletteAlpha[index] : 255;
      return [palette[index * 3], palette[index * 3 + 1], palette[index * 3 + 2], alpha];
    }
    return [pixels[i], pixels[i + 1], pixels[i + 2], colourType === 6 ? pixels[i + 3] : 255];
  };
  return { width, height, pixel };
}

function allPixels(png: ReturnType<typeof decodePng>): Rgba[] {
  const out: Rgba[] = [];
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) out.push(png.pixel(x, y));
  return out;
}

const near = (actual: Rgba, rgb: [number, number, number]) =>
  actual[3] === 255 && actual.slice(0, 3).every((c, i) => Math.abs(c - rgb[i]) <= 2);

const accent = themeToken('accent');
const onAccent = themeToken('on-accent');

describe('app icons', () => {
  const icons = [
    ['public/pwa-64x64.png', 64],
    ['public/pwa-192x192.png', 192],
    ['public/pwa-512x512.png', 512],
    ['public/maskable-icon-512x512.png', 512],
    ['public/apple-touch-icon.png', 180],
  ] as const;

  it.each(icons)('%s is %ipx square', (path, size) => {
    const png = decodePng(path);
    expect([png.width, png.height]).toEqual([size, size]);
  });

  it.each(icons)('%s carries the receipt mark on the accent colour', (path) => {
    const png = decodePng(path);
    const pixels = allPixels(png);
    // The tile is accent-coloured just inside its edge, above the glyph…
    expect(near(png.pixel(png.width >> 1, Math.round(png.height * 0.12)), accent)).toBe(true);
    // …and the glyph is drawn in the on-accent colour.
    expect(pixels.some((p) => near(p, onAccent))).toBe(true);
  });

  it.each(['public/apple-touch-icon.png', 'public/maskable-icon-512x512.png'])(
    '%s is fully opaque so the OS mask never shows black corners',
    (path) => {
      const png = decodePng(path);
      expect(allPixels(png).every((p) => p[3] === 255)).toBe(true);
      expect(near(png.pixel(0, 0), accent)).toBe(true);
    },
  );

  it.each(['public/pwa-64x64.png', 'public/pwa-192x192.png', 'public/pwa-512x512.png'])(
    '%s is a rounded tile with transparent corners',
    (path) => {
      expect(decodePng(path).pixel(0, 0)[3]).toBe(0);
    },
  );

  it('favicon.svg uses the theme accent and on-accent colours', () => {
    const svg = read('public/favicon.svg').toString().toLowerCase();
    expect(svg).toContain(hex(accent));
    expect(svg).toContain(hex(onAccent));
  });

  it('favicon.ico bundles 16, 32 and 48px images', () => {
    const ico = read('public/favicon.ico');
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => ico[6 + i * 16] || 256);
    expect(sizes.sort((a, b) => a - b)).toEqual([16, 32, 48]);
  });
});
