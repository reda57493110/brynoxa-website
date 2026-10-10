import type { Locale } from '@/i18n'
import type { ProductVariant } from '@/types'
import { SPEC_FIELDS, formatSpecValue, getTemplate, isTemplateId, normalizeSpecs, specLabel, templateFields } from './specs'

/**
 * Product variants: the same model in several versions (RAM, storage, colour…). Each version is
 * its own product (SKU, price, stock); the specs named in `variantAttributes` tell them apart.
 */

// Descriptive fields that never make sense as an option button
const NOT_OPTIONS = new Set([
  'model', 'use_case', 'in_box', 'warranty', 'dimensions', 'compatibility', 'frequency_response',
  'supported_memory', 'pcie_slots', 'internal_headers', 'print_resolution', 'cartridges', 'max_speed',
])

/** Spec fields of a type that can be offered as options. */
export function variantableFields(templateId: string): string[] {
  return templateFields(getTemplate(templateId)).filter((k) => !NOT_OPTIONS.has(k) && SPEC_FIELDS[k]?.type !== 'multi')
}

/** "16 GB · 512 GB" — the option values of one product. */
export function variantLabel(specs: Record<string, string> | undefined, templateId: string, attributes: string[], locale: Locale = 'en') {
  const n = normalizeSpecs(specs, templateId)
  return attributes
    .map((k) => (n[k] ? formatSpecValue(k, n[k], locale) : ''))
    .filter(Boolean)
    .join(' · ')
}

const templateOf = (v: ProductVariant, fallback: string) => (isTemplateId(v.specTemplate) ? v.specTemplate! : fallback)

/** Values in a natural order: numbers and sizes (512 GB < 1 TB) ascending, others as first seen. */
function sortKey(value: string): number | null {
  if (/^\d+(\.\d+)?$/.test(value)) return Number(value)
  const m = value.match(/^(\d+(?:\.\d+)?)\s*(GB|TB|MB)\b/i)
  if (!m) return null
  const unit = m[2].toUpperCase()
  return Number(m[1]) * (unit === 'TB' ? 1024 : unit === 'MB' ? 1 / 1024 : 1)
}

export interface VariantOption {
  value: string
  label: string
  target: ProductVariant
  available: boolean
  selected: boolean
}

export interface VariantAxis {
  key: string
  label: string
  options: VariantOption[]
}

/**
 * Option rows for the product page. Clicking an option goes to the variant with that value that
 * keeps as many of the current choices as possible (in stock first).
 */
export function variantAxes(
  currentId: string,
  variants: ProductVariant[],
  templateId: string,
  attributes: string[] | undefined,
  locale: Locale
): VariantAxis[] {
  if (variants.length < 2) return []
  const specsOf = new Map(variants.map((v) => [v._id, normalizeSpecs(v.specs, templateOf(v, templateId))]))
  const current = specsOf.get(currentId) ?? {}

  // Options chosen by the admin; otherwise the spec fields whose values differ
  let keys = (attributes ?? []).filter((k) => SPEC_FIELDS[k])
  if (!keys.length) {
    keys = variantableFields(templateId).filter((k) => new Set(variants.map((v) => specsOf.get(v._id)?.[k] ?? '')).size > 1)
  }

  return keys
    .map((key) => {
      const seen: string[] = []
      for (const v of variants) {
        const val = specsOf.get(v._id)?.[key]
        if (val && !seen.includes(val)) seen.push(val)
      }
      const sorted = seen.every((v) => sortKey(v) !== null) ? [...seen].sort((a, b) => sortKey(a)! - sortKey(b)!) : seen
      const options = sorted.map((value) => {
        const candidates = variants.filter((v) => specsOf.get(v._id)?.[key] === value)
        const score = (v: ProductVariant) =>
          keys.filter((k) => k !== key && specsOf.get(v._id)?.[k] === current[k]).length * 10 + (v.stock > 0 ? 1 : 0) + (v._id === currentId ? 100 : 0)
        const target = [...candidates].sort((a, b) => score(b) - score(a))[0]
        return {
          value,
          label: formatSpecValue(key, value, locale),
          target,
          available: candidates.some((c) => c.stock > 0),
          selected: current[key] === value,
        }
      })
      return { key, label: specLabel(key, locale), options }
    })
    .filter((axis) => axis.options.length > 1)
}

/** Variants that cannot be told apart by their options (same values for every option). */
export function duplicateVariants(variants: ProductVariant[], templateId: string, attributes: string[]) {
  const byLabel = new Map<string, ProductVariant[]>()
  for (const v of variants) {
    const label = variantLabel(v.specs, templateOf(v, templateId), attributes)
    byLabel.set(label, [...(byLabel.get(label) ?? []), v])
  }
  return [...byLabel.values()].filter((list) => list.length > 1)
}
