import { ZodError } from 'zod';
import config from '../config/env.js';
import { HttpError } from '../utils/errors.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `No route for ${req.method} ${req.originalUrl}` } });
}

/* eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity */
export function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.') || '(body)',
          message: issue.message,
        })),
      },
    });
  }

  if (error instanceof HttpError || error.status) {
    const status = error.status ?? 500;
    if (status >= 500) console.error('[error]', error);
    return res.status(status).json({
      error: { message: error.message, ...(error.details ? { details: error.details } : {}) },
    });
  }

  // Multer and driver level failures
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: { message: 'Image is too large' } });
  }
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.code === '23505') {
    return res.status(409).json({ error: { message: 'That record already exists' } });
  }

  console.error('[error]', error);
  res.status(500).json({
    error: {
      message: 'Internal server error',
      ...(config.env === 'development' ? { debug: error.message } : {}),
    },
  });
}
