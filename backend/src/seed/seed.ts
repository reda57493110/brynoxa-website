import { connectDB } from '../config/db';
import { env } from '../config/env';
import { User } from '../models/User';
import { Category } from '../models/Category';
import { Brand } from '../models/Brand';
import { Product } from '../models/Product';
import { Coupon } from '../models/Coupon';
import { getSettings } from '../models/Settings';
import { slugify } from '../utils/slugify';
import { migrateCurrencyToMad } from '../config/migrateCurrency';
import { BRAND_DEFS, CATEGORY_DEFS, CATALOG_VERSION, PRODUCT_DEFS } from './catalogData';

const RETIRED_CATEGORY_SLUGS = ['office', 'networking'];

export async function removeRetiredCategories() {
  const cats = await Category.find({ slug: { $in: RETIRED_CATEGORY_SLUGS } });
  const ids = cats.map((c) => c._id);
  if (!ids.length) return;
  await Product.deleteMany({ category: { $in: ids } });
  await Category.deleteMany({ _id: { $in: ids } });
}

export async function ensureAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    console.warn('ADMIN_EMAIL and ADMIN_PASSWORD are not configured; skipping admin bootstrap');
    return null;
  }
  const existing = await User.findOne({ email: env.ADMIN_EMAIL }).select('+password');
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log(`Promoted ${env.ADMIN_EMAIL} to admin`);
    } else if (env.ADMIN_PASSWORD && !(await existing.comparePassword(env.ADMIN_PASSWORD))) {
      existing.password = env.ADMIN_PASSWORD;
      existing.failedLoginAttempts = 0;
      existing.lockedUntil = undefined;
      await existing.save();
      console.log(`Synced admin password for ${env.ADMIN_EMAIL}`);
    }
    return existing;
  }

  const admin = await User.create({
    name: 'Brynoxa Admin',
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    role: 'admin',
  });
  console.log(`Admin created: ${env.ADMIN_EMAIL}`);
  return admin;
}

export async function upsertCatalog() {
  await removeRetiredCategories();

  const categoryIds = new Map<string, string>();
  for (const def of CATEGORY_DEFS) {
    const category = await Category.findOneAndUpdate(
      { slug: def.slug },
      {
        name: def.name,
        slug: def.slug,
        description: def.description,
        sortOrder: def.sortOrder,
        isActive: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    categoryIds.set(def.slug, category._id.toString());
  }

  const brandIds = new Map<string, string>();
  for (const name of BRAND_DEFS) {
    const slug = slugify(name);
    const brand = await Brand.findOneAndUpdate(
      { slug },
      { name, slug, isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    brandIds.set(name, brand._id.toString());
  }

  const keepSkus = PRODUCT_DEFS.map((p) => p.sku);
  const now = new Date();

  for (const def of PRODUCT_DEFS) {
    const category = categoryIds.get(def.category);
    const brand = brandIds.get(def.brand);
    if (!category || !brand) {
      throw new Error(`Missing category or brand for ${def.sku}`);
    }

    await Product.findOneAndUpdate(
      { sku: def.sku },
      {
        $set: {
          name: def.name,
          slug: def.slug,
          sku: def.sku,
          category,
          brand,
          price: def.price,
          ...(def.compareAtPrice !== undefined
            ? { compareAtPrice: def.compareAtPrice }
            : { compareAtPrice: undefined }),
          stock: def.stock,
          isFeatured: Boolean(def.isFeatured),
          featuredAt: def.isFeatured ? now : null,
          isCarousel: Boolean(def.isCarousel),
          carouselAt: def.isCarousel ? now : null,
          shortDescription: def.shortDescription,
          description: def.description,
          specs: def.specs,
          tags: def.tags,
          images: [{ url: def.image, alt: def.name, isPrimary: true }],
          isActive: true,
          lowStockThreshold: 5,
          averageRating: 0,
          reviewCount: 0,
          soldCount: 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  await Product.updateMany({ sku: { $nin: keepSkus } }, { $set: { isActive: false } });
  console.log(`Catalog upserted (${PRODUCT_DEFS.length} products, v${CATALOG_VERSION})`);
}

export async function syncCatalogIfNeeded() {
  const settings = await getSettings();
  if (settings.catalogVersion === CATALOG_VERSION) return;
  await upsertCatalog();
  settings.catalogVersion = CATALOG_VERSION;
  await settings.save();
}

export async function runSeed(force = false) {
  await getSettings();
  await ensureAdmin();
  await removeRetiredCategories();

  if (force) {
    await Promise.all([
      Product.deleteMany({}),
      Category.deleteMany({}),
      Brand.deleteMany({}),
    ]);
    const settings = await getSettings();
    settings.catalogVersion = 0;
    await settings.save();
  }

  await syncCatalogIfNeeded();

  const couponExists = await Coupon.findOne({ code: 'BRYNOXA10' });
  if (!couponExists) {
    await Coupon.create({
      code: 'BRYNOXA10',
      type: 'percent',
      value: 10,
      minOrder: 1000,
      maxUses: 1000,
      isActive: true,
    });
  }

  console.log('Seed complete.');
}

async function cli() {
  await connectDB();
  await migrateCurrencyToMad();
  await runSeed(true);
  process.exit(0);
}

if (require.main === module) {
  cli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
