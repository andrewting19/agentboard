import { afterEach, describe, expect, test } from 'bun:test'

const bunAny = Bun as typeof Bun & {
  serve: typeof Bun.serve
  spawnSync: typeof Bun.spawnSync
}

const processAny = process as typeof process & {
  exit: typeof process.exit
}

const originalServe = bunAny.serve
const originalSpawnSync = bunAny.spawnSync
const originalProcessExit = processAny.exit
const originalConsoleError = console.error
const originalSetInterval = globalThis.setInterval

afterEach(() => {
  bunAny.serve = originalServe
  bunAny.spawnSync = originalSpawnSync
  processAny.exit = originalProcessExit
  console.error = originalConsoleError
  globalThis.setInterval = originalSetInterval
})

describe('port availability', () => {
  test('exits when the configured port is already in use', async () => {
    const errors: string[] = []
    console.error = (message?: unknown) => {
      if (typeof message === 'string') {
        errors.push(message)
      }
    }

    bunAny.spawnSync = ((...args: Parameters<typeof Bun.spawnSync>) => {
      const command = Array.isArray(args[0]) ? args[0][0] : ''
      if (command === 'lsof') {
        return {
          exitCode: 0,
          stdout: Buffer.from('123\n'),
          stderr: Buffer.from(''),
        } as ReturnType<typeof Bun.spawnSync>
      }
      if (command === 'ps') {
        return {
          exitCode: 0,
          stdout: Buffer.from('node\n'),
          stderr: Buffer.from(''),
        } as ReturnType<typeof Bun.spawnSync>
      }
      return {
        exitCode: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
      } as ReturnType<typeof Bun.spawnSync>
    }) as typeof Bun.spawnSync

    bunAny.serve = ((_options: Parameters<typeof Bun.serve>[0]) => {
      return {} as ReturnType<typeof Bun.serve>
    }) as typeof Bun.serve

    globalThis.setInterval = (() => 0) as unknown as typeof globalThis.setInterval

    processAny.exit = ((code?: number) => {
      throw new Error(`exit:${code ?? 0}`)
    }) as typeof processAny.exit

    let thrown: Error | null = null
    try {
      const suffix = 'port-check'
      await import(`../index?test=${suffix}`)
    } catch (error) {
      thrown = error as Error
    }

    expect(thrown?.message).toBe('exit:1')
    const expectedPort = Number(process.env.PORT) || 4040
    expect(errors.join('\n')).toContain(`Port ${expectedPort} already in use`)
  })
})
