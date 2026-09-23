const path = require('path');
const { connectMongo } = require('./_lib/mongo');

const backendNodeModules = path.join(__dirname, '../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

function siteOrigin(req) {
  const fromEnv = (process.env.CLIENT_URL || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return host ? `${proto}://${host}` : 'https://brynoxa-website-lime.vercel.app';
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(loc, { lastmod, changefreq, priority } = {}) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>${
      lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ''
    }${changefreq ? `\n    <changefreq>${changefreq}</changefreq>` : ''}${
      priority !== undefined ? `\n    <priority>${priority}</priority>` : ''
    }
  </url>`;
}

function toDate(value) {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.end('Method not allowed');
    return;
  }

  const origin = siteOrigin(req);
  const staticPages = [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/shop', changefreq: 'daily', priority: '0.9' },
    { path: '/services', changefreq: 'weekly', priority: '0.7' },
    { path: '/contact', changefreq: 'monthly', priority: '0.6' },
  ];

  let categoryUrls = [];
  let productUrls = [];

  try {
    await connectMongo();
    const { Category } = require('../backend/dist/models/Category');
    const { Product } = require('../backend/dist/models/Product');

    const categories = await Category.find({
      isActive: true,
      slug: { $nin: ['office', 'networking'] },
    })
      .select('slug updatedAt')
      .lean();

    categoryUrls = categories.map((c) =>
      urlEntry(`${origin}/category/${c.slug}`, {
        lastmod: toDate(c.updatedAt),
        changefreq: 'weekly',
        priority: '0.8',
      })
    );

    const activeCategoryIds = categories.map((c) => c._id);
    const products = activeCategoryIds.length
      ? await Product.find({
          isActive: true,
          category: { $in: activeCategoryIds },
        })
          .select('slug updatedAt')
          .sort({ updatedAt: -1 })
          .limit(5000)
          .lean()
      : [];

    productUrls = products.map((p) =>
      urlEntry(`${origin}/product/${p.slug}`, {
        lastmod: toDate(p.updatedAt),
        changefreq: 'weekly',
        priority: '0.85',
      })
    );
  } catch (err) {
    console.error('Sitemap catalog query failed:', err);
    // Still return static pages so crawlers get something useful.
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages
  .map((p) =>
    urlEntry(`${origin}${p.path}`, {
      changefreq: p.changefreq,
      priority: p.priority,
    })
  )
  .join('\n')}
${categoryUrls.join('\n')}
${productUrls.join('\n')}
</urlset>
`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  res.end(body);
};
