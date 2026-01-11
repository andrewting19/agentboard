import { afterEach, describe, expect, test } from 'bun:test'

const ORIGINAL_ENV = {
  PORT: process.env.PORT,
  TMUX_SESSION: process.env.TMUX_SESSION,
  REFRESH_INTERVAL_MS: process.env.REFRESH_INTERVAL_MS,
  DISCOVER_PREFIXES: process.env.DISCOVER_PREFIXES,
  TLS_CERT: process.env.TLS_CERT,
  TLS_KEY: process.env.TLS_KEY,
}

const ENV_KEYS = Object.keys(ORIGINAL_ENV) as Array<keyof typeof ORIGINAL_ENV>

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = ORIGINAL_ENV[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

async function loadConfig(tag: string) {
  const modulePath = `../config?${tag}`
  const module = await import(modulePath)
  return module.config as {
    port: number
    tmuxSession: string
    refreshIntervalMs: number
    discoverPrefixes: string[]
    tlsCert: string
    tlsKey: string
  }
}

afterEach(() => {
  restoreEnv()
})

describe('config', () => {
  test('uses defaults when env is unset', async () => {
    for (const key of ENV_KEYS) {
      delete process.env[key]
    }

    const config = await loadConfig('defaults')
    expect(config.port).toBe(4040)
    expect(config.tmuxSession).toBe('agentboard')
    expect(config.refreshIntervalMs).toBe(2000)
    expect(config.discoverPrefixes).toEqual([])
    expect(config.tlsCert).toBe('')
    expect(config.tlsKey).toBe('')
  })

  test('parses env overrides and trims discover prefixes', async () => {
    process.env.PORT = '9090'
    process.env.TMUX_SESSION = 'demo'
    process.env.REFRESH_INTERVAL_MS = '3000'
    process.env.DISCOVER_PREFIXES = ' alpha, beta ,,gamma '
    process.env.TLS_CERT = '/tmp/cert.pem'
    process.env.TLS_KEY = '/tmp/key.pem'

    const config = await loadConfig('overrides')
    expect(config.port).toBe(9090)
    expect(config.tmuxSession).toBe('demo')
    expect(config.refreshIntervalMs).toBe(3000)
    expect(config.discoverPrefixes).toEqual(['alpha', 'beta', 'gamma'])
    expect(config.tlsCert).toBe('/tmp/cert.pem')
    expect(config.tlsKey).toBe('/tmp/key.pem')
  })
})
