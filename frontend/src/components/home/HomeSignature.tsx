import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ProductCarousel } from '@/components/product/ProductCarousel'
import { useT } from '@/hooks/useT'
import { SIGNATURE_BRAND } from '@/hooks/useHomeRows'
import type { Product } from '@/types'

/** Fewer than this and the section stays hidden */
export const SIGNATURE_MIN = 2

/**
 * Home: "Brynoxa Signature" — products with the Brynoxa touch, in a panel of its own (the brand
 * mark, a cyan glow, a signature line), so it does not look like the other rows. Staff choose the
 * products in Admin → Products → Home page; otherwise the shop's own Brynoxa-brand products.
 */
export function HomeSignature({ products }: { products: Product[] }) {
  const t = useT()
  if (products.length < SIGNATURE_MIN) return null

  return (
    <section id="signature" aria-labelledby="home-signature-heading" className="py-4 sm:py-8">
      <Container>
        <div className="relative overflow-hidden rounded-[1.25rem] border border-[color-mix(in_srgb,var(--brand)_45%,var(--border))] bg-[#080b0e] p-3 shadow-[0_0_60px_-20px_rgb(0_194_255_/_0.45)] sm:rounded-[2rem] sm:p-7">
          {/* The brand glow, behind everything */}
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_90%_at_0%_0%,rgb(0_194_255_/_0.18),transparent_60%),radial-gradient(50%_70%_at_100%_100%,rgb(0_194_255_/_0.10),transparent_60%)]"
            aria-hidden="true"
          />
          <div className="relative mb-3 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
            <div className="flex max-w-xl items-start gap-3 sm:gap-4">
              <span className="relative inline-flex size-10 shrink-0 overflow-hidden rounded-xl bg-[#080b0e] ring-1 ring-[rgb(0_194_255_/_0.4)] shadow-[0_0_24px_-4px_rgb(0_194_255_/_0.7)] sm:size-14 sm:rounded-2xl">
                <img src="/brand/brynoxa-mark-128.webp" alt="" width={56} height={56} className="h-full w-full scale-[1.08] object-cover" decoding="async" />
              </span>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand)] sm:text-[11px]">
                  <SiteIcon name="star" size={11} />
                  {t('home.signatureBadge')}
                </span>
                <h2 id="home-signature-heading" className="mt-1.5 font-display text-lg font-semibold leading-tight tracking-tight text-white sm:text-4xl">
                  {t('home.signatureTitle')}
                </h2>
                <p className="mt-1 text-[12.5px] leading-snug text-white/70 sm:mt-2 sm:text-base sm:leading-relaxed">{t('home.signatureBody')}</p>
              </div>
            </div>
            <Link
              to={`/shop?brand=${SIGNATURE_BRAND}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--brand)] px-3 text-xs font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 sm:h-10 sm:gap-2 sm:px-4 sm:text-sm"
            >
              {t('home.signatureViewAll')}
              <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
            </Link>
          </div>
          <div className="relative">
            <ProductCarousel products={products} />
          </div>
        </div>
      </Container>
    </section>
  )
}
