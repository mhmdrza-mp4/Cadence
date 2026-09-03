import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import {
  INIT, runCompare, runSimulation,
  type CompareData, type Config, type Result,
} from './api'

type Store = {
  config: Config
  setConfig: (c: Config) => void
  result: Result | null
  compare: CompareData | null
  running: boolean
  error: string | null
  run: () => Promise<void>
  runCompare: () => Promise<void>
  dismiss: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config>(INIT)
  const [result, setResult] = useState<Result | null>(null)
  const [compare, setCompare] = useState<CompareData | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async () => {
    setRunning(true)
    setError(null)
    try {
      setResult(await runSimulation(config))
    } catch {
      setError('Could not reach the simulation API — is the backend running on port 8000?')
    } finally {
      setRunning(false)
    }
  }, [config])

  const runCmp = useCallback(async () => {
    setRunning(true)
    setError(null)
    try {
      setCompare(await runCompare(config, result?.summary.bottleneck_station ?? 'Assembly'))
    } catch {
      setError('Could not reach the simulation API — is the backend running on port 8000?')
    } finally {
      setRunning(false)
    }
  }, [config, result])

  return (
    <Ctx.Provider
      value={{
        config, setConfig, result, compare, running, error,
        run, runCompare: runCmp, dismiss: () => setError(null),
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside provider')
  return s
}
