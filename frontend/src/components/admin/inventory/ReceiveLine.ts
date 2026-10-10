import type { Product, ReceiptPayload } from '@/types'

export type UnitResult = 'available' | 'defective' | 'underRepair' | 'awaitingInspection'

export interface ReceiveLineState {
  key: string
  product: Product | null
  qty: string
  unitCost: string
  warranty: string
  serialsText: string
  passed: string
  defective: string
  repair: string
  unitResults: Record<string, { result?: UnitResult; fault: string }>
  faultNotes: string
}

export function newReceiveLine(): ReceiveLineState {
  return {
    key: Math.random().toString(36).slice(2),
    product: null,
    qty: '1',
    unitCost: '',
    warranty: '',
    serialsText: '',
    passed: '',
    defective: '',
    repair: '',
    unitResults: {},
    faultNotes: '',
  }
}

export const UNIT_RESULT_OPTIONS: { value: UnitResult; label: string }[] = [
  { value: 'available', label: 'Passed → available' },
  { value: 'defective', label: 'Defective' },
  { value: 'underRepair', label: 'Needs repair' },
  { value: 'awaitingInspection', label: 'Not inspected' },
]

const toInt = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

function splitSerials(text: string) {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export interface LineAnalysis {
  qty: number
  serials: string[]
  perSerial: boolean
  counts: Record<UnitResult, number>
  total: number | null
  errors: { product?: string; qty?: string; serials?: string; counts?: string; cost?: string }
}

/** Live counts + validation, mirroring the server's receive rules. */
export function analyseLine(line: ReceiveLineState, requireInspection: boolean): LineAnalysis {
  const qty = toInt(line.qty)
  const serials = splitSerials(line.serialsText)
  const tracked = Boolean(line.product?.serialTracking)
  const perSerial = tracked && serials.length > 0
  const defaultResult: UnitResult = requireInspection ? 'awaitingInspection' : 'available'
  const errors: LineAnalysis['errors'] = {}

  if (!line.product) errors.product = 'Pick a product'
  if (!(qty > 0) || String(Math.floor(Number(line.qty))) !== line.qty.trim()) errors.qty = 'Whole number, at least 1'

  const dupes = serials.filter((s, i) => serials.indexOf(s) !== i)
  if (dupes.length) errors.serials = `Duplicate serial: ${dupes[0]}`
  else if (tracked && serials.length !== qty) errors.serials = `Serial-tracked: enter exactly ${qty} serial${qty === 1 ? '' : 's'} (${serials.length} now)`
  else if (!tracked && serials.length && serials.length !== qty) errors.serials = `Enter ${qty} serials, or none`

  const counts: Record<UnitResult, number> = { available: 0, defective: 0, underRepair: 0, awaitingInspection: 0 }
  if (perSerial) {
    for (const s of serials) counts[line.unitResults[s]?.result ?? defaultResult] += 1
  } else {
    const passed = toInt(line.passed)
    const defective = toInt(line.defective)
    const repair = toInt(line.repair)
    const inspected = passed + defective + repair > 0
    counts.available = inspected ? passed : requireInspection ? 0 : qty
    counts.defective = defective
    counts.underRepair = repair
    const sum = counts.available + defective + repair
    if (sum > qty) errors.counts = `Results add up to ${sum}, more than the ${qty} received`
    counts.awaitingInspection = Math.max(0, qty - sum)
  }

  let total: number | null = null
  if (line.unitCost.trim() !== '') {
    const c = Number(line.unitCost)
    if (!Number.isFinite(c) || c < 0) errors.cost = 'Enter 0 or more'
    else total = Math.round(c * qty * 100) / 100
  }

  return { qty, serials, perSerial, counts, total, errors }
}

export function lineToPayload(line: ReceiveLineState, a: LineAnalysis, requireInspection: boolean): ReceiptPayload['lines'][number] {
  const defaultResult: UnitResult = requireInspection ? 'awaitingInspection' : 'available'
  const out: ReceiptPayload['lines'][number] = {
    productId: line.product!._id,
    qty: a.qty,
  }
  if (line.unitCost.trim() !== '') out.unitCost = Number(line.unitCost)
  if (line.warranty.trim()) out.warranty = line.warranty.trim()
  if (a.serials.length) out.serials = a.serials
  if (line.faultNotes.trim()) out.faultNotes = line.faultNotes.trim()
  if (a.perSerial) {
    out.unitResults = a.serials.map((serial) => {
      const r = line.unitResults[serial]
      return { serial, result: r?.result ?? defaultResult, ...(r?.fault.trim() ? { fault: r.fault.trim() } : {}) }
    })
  } else {
    const result = { available: toInt(line.passed), defective: toInt(line.defective), underRepair: toInt(line.repair) }
    if (result.available + result.defective + result.underRepair > 0) out.result = result
  }
  return out
}

