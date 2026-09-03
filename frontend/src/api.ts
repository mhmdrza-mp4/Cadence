export const API = import.meta.env.VITE_API_URL || ''
export const STATIONS = ['Cutting', 'Assembly', 'Quality Inspection', 'Packaging'] as const
export const PRODUCTS = ['Frame', 'Panel', 'Chassis'] as const

export const SHORT: Record<string, string> = {
  Cutting: 'CUT',
  Assembly: 'ASM',
  'Quality Inspection': 'QCI',
  Packaging: 'PKG',
}

// Validated categorical palette (light surface #ffffff) — see dataviz method.
// Slot 1..4, fixed assignment: stations/products use these in order, never re-sorted.
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100']
export const PCOLORS: Record<string, string> = {
  Frame: SERIES[0],
  Panel: SERIES[1],
  Chassis: SERIES[2],
}

export type Machine = {
  id: string
  station: string
  utilization: number
  busy_minutes: number
  downtime_minutes: number
  breakdowns: number
}
export type Station = {
  name: string
  utilization: number
  average_queue: number
  max_queue: number
  total_downtime_minutes: number
  machines: Machine[]
}
export type Summary = {
  throughput_per_hour: number
  completed_items: number
  average_cycle_time_minutes: number
  p50_cycle_time_minutes: number
  p90_cycle_time_minutes: number
  overall_utilization: number
  bottleneck_station: string
  bottleneck_score: number
  bottleneck_reason: string
  suggestion: string
  cycle_time_by_product: Record<string, number>
  throughput_by_product: Record<string, number>
  arrivals: number
  total_breakdowns: number
  total_downtime_minutes: number
}
export type Frame = { t: number; queues: Record<string, number>; machines: Record<string, string> }
export type Config = {
  duration_hours: number
  arrival_rate_per_hour: number
  priority_ratio: number
  seed: number
  stations: Record<string, { machines: number; mtbf: number; mttr: number }>
}
export type Result = {
  config: Config
  summary: Summary
  stations: Station[]
  queue_series: Record<string, number>[]
  utilization_series: Record<string, number>[]
  throughput_series: { time: number; throughput: number }[]
  breakdown_markers: { time: number; station: string; machine: string }[]
  cycle_time_distribution: { cycle_time: number; product: string }[]
  events: Ev[]
  replay: Frame[]
}
export type Ev = {
  time: number
  event: string
  station?: string
  machine?: string
  item_id?: string
  product?: string
  duration?: number
  cycle_time?: number
  priority?: string | number
}
export type CompareData = {
  baseline: Result
  comparison: Result
  throughput_delta_percent: number
  takeaway: string
}

export const INIT: Config = {
  duration_hours: 8,
  arrival_rate_per_hour: 26,
  priority_ratio: 0.25,
  seed: 7,
  stations: Object.fromEntries(
    STATIONS.map((n) => [n, { machines: 2, mtbf: 180, mttr: 12 }])
  ),
}

export async function runSimulation(config: Config): Promise<Result> {
  const r = await fetch(`${API}/api/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!r.ok) throw new Error(`API error ${r.status}`)
  return r.json()
}

export async function runCompare(config: Config, bottleneck: string): Promise<CompareData> {
  const variant = structuredClone(config)
  variant.stations[bottleneck].machines = Math.min(12, variant.stations[bottleneck].machines + 1)
  const r = await fetch(`${API}/api/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseline: config, comparison: variant }),
  })
  if (!r.ok) throw new Error(`API error ${r.status}`)
  return r.json()
}

export function clk(t: number) {
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
}

/** Float hours → clock format "H:MM" (e.g. 5.5 → "5:30", 8 → "8:00"). */
export function fmtHour(h: number) {
  const t = Math.round(h * 60)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}

/** Float minutes → clock format "M:SS" (e.g. 18.5 → "18:30", 41.9 → "41:54"). */
export function fmtMin(m: number) {
  const s = Math.round(m * 60)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Float minutes → clock format "H:MM:SS" (e.g. 85.5 → "1:25:30"). */
export function fmtHMS(m: number) {
  const s = Math.round(m * 60)
  return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
