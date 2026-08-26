/**
 * Zod validation middleware. Parsed (and coerced) values replace the raw input,
 * so controllers always work with clean data.
 */
export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) return next(result.error);
  req.body = result.data;
  next();
};

export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query ?? {});
  if (!result.success) return next(result.error);
  req.validatedQuery = result.data;
  next();
};

export const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params ?? {});
  if (!result.success) return next(result.error);
  req.validatedParams = result.data;
  next();
};
