const path = require('path');
const Module = require('module');

const backendNodeModules = path.join(__dirname, '../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

const serverless = require('serverless-http');
const { getApp } = require('../backend/dist/app');

const handler = serverless(getApp());

module.exports = async (req, res) => {
  try {
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
