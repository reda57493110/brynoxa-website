const path = require('path');
const Module = require('module');

const backendNodeModules = path.join(__dirname, '../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

const serverless = require('serverless-http');
const { connectDB } = require('../backend/dist/config/db');
const { getApp } = require('../backend/dist/app');

const dbReady = connectDB().catch((err) => {
  console.error('Mongo preconnect failed:', err);
});

const handler = serverless(getApp());

module.exports = async (req, res) => {
  try {
    await dbReady;
    return await handler(req, res);
  } catch (err) {
    console.error('API request failed:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        message: err instanceof Error ? err.message : 'Server error',
      })
    );
  }
};
