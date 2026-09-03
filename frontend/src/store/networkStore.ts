import { create } from 'zustand'

type NetworkState = {
  pending: number
  begin: () => void
  end: () => void
}

export const useNetworkStore = create<NetworkState>((set) => ({
  pending: 0,
  begin: () => set((s) => ({ pending: s.pending + 1 })),
  end: () => set((s) => ({ pending: Math.max(0, s.pending - 1) })),
}))
