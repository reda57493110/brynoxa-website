import { create } from 'zustand'

type WhatsAppState = {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useWhatsAppStore = create<WhatsAppState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
