import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DEFAULT_PROJECT_DIR = '~/Documents/GitHub'

interface SettingsState {
  defaultProjectDir: string
  setDefaultProjectDir: (dir: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultProjectDir: DEFAULT_PROJECT_DIR,
      setDefaultProjectDir: (dir) => set({ defaultProjectDir: dir }),
    }),
    { name: 'agentboard-settings' }
  )
)

export { DEFAULT_PROJECT_DIR }
