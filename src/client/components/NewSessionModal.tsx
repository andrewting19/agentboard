import { useEffect, useState } from 'react'

interface NewSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (projectPath: string, name?: string) => void
  defaultProjectDir: string
  lastProjectPath?: string | null
  activeProjectPath?: string
  activeProjectName?: string
}

export default function NewSessionModal({
  isOpen,
  onClose,
  onCreate,
  defaultProjectDir,
  lastProjectPath,
  activeProjectPath,
  activeProjectName,
}: NewSessionModalProps) {
  const [projectPath, setProjectPath] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setProjectPath('')
      setName('')
      return
    }
    // Priority: active session -> last used -> default
    const basePath =
      activeProjectPath?.trim() || lastProjectPath || defaultProjectDir
    setProjectPath(basePath)
    setName(activeProjectName?.trim() || '')
  }, [activeProjectName, activeProjectPath, defaultProjectDir, isOpen, lastProjectPath])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  const resolveProjectPath = (value: string) => {
    const trimmedValue = value.trim()
    const baseDir =
      activeProjectPath?.trim() || lastProjectPath || defaultProjectDir.trim()
    if (!trimmedValue) {
      return baseDir
    }

    const isAbsolute =
      trimmedValue.startsWith('/') ||
      trimmedValue.startsWith('~') ||
      /^[A-Za-z]:[\\/]/.test(trimmedValue)

    if (isAbsolute || !baseDir) {
      return trimmedValue
    }

    const base = baseDir.replace(/[\\/]+$/, '')
    return `${base}/${trimmedValue}`
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const resolvedPath = resolveProjectPath(projectPath)
    if (!resolvedPath) {
      return
    }
    onCreate(resolvedPath, name.trim() || undefined)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md border border-border bg-elevated p-6"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-primary">
          New Session
        </h2>
        <p className="mt-2 text-xs text-muted">
          Enter an absolute project path or a folder name. Relative paths use
          the base directory.
        </p>
        {(activeProjectPath?.trim() || lastProjectPath || defaultProjectDir.trim()) ? (
          <p className="mt-1 text-xs text-muted">
            Base: {activeProjectPath?.trim() || lastProjectPath || defaultProjectDir.trim()}
          </p>
        ) : null}

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-secondary">
              Project Path
            </label>
            <input
              value={projectPath}
              onChange={(event) => setProjectPath(event.target.value)}
              placeholder={
                activeProjectPath ||
                lastProjectPath ||
                defaultProjectDir ||
                '/Users/you/code/my-project'
              }
              className="input"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-secondary">
              Display Name (optional)
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="my-project"
              className="input"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create
          </button>
        </div>
      </form>
    </div>
  )
}
