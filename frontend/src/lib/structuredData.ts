/**
 * Data for Google (schema.org JSON-LD): the shop itself on the home page, and each product with its
 * price, stock, condition, returns and delivery country, so search results can show price / stock.
 */
import { CONTACT } from '@/lib/site'
import type { Brand, Category, Product } from '@/types'

function origin() {
  const fromEnv = import.meta.env.VITE_SITE_URL as string | undefined
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return typeof window !== 'undefined' ? window.location.origin : 'https://brynoxa-website-lime.vercel.app'
}

export const absolute = (pathOrUrl: string) =>
  /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${origin()}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`

const SELLER = () => ({ '@type': 'Organization', '@id': `${origin()}/#organization`, name: 'Brynoxa' })

/** Home page: who we are, how to reach us, and the shop search (search box in Google). */
export function organizationData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'OnlineStore',
        '@id': `${origin()}/#organization`,
        name: 'Brynoxa',
        url: `${origin()}/`,
        logo: absolute('/brand/icon-192.png'),
        image: absolute('/brand/brynoxa-logo-social.png'),
        email: CONTACT.email.value,
        telephone: '+' + CONTACT.whatsapp.number,
        areaServed: { '@type': 'Country', name: 'Morocco' },
        address: { '@type': 'PostalAddress', addressCountry: 'MA' },
        currenciesAccepted: 'MAD',
        paymentAccepted: 'Cash',
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '+' + CONTACT.whatsapp.number,
          contactType: 'customer service',
          areaServed: 'MA',
          availableLanguage: ['French', 'Arabic', 'English'],
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${origin()}/#website`,
        url: `${origin()}/`,
        name: 'Brynoxa',
        publisher: { '@id': `${origin()}/#organization` },
        inLanguage: ['en', 'fr', 'ar'],
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${origin()}/shop?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }
}

const CONDITION: Record<string, string> = {
  new: 'https://schema.org/NewCondition',
  refurbished: 'https://schema.org/RefurbishedCondition',
  used: 'https://schema.org/UsedCondition',
}

/** One product page: the product, its offer, and the breadcrumb (Shop › Category › Product). */
export function productData(p: Product, description: string) {
  const url = `${origin()}/product/${p.slug}`
  const brand = typeof p.brand === 'object' && p.brand ? (p.brand as Brand).name : undefined
  const category = typeof p.category === 'object' && p.category ? (p.category as Category) : null
  const images = (p.images ?? []).map((i) => absolute(i.url))
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${url}#product`,
        name: p.variantLabel ? `${p.name} (${p.variantLabel})` : p.name,
        description,
        sku: p.sku,
        image: images.length ? images : undefined,
        brand: brand ? { '@type': 'Brand', name: brand } : undefined,
        category: category?.name,
        url,
        offers: {
          '@type': 'Offer',
          url,
          priceCurrency: 'MAD',
          price: p.price,
          itemCondition: CONDITION[p.condition ?? 'new'] ?? CONDITION.new,
          availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          seller: SELLER(),
          acceptedPaymentMethod: { '@type': 'PaymentMethod', name: 'Cash on delivery' },
          eligibleRegion: { '@type': 'Country', name: 'MA' },
          hasMerchantReturnPolicy: {
            '@type': 'MerchantReturnPolicy',
            applicableCountry: 'MA',
            returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
            merchantReturnDays: 14,
            returnMethod: 'https://schema.org/ReturnByMail',
          },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Shop', item: `${origin()}/shop` },
          ...(category
            ? [{ '@type': 'ListItem', position: 2, name: category.name, item: `${origin()}/category/${category.slug}` }]
            : []),
          { '@type': 'ListItem', position: category ? 3 : 2, name: p.name, item: url },
        ],
      },
    ],
  }
}
