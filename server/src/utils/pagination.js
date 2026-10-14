export function paginationMeta({ page, limit }, total) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export const skipFor = ({ page, limit }) => (page - 1) * limit;
