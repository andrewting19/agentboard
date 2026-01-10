import { useEffect, useState } from 'react'
import {
  DEFAULT_PROJECT_DIR,
  useSettingsStore,
} from '../stores/settingsStore'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsModal({
  isOpen,
  onClose,
}: SettingsModalProps) {
  const defaultProjectDir = useSettingsStore((state) => state.defaultProjectDir)
  const setDefaultProjectDir = useSettingsStore(
    (state) => state.setDefaultProjectDir
  )
  const [draftDir, setDraftDir] = useState(defaultProjectDir)

  useEffect(() => {
    if (isOpen) {
      setDraftDir(defaultProjectDir)
    }
  }, [defaultProjectDir, isOpen])

  if (!isOpen) {
    return null
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = draftDir.trim()
    setDefaultProjectDir(trimmed || DEFAULT_PROJECT_DIR)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md border border-border bg-elevated p-6"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
          Settings
        </h2>
        <p className="mt-2 text-xs text-muted">
          Set the default directory for new sessions. Tilde (~) resolves to your
          home directory on the server.
        </p>

        <div className="mt-5">
          <label className="mb-1.5 block text-xs text-secondary">
            Default Project Directory
          </label>
          <input
            value={draftDir}
            onChange={(event) => setDraftDir(event.target.value)}
            placeholder={DEFAULT_PROJECT_DIR}
            className="input"
            autoFocus
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </div>
  )
}
