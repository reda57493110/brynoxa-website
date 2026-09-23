import { create } from 'zustand'
import { trackWhatsApp } from '@/lib/analytics'

export type WhatsAppTopic = 'product' | 'order' | 'advice' | 'warranty' | 'return' | 'other'

type OpenOpts = { topic?: WhatsAppTopic; productName?: string }

function readOpenOpts(value: unknown): OpenOpts {
  if (!value || typeof value !== 'object' || 'nativeEvent' in value) return {}
  const record = value as OpenOpts
  return {
    topic: record.topic,
    productName: record.productName,
  }
}

type WhatsAppState = {
  isOpen: boolean
  topic: WhatsAppTopic | null
  productName: string
  open: (opts?: OpenOpts) => void
  close: () => void
}

export const useWhatsAppStore = create<WhatsAppState>((set) => ({
  isOpen: false,
  topic: null,
  productName: '',
  open: (opts?: OpenOpts) => {
    const next = readOpenOpts(opts)
    trackWhatsApp({
      stage: 'open',
      topic: next.topic ?? null,
      productName: next.productName,
    })
    set({
      isOpen: true,
      topic: next.topic ?? null,
      productName: next.productName ?? '',
    })
  },
  close: () => set({ isOpen: false, topic: null, productName: '' }),
}))
