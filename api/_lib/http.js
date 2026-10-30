function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      return req.body ? JSON.parse(req.body) : {};
    }
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

/**
 * Error reply for the serverless handlers. Expected problems (bad input, not found, not allowed:
 * status 400–499, or a Mongoose validation / bad-id error) keep their message; anything else is
 * logged and the visitor only sees a generic message, so no database or server details leak.
 */
function sendError(res, err) {
  let status = Number(err?.statusCode) || 0;
  let message = err instanceof Error ? err.message : '';
  if (!status && err?.name === 'ValidationError') status = 400;
  if (!status && err?.name === 'CastError') {
    status = 400;
    message = 'Invalid id';
  }
  // A value that must be unique is already taken (SKU, email, coupon code…): the person's input
  const taken = require('../../backend/dist/utils/duplicateKey').duplicateKeyMessage(err);
  if (!status && taken) {
    status = 409;
    message = taken;
  }
  if (status >= 400 && status < 500) {
    sendJson(res, status, {
      success: false,
      message: message || 'Request failed',
      // Same extras as the Express error handler (field errors, codes such as MFA_REQUIRED)
      ...(err?.errors && err?.statusCode ? { errors: err.errors } : {}),
      ...(err?.code && typeof err.code === 'string' ? { code: err.code } : {}),
    });
    return;
  }
  sendJson(res, status >= 500 ? status : 500, { success: false, message: 'Something went wrong. Please try again.' });
}

/**
 * Public shop data (product lists, categories, brands, settings) is the same for every visitor,
 * so Vercel's edge (Paris for Morocco) keeps a copy for 60 s and serves it instantly; after that
 * it refreshes in the background. Browsers do not keep it (max-age=0). Signed-in staff ask with
 * a `fresh` parameter (frontend api/client.ts), so admin screens always see their changes.
 */
function cachePublic(res) {
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');
}

/** Staff-only or per-person answers: never stored by the edge or the browser. */
function cachePrivate(res) {
  res.setHeader('Cache-Control', 'private, no-store');
}

module.exports = { sendJson, readJsonBody, sendError, cachePublic, cachePrivate };
