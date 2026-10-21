/**
 * Shared test helpers. Tests run against the compiled backend (backend/dist) and the serverless
 * handlers in api/, with fake database calls — no real MongoDB, email or network is used.
 * Run everything with `npm test` from the project root.
 */
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const dist = (p) => path.join(ROOT, 'backend/dist', p);
const api = (p) => path.join(ROOT, 'api', p);

/** Test-only secrets and settings; call before requiring anything from backend/dist. */
function setTestEnv(extra = {}) {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef',
    JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef',
    MFA_ENCRYPTION_KEY: 'test-mfa-key-0123456789abcdef0123456789',
    MONGODB_URI: 'mongodb://127.0.0.1:1/none',
    CLIENT_URL: 'https://shop.test',
    RESEND_API_KEY: '',
    EMAIL_FROM: '',
    ...extra,
  });
  // Any database call that was not faked fails at once instead of waiting 10 s for a server
  require(path.join(ROOT, 'backend/node_modules/mongoose')).set('bufferCommands', false);
}

/** Replace a CommonJS module (e.g. api/_lib/mongo.js) before it is required by the code under test. */
function fakeModule(file, exports) {
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}

/** Calls a serverless handler with a fake request; resolves with { status, body, headers }. */
function callHandler(handler, { method = 'GET', url = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 0,
      headers: {},
      setHeader(k, v) {
        this.headers[k.toLowerCase()] = v;
      },
      end(b) {
        let parsed = b;
        try {
          parsed = b ? JSON.parse(String(b)) : null;
        } catch {
          /* not JSON */
        }
        resolve({ status: this.statusCode, body: parsed, headers: this.headers });
      },
    };
    Promise.resolve(handler({ method, url, headers, body, socket: {} }, res)).catch(reject);
  });
}

/** Fake MongoDB collections for handlers that use conn.db.collection(...) directly. */
function fakeCollections() {
  const cols = {};
  const state = { failDb: false };
  const matches = (d, q) => Object.entries(q).every(([k, v]) => String(d[k]) === String(v));
  function collection(name) {
    if (!cols[name]) cols[name] = [];
    const docs = cols[name];
    const find = (q) => docs.find((d) => matches(d, q));
    return {
      createIndex: async () => 'ok',
      findOne: async (q) => find(q) || null,
      updateOne: async (q, u) => {
        const d = find(q);
        if (d) Object.assign(d, u.$set || {});
        return {};
      },
      findOneAndUpdate: async (q, u, o = {}) => {
        if (state.failDb) throw new Error('db down');
        let d = find(q);
        if (!d && o.upsert) {
          d = { ...q, ...(u.$setOnInsert || {}) };
          docs.push(d);
        }
        if (!d) return null;
        for (const [k, v] of Object.entries(u.$inc || {})) d[k] = (d[k] || 0) + v;
        Object.assign(d, u.$set || {});
        return d;
      },
    };
  }
  return { conn: { db: { collection } }, cols, state };
}

module.exports = { ROOT, dist, api, setTestEnv, fakeModule, callHandler, fakeCollections };
