import { ApiError } from '../utils/ApiError.js';

/** The `order` value that appends a new item after the last one in `scope`. */
export async function nextOrder(Model, scope) {
  const last = await Model.findOne(scope).sort({ order: -1 }).select('order').lean();
  return last ? last.order + 1 : 0;
}

/**
 * Rewrites `order` so items in `scope` follow the sequence of `ids`.
 * `ids` must list every item in the scope exactly once.
 */
export async function applyOrder(Model, scope, ids, label) {
  const existing = await Model.find(scope).select('_id').lean();
  const known = new Set(existing.map((doc) => doc._id.toString()));
  if (known.size !== ids.length || ids.some((id) => !known.has(id))) {
    throw ApiError.validation([
      { path: 'ids', message: `List every ${label} exactly once, in the new order` },
    ]);
  }
  await Model.bulkWrite(
    ids.map((id, index) => ({
      updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
    })),
  );
}
