import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, '..');

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'traceback-dev-secret-change-me',
  jwtExpiry: process.env.JWT_EXPIRY || '7d',
  dbFile: process.env.DB_FILE || path.join(ROOT, 'data', 'traceback.db'),
  uploadDir: process.env.UPLOAD_DIR || path.join(ROOT, 'uploads'),
  publicUrl: process.env.PUBLIC_URL || '',
};

/**
 * Default matching-engine configuration.
 * Weights follow the problem statement (PCE SW PS 13, section 6):
 *   item/category 25% · description 25% · location 20% · date/time 15% · image 15%
 * Admins can tune these live from the Admin → Settings screen.
 */
export const DEFAULT_SETTINGS = {
  weight_category: 25,
  weight_description: 25,
  weight_location: 20,
  weight_date: 15,
  weight_image: 15,
  match_threshold: 45,
  strong_match_threshold: 80,
  auto_notify: 1,
  date_window_days: 14,
};
