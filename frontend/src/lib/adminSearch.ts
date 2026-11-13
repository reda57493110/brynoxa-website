import type { SiteIconName } from '@/components/ui/SiteIcon'

/**
 * What the admin search box can open without asking the server: pages, settings and actions
 * ("Edit a product", "Add a coupon"…), each with the everyday words people type for it, in
 * English and French. Who may open each one follows the page itself (canOpenAdminPath).
 */
export type AdminPageEntry = {
  label: string
  hint: string
  to: string
  icon: SiteIconName
  words: string
  /** An action ("Add…", "Edit…") rather than a page */
  action?: boolean
}

export const ADMIN_PAGES: AdminPageEntry[] = [
  // Pages
  { label: 'Dashboard', hint: 'Today at a glance', to: '/admin', icon: 'dashboard', words: 'home overview today summary accueil tableau de bord' },
  { label: 'Orders', hint: 'All orders', to: '/admin/orders', icon: 'cart', words: 'sales commandes list ventes' },
  { label: 'Pending orders', hint: 'Orders → to confirm', to: '/admin/orders?status=pending', icon: 'cart', words: 'confirm new waiting call attente confirmer' },
  { label: 'Delivered orders', hint: 'Orders → delivered', to: '/admin/orders?status=delivered', icon: 'check', words: 'delivered done completed livrees livre' },
  { label: 'Deposits & payments', hint: 'Orders → deposits to check', to: '/admin/orders?view=deposits', icon: 'banknote', words: 'deposit acompte transfer virement proof receipt payment paiement cash plus wafacash' },
  { label: 'Inbox', hint: 'Messages from the contact page', to: '/admin/messages', icon: 'inbox', words: 'messages contact questions mail boite reception' },
  { label: 'Customers', hint: 'All customers', to: '/admin/customers', icon: 'users', words: 'clients buyers people wholesale accounts acheteurs' },
  { label: 'Products', hint: 'Catalog: open a product to edit it', to: '/admin/products', icon: 'package', words: 'produits catalog catalogue items laptops pc price prix photos edit modify change update manage list' },
  { label: 'Inventory', hint: 'Stock overview', to: '/admin/inventory', icon: 'warehouse', words: 'stock quantity quantite low out of stock rupture warehouse entrepot' },
  { label: 'Returns', hint: 'Inventory → returned products to check', to: '/admin/inventory/returns', icon: 'refresh', words: 'returned items assess inspection retour retours' },
  { label: 'Repairs', hint: 'Inventory → products being repaired', to: '/admin/inventory/repairs', icon: 'wrench', words: 'repair fix technician broken reparation panne' },
  { label: 'Stock movements', hint: 'Inventory → every stock change', to: '/admin/inventory/movements', icon: 'sliders', words: 'history ledger log write off historique mouvements' },
  { label: 'Complete your setup', hint: 'Accessories suggested with each product', to: '/admin/products?board=setup', icon: 'layers', words: 'recommendations accessories accessoires bundle upsell suggestions' },
  { label: 'Profit', hint: 'What the shop really earned', to: '/admin/profit', icon: 'banknote', words: 'money earnings margin benefit net benefice marge argent gains' },
  { label: 'Expenses', hint: 'Profit → ads, rent, packaging…', to: '/admin/profit?tab=expenses', icon: 'banknote', words: 'spending ads rent salary costs depenses loyer pub' },
  { label: 'Product costs', hint: 'Profit → what each product cost you', to: '/admin/profit?tab=costs', icon: 'banknote', words: 'purchase price cost price buying prix achat cout' },
  { label: 'Courier prices', hint: 'Profit → what deliveries cost you', to: '/admin/profit?tab=courier', icon: 'truck', words: 'delivery cost shipping courier amana livreur livraison' },
  { label: 'Analytics', hint: 'Sales charts and reports', to: '/admin/analytics', icon: 'sliders', words: 'reports revenue charts statistics stats best sellers cities rapports chiffre affaires' },
  { label: 'Ads & social media', hint: 'Campaigns, what they cost, orders they bring', to: '/admin/ads', icon: 'megaphone', words: 'ads advertising facebook meta campaign sponsored boost social media post spend budget roas tracking link utm publicite pub reseaux sociaux' },
  { label: 'Coupons', hint: 'Discount codes', to: '/admin/coupons', icon: 'ticket', words: 'discount promo code reduction offer remise' },
  { label: 'Push notifications', hint: 'Send a message to phones', to: '/admin/notifications', icon: 'bell', words: 'push campaign phone alert notification' },
  { label: 'Emails', hint: 'Emails sent and sending one', to: '/admin/emails', icon: 'mail', words: 'send email mail customers courriel' },
  { label: 'Settings', hint: 'Store settings', to: '/admin/settings', icon: 'settings', words: 'options configuration parametres reglages' },
  { label: 'General settings', hint: 'Settings → store name, storage', to: '/admin/settings?tab=general', icon: 'settings', words: 'store name support email storage database cloudinary stockage boutique nom' },
  { label: 'Payment options', hint: 'Orders → Deposits & payments → your payment details', to: '/admin/orders?view=deposits', icon: 'banknote', words: 'payment methods bank rib cash plus wafacash deposit instructions paiement' },
  { label: 'Home page & shop header', hint: 'Products → Home page, Setups, Shop header', to: '/admin/products?board=home', icon: 'monitor', words: 'home page deals hero banner shop header storefront accueil vitrine' },
  { label: 'Contact & business', hint: 'Settings → WhatsApp, phone, social pages, legal details', to: '/admin/settings?tab=contact', icon: 'phone', words: 'contact whatsapp phone number telephone numero social pages links reseaux business name ice rc address legal adresse entreprise' },
  { label: 'Delivery prices', hint: 'Settings → delivery price, free from, by city', to: '/admin/settings?tab=delivery', icon: 'truck', words: 'delivery fee shipping price free shipping city cities frais livraison gratuite ville' },
  { label: 'Brands', hint: 'Settings → Catalog → brands and logos', to: '/admin/settings?tab=catalog', icon: 'tag', words: 'brands brand logo marque marques rename' },
  { label: 'Catalog settings', hint: 'Settings → categories and brands', to: '/admin/settings?tab=catalog', icon: 'layers', words: 'categories brands marques specs templates' },
  { label: 'Inventory settings', hint: 'Inventory → Settings: storage places, statuses, inspection', to: '/admin/inventory/settings', icon: 'warehouse', words: 'locations statuses inspection emplacements' },
  { label: 'Customers & pricing settings', hint: 'Settings → wholesale tiers, segments', to: '/admin/settings?tab=customers', icon: 'users', words: 'wholesale tiers business segments vip grossiste' },
  { label: 'Automatic emails', hint: 'Settings → notifications', to: '/admin/settings?tab=notifications', icon: 'mail', words: 'email notifications messages templates resend' },
  { label: 'Roles', hint: 'Staff and what they can do', to: '/admin/roles', icon: 'shield', words: 'staff team employees permissions users access activity equipe employes' },
  { label: 'Security', hint: 'Password and 2-step sign-in', to: '/admin/security', icon: 'shield', words: 'password 2-step mfa authenticator sign in mot de passe securite' },

  // Actions (what people want to do)
  { label: 'Edit a product', hint: 'Products → search it, then open it', to: '/admin/products', icon: 'pencil', words: 'edit modify change update product produit modifier changer photos description', action: true },
  { label: 'Change a price', hint: 'Products → open the product → Price', to: '/admin/products', icon: 'pencil', words: 'price prix promo discount sale change edit modifier', action: true },
  { label: 'Add a product', hint: 'Products → new product', to: '/admin/products/new', icon: 'plus', words: 'add new create product produit ajouter nouveau creer', action: true },
  { label: 'Add an order', hint: 'Orders → an order from Instagram, phone or the shop', to: '/admin/orders/new', icon: 'plus', words: 'add new create order manual instagram facebook tiktok whatsapp phone shop sale commande ajouter nouvelle', action: true },
  { label: 'Return & refund', hint: 'Open the delivered order → Return & refund', to: '/admin/orders?status=delivered', icon: 'refresh', words: 'return refund money back rembourser remboursement retour annuler cancel sale', action: true },
  { label: 'Record a deposit', hint: 'Orders → Deposits & payments', to: '/admin/orders?view=deposits', icon: 'banknote', words: 'record deposit acompte received paid recu', action: true },
  { label: 'Receive stock', hint: 'Inventory → a delivery from a supplier', to: '/admin/inventory/receive', icon: 'truck', words: 'receive supplier receipt purchase arrival serial numbers add stock fournisseur reception ajouter stock', action: true },
  { label: 'Add an expense', hint: 'Profit → Expenses', to: '/admin/profit?tab=expenses', icon: 'plus', words: 'add expense spending ads rent depense ajouter', action: true },
  { label: 'Add a coupon', hint: 'Coupons → new code', to: '/admin/coupons', icon: 'ticket', words: 'add new create coupon promo code discount ajouter creer remise', action: true },
  { label: 'Add a staff member', hint: 'Roles → add staff', to: '/admin/roles', icon: 'users', words: 'add staff employee user team ajouter employe membre', action: true },
  { label: 'Send a push notification', hint: 'Push notifications → new message', to: '/admin/notifications', icon: 'bell', words: 'send push notification campaign envoyer', action: true },
  { label: 'Change my password', hint: 'Security', to: '/admin/security', icon: 'shield', words: 'change password mot de passe changer', action: true },
  { label: 'Change home page deals', hint: 'Products → Home page → Deals', to: '/admin/products?board=home', icon: 'monitor', words: 'home page deals accueil offres change banner hero', action: true },
  { label: 'Set the delivery fee', hint: 'Settings → Delivery', to: '/admin/settings?tab=delivery', icon: 'truck', words: 'delivery fee shipping price frais livraison set change', action: true },
  { label: 'Change the WhatsApp number', hint: 'Settings → Contact & business', to: '/admin/settings?tab=contact', icon: 'phone', words: 'change whatsapp phone number numero changer', action: true },
  { label: 'Add a category', hint: 'Settings → Catalog', to: '/admin/settings?tab=catalog', icon: 'layers', words: 'add category categorie brand marque ajouter', action: true },
]

