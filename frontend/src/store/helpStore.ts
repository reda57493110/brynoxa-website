import { create } from 'zustand'
import type { HelpGuideId } from '@/lib/help/types'

/**
 * The Help button panel (components/help/HelpWidget). `guide`: the step-by-step guide shown,
 * null for the list of guides.
 */
type HelpState = {
  isOpen: boolean
  guide: HelpGuideId | null
  open: (guide: HelpGuideId | null) => void
  show: (guide: HelpGuideId | null) => void
  close: () => void
}

export const useHelpStore = create<HelpState>((set) => ({
  isOpen: false,
  guide: null,
  open: (guide) => set({ isOpen: true, guide }),
  show: (guide) => set({ guide }),
  close: () => set({ isOpen: false }),
}))
