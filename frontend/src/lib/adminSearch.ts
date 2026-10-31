import type { SiteIconName } from '@/components/ui/SiteIcon'

/**
 * Admin pages the search box can open, with the everyday words people type for them.
 * Who may open each one follows the page itself (lib/permissions canOpenAdminPath).
 */
export type AdminPageEntry = { label: string; hint: string; to: string; icon: SiteIconName; words: string }

export const ADMIN_PAGES: AdminPageEntry[] = [
  { label: 'Dashboard', hint: 'Today at a glance', to: '/admin', icon: 'dashboard', words: 'home overview today summary' },
  { label: 'Orders', hint: 'All orders', to: '/admin/orders', icon: 'cart', words: 'sales commandes list' },
  { label: 'Pending orders', hint: 'Orders → to confirm', to: '/admin/orders?status=pending', icon: 'cart', words: 'confirm new waiting call' },
  { label: 'New order', hint: 'Orders → add an order from Instagram, phone or the shop', to: '/admin/orders/new', icon: 'plus', words: 'add manual instagram facebook tiktok whatsapp phone shop sale' },
  { label: 'Deposits & payments', hint: 'Orders → deposits to check', to: '/admin/orders?view=deposits', icon: 'banknote', words: 'deposit acompte transfer proof receipt payment cash plus wafacash' },
  { label: 'Inbox', hint: 'Messages from the contact page', to: '/admin/messages', icon: 'inbox', words: 'messages contact questions mail' },
  { label: 'Customers', hint: 'All customers', to: '/admin/customers', icon: 'users', words: 'clients buyers people wholesale accounts' },
  { label: 'Products', hint: 'Catalog', to: '/admin/products', icon: 'package', words: 'catalog items laptops pc price photos' },
  { label: 'New product', hint: 'Products → add a product', to: '/admin/products/new', icon: 'plus', words: 'add create item' },
  { label: 'Inventory', hint: 'Stock overview', to: '/admin/inventory', icon: 'warehouse', words: 'stock quantity low out of stock warehouse' },
  { label: 'Receive stock', hint: 'Inventory → a delivery from a supplier', to: '/admin/inventory/receive', icon: 'truck', words: 'supplier receipt purchase arrival serial numbers' },
  { label: 'Returns', hint: 'Inventory → returned products to check', to: '/admin/inventory/returns', icon: 'refresh', words: 'returned items assess inspection retour' },
  { label: 'Repairs', hint: 'Inventory → products being repaired', to: '/admin/inventory/repairs', icon: 'wrench', words: 'repair fix technician broken' },
  { label: 'Stock movements', hint: 'Inventory → every stock change', to: '/admin/inventory/movements', icon: 'sliders', words: 'history ledger log write off' },
  { label: 'Complete your setup', hint: 'Accessories suggested with each product', to: '/admin/setup', icon: 'layers', words: 'recommendations accessories bundle upsell' },
  { label: 'Profit', hint: 'What the shop really earned', to: '/admin/profit', icon: 'banknote', words: 'money earnings margin benefit net' },
  { label: 'Expenses', hint: 'Profit → ads, rent, packaging…', to: '/admin/profit?tab=expenses', icon: 'banknote', words: 'spending ads facebook rent salary costs' },
  { label: 'Product costs', hint: 'Profit → what each product cost you', to: '/admin/profit?tab=costs', icon: 'banknote', words: 'purchase price cost price buying' },
  { label: 'Courier prices', hint: 'Profit → what deliveries cost you', to: '/admin/profit?tab=courier', icon: 'truck', words: 'delivery cost shipping courier amana' },
  { label: 'Analytics', hint: 'Sales charts and reports', to: '/admin/analytics', icon: 'sliders', words: 'reports revenue charts statistics best sellers cities' },
  { label: 'Coupons', hint: 'Discount codes', to: '/admin/coupons', icon: 'ticket', words: 'discount promo code reduction offer' },
  { label: 'Push notifications', hint: 'Send a message to phones', to: '/admin/notifications', icon: 'bell', words: 'push campaign phone alert' },
  { label: 'Emails', hint: 'Emails sent and sending one', to: '/admin/emails', icon: 'mail', words: 'send email mail customers' },
  { label: 'Settings', hint: 'Store settings', to: '/admin/settings', icon: 'settings', words: 'options configuration' },
  { label: 'General settings', hint: 'Settings → store name, storage', to: '/admin/settings?tab=general', icon: 'settings', words: 'store name support email storage database cloudinary' },
  { label: 'Orders & payments settings', hint: 'Settings → cash on delivery, deposits, payment options', to: '/admin/settings?tab=orders', icon: 'banknote', words: 'payment methods bank rib cash plus wafacash deposit shipping delivery fee free shipping tax' },
  { label: 'Storefront settings', hint: 'Settings → what customers see first', to: '/admin/settings?tab=storefront', icon: 'monitor', words: 'home page deals hero banner shop header' },
  { label: 'Catalog settings', hint: 'Settings → categories and brands', to: '/admin/settings?tab=catalog', icon: 'layers', words: 'categories brands specs templates' },
  { label: 'Inventory settings', hint: 'Settings → storage places, receiving', to: '/admin/settings?tab=inventory', icon: 'warehouse', words: 'locations statuses inspection' },
  { label: 'Customers & pricing settings', hint: 'Settings → wholesale tiers, segments', to: '/admin/settings?tab=customers', icon: 'users', words: 'wholesale tiers business segments vip' },
  { label: 'Automatic emails', hint: 'Settings → notifications', to: '/admin/settings?tab=notifications', icon: 'mail', words: 'email notifications messages templates resend' },
  { label: 'Roles', hint: 'Staff and what they can do', to: '/admin/roles', icon: 'shield', words: 'staff team employees permissions users access activity' },
  { label: 'Security', hint: 'Password and 2-step sign-in', to: '/admin/security', icon: 'shield', words: 'password 2-step mfa authenticator sign in' },
]

/** Lowercase, without accents, so "Retour" finds "retour" and "é" finds "e". */
export function searchText(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** Pages whose name, hint or words contain every word typed (best matches first). */
export function matchPages(query: string, pages: AdminPageEntry[] = ADMIN_PAGES) {
  const words = searchText(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  return pages
    .map((p) => {
      const label = searchText(p.label)
      const all = `${label} ${searchText(p.hint)} ${p.words}`
      if (!words.every((w) => all.includes(w))) return null
      // Name starting with the query first, then name containing it, then the rest
      const score = label.startsWith(words[0]) ? 0 : label.includes(words[0]) ? 1 : 2
      return { page: p, score }
    })
    .filter((x): x is { page: AdminPageEntry; score: number } => Boolean(x))
    .sort((a, b) => a.score - b.score)
    .map((x) => x.page)
}
