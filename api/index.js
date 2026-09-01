const path = require('path');
const Module = require('module');

const backendNodeModules = path.join(__dirname, '../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

const serverless = require('serverless-http');

/** @type {import('serverless-http').Handler | null} */
let handler = null;
/** @type {Promise<void> | null} */
let booting = null;

async function getHandler() {
  if (handler) return handler;
  if (!booting) {
    booting = (async () => {
      const { getApp } = require('../backend/dist/app');
      const app = await getApp();
      handler = serverless(app);
    })();
  }
  await booting;
  return handler;
}

module.exports = async (req, res) => {
  try {
    const fn = await getHandler();
    return fn(req, res);
  } catch (err) {
    console.error('API bootstrap failed:', err);
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
