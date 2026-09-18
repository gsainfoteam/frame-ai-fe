import { create } from 'zustand'

export type ToastItem = {
  id: string
  text: string
  error?: boolean
}

type ToastState = {
  toasts: ToastItem[]
  push: (text: string, error?: boolean) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (text, error = false) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    set((state) => ({ toasts: [...state.toasts.slice(-4), { id, text, error }] }))
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }))
    }, 7000)
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
}))

export function toast(text: string, error = false) {
  useToastStore.getState().push(text, error)
}
