export function ok(res, data, { status = 200, meta } = {}) {
  return res.status(status).json({ success: true, data, ...(meta && { meta }) });
}

export function created(res, data) {
  return ok(res, data, { status: 201 });
}

export function noContent(res) {
  return res.status(204).end();
}
