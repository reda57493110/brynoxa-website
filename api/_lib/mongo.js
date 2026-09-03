const { connectDB } = require('../../backend/dist/config/db');

let connectionPromise = null;

async function connectMongo() {
  // Reuse backend's DB connector so fast handlers and backend models share
  // the same mongoose singleton instance.
  if (!connectionPromise) {
    connectionPromise = connectDB();
  }
  return connectionPromise;
}

module.exports = { connectMongo };
