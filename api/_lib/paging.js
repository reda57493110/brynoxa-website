/** Page / page size from the query string: page >= 1, size 1–max (default when missing or bad). */
function paging(query, defaultLimit = 20, max = 100) {
  const page = Math.max(1, Math.floor(Number(query?.page)) || 1);
  const limit = Math.min(max, Math.max(1, Math.floor(Number(query?.limit)) || defaultLimit));
  return { page, limit };
}

module.exports = { paging };
