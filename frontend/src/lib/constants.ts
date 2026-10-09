export const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
] as const

export const COMPARE_MAX = 4
