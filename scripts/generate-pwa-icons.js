/**
 * Generate placeholder PWA icons with brand color.
 * These are minimal valid PNGs - replace with proper brand icons before production.
 */
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { deflateSync } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public", "assets");

// Brand color: #1fa7a0 (teal)
const BRAND_R = 0x1f;
const BRAND_G = 0xa7;
const BRAND_B = 0xa0;

function crc32(data) {
  let crc = 0xffffffff;
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crcData = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function generatePng(size) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // color type (RGB)
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  // Image data: solid brand color with a simple centered circle pattern
  const rawData = [];
  const center = size / 2;
  const outerRadius = size * 0.4;
  const innerRadius = size * 0.25;

  for (let y = 0; y < size; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < innerRadius) {
        // Inner circle: white
        rawData.push(0xff, 0xff, 0xff);
      } else if (dist < outerRadius) {
        // Outer ring: brand color
        rawData.push(BRAND_R, BRAND_G, BRAND_B);
      } else {
        // Background: light cream (#f7f4ec)
        rawData.push(0xf7, 0xf4, 0xec);
      }
    }
  }

  const compressed = deflateSync(Buffer.from(rawData));

  // IEND chunk
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    createPngChunk("IHDR", ihdr),
    createPngChunk("IDAT", compressed),
    createPngChunk("IEND", iend),
  ]);
}

// Generate icons
const sizes = [192, 512];
for (const size of sizes) {
  const png = generatePng(size);
  const path = join(publicDir, `pwa-icon-${size}.png`);
  writeFileSync(path, png);
  console.log(`Generated ${path}`);
}
