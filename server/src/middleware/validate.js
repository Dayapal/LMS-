import { ApiError } from '../utils/ApiError.js';

const toDetails = (issues) =>
  issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));

/**
 * Validates request parts against zod schemas. Parsed (and stripped) values
 * replace `req.body`; params and query are exposed on `req.valid` because
 * Express 5 makes `req.query` read-only.
 */
export function validate({ body, params, query } = {}) {
  return (req, _res, next) => {
    req.valid = {};
    const parts = { body, params, query };
    for (const [part, schema] of Object.entries(parts)) {
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) throw ApiError.validation(toDetails(result.error.issues));
      req.valid[part] = result.data;
    }
    if (body) req.body = req.valid.body;
    next();
  };
}
