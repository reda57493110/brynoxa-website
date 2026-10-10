import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { categoriesApi } from '@/api/categoriesApi'
import { brandsApi } from '@/api/brandsApi'
import { uploadApi } from '@/api/uploadApi'
import { prepareImageForUpload } from '@/lib/prepareImage'
import { getErrorMessage } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useToastStore } from '@/store/toastStore'
import { HERO_NONE, useHeroProduct } from '@/hooks/useHeroProduct'
import { cn } from '@/lib/cn'
import type { Brand, Product, ProductCondition } from '@/types'
import { RecommendedPicker } from '@/components/admin/RecommendedPicker'
import { toPicked, type PickedProduct } from '@/lib/recommended'

type ImageSource = 'gallery' | 'url'
type FormImage = { url: string; publicId?: string }

const MAX_IMAGES = 8

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
  const adminSettings = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => (await adminApi.settings.get()).data.data,
  })
  const existing = useQuery({
    queryKey: ['admin-product', id],
    queryFn: async () => (await adminApi.products.get(id!)).data.data,
    enabled: isEdit,
  })
  const shopHeroShown = useHeroProduct('shop')
  const isShownInShopHero = isEdit && shopHeroShown.product?._id === id
  const isAutoShopHero = isShownInShopHero && !shopHeroShown.pinned
  const [shopHero, setShopHero] = useState(false)

  useEffect(() => {
    if (isEdit && !shopHeroShown.pending) setShopHero(isShownInShopHero)
  }, [isEdit, shopHeroShown.pending, isShownInShopHero])

  const fileRef = useRef<HTMLInputElement>(null)
  const [imageSource, setImageSource] = useState<ImageSource>('gallery')
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null)
  const [urlDraft, setUrlDraft] = useState('')
  const [form, setForm] = useState<{
    name: string
    sku: string
    description: string
    shortDescription: string
    category: string
    brand: string
    price: number
    compareAtPrice: number
    costPrice: string
    depositType: 'none' | 'fixed' | 'percent'
    depositValue: number
    stock: number
    condition: ProductCondition
    conditionNote: string
    serialTracking: boolean
    inventoryLocation: string
    tags: string
    isFeatured: boolean
    isCarousel: boolean
    isActive: boolean
    images: FormImage[]
    recommended: PickedProduct[]
    recommendedOnly: boolean
  }>({
    name: '',
    sku: '',
    description: '',
    shortDescription: '',
    category: '',
    brand: '',
    price: 0,
    compareAtPrice: 0,
    costPrice: '',
    depositType: 'none',
    depositValue: 0,
    stock: 0,
    condition: 'new',
    conditionNote: '',
    serialTracking: false,
    inventoryLocation: '',
    tags: '',
    isFeatured: false,
    isCarousel: false,
    isActive: true,
    images: [],
    recommended: [],
    recommendedOnly: false,
  })
  const initialFormRef = useRef(JSON.stringify(form))

  useEffect(() => {
    if (existing.data) {
      const p = existing.data
      const images = [...(p.images || [])]
        .sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)))
        .map(({ url, publicId }) => ({ url, publicId }))
      const brandName =
        typeof p.brand === 'string' ? '' : (p.brand as Brand)?.name || ''
      const nextForm = {
        name: p.name,
        sku: p.sku,
        description: p.description,
        shortDescription: p.shortDescription || '',
        category: typeof p.category === 'string' ? p.category : p.category._id,
        brand: brandName,
        price: p.price,
        compareAtPrice: p.compareAtPrice || 0,
        costPrice: p.costPrice != null ? String(p.costPrice) : '',
        depositType: p.deposit?.type ?? ('none' as const),
        depositValue: p.deposit?.value ?? 0,
        stock: p.stock,
        condition: p.condition ?? ('new' as const),
        conditionNote: p.conditionNote || '',
        serialTracking: Boolean(p.serialTracking),
        inventoryLocation: p.inventoryLocation || '',
        tags: (p.tags || []).join(', '),
        isFeatured: p.isFeatured,
        isCarousel: Boolean(p.isCarousel),
        isActive: p.isActive,
        images,
        recommended: (p.recommended || [])
          .filter((r): r is Product => typeof r === 'object' && r !== null)
          .map(toPicked),
        recommendedOnly: Boolean(p.recommendedOnly),
      }
      initialFormRef.current = JSON.stringify(nextForm)
      setForm(nextForm)
    }
  }, [existing.data])

  const locationOptions = Array.from(
    new Set(
      [...(adminSettings.data?.inventoryLocations || []), form.inventoryLocation.trim()].filter(
        Boolean
      )
    )
  )

  const isDirty = JSON.stringify(form) !== initialFormRef.current
  const costNumber =
    form.costPrice.trim() !== '' && Number.isFinite(Number(form.costPrice))
      ? Number(form.costPrice)
      : null
  const salePrice = Number(form.price)

  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

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
        costPrice: form.costPrice.trim() === '' ? null : Number(form.costPrice),
        deposit:
          form.depositType !== 'none' && Number(form.depositValue) > 0
            ? { type: form.depositType, value: Number(form.depositValue) }
            : null,
        // Stock only changes through the inventory ledger once a product exists;
        // on create it is recorded as the opening movement.
        ...(isEdit ? {} : { stock: Number(form.stock) }),
        condition: form.condition,
        conditionNote: form.condition === 'new' ? '' : form.conditionNote.trim(),
        serialTracking: form.serialTracking,
        inventoryLocation: form.inventoryLocation.trim(),
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        isFeatured: form.isFeatured,
        isCarousel: form.isCarousel,
        isActive: form.isActive,
        recommended: form.recommended.map((r) => r._id),
        recommendedOnly: form.recommendedOnly,
        images: form.images.map((img, i) => ({
          url: img.url,
          publicId: img.publicId,
          alt: form.name,
          isPrimary: i === 0,
        })),
      }
      const res = isEdit
        ? await adminApi.products.update(id!, payload)
        : await adminApi.products.create(payload)
      const savedId = res.data.data?._id || id
      if (savedId && shopHero && !isShownInShopHero) {
        await adminApi.settings.update({ pageHeroProducts: { shop: savedId } })
      } else if (savedId && !shopHero && isShownInShopHero) {
        await adminApi.settings.update({ pageHeroProducts: { shop: HERO_NONE } })
      }
      return res
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['brands'] })
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      qc.invalidateQueries({ queryKey: ['hero-product'] })
      qc.invalidateQueries({ queryKey: ['hero-auto-products'] })
      toast(isEdit ? 'Product updated' : 'Product created', 'success')
      navigate('/admin/products')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const room = MAX_IMAGES - form.images.length

  const onUpload = async (fileList: FileList) => {
    const all = Array.from(fileList)
    const files = all.slice(0, room)
    if (fileRef.current) fileRef.current.value = ''
    if (!files.length) {
      toast(`A product can have up to ${MAX_IMAGES} photos`, 'error')
      return
    }
    if (all.length > files.length) {
      toast(`Only the first ${files.length} photos were added (max ${MAX_IMAGES})`, 'info')
    }
    let added = 0
    setUploading({ done: 0, total: files.length })
    for (const [i, file] of files.entries()) {
      try {
        const { blob, filename } = await prepareImageForUpload(file)
        const res = await uploadApi.image(blob, filename)
        const { url, publicId } = res.data.data
        setForm((f) => ({ ...f, images: [...f.images, { url, publicId }].slice(0, MAX_IMAGES) }))
        added += 1
      } catch (e) {
        toast(`${file.name}: ${getErrorMessage(e)}`, 'error')
      }
      setUploading({ done: i + 1, total: files.length })
    }
    setUploading(null)
    if (added) toast(added === 1 ? 'Photo added' : `${added} photos added`, 'success')
  }

  const addImageUrl = (raw: string) => {
    const url = raw.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) {
      toast('Paste a full image address starting with https://', 'error')
      return
    }
    if (room <= 0) {
      toast(`A product can have up to ${MAX_IMAGES} photos`, 'error')
      return
    }
    if (form.images.some((img) => img.url === url)) {
      toast('This photo is already added', 'info')
      return
    }
    setForm((f) => ({ ...f, images: [...f.images, { url }] }))
    setUrlDraft('')
  }

  const removeImage = (index: number) =>
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }))

  const moveImage = (index: number, to: number) =>
    setForm((f) => {
      if (to < 0 || to >= f.images.length) return f
      const images = [...f.images]
      const [item] = images.splice(index, 1)
      images.splice(to, 0, item)
      return { ...f, images }
    })

  if (isEdit && existing.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  if (isEdit && existing.isError) {
    return <QueryErrorState onRetry={() => existing.refetch()} />
  }

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4 sm:space-y-6">
      <div className="min-w-0">
        <h1 className="font-display text-lg font-semibold sm:text-2xl">
          {isEdit ? 'Edit product' : 'New product'}
        </h1>
        <Link to="/admin/products" className="text-sm text-[var(--brand-text)]">
          Back to products
        </Link>
      </div>

      <form
        className="grid min-w-0 gap-4 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:grid-cols-2 sm:rounded-2xl sm:p-6"
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
          if (!isEdit && (!Number.isInteger(Number(form.stock)) || form.stock < 0)) {
            toast('Stock must be a whole number (0 or more)', 'error')
            return
          }
          save.mutate()
        }}
      >
        <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/40 p-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">Status</p>
            <p className="text-xs text-[var(--fg-muted)]">
              Inactive products stay in admin with all their stock and details, but customers can’t see them.
            </p>
          </div>
          <div role="radiogroup" aria-label="Product status" className="inline-flex shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5">
            {[
              { value: true, label: 'Active' },
              { value: false, label: 'Inactive' },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                role="radio"
                aria-checked={form.isActive === o.value}
                onClick={() => setForm({ ...form, isActive: o.value })}
                className={cn(
                  'h-8 rounded-full px-4 text-sm font-medium transition',
                  form.isActive === o.value
                    ? o.value
                      ? 'bg-[var(--success)] text-white'
                      : 'bg-[var(--fg)] text-[var(--bg)]'
                    : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
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
          <div className="sm:col-span-2 space-y-1.5">
            <div className="sm:max-w-[calc(50%-0.5rem)]">
              <Input
                label="Cost price (DH) — private"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                placeholder="What you paid for it"
              />
            </div>
            <p className="text-xs text-[var(--fg-muted)]">
              Never shown to customers. Used for profit reports, and recorded on each new order so
              later cost changes don't rewrite past profit.
            </p>
            {costNumber !== null && salePrice > 0 ? (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="text-[var(--fg-muted)]">
                  Margin:{' '}
                  <span className="font-semibold tabular-nums text-[var(--fg)]">
                    {(((salePrice - costNumber) / salePrice) * 100).toFixed(1)}%
                  </span>{' '}
                  ({(salePrice - costNumber).toLocaleString('fr-MA')} DH per unit)
                </span>
                {costNumber >= salePrice ? (
                  <span className="font-medium text-[var(--warning)]">
                    Cost is higher than the sale price
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>
        <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
          <Select
            label="Deposit before confirmation"
            value={form.depositType}
            onChange={(e) =>
              setForm({ ...form, depositType: e.target.value as typeof form.depositType })
            }
            options={[
              { value: 'none', label: 'No deposit (standard cash on delivery)' },
              { value: 'fixed', label: 'Fixed amount per unit (DH)' },
              { value: 'percent', label: 'Percentage of the price (%)' },
            ]}
          />
          {form.depositType !== 'none' ? (
            <Input
              label={form.depositType === 'percent' ? 'Deposit (%)' : 'Deposit per unit (DH)'}
              type="number"
              min={0}
              max={form.depositType === 'percent' ? 100 : undefined}
              step="0.01"
              value={form.depositValue || ''}
              onChange={(e) =>
                setForm({ ...form, depositValue: e.target.value === '' ? 0 : Number(e.target.value) })
              }
              required
            />
          ) : null}
          <p className="sm:col-span-2 text-xs text-[var(--fg-muted)]">
            Customers see the deposit on the product page and at checkout, and pay the rest on delivery.
            The order can only be confirmed once you mark the deposit as received.
          </p>
        </div>
        {isEdit ? (
          <div className="flex min-w-0 flex-col gap-1.5 text-sm">
            <span className="font-medium text-[var(--fg)]">Stock</span>
            <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/40 px-3.5 py-2">
              <span>
                In stock: <span className="font-semibold tabular-nums">{form.stock}</span>
              </span>
              <Link
                to={`/admin/inventory/products/${id}`}
                className="font-medium text-[var(--brand-text)] hover:underline"
              >
                Manage stock <span className="inline-block rtl:rotate-180">→</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="min-w-0 space-y-1.5">
            <Input
              label="Opening stock"
              type="number"
              min={0}
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
              required
            />
            <p className="text-xs text-[var(--fg-muted)]">
              Recorded as the opening stock movement. Later changes go through Inventory.
            </p>
          </div>
        )}
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
        <div className="sm:col-span-2 grid min-w-0 gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-4 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm font-semibold">Condition &amp; inventory</p>
          <Select
            label="Condition"
            value={form.condition}
            onChange={(e) => setForm({ ...form, condition: e.target.value as ProductCondition })}
            options={[
              { value: 'new', label: 'New' },
              { value: 'refurbished', label: 'Refurbished' },
              { value: 'used', label: 'Used' },
            ]}
          />
          <div className="min-w-0">
            <Input
              label="Storage location"
              list="product-inventory-locations"
              maxLength={80}
              value={form.inventoryLocation}
              onChange={(e) => setForm({ ...form, inventoryLocation: e.target.value })}
              placeholder={locationOptions.length ? 'Pick a location or type one' : 'e.g. Shelf A3'}
            />
            <datalist id="product-inventory-locations">
              {locationOptions.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </div>
          <p className="sm:col-span-2 text-xs text-[var(--fg-muted)]">
            Refurbished and used listings only sell units of that condition. Create them from{' '}
            <Link to="/admin/inventory" className="text-[var(--brand-text)] hover:underline">
              Admin → Inventory
            </Link>{' '}
            → product → “Create refurbished/used listing”, so they stay linked to the new model.
            Storage locations are managed in{' '}
            <Link to="/admin/settings" className="text-[var(--brand-text)] hover:underline">
              Settings
            </Link>
            .
          </p>
          {form.condition !== 'new' ? (
            <div className="sm:col-span-2 space-y-1.5">
              <Textarea
                label="Condition note"
                rows={3}
                maxLength={500}
                value={form.conditionNote}
                onChange={(e) => setForm({ ...form, conditionNote: e.target.value })}
                placeholder="e.g. Light scratches on the lid, battery at 88%, original charger included"
              />
              <p className="flex justify-between gap-3 text-xs text-[var(--fg-muted)]">
                <span>Shown to customers on this listing. Describe the actual condition honestly.</span>
                <span className="shrink-0 tabular-nums">{form.conditionNote.length}/500</span>
              </p>
            </div>
          ) : null}
          <label className="sm:col-span-2 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.serialTracking}
              onChange={(e) => setForm({ ...form, serialTracking: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-medium">Serial number tracking</span>
              <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
                Each unit is tracked by its serial number. Deliveries require serials.
              </span>
            </span>
          </label>
        </div>
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
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">Product photos</p>
              <span className="text-xs tabular-nums text-[var(--fg-muted)]">
                {form.images.length}/{MAX_IMAGES}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
              The first photo is the main one shown in the shop. Use the arrows to change the order.
            </p>
          </div>

          {form.images.length || uploading ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {form.images.map((img, i) => (
                <li
                  key={img.url}
                  className="relative aspect-square overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]"
                >
                  <SafeImage
                    src={img.url}
                    alt={`Photo ${i + 1}`}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  {i === 0 ? (
                    <span className="absolute start-1.5 top-1.5 rounded-full bg-[var(--brand)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-fg)]">
                      Main
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute end-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-[var(--danger)]"
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    <SiteIcon name="close" size={14} />
                  </button>
                  {form.images.length > 1 ? (
                    <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                      <button
                        type="button"
                        onClick={() => moveImage(i, i - 1)}
                        disabled={i === 0}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:invisible"
                        aria-label={`Move photo ${i + 1} earlier`}
                      >
                        <SiteIcon name="chevron-left" size={14} className="rtl:rotate-180" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(i, i + 1)}
                        disabled={i === form.images.length - 1}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:invisible"
                        aria-label={`Move photo ${i + 1} later`}
                      >
                        <SiteIcon name="chevron-right" size={14} className="rtl:rotate-180" />
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
              {uploading
                ? Array.from({ length: uploading.total - uploading.done }).map((_, i) => (
                    <li
                      key={`uploading-${i}`}
                      className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-muted)]/60"
                    >
                      {i === 0 ? <Spinner /> : <SiteIcon name="clock" size={16} className="text-[var(--fg-muted)]" />}
                    </li>
                  ))
                : null}
            </ul>
          ) : null}

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
                multiple
                className="hidden"
                onChange={(e) => e.target.files?.length && onUpload(e.target.files)}
              />
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {uploading
                      ? `Uploading ${Math.min(uploading.done + 1, uploading.total)} of ${uploading.total}…`
                      : 'Choose photos from your phone or computer'}
                  </p>
                  <p className="mt-1 text-xs text-[var(--fg-muted)]">
                    You can select several at once. Big phone photos are resized automatically.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={Boolean(uploading)}
                  disabled={room <= 0}
                  onClick={() => fileRef.current?.click()}
                >
                  <SiteIcon name="plus" size={14} />
                  {form.images.length ? 'Add more photos' : 'Add photos'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <Input
                  label="Image address (URL)"
                  placeholder="https://… or paste copied image link"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addImageUrl(urlDraft)
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={!urlDraft.trim() || room <= 0}
                  onClick={() => addImageUrl(urlDraft)}
                >
                  <SiteIcon name="plus" size={14} />
                  Add
                </Button>
              </div>
              <p className="text-xs text-[var(--fg-muted)]">
                Some shops (like joutech.ma) block pasted links. If the preview breaks, use{' '}
                <strong className="text-[var(--fg)]">From my gallery</strong> instead.
              </p>
            </div>
          )}
        </div>
        <RecommendedPicker
          value={form.recommended}
          onChange={(recommended) => setForm({ ...form, recommended })}
          only={form.recommendedOnly}
          onOnlyChange={(recommendedOnly) => setForm({ ...form, recommendedOnly })}
          excludeId={id}
        />
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
              checked={shopHero}
              onChange={(e) => setShopHero(e.target.checked)}
            />
            <span>
              <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                Show in Shop page header
                {isShownInShopHero ? (
                  <span className="rounded-full bg-[color-mix(in_srgb,var(--success)_14%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success)]">
                    Showing now{isAutoShopHero ? ' · automatic' : ''}
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
                {isAutoShopHero
                  ? 'It appears there automatically because it is your first featured product.'
                  : isShownInShopHero
                    ? 'This product is the big picture at the top of the Shop page.'
                    : shopHeroShown.product
                      ? `The big picture at the top of the Shop page. Checking this replaces “${shopHeroShown.product.name}”.`
                      : 'The big picture at the top of the Shop page. Only one product can be there.'}{' '}
                You can also change it in{' '}
                <Link to="/admin/settings" className="text-[var(--brand-text)] hover:underline">
                  Settings
                </Link>
                .
              </span>
              {isShownInShopHero && !shopHero ? (
                <span className="mt-1 block text-xs text-[var(--fg-muted)]">
                  After you save, it will be removed and the Shop header will show its normal photo.
                </span>
              ) : null}
              {shopHero && !form.isActive ? (
                <span className="mt-1 block text-xs text-[var(--danger)]">
                  Set the status to Active at the top, otherwise customers won’t see it.
                </span>
              ) : null}
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
