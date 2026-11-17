import type { Locale } from '@/i18n'
import type { Product } from '@/types'

type WithTexts = Pick<Product, 'description' | 'shortDescription' | 'translations'>

/**
 * The product's descriptions in the page language: the French / Arabic text typed in admin,
 * or the main text when that language was left empty.
 */
export function withProductText<T extends WithTexts>(product: T, locale: Locale): T {
  if (locale !== 'fr' && locale !== 'ar') return product
  const own = product.translations?.[locale]
  const description = own?.description?.trim()
  const shortDescription = own?.shortDescription?.trim()
  if (!description && !shortDescription) return product
  return {
    ...product,
    description: description || product.description,
    shortDescription: shortDescription || product.shortDescription,
  }
}
