const mongoose = require('mongoose');

module.exports = async (req, res) => {
  const uri = process.env.MONGODB_URI;
  res.setHeader('Content-Type', 'application/json');

  if (!uri) {
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: 'MONGODB_URI is not set on Vercel' }));
    return;
  }

  const started = Date.now();
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await mongoose.connection.db.admin().ping();
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, message: 'MongoDB connected', ms: Date.now() - started }));
  } catch (err) {
    res.statusCode = 503;
    res.end(
      JSON.stringify({
        ok: false,
        ms: Date.now() - started,
        error: err instanceof Error ? err.message : 'MongoDB connection failed',
      })
    );
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};