/** Words that only say what to do or are filler: not looked up in orders, customers, products. */
const COMMAND_WORDS = new Set([
  'edit', 'modify', 'change', 'update', 'open', 'show', 'view', 'see', 'find', 'search', 'go', 'goto', 'manage',
  'delete', 'remove', 'add', 'new', 'create', 'the', 'a', 'an', 'my', 'to', 'for', 'of', 'page', 'in', 'on', 'with',
  'modifier', 'changer', 'voir', 'ouvrir', 'chercher', 'ajouter', 'supprimer', 'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'mon', 'ma', 'mes',
  'product', 'products', 'produit', 'produits', 'order', 'orders', 'commande', 'commandes', 'customer', 'customers', 'client', 'clients',
])

/** Lowercase, without accents, so "Retour" finds "retour" and "é" finds "e". */
export function searchText(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** The meaningful part to look up in orders, customers and products: "edit hp" → "hp". */
export function dataQuery(query: string) {
  const words = query.trim().split(/\s+/).filter(Boolean)
  const kept = words.filter((w) => !COMMAND_WORDS.has(searchText(w)))
  return kept.join(' ')
}

/** At most one letter added, missing or wrong ("prodcut" ~ "product", "invetory" ~ "inventory"). */
function nearly(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else {
      // swapped letters count as one mistake
      if (a[i + 1] === b[j] && a[i] === b[j + 1]) {
        i += 2
        j += 2
        continue
      }
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** How well one typed word matches a text: 3 whole word, 2 start of a word, 1 small typo, 0 no. */
function wordScore(word: string, tokens: string[]) {
  if (tokens.includes(word)) return 3
  if (word.length >= 2 && tokens.some((t) => t.startsWith(word))) return 2
  if (word.length >= 4 && tokens.some((t) => t.length >= 4 && nearly(word, t))) return 1
  return 0
}

/**
 * Pages, settings and actions ranked by how well they match: every typed word counts, the name
 * counts more than the description, small typos are forgiven. Anything with no meaningful word
 * matching is left out.
 */
export function matchPages(query: string, pages: AdminPageEntry[] = ADMIN_PAGES) {
  const words = searchText(query).split(/[\s/,.]+/).filter(Boolean)
  if (!words.length) return []
  const meaningful = words.filter((w) => !COMMAND_WORDS.has(w) || words.length === 1)
  return pages
    .map((p, order) => {
      const label = searchText(p.label).split(/[\s&→,'’-]+/).filter(Boolean)
      const rest = searchText(`${p.hint} ${p.words}`).split(/[\s&→,'’/-]+/).filter(Boolean)
      let score = 0
      let matched = 0
      let meaningfulMatched = 0
      for (const w of words) {
        const inLabel = wordScore(w, label)
        const s = Math.max(inLabel * 2, wordScore(w, rest))
        if (s > 0) {
          matched++
          if (!COMMAND_WORDS.has(w) || words.length === 1) meaningfulMatched++
        }
        score += s
      }
      if (!matched || (meaningful.length && !meaningfulMatched)) return null
      // Every word found ranks above some words found; actions first when a verb was typed
      score += matched === words.length ? 20 : 0
      if (p.action && words.some((w) => COMMAND_WORDS.has(w))) score += 4
      return { page: p, score, order }
    })
    .filter((x): x is { page: AdminPageEntry; score: number; order: number } => Boolean(x))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((x) => x.page)
}
