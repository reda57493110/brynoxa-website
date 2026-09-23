const path = require('path');

const backendNodeModules = path.join(__dirname, '../../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

const Busboy = require('busboy');

const MAX_FILE_BYTES = 4 * 1024 * 1024; // stay under Vercel body limit
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Parse a single multipart file field named `image` from a Node/Vercel request.
 * @returns {Promise<{ buffer: Buffer, mimetype: string, filename: string } | null>}
 */
function parseImageUpload(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      reject(Object.assign(new Error('Expected multipart/form-data'), { statusCode: 400 }));
      return;
    }

    let file = null;
    let truncated = false;
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    let bb;
    try {
      bb = Busboy({
        headers: req.headers,
        limits: { files: 1, fileSize: MAX_FILE_BYTES },
      });
    } catch (err) {
      fail(Object.assign(err instanceof Error ? err : new Error('Invalid multipart body'), { statusCode: 400 }));
      return;
    }

    bb.on('file', (name, stream, info) => {
      if (name !== 'image') {
        stream.resume();
        return;
      }

      const mime = String(info.mimeType || info.mime || '').toLowerCase();
      const chunks = [];

      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('limit', () => {
        truncated = true;
      });
      stream.on('error', fail);
      stream.on('end', () => {
        file = {
          buffer: Buffer.concat(chunks),
          mimetype: mime,
          filename: info.filename || 'upload',
        };
      });
    });

    bb.on('error', (err) => fail(Object.assign(err, { statusCode: 400 })));
    bb.on('finish', () => {
      if (truncated) {
        fail(Object.assign(new Error('Image must be 4 MB or smaller'), { statusCode: 400 }));
        return;
      }
      done(file);
    });

    // Prefer streaming; fall back if the runtime already buffered the body.
    if (Buffer.isBuffer(req.body)) {
      bb.end(req.body);
      return;
    }
    if (typeof req.body === 'string' && req.body) {
      bb.end(Buffer.from(req.body));
      return;
    }
    if (req.readable === false && req.rawBody) {
      bb.end(Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody));
      return;
    }

    req.pipe(bb);
  });
}

function assertAllowedImage(file) {
  if (!file || !file.buffer?.length) {
    const err = new Error('No file uploaded');
    err.statusCode = 400;
    throw err;
  }
  if (!ALLOWED_TYPES.has(file.mimetype)) {
    const err = new Error('Only JPEG, PNG, and WebP uploads are allowed');
    err.statusCode = 400;
    throw err;
  }
  return file;
}

module.exports = { parseImageUpload, assertAllowedImage, MAX_FILE_BYTES, ALLOWED_TYPES };
