const { connectDB } = require('../../backend/dist/config/db');

let connectionPromise = null;

async function connectMongo() {
  // Reuse backend's DB connector so fast handlers and backend models share
  // the same mongoose singleton instance.
  if (!connectionPromise) {
    connectionPromise = connectDB().catch((err) => {
      // Not cached: the next request tries again instead of failing for the life of the instance
      connectionPromise = null;
      throw err;
    });
  }
  const mongoose = await connectionPromise;
  return mongoose.connection;
}

module.exports = { connectMongo };
