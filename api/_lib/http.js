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
  if (status >= 400 && status < 500) {
    sendJson(res, status, { success: false, message: message || 'Request failed' });
    return;
  }
  sendJson(res, status >= 500 ? status : 500, { success: false, message: 'Something went wrong. Please try again.' });
}

module.exports = { sendJson, readJsonBody, sendError };
