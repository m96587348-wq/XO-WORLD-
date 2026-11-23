import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function renderIcon(size, safeMarginRatio = 0.0) {
  const buf = Buffer.alloc(size * size * 4);
  const bg = [8, 13, 24, 255]; // #080D18
  const surface = [16, 24, 39, 255]; // #101827
  const border = [30, 41, 59, 255]; // #1E293B
  const orange = [255, 107, 26, 255]; // #FF6B1A
  const white = [255, 255, 255, 255];

  const scale = 1 - safeMarginRatio * 2;
  const offset = size * safeMarginRatio;
  const toNorm = (v) => (v - offset) / (size * scale);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      let col = bg;

      const nx = toNorm(x + 0.5);
      const ny = toNorm(y + 0.5);

      // Subtle inner frame for non-maskable icons
      if (safeMarginRatio === 0) {
        const edge = Math.min(x, y, size - 1 - x, size - 1 - y) / size;
        if (edge > 0.05 && edge < 0.065) {
          col = border;
        } else if (edge >= 0.065) {
          col = surface;
        }
      }

      // Draw 'X' in orange (#FF6B1A) on left half
      const d1 = distToSegment(nx, ny, 0.23, 0.34, 0.43, 0.66);
      const d2 = distToSegment(nx, ny, 0.43, 0.34, 0.23, 0.66);
      if (Math.min(d1, d2) < 0.048) {
        col = orange;
      }

      // Draw 'O' ring in white on right half + orange core dot
      const doDist = Math.hypot(nx - 0.66, ny - 0.5);
      if (Math.abs(doDist - 0.145) < 0.044) {
        col = white;
      } else if (doDist < 0.042) {
        col = orange;
      }

      buf[idx] = col[0];
      buf[idx + 1] = col[1];
      buf[idx + 2] = col[2];
      buf[idx + 3] = col[3];
    }
  }
  return encodePNG(size, size, buf);
}

const outDir = path.resolve(process.cwd(), 'public');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), renderIcon(192, 0));
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), renderIcon(512, 0));
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), renderIcon(512, 0.16));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), renderIcon(180, 0));
console.log('Generated PWA PNG icons in public/');
