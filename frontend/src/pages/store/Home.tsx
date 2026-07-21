import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { productsApi } from '@/api/productsApi'
import { categoriesApi } from '@/api/categoriesApi'
import { Container } from '@/components/ui/Container'
import { ProductGrid } from '@/components/product/ProductGrid'
import { Skeleton } from '@/components/ui/Skeleton'

export function Home() {
  const featured = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: async () => (await productsApi.list({ featured: true, limit: 8 })).data.data,
  })
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.list()).data.data,
  })

  return (
    <>
      <section className="relative min-h-[100svh] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(135deg, #080b0e 0%, #1a2229 45%, #0f1419 100%), radial-gradient(ellipse 70% 60% at 70% 40%, rgba(0,194,255,0.22), transparent 60%)',
            backgroundBlendMode: 'normal',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
        />
        <Container className="relative z-10 flex min-h-[100svh] flex-col justify-center pb-24 pt-10 text-white">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-display text-5xl font-bold tracking-tight sm:text-7xl md:text-8xl"
          >
            Brynox<span className="text-[var(--brand)]">a</span>
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 max-w-2xl font-display text-2xl font-semibold text-balance text-white/95 sm:text-3xl"
          >
            Precision gear for modern living
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-4 max-w-lg text-base text-white/70 sm:text-lg"
          >
            Curated electronics and lifestyle essentials with electric clarity and graphite calm.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8"
          >
            <Link
              to="/shop"
              className="group inline-flex h-12 items-center gap-2 rounded-2xl bg-[var(--brand)] px-6 text-base font-semibold text-[var(--brand-fg)] shadow-soft transition hover:brightness-110"
            >
              Shop collection
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-semibold sm:text-3xl">Featured</h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">Handpicked pieces from the latest drop.</p>
            </div>
            <Link to="/shop" className="text-sm font-medium text-[var(--brand)] hover:underline">
              View all
            </Link>
          </div>
          <ProductGrid products={featured.data} loading={featured.isLoading} />
        </Container>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--bg-elevated)] py-16 sm:py-20">
        <Container>
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">Shop by category</h2>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">Find your lane and dig in.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.isLoading
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)
              : categories.data?.map((c, i) => (
                  <motion.div
                    key={c._id}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Link
                      to={`/category/${c.slug}`}
                      className="group relative flex h-36 items-end overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] p-5 shadow-soft transition hover:border-[var(--brand)]"
                    >
                      {c.image ? (
                        <img
                          src={c.image}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover opacity-40 transition group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,color-mix(in_srgb,var(--brand)_25%,transparent),transparent_55%)]" />
                      )}
                      <span className="relative font-display text-xl font-semibold">{c.name}</span>
                    </Link>
                  </motion.div>
                ))}
          </div>
        </Container>
      </section>
    </>
  )
}
