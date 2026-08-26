import { z } from 'zod';
import { CATEGORIES, ITEM_STATUS, ITEM_TYPES } from '../../utils/constants.js';

/** Accepts ISO strings and `datetime-local` values, returns a full ISO string. */
const dateTime = z
  .string()
  .trim()
  .min(1, 'Date and time are required')
  .transform((value, ctx) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid date and time' });
      return z.NEVER;
    }
    // Tolerate a few minutes of clock skew, but reject clearly future events.
    if (parsed.getTime() > Date.now() + 10 * 60 * 1000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Date cannot be in the future' });
      return z.NEVER;
    }
    return parsed.toISOString();
  });

/** Multipart form fields arrive as strings; empty means "not provided". */
const optionalNumber = z
  .union([z.string(), z.number()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '' || value === null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  });

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === '' ? undefined : value));

export const createItemSchema = z.object({
  type: z.enum(ITEM_TYPES, { message: `type must be one of: ${ITEM_TYPES.join(', ')}` }),
  title: z.string().trim().min(3, 'Give the item a short title').max(120),
  category: z.string().trim().min(2, 'Category is required').max(60),
  description: z.string().trim().max(2000).default(''),
  location: z.string().trim().min(2, 'Where was it lost or found?').max(160),
  latitude: optionalNumber,
  longitude: optionalNumber,
  occurred_at: dateTime,
  image_url: optionalText(500),
  /** Question only the true owner can answer (spec section 7). */
  verification_question: optionalText(300),
  /** Expected answer / private identifying detail. Never returned by the API. */
  secret_details: optionalText(500),
});

export const updateItemSchema = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    category: z.string().trim().min(2).max(60).optional(),
    description: z.string().trim().max(2000).optional(),
    location: z.string().trim().min(2).max(160).optional(),
    latitude: optionalNumber,
    longitude: optionalNumber,
    occurred_at: dateTime.optional(),
    image_url: optionalText(500),
    verification_question: optionalText(300),
    secret_details: optionalText(500),
    status: z.enum(Object.values(ITEM_STATUS)).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

export const searchQuerySchema = z.object({
  q: optionalText(120),
  type: z.enum(ITEM_TYPES).optional(),
  category: optionalText(60),
  location: optionalText(160),
  status: z.enum(Object.values(ITEM_STATUS)).optional(),
  date_from: optionalText(40),
  date_to: optionalText(40),
  sort: z.enum(['recent', 'oldest', 'date', 'title']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  unresolved_only: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) => value === true || value === 'true'),
  include_hidden: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) => value === true || value === 'true'),
});

export const knownCategories = CATEGORIES;
