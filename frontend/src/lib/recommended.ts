import type { Product } from '@/types'

/** A hand-picked "Complete your setup" product as shown in the admin picker. */
export type PickedProduct = Pick<Product, '_id' | 'name' | 'sku' | 'price' | 'stock' | 'isActive'> & {
  image?: string
}

export function toPicked(p: Product): PickedProduct {
  const image = p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url
  return { _id: p._id, name: p.name, sku: p.sku, price: p.price, stock: p.stock, isActive: p.isActive, image }
}
