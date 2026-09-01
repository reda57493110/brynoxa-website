const serverless = require('serverless-http');
const { getApp } = require('../backend/dist/app');

/** @type {import('serverless-http').Handler | null} */
let handler = null;

module.exports = async (req, res) => {
  if (!handler) {
    const app = await getApp();
    handler = serverless(app);
  }
  return handler(req, res);
};
