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

const placeholders = [
  'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=800&q=80',
  'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=800&q=80',
  'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&q=80',
  'https://images.unsplash.com/photo-1616588589676-62b3bd4ff6d1?w=800&q=80',
  'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=800&q=80',
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80',
];

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
  const existing = await User.findOne({ email: env.ADMIN_EMAIL });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log(`Promoted ${env.ADMIN_EMAIL} to admin`);
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

export async function runSeed(force = false) {
  await getSettings();
  await ensureAdmin();

  await removeRetiredCategories();

  const productCount = await Product.countDocuments();
  if (productCount > 0 && !force) {
    console.log('Catalog already seeded, skipping');
    return;
  }

  if (force) {
    await Promise.all([
      Product.deleteMany({}),
      Category.deleteMany({}),
      Brand.deleteMany({}),
      Coupon.deleteMany({}),
    ]);
  }

  const categoryNames = [
    'Laptops',
    'Gaming PCs',
    'Monitors',
    'Keyboards',
    'Mice',
    'Headphones',
    'Components',
    'Accessories',
  ];

  const categories = await Category.insertMany(
    categoryNames.map((name, i) => ({
      name,
      slug: slugify(name),
      description: `Premium ${name.toLowerCase()} for work and play.`,
      sortOrder: i,
      isActive: true,
    }))
  );

  const brandNames = ['Brynoxa', 'ASUS', 'MSI', 'Razer', 'Dell', 'Logitech', 'Samsung', 'NVIDIA'];
  const brands = await Brand.insertMany(
    brandNames.map((name) => ({
      name,
      slug: slugify(name),
      isActive: true,
    }))
  );

  const cat = (name: string) => categories.find((c) => c.name === name)!._id;
  const brand = (name: string) => brands.find((b) => b.name === name)!._id;

  const products = [
    {
      name: 'Brynoxa Blade 15 Pro',
      sku: 'BRX-LAP-001',
      category: cat('Laptops'),
      brand: brand('Brynoxa'),
      price: 18990,
      compareAtPrice: 21990,
      stock: 24,
      isFeatured: true,
      shortDescription: 'Ultra-thin performance laptop for creators.',
      description:
        'The Brynoxa Blade 15 Pro combines a vivid 15.6" QHD display with a powerful multi-core CPU and dedicated graphics — built for design, code, and entertainment.',
      specs: {
        CPU: 'Intel Core i7',
        RAM: '32GB DDR5',
        Storage: '1TB NVMe SSD',
        GPU: 'RTX 4060',
        Display: '15.6" QHD 165Hz',
      },
      tags: ['laptop', 'creator', 'portable'],
    },
    {
      name: 'Phantom Rogue Gaming Desktop',
      sku: 'BRX-PC-001',
      category: cat('Gaming PCs'),
      brand: brand('Brynoxa'),
      price: 24990,
      compareAtPrice: 27990,
      stock: 12,
      isFeatured: true,
      shortDescription: 'Liquid-cooled tower ready for 4K gaming.',
      description:
        'Factory-tuned gaming PC with high-airflow chassis, RGB accents, and room to expand. Dominate every title at ultra settings.',
      specs: {
        CPU: 'AMD Ryzen 7',
        RAM: '32GB DDR5',
        Storage: '2TB NVMe',
        GPU: 'RTX 4070 Ti',
        PSU: '850W Gold',
      },
      tags: ['gaming', 'desktop', 'rtx'],
    },
    {
      name: 'VistaPro 27 OLED',
      sku: 'BRX-MON-001',
      category: cat('Monitors'),
      brand: brand('Samsung'),
      price: 7990,
      compareAtPrice: 8990,
      stock: 40,
      isFeatured: true,
      shortDescription: '27-inch OLED with near-instant response.',
      description:
        'Immersive OLED panel with HDR, ultra-thin bezels, and USB-C docking for a clean desk setup.',
      specs: { Size: '27"', Panel: 'OLED', Refresh: '240Hz', Resolution: '2560x1440' },
      tags: ['monitor', 'oled', 'gaming'],
    },
    {
      name: 'Strike Mechanical Keyboard',
      sku: 'BRX-KB-001',
      category: cat('Keyboards'),
      brand: brand('Razer'),
      price: 1490,
      stock: 80,
      isFeatured: true,
      shortDescription: 'Hot-swap switches with aluminum frame.',
      description:
        'Precision typing with per-key RGB, gasket mount, and wireless dual-mode connectivity.',
      specs: { Switches: 'Hot-swap tactile', Layout: '75%', Connectivity: '2.4G / BT / USB' },
      tags: ['keyboard', 'mechanical'],
    },
    {
      name: 'Aero Pro Wireless Mouse',
      sku: 'BRX-MS-001',
      category: cat('Mice'),
      brand: brand('Logitech'),
      price: 990,
      stock: 120,
      isFeatured: false,
      shortDescription: 'Lightweight sensor for competitive play.',
      description:
        'Ultra-light shell, optical switches, and 80-hour battery life for marathon sessions.',
      specs: { Sensor: '26K DPI', Weight: '58g', Battery: '80 hours' },
      tags: ['mouse', 'wireless'],
    },
    {
      name: 'Nova Surround Headset',
      sku: 'BRX-HP-001',
      category: cat('Headphones'),
      brand: brand('Razer'),
      price: 1790,
      stock: 55,
      isFeatured: true,
      shortDescription: 'Studio-tuned drivers with detachable mic.',
      description: 'Immersive spatial audio and memory-foam cushions for all-day comfort.',
      specs: { Drivers: '50mm', Mic: 'Detachable', Connectivity: 'USB / 3.5mm' },
      tags: ['headset', 'audio'],
    },
    {
      name: 'Force RTX 4080 Founders',
      sku: 'BRX-GPU-001',
      category: cat('Components'),
      brand: brand('NVIDIA'),
      price: 11990,
      stock: 18,
      isFeatured: true,
      shortDescription: 'Flagship graphics for creators and gamers.',
      description: 'Ray tracing, DLSS, and massive VRAM for future-proof performance.',
      specs: { VRAM: '16GB GDDR6X', Interface: 'PCIe 4.0', TGP: '320W' },
      tags: ['gpu', 'rtx', 'component'],
    },
    {
      name: 'ChargeDock USB-C Hub',
      sku: 'BRX-ACC-001',
      category: cat('Accessories'),
      brand: brand('Brynoxa'),
      price: 690,
      stock: 200,
      isFeatured: false,
      shortDescription: '8-in-1 hub with 100W pass-through.',
      description: 'HDMI 4K, SD/TF, USB-A/C, and Ethernet in a compact aluminum body.',
      specs: { Ports: '8-in-1', Power: '100W PD', Video: 'HDMI 4K60' },
      tags: ['hub', 'usb-c', 'accessory'],
    },
    {
      name: 'MSI Stealth 16 Studio',
      sku: 'MSI-LAP-016',
      category: cat('Laptops'),
      brand: brand('MSI'),
      price: 20990,
      stock: 15,
      isFeatured: true,
      shortDescription: 'Creator laptop with mini-LED display.',
      description: 'Studio-grade color accuracy and discrete graphics for 3D and video.',
      specs: { CPU: 'Intel Core i9', RAM: '32GB', GPU: 'RTX 4070', Display: '16" Mini-LED' },
      tags: ['laptop', 'msi', 'creator'],
    },
    {
      name: 'ASUS ROG Swift PG32',
      sku: 'ASUS-MON-032',
      category: cat('Monitors'),
      brand: brand('ASUS'),
      price: 12990,
      stock: 10,
      isFeatured: false,
      shortDescription: '32-inch 4K gaming monitor.',
      description: 'HDMI 2.1, variable refresh, and elite contrast for console and PC.',
      specs: { Size: '32"', Resolution: '4K', Refresh: '144Hz', HDR: 'HDR1600' },
      tags: ['monitor', '4k', 'rog'],
    },
  ];

  await Product.insertMany(
    products.map((p, i) => ({
      ...p,
      slug: slugify(p.name),
      images: [
        {
          url: placeholders[i % placeholders.length],
          alt: p.name,
          isPrimary: true,
        },
      ],
      isActive: true,
      lowStockThreshold: 5,
      averageRating: 4 + (i % 10) / 10,
      reviewCount: 5 + i,
      soldCount: 10 + i * 3,
    }))
  );

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
