/**
 * Admin texts in English, French and Arabic (Moroccan staff). Step by step: the menu and the top
 * bar first; screens not translated yet stay in English. A key missing in FR / AR shows the English.
 */
export const ADMIN_LANGS = [
  { id: 'en', label: 'EN', name: 'English', dir: 'ltr' },
  { id: 'fr', label: 'FR', name: 'Français', dir: 'ltr' },
  { id: 'ar', label: 'AR', name: 'العربية', dir: 'rtl' },
] as const
export type AdminLang = (typeof ADMIN_LANGS)[number]['id']

const en = {
  // Menu groups
  'group.daily': 'Daily work',
  'group.catalog': 'Catalog',
  'group.money': 'Money',
  'group.marketing': 'Marketing',
  'group.store': 'Store',
  // Menu
  'nav.dashboard': 'Dashboard',
  'nav.orders': 'Orders',
  'nav.inbox': 'Inbox',
  'nav.customers': 'Customers',
  'nav.products': 'Products',
  'nav.inventory': 'Inventory',
  'nav.profit': 'Profit',
  'nav.analytics': 'Analytics',
  'nav.social': 'Social media',
  'nav.ads': 'Ads & campaigns',
  'nav.coupons': 'Coupons',
  'nav.notifications': 'Notifications',
  'nav.emails': 'Emails',
  'nav.settings': 'Settings',
  'nav.roles': 'Roles',
  'nav.security': 'Security',
  'nav.yourRole': 'Your role',
  'nav.closeMenu': 'Close menu',
  'nav.openMenu': 'Open menu',
  // Roles
  'role.admin': 'Owner',
  'role.orders': 'Orders',
  'role.catalog': 'Catalog',
  'role.support': 'Support',
  'role.marketing': 'Marketing',
  'role.staff': 'Staff',
  // Top bar
  'top.live': 'Live',
  'top.ordersToday': '{count} orders today',
  'top.orderToday': '1 order today',
  'top.workspace': '{role} workspace',
  'top.pending': '{count} pending',
  'top.store': 'Store',
  'top.viewStore': 'View store',
  'top.signOut': 'Sign out',
  'top.lightMode': 'Light mode',
  'top.darkMode': 'Dark mode',
  'top.language': 'Language',
} as const

export type AdminKey = keyof typeof en

const fr: Partial<Record<AdminKey, string>> = {
  'group.daily': 'Au quotidien',
  'group.catalog': 'Catalogue',
  'group.money': 'Argent',
  'group.marketing': 'Marketing',
  'group.store': 'Boutique',
  'nav.dashboard': 'Tableau de bord',
  'nav.orders': 'Commandes',
  'nav.inbox': 'Messages',
  'nav.customers': 'Clients',
  'nav.products': 'Produits',
  'nav.inventory': 'Stock',
  'nav.profit': 'Bénéfice',
  'nav.analytics': 'Statistiques',
  'nav.social': 'Réseaux sociaux',
  'nav.ads': 'Publicités & campagnes',
  'nav.coupons': 'Codes promo',
  'nav.notifications': 'Notifications',
  'nav.emails': 'E-mails',
  'nav.settings': 'Paramètres',
  'nav.roles': 'Rôles',
  'nav.security': 'Sécurité',
  'nav.yourRole': 'Votre rôle',
  'nav.closeMenu': 'Fermer le menu',
  'nav.openMenu': 'Ouvrir le menu',
  'role.admin': 'Propriétaire',
  'role.orders': 'Commandes',
  'role.catalog': 'Catalogue',
  'role.support': 'Support',
  'role.marketing': 'Marketing',
  'role.staff': 'Équipe',
  'top.live': 'En direct',
  'top.ordersToday': '{count} commandes aujourd’hui',
  'top.orderToday': '1 commande aujourd’hui',
  'top.workspace': 'Espace {role}',
  'top.pending': '{count} en attente',
  'top.store': 'Boutique',
  'top.viewStore': 'Voir la boutique',
  'top.signOut': 'Déconnexion',
  'top.lightMode': 'Mode clair',
  'top.darkMode': 'Mode sombre',
  'top.language': 'Langue',
}

const ar: Partial<Record<AdminKey, string>> = {
  'group.daily': 'الخدمة اليومية',
  'group.catalog': 'الكتالوج',
  'group.money': 'الفلوس',
  'group.marketing': 'التسويق',
  'group.store': 'المتجر',
  'nav.dashboard': 'لوحة التحكم',
  'nav.orders': 'الطلبات',
  'nav.inbox': 'الرسائل',
  'nav.customers': 'الزبناء',
  'nav.products': 'المنتجات',
  'nav.inventory': 'المخزون',
  'nav.profit': 'الربح',
  'nav.analytics': 'الإحصائيات',
  'nav.social': 'مواقع التواصل',
  'nav.ads': 'الإعلانات والحملات',
  'nav.coupons': 'كوبونات التخفيض',
  'nav.notifications': 'الإشعارات',
  'nav.emails': 'الإيميلات',
  'nav.settings': 'الإعدادات',
  'nav.roles': 'الأدوار',
  'nav.security': 'الأمان',
  'nav.yourRole': 'الدور ديالك',
  'nav.closeMenu': 'سد القائمة',
  'nav.openMenu': 'حل القائمة',
  'role.admin': 'المالك',
  'role.orders': 'الطلبات',
  'role.catalog': 'الكتالوج',
  'role.support': 'الدعم',
  'role.marketing': 'التسويق',
  'role.staff': 'الفريق',
  'top.live': 'مباشر',
  'top.ordersToday': '{count} طلبات اليوم',
  'top.orderToday': 'طلب واحد اليوم',
  'top.workspace': 'فضاء {role}',
  'top.pending': '{count} فالانتظار',
  'top.store': 'المتجر',
  'top.viewStore': 'شوف المتجر',
  'top.signOut': 'خروج',
  'top.lightMode': 'الوضع الفاتح',
  'top.darkMode': 'الوضع الداكن',
  'top.language': 'اللغة',
}

export const ADMIN_TEXT: Record<AdminLang, Partial<Record<AdminKey, string>>> = { en, fr, ar }

/** One admin text in a language (English when that language does not have it yet) */
export function adminText(lang: AdminLang, key: AdminKey, vars?: Record<string, string | number>) {
  let s = ADMIN_TEXT[lang][key] ?? en[key]
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}
