import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { categoriesApi } from '@/api/categoriesApi'
import { brandsApi } from '@/api/brandsApi'
import { uploadApi } from '@/api/uploadApi'
import { getErrorMessage } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useToastStore } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import type { Brand } from '@/types'

type ImageSource = 'gallery' | 'url'

async function resolveBrandId(name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Brand is required')
  const existing = (await brandsApi.list(true)).data.data
  const match = existing.find((b) => b.name.toLowerCase() === trimmed.toLowerCase())
  if (match) return match._id
  const created = await adminApi.brands.create({ name: trimmed })
  return created.data.data._id
}

export function ProductForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.push)

  const categories = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: async () => (await categoriesApi.list(true)).data.data,
  })
  const existing = useQuery({
    queryKey: ['admin-product', id],
    queryFn: async () => (await adminApi.products.get(id!)).data.data,
    enabled: isEdit,
  })

  const fileRef = useRef<HTMLInputElement>(null)
  const [imageSource, setImageSource] = useState<ImageSource>('gallery')
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    sku: '',
    description: '',
    shortDescription: '',
    category: '',
    brand: '',
    price: 0,
    compareAtPrice: 0,
    stock: 0,
    tags: '',
    isFeatured: false,
    isCarousel: false,
    isActive: true,
    imageUrl: '',
  })

  useEffect(() => {
    if (existing.data) {
      const p = existing.data
      const url = p.images?.[0]?.url || ''
      const brandName =
        typeof p.brand === 'string' ? '' : (p.brand as Brand)?.name || ''
      setForm({
        name: p.name,
        sku: p.sku,
        description: p.description,
        shortDescription: p.shortDescription || '',
        category: typeof p.category === 'string' ? p.category : p.category._id,
        brand: brandName,
        price: p.price,
        compareAtPrice: p.compareAtPrice || 0,
        stock: p.stock,
        tags: (p.tags || []).join(', '),
        isFeatured: p.isFeatured,
        isCarousel: Boolean(p.isCarousel),
        isActive: p.isActive,
        imageUrl: url,
      })
      if (url) setImageSource('url')
    }
  }, [existing.data])

  const save = useMutation({
    mutationFn: async () => {
      const brandId = await resolveBrandId(form.brand)
      const payload = {
        name: form.name,
        sku: form.sku,
        description: form.description,
        shortDescription: form.shortDescription || undefined,
        category: form.category,
        brand: brandId,
        price: Number(form.price),
        compareAtPrice:
          form.compareAtPrice && form.compareAtPrice > Number(form.price)
            ? Number(form.compareAtPrice)
            : undefined,
        stock: Number(form.stock),
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        isFeatured: form.isFeatured,
        isCarousel: form.isCarousel,
        isActive: form.isActive,
        images: form.imageUrl
          ? [{ url: form.imageUrl, isPrimary: true, alt: form.name }]
          : [],
      }
      if (isEdit) return adminApi.products.update(id!, payload)
      return adminApi.products.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['brands'] })
      toast(isEdit ? 'Product updated' : 'Product created', 'success')
      navigate('/admin/products')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const onUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file', 'error')
      return
    }
    setUploading(true)
    try {
      const res = await uploadApi.image(file)
      setForm((f) => ({ ...f, imageUrl: res.data.data.url }))
      toast('Image uploaded', 'success')
    } catch (e) {
      toast(getErrorMessage(e), 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (isEdit && existing.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">
          {isEdit ? 'Edit product' : 'New product'}
        </h1>
        <Link to="/admin/products" className="text-sm text-[var(--brand-text)]">
          Back to products
        </Link>
      </div>

      <form
        className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!form.name.trim() || form.name.trim().length < 2) {
            toast('Enter a product name (at least 2 characters)', 'error')
            return
          }
          if (!form.sku.trim() || form.sku.trim().length < 2) {
            toast('Enter a SKU (at least 2 characters)', 'error')
            return
          }
          if (!form.category) {
            toast('Choose a category — add one in Settings if the list is empty', 'error')
            return
          }
          if (!form.brand.trim()) {
            toast('Enter a brand name', 'error')
            return
          }
          if (!form.description.trim() || form.description.trim().length < 10) {
            toast('Description must be at least 10 characters', 'error')
            return
          }
          if (Number.isNaN(form.price) || form.price < 0) {
            toast('Enter a valid sale price', 'error')
            return
          }
          if (!Number.isInteger(Number(form.stock)) || form.stock < 0) {
            toast('Stock must be a whole number (0 or more)', 'error')
            return
          }
          save.mutate()
        }}
      >
        <Input
          label="Name"
          className="sm:col-span-2"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          label="SKU"
          value={form.sku}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
          required
        />
        <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
          <Input
            label="Sale price (DH)"
            type="number"
            min={0}
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            required
          />
          <Input
            label="Original price (DH)"
            type="number"
            min={0}
            step="0.01"
            value={form.compareAtPrice || ''}
            onChange={(e) =>
              setForm({
                ...form,
                compareAtPrice: e.target.value === '' ? 0 : Number(e.target.value),
              })
            }
            placeholder="e.g. 1800"
          />
          <p className="sm:col-span-2 text-xs text-[var(--fg-muted)]">
            Customers pay the sale price. If original is higher (e.g. 1800 → 1500), the shop shows{' '}
            <span className="font-medium text-[var(--fg)]">1500 DH</span>{' '}
            <span className="line-through">1800 DH</span> with a −% badge.
          </p>
          {form.compareAtPrice > 0 && form.compareAtPrice > form.price ? (
            <div className="sm:col-span-2 flex flex-wrap items-baseline gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/40 px-4 py-3">
              <span className="text-xs text-[var(--fg-muted)]">Customer preview:</span>
              <span className="font-display text-lg font-semibold">
                {Number(form.price).toLocaleString('fr-MA')} DH
              </span>
              <span className="text-sm text-[var(--fg-muted)] line-through">
                {Number(form.compareAtPrice).toLocaleString('fr-MA')} DH
              </span>
              <span className="rounded-full bg-[var(--fg)] px-2 py-0.5 text-[11px] font-bold text-[var(--bg)]">
                −{Math.round((1 - form.price / form.compareAtPrice) * 100)}%
              </span>
            </div>
          ) : null}
        </div>
        <Input
          label="Stock"
          type="number"
          min={0}
          value={form.stock}
          onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
          required
        />
        <Select
          label="Category"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          required
          options={(categories.data || []).map((c) => ({ value: c._id, label: c.name }))}
        />
        <Input
          label="Brand"
          value={form.brand}
          onChange={(e) => setForm({ ...form, brand: e.target.value })}
          placeholder="e.g. ASUS, Brynoxa"
          required
        />
        <Textarea
          label="Short description"
          className="sm:col-span-2"
          value={form.shortDescription}
          onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
        />
        <Textarea
          label="Description"
          className="sm:col-span-2"
          rows={5}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
        />
        <Input
          label="Tags (comma separated)"
          className="sm:col-span-2"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
        />
        <div className="sm:col-span-2 space-y-3">
          <p className="text-sm font-medium">Product image</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setImageSource('gallery')}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition',
                imageSource === 'gallery'
                  ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]'
                  : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--brand)]'
              )}
            >
              <SiteIcon name="package-open" size={14} />
              From my gallery
            </button>
            <button
              type="button"
              onClick={() => setImageSource('url')}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition',
                imageSource === 'url'
                  ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]'
                  : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--brand)]'
              )}
            >
              <SiteIcon name="external" size={14} />
              Paste image address
            </button>
          </div>

          {imageSource === 'gallery' ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-muted)]/40 p-5">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
              />
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Choose a photo from your device</p>
                  <p className="mt-1 text-xs text-[var(--fg-muted)]">
                    JPG, PNG, or WebP — uploads to your store and fills the image for this product.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <SiteIcon name="plus" size={14} />
                  Browse gallery
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                label="Image address (URL)"
                placeholder="https://… or paste copied image link"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text').trim()
                  if (text) {
                    e.preventDefault()
                    setForm((f) => ({ ...f, imageUrl: text }))
                  }
                }}
              />
              <p className="text-xs text-[var(--fg-muted)]">
                Some shops (like joutech.ma) block pasted links. If the preview breaks, use{' '}
                <strong className="text-[var(--fg)]">From my gallery</strong> instead.
              </p>
            </div>
          )}

          {form.imageUrl ? (
            <div className="flex items-start gap-4 rounded-2xl border border-[var(--border)] p-3">
              <img
                src={form.imageUrl}
                alt="Product preview"
                referrerPolicy="no-referrer"
                className="h-24 w-24 rounded-xl object-cover bg-[var(--bg-muted)]"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.opacity = '0.35'
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Preview</p>
                <p className="mt-1 truncate text-xs text-[var(--fg-muted)]">{form.imageUrl}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                >
                  <SiteIcon name="trash" size={14} />
                  Remove image
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="sm:col-span-2 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.isFeatured}
              onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-medium">Featured (spotlight)</span>
              <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
                Big featured pick on the homepage — the main product customers see first.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.isCarousel}
              onChange={(e) => setForm({ ...form, isCarousel: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-medium">Homepage carousel</span>
              <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
                Appears in the sliding product carousel under Featured. Separate from the spotlight.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-medium">Active in shop</span>
              <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
                Hidden products stay in admin but are not visible to customers.
              </span>
            </span>
          </label>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" loading={save.isPending}>
            {isEdit ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </form>
    </div>
  )
}
