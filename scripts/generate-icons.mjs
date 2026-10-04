#!/usr/bin/env node
// Renders every app icon (favicon, PWA install icons, iOS home-screen icon,
// Android maskable icon) from one SVG mark, coloured from the light-theme
// tokens in src/index.css so the icon always matches the app.
//
//   npm run icons
//
// The mark is the receipt glyph from src/components/BrandMark.tsx on an
// accent tile. Rasterising goes through Playwright's Chromium, which is
// already a dev dependency.
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const publicDir = new URL('public/', root);

function themeToken(name) {
  const css = readFileSync(new URL('src/index.css', root), 'utf8');
  const match = css.match(new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+);`));
  if (!match) throw new Error(`--${name} not found in src/index.css`);
  return '#' + match.slice(1, 4).map((c) => Number(c).toString(16).padStart(2, '0')).join('');
}

const accent = themeToken('accent');
const onAccent = themeToken('on-accent');

/**
 * The icon on a 512 canvas. `tile` rounds the corners (transparent outside);
 * `full` bleeds to the edge for platforms that apply their own mask. `glyph`
 * is the scale of the 24-unit receipt glyph: larger reads better at favicon
 * sizes, smaller keeps it inside Android's maskable safe zone.
 */
function iconSvg({ shape, glyph }) {
  const radius = shape === 'tile' ? 115 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${accent}"/>
  <g transform="translate(256 256) scale(${glyph}) translate(-12 -11)" fill="none" stroke="${onAccent}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 4h16v14l-2.5-1.5L15 18l-3-1.5L9 18l-2.5-1.5L4 18z"/>
    <path d="M9 8h6M9 12h4"/>
  </g>
</svg>
`;
}

const favicon = iconSvg({ shape: 'tile', glyph: 16 });
const install = iconSvg({ shape: 'tile', glyph: 14 });
const appleTouch = iconSvg({ shape: 'full', glyph: 14 });
const maskable = iconSvg({ shape: 'full', glyph: 11 });

/** Packs PNG images into a .ico container (PNG-in-ICO, supported everywhere since Vista). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size % 256;
    entry[1] = size % 256;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function render(svg, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  );
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

const write = (name, data) => {
  writeFileSync(new URL(name, publicDir), data);
  console.log(`  public/${name}`);
};

try {
  console.log(`Icon colours: ${accent} tile, ${onAccent} glyph`);
  write('favicon.svg', favicon);
  const icoImages = [];
  for (const size of [16, 32, 48]) icoImages.push({ size, png: await render(favicon, size) });
  write('favicon.ico', ico(icoImages));
  for (const size of [64, 192, 512]) write(`pwa-${size}x${size}.png`, await render(install, size));
  write('apple-touch-icon.png', await render(appleTouch, 180));
  write('maskable-icon-512x512.png', await render(maskable, 512));
} finally {
  await browser.close();
}
