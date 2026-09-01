module.exports = (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({ success: true, message: 'Brynoxa API OK' }));
};
