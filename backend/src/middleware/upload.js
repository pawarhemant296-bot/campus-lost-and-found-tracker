/**
 * Item photo upload.
 *
 * STORAGE_DRIVER=local      -> saved under ./uploads and served at /uploads/... (default)
 * STORAGE_DRIVER=cloudinary -> streamed to Cloudinary via their unsigned REST endpoint
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import config from '../config/env.js';
import { badRequest } from '../utils/errors.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']);

fs.mkdirSync(config.storage.uploadDir, { recursive: true });

const memory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.storage.maxUploadBytes, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(badRequest(`Unsupported image type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

/** Accepts a single optional file under the `image` field. */
export const uploadImage = memory.single('image');

async function saveLocal(file) {
  const extension = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`;
  await fs.promises.writeFile(path.join(config.storage.uploadDir, filename), file.buffer);
  return `${config.publicUrl}/uploads/${filename}`;
}

async function saveCloudinary(file) {
  const { cloudName, apiKey, apiSecret } = config.storage.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    throw badRequest('Cloudinary is selected but credentials are missing');
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'lost-found';
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex');

  const form = new FormData();
  form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname || 'upload.jpg');
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    throw badRequest(`Cloudinary upload failed (${response.status})`);
  }
  const data = await response.json();
  return data.secure_url;
}

/**
 * Persists `req.file` (if any) and returns its public URL.
 * Falls back to an `image_url` supplied directly in the body.
 */
export async function persistUploadedImage(req) {
  if (!req.file) {
    const provided = req.body?.image_url;
    return provided ? String(provided).trim() : null;
  }
  if (config.storage.driver === 'cloudinary') return saveCloudinary(req.file);
  return saveLocal(req.file);
}
