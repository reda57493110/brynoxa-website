/** GET /api/v1/health — simple "the API is up" check (no database access). */
module.exports = async (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 200;
  res.end(JSON.stringify({ success: true, message: 'Brynoxa API OK' }));
};
