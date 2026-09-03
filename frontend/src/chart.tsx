import type { ReactNode } from 'react'
import { CartesianGrid } from 'recharts'
import { fmtHour } from './api'

/** Shared tooltip for all recharts charts — values lead, labels follow. */
export function ChartTip(props: any) {
  const { active, payload, label } = props
  if (!active || !payload?.length) return null
  return (
    <div className="tip">
      {label != null && (
        <div className="tip-label">
          {typeof label === 'number' ? fmtHour(label) : label}
        </div>
      )}
      {payload.map((p: any) => (
        <div className="tip-row" key={p.dataKey ?? p.name}>
          <i style={{ background: p.stroke || p.fill || p.payload?.fill }} />
          <span>{p.name ?? p.dataKey}</span>
          <b>
            {typeof p.value === 'number'
              ? p.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : p.value}
          </b>
        </div>
      ))}
    </div>
  )
}

export const AXIS = {
  tick: { fill: '#a8a29e', fontSize: 11 },
  axisLine: false,
  tickLine: false,
} as const

/** Hairline, solid, recessive horizontal grid — per mark spec. */
export function HGrid() {
  return <CartesianGrid stroke="#eee9e1" vertical={false} />
}

export function ChartCard({
  title, sub, children, legend, className,
}: {
  title: string
  sub?: string
  children: ReactNode
  legend?: ReactNode
  className?: string
}) {
  return (
    <div className={`card${className ? ` ${className}` : ''}`}>
      <div className="card-head">
        <h3>{title}</h3>
        {sub && <div className="card-sub">{sub}</div>}
      </div>
      {children}
      {legend && <div className="legend">{legend}</div>}
    </div>
  )
}

export function Lg({ color, children }: { color?: string; children: ReactNode }) {
  return (
    <span>
      {color && <i style={{ background: color }} />}
      {children}
    </span>
  )
}
