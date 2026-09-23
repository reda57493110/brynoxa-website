import { useEffect } from 'react'

export type SeoInput = {
  title: string
  description?: string
  /** Absolute URL or site-relative path (e.g. /brand/brynoxa-logo-social.png) */
  image?: string
  type?: 'website' | 'product' | 'article'
  /** Path override; defaults to current location */
  path?: string
  noIndex?: boolean
  /** Optional JSON-LD object (Product, Organization, etc.) */
  jsonLd?: Record<string, unknown> | null
}

const DEFAULT_DESCRIPTION =
  'Brynoxa — PCs, laptops, and components. Cash on delivery across Morocco.'
const DEFAULT_IMAGE = '/brand/brynoxa-logo-social.png'

function siteOrigin() {
  const fromEnv = import.meta.env.VITE_SITE_URL as string | undefined
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return 'https://brynoxa-website-lime.vercel.app'
}

function absoluteUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const origin = siteOrigin()
  return `${origin}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function upsertJsonLd(data: Record<string, unknown> | null | undefined) {
  const id = 'brynoxa-json-ld'
  let el = document.getElementById(id) as HTMLScriptElement | null
  if (!data) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('script')
    el.id = id
    el.type = 'application/ld+json'
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

/**
 * Sets document title + description + Open Graph / Twitter tags for the current view.
 * SPA note: social crawlers that do not run JS still need SSR/prerender later;
 * this still helps browsers, share previews that execute JS, and in-app discovery.
 */
export function useSeo({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  type = 'website',
  path,
  noIndex = false,
  jsonLd,
}: SeoInput) {
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : ''

  useEffect(() => {
    const previousTitle = document.title
    document.title = title

    const url = absoluteUrl(path ?? `${window.location.pathname}${window.location.search}`)
    const imageUrl = absoluteUrl(image)
    const robots = noIndex ? 'noindex, nofollow' : 'index, follow'

    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', robots)
    upsertMeta('property', 'og:site_name', 'Brynoxa')
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:image', imageUrl)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:type', type === 'product' ? 'product' : type)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', imageUrl)
    upsertLink('canonical', url.split('?')[0])
    upsertJsonLd(jsonLdKey ? (JSON.parse(jsonLdKey) as Record<string, unknown>) : null)

    return () => {
      document.title = previousTitle
      upsertJsonLd(null)
    }
  }, [title, description, image, type, path, noIndex, jsonLdKey])
}

/** Title-only helper used across account/auth pages. */
export function usePageTitle(title: string, options?: Omit<SeoInput, 'title'>) {
  useSeo({ title, ...options })
}
