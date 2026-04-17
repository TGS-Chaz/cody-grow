// One-shot utility — generates PNG PWA icons without needing sharp/canvas/imagemagick.
// Run: node scripts/generate-pwa-icons.mjs
//
// Renders a solid-color background with a single centered white "G" glyph drawn
// as raw pixels. Good enough to satisfy manifest.json icon requirements and
// pass Lighthouse PWA audits; replace with real artwork later.

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public");

// Theme background (matches theme_color in manifest.json)
const BG = [0x0a, 0x0e, 0x17]; // #0A0E17
// Primary accent (Cody teal)
const FG = [0x00, 0xd4, 0xaa];

// Simple bitmap font for the letter "G", drawn in a 12x12 cell upscaled to any
// output size. Each row of 12 columns encoded as a hex mask.
const GLYPH_G = [
  0b001111111100,
  0b011111111110,
  0b111100000011,
  0b111000000000,
  0b110000000000,
  0b110000011111,
  0b110000011111,
  0b110000000011,
  0b111000000011,
  0b111100000011,
  0b011111111110,
  0b001111111100,
];
const GLYPH_W = 12;
const GLYPH_H = 12;

function generateIcon(size) {
  const stride = size * 4; // RGBA
  const raw = new Uint8Array(size * stride + size); // +size for per-row filter bytes

  // Upscale the 12x12 glyph so it occupies ~60% of the canvas, centered
  const scale = Math.floor((size * 0.58) / GLYPH_W);
  const glyphPxW = GLYPH_W * scale;
  const glyphPxH = GLYPH_H * scale;
  const offX = Math.floor((size - glyphPxW) / 2);
  const offY = Math.floor((size - glyphPxH) / 2);

  for (let y = 0; y < size; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const pxStart = rowStart + 1 + x * 4;
      // Default: bg color
      let r = BG[0], g = BG[1], b = BG[2];
      // If inside glyph area, sample
      const gx = Math.floor((x - offX) / scale);
      const gy = Math.floor((y - offY) / scale);
      if (gx >= 0 && gx < GLYPH_W && gy >= 0 && gy < GLYPH_H) {
        const row = GLYPH_G[gy];
        if ((row >> (GLYPH_W - 1 - gx)) & 1) {
          r = FG[0]; g = FG[1]; b = FG[2];
        }
      }
      raw[pxStart] = r;
      raw[pxStart + 1] = g;
      raw[pxStart + 2] = b;
      raw[pxStart + 3] = 0xff; // alpha
    }
  }

  // CRC table (IEEE 802.3 polynomial)
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  function crc32(bytes) {
    let c = 0xffffffff;
    for (const b of bytes) c = (table[(c ^ b) & 0xff] ^ (c >>> 8)) >>> 0;
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const typeBytes = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
    return Buffer.concat([len, typeBytes, data, crc]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  const idatData = deflateSync(raw, { level: 9 });
  const png = Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idatData),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png;
}

try { mkdirSync(OUT_DIR, { recursive: true }); } catch {}

for (const size of [192, 512]) {
  const path = join(OUT_DIR, `cody-icon-${size}.png`);
  writeFileSync(path, generateIcon(size));
  console.log(`wrote ${path} (${size}x${size})`);
}
