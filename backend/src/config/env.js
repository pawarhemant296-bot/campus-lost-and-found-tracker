import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_ROOT = path.resolve(here, '..', '..');

const str = (key, fallback = '') => (process.env[key] ?? fallback).toString().trim();
const num = (key, fallback) => {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const bool = (key, fallback = false) => {
  const raw = str(key, String(fallback)).toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
};
const list = (key, fallback = []) => {
  const raw = str(key);
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const resolveFromRoot = (value) => (path.isAbsolute(value) ? value : path.resolve(BACKEND_ROOT, value));

export const config = {
  env: str('NODE_ENV', 'development'),
  port: num('PORT', 4000),
  publicUrl: str('PUBLIC_URL', `http://localhost:${num('PORT', 4000)}`).replace(/\/$/, ''),
  corsOrigins: list('CORS_ORIGIN', ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:4000']),

  auth: {
    jwtSecret: str('JWT_SECRET', 'dev-only-insecure-secret'),
    jwtExpiresIn: str('JWT_EXPIRES_IN', '7d'),
    bcryptRounds: num('BCRYPT_ROUNDS', 10),
    allowedEmailDomains: list('ALLOWED_EMAIL_DOMAINS').map((d) => d.toLowerCase().replace(/^@/, '')),
  },

  db: {
    client: str('DB_CLIENT', 'sqlite').toLowerCase() === 'postgres' ? 'postgres' : 'sqlite',
    sqliteFile: resolveFromRoot(str('SQLITE_FILE', './data/lostfound.db')),
    connectionString: str('DATABASE_URL'),
  },

  storage: {
    driver: str('STORAGE_DRIVER', 'local').toLowerCase(),
    uploadDir: resolveFromRoot(str('UPLOAD_DIR', './uploads')),
    maxUploadBytes: num('MAX_UPLOAD_MB', 5) * 1024 * 1024,
    cloudinary: {
      cloudName: str('CLOUDINARY_CLOUD_NAME'),
      apiKey: str('CLOUDINARY_API_KEY'),
      apiSecret: str('CLOUDINARY_API_SECRET'),
    },
  },

  matching: {
    weights: {
      category: num('MATCH_WEIGHT_CATEGORY', 0.25),
      description: num('MATCH_WEIGHT_DESCRIPTION', 0.25),
      location: num('MATCH_WEIGHT_LOCATION', 0.2),
      time: num('MATCH_WEIGHT_TIME', 0.15),
      image: num('MATCH_WEIGHT_IMAGE', 0.15),
    },
    minScore: num('MATCH_MIN_SCORE', 45),
    strongScore: num('MATCH_STRONG_SCORE', 75),
    dateWindowDays: num('MATCH_DATE_WINDOW_DAYS', 14),
  },

  ai: {
    enabled: bool('AI_SERVICE_ENABLED', false),
    url: str('AI_SERVICE_URL', 'http://localhost:8000').replace(/\/$/, ''),
    timeoutMs: num('AI_SERVICE_TIMEOUT_MS', 2500),
  },
};

/** Warn loudly instead of failing: a hackathon demo should always boot. */
export function validateConfig(logger = console) {
  if (config.env === 'production' && config.auth.jwtSecret.startsWith('dev-only')) {
    logger.warn('[config] JWT_SECRET is not set. Set a strong secret before deploying.');
  }
  const sum = Object.values(config.matching.weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 0.001) {
    logger.warn(`[config] Matching weights sum to ${sum.toFixed(3)}, expected 1.0. Scores will be normalised.`);
  }
  if (config.db.client === 'postgres' && !config.db.connectionString) {
    throw new Error('DB_CLIENT=postgres requires DATABASE_URL');
  }
}

export default config;
