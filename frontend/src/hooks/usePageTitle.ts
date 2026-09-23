import { useSeo, type SeoInput } from './useSeo'

/** Title helper for account/auth pages. Marketing pages should use useSeo. */
export function usePageTitle(title: string, options?: Omit<SeoInput, 'title'>) {
  useSeo({ title, ...options })
}

export { useSeo }
export type { SeoInput }
