#!/usr/bin/env node
// =============================================================================
// scripts/generate-placeholder-icons.mjs
//
// One-off generator for the four PWA icon paths the manifest declares.
// Emits solid-color PNG files at the exact pixel dimensions vite-plugin-pwa
// and index.html reference.
//
// Constraints intentionally enforced by this script's shape:
//   - ZERO new npm dependencies. Uses only Node built-ins (zlib, fs, path,
//     node:buffer). Hand-rolls the PNG encoder (~80 lines) rather than
//     pulling in `sharp` (~30 MB transitive) or `pngjs` (~1 MB) just to
//     write four flat-color rectangles.
//   - NOT wired into package.json scripts. Run on demand:
//       node scripts/generate-placeholder-icons.mjs
//     Re-run only when intentionally overwriting the placeholders (color
//     change, dimension change, real-art replacement via 001 task T052).
//
// Color: matches PALETTE_HEX.bgForest from src/config/palette.ts (#2d6a3e).
// Update both locations together if changed (per v1.1.1 amendment: parse-
// time-only surfaces keep the literal + cross-reference comment).
//
// Spec ref: specs/002-shipping-infrastructure/tasks.md T109 + T110.
// Constitution: III (no magic colors), VII (asset credits), XII (public-repo
// hygiene — placeholder PNGs are flat-color, not derivative of any IP).
// =============================================================================

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { deflateSync } from "node:zlib";
import { Buffer } from "node:buffer";

// --- color: keep in sync with src/config/palette.ts PALETTE_HEX.bgForest ----
const COLOR_HEX = "#2d6a3e";

// --- icon manifest (paths must match vite.config.ts + index.html refs) ------
const ICONS = [
  { path: "public/icons/icon-192.png", size: 192 },
  { path: "public/icons/icon-512.png", size: 512 },
  // Maskable icons should be full-bleed solid color so the platform's mask
  // crop has predictable output. Same data as icon-512 is fine for a solid
  // color (the entire 512x512 is bleed; no transparent corners).
  { path: "public/icons/icon-maskable-512.png", size: 512 },
  // iOS apple-touch-icon (referenced from index.html). Standard size 180.
  { path: "public/icons/apple-touch-icon.png", size: 180 },
];

// --- PNG encoder (built-ins only) -------------------------------------------

/**
 * Compute CRC32 for a Buffer. Standard PNG chunk CRC algorithm
 * (IEEE 802.3 polynomial, reflected, init 0xFFFFFFFF, xor-out 0xFFFFFFFF).
 * @param {Buffer} data
 * @returns {number} 32-bit unsigned CRC
 */
function crc32(data) {
  let c;
  if (!crc32.table) {
    crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crc32.table[n] = c >>> 0;
    }
  }
  c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = (crc32.table[(c ^ data[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Build a PNG chunk: 4-byte length + 4-byte type + data + 4-byte CRC.
 * CRC is over type+data, not length.
 * @param {string} type 4-character chunk type ID (e.g. "IHDR")
 * @param {Buffer} data
 * @returns {Buffer}
 */
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

/**
 * Encode a solid-color RGB image as a PNG buffer.
 * @param {number} size width and height in pixels (square)
 * @param {number} r 0..255
 * @param {number} g 0..255
 * @param {number} b 0..255
 * @returns {Buffer}
 */
function encodeSolidPng(size, r, g, b) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR: 13 bytes
  //   width(4), height(4), bit depth(1), color type(1), compression(1),
  //   filter(1), interlace(1)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr.writeUInt8(8, 8); // bit depth: 8 bits per channel
  ihdr.writeUInt8(2, 9); // color type 2: RGB (no alpha)
  ihdr.writeUInt8(0, 10); // compression: deflate
  ihdr.writeUInt8(0, 11); // filter: standard
  ihdr.writeUInt8(0, 12); // interlace: none

  // IDAT: each scanline is (filter byte = 0) + size*3 bytes of RGB data.
  // For a solid color, every pixel is (r,g,b). The whole image:
  //   size rows * (1 + size*3) bytes.
  const rowBytes = 1 + size * 3;
  const raw = Buffer.alloc(size * rowBytes);
  for (let y = 0; y < size; y++) {
    const off = y * rowBytes;
    raw[off] = 0; // filter type "none"
    for (let x = 0; x < size; x++) {
      const px = off + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }
  const compressed = deflateSync(raw, { level: 9 });

  // IEND has no data
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- main --------------------------------------------------------------------

const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(COLOR_HEX);
if (!m) {
  console.error(`Invalid COLOR_HEX: ${COLOR_HEX}`);
  process.exit(1);
}
const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];

console.log(`Generating ${ICONS.length} PNG icons (color ${COLOR_HEX} = rgb(${r}, ${g}, ${b}))`);

for (const { path, size } of ICONS) {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const png = encodeSolidPng(size, r, g, b);
  writeFileSync(path, png);
  console.log(`  ${path} (${size}x${size}, ${png.length} bytes)`);
}

console.log("Done.");
