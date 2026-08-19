import { useEffect, useState } from 'react'
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
import { useToastStore } from '@/store/toastStore'

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
  const brands = useQuery({
    queryKey: ['brands', 'all'],
    queryFn: async () => (await brandsApi.list(true)).data.data,
  })
  const existing = useQuery({
    queryKey: ['admin-product', id],
    queryFn: async () => (await adminApi.products.get(id!)).data.data,
    enabled: isEdit,
  })

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
    isActive: true,
    imageUrl: '',
  })

  useEffect(() => {
    if (existing.data) {
      const p = existing.data
      setForm({
        name: p.name,
        sku: p.sku,
        description: p.description,
        shortDescription: p.shortDescription || '',
        category: typeof p.category === 'string' ? p.category : p.category._id,
        brand: typeof p.brand === 'string' ? p.brand : p.brand._id,
        price: p.price,
        compareAtPrice: p.compareAtPrice || 0,
        stock: p.stock,
        tags: (p.tags || []).join(', '),
        isFeatured: p.isFeatured,
        isActive: p.isActive,
        imageUrl: p.images?.[0]?.url || '',
      })
    }
  }, [existing.data])

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        sku: form.sku,
        description: form.description,
        shortDescription: form.shortDescription || undefined,
        category: form.category,
        brand: form.brand,
        price: Number(form.price),
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
        stock: Number(form.stock),
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        isFeatured: form.isFeatured,
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
      toast(isEdit ? 'Product updated' : 'Product created', 'success')
      navigate('/admin/products')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const onUpload = async (file: File) => {
    try {
      const res = await uploadApi.image(file)
      setForm((f) => ({ ...f, imageUrl: res.data.data.url }))
      toast('Image uploaded', 'success')
    } catch (e) {
      toast(getErrorMessage(e), 'error')
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
        <Input
          label="Price (DH)"
          type="number"
          min={0}
          step="0.01"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
          required
        />
        <Input
          label="Compare at (DH)"
          type="number"
          min={0}
          step="0.01"
          value={form.compareAtPrice}
          onChange={(e) => setForm({ ...form, compareAtPrice: Number(e.target.value) })}
        />
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
        <Select
          label="Brand"
          value={form.brand}
          onChange={(e) => setForm({ ...form, brand: e.target.value })}
          required
          options={(brands.data || []).map((b) => ({ value: b._id, label: b.name }))}
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
        <Input
          label="Image URL"
          className="sm:col-span-2"
          value={form.imageUrl}
          onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
        />
        <div className="sm:col-span-2">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isFeatured}
            onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
          />
          Featured
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" loading={save.isPending}>
            {isEdit ? 'Save changes' : 'Create product'}
          </Button>
        </div>
      </form>
    </div>
  )
}
