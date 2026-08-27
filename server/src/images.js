import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from './config.js';

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('[traceback] sharp unavailable — image similarity will be skipped');
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(png|jpe?g|webp|gif|avif|svg\+xml)$/.test(file.mimetype);
    cb(ok ? null : new Error('Only image uploads are allowed'), ok);
  },
});

/**
 * Perceptual difference hash (dHash): resize to 9x8 greyscale, compare each
 * pixel with its right neighbour → 64 bits, returned as 16 hex chars.
 * Robust to scaling, compression and mild colour shifts.
 */
export async function computeImageHash(filePath) {
  if (!sharp || !filePath || !fs.existsSync(filePath)) return null;
  try {
    const raw = await sharp(filePath)
      .flatten({ background: '#ffffff' })
      .resize(9, 8, { fit: 'fill' })
      .greyscale()
      .raw()
      .toBuffer();
    let bits = '';
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        bits += raw[y * 9 + x] > raw[y * 9 + x + 1] ? '1' : '0';
      }
    }
    return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
  } catch (err) {
    console.warn('[traceback] image hash failed:', err.message);
    return null;
  }
}

/** Renders a deterministic cosmic placeholder image (used by the seeder). */
export async function writeSeedImage(fileName, { label, hue = 265, glyph = '?' }) {
  const target = path.join(config.uploadDir, fileName);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
    <defs>
      <radialGradient id="g" cx="30%" cy="25%" r="90%">
        <stop offset="0%" stop-color="hsl(${hue} 70% 42%)"/>
        <stop offset="55%" stop-color="hsl(${hue + 12} 60% 20%)"/>
        <stop offset="100%" stop-color="#0a0a0f"/>
      </radialGradient>
    </defs>
    <rect width="800" height="600" fill="url(#g)"/>
    ${Array.from({ length: 60 }, (_, i) => {
      const x = (i * 137.5) % 800;
      const y = (i * 219.7) % 600;
      const r = ((i * 7) % 3) + 1;
      return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r}" fill="#ffffff" opacity="0.${((i % 6) + 2)}"/>`;
    }).join('')}
    <text x="400" y="300" font-size="180" text-anchor="middle" fill="#ffffff" opacity="0.92">${glyph}</text>
    <text x="400" y="400" font-size="38" text-anchor="middle" fill="#e9d5ff" font-family="Helvetica, Arial, sans-serif" opacity="0.85">${label}</text>
  </svg>`;

  if (sharp) {
    await sharp(Buffer.from(svg)).png().toFile(target);
    return { fileName, hash: await computeImageHash(target) };
  }
  fs.writeFileSync(target.replace(/\.png$/, '.svg'), svg);
  return { fileName: fileName.replace(/\.png$/, '.svg'), hash: null };
}

export const hasSharp = Boolean(sharp);
