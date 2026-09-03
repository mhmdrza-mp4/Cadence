import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar, BarChart, ResponsiveContainer, XAxis, YAxis,
} from 'recharts'
import { useStore } from '../store'
import { AXIS, ChartCard, HGrid, Lg } from '../chart'
import { PRODUCTS, PCOLORS } from '../api'

const ROUTES: Record<string, string[]> = {
  Frame: ['Cutting', 'Assembly', 'Quality Inspection', 'Packaging'],
  Panel: ['Cutting', 'Assembly', 'Packaging'],
  Chassis: ['Cutting', 'Assembly', 'Quality Inspection', 'Assembly', 'Packaging'],
}

export default function Products() {
  const { result } = useStore()
  const [col, setCol] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const buckets = useMemo(() => {
    if (!result) return []
    const m: Record<string, Record<string, number>> = {}
    for (const { cycle_time, product } of result.cycle_time_distribution) {
      const k = `${Math.floor(cycle_time / 5) * 5}`
      ;(m[k] ??= {})[product] = (m[k][product] ?? 0) + 1
    }
    return Object.entries(m)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([k, v]) => ({ time: `${k}m`, ...v }))
  }, [result])

  if (!result) {
    return (
      <>
        <div className="page-head">
          <h1>Products</h1>
          <p>How each product type flows through the line.</p>
        </div>
        <div className="empty">
          <h2>No simulation yet</h2>
          <p>Run a simulation first — this page compares product mixes and cycle times.</p>
        </div>
      </>
    )
  }

  const s = result.summary
  const last = PRODUCTS[PRODUCTS.length - 1]

  return (
    <>
      <div className="page-head">
        <h1>Products</h1>
        <p>How each product type flows through the line.</p>
      </div>

      <ChartCard
        title="Cycle time distribution"
        sub="completed items by total minutes in the system, 5-minute buckets"
        legend={
          <>
            {PRODUCTS.map((p) => (
              <Lg key={p} color={PCOLORS[p]}>{p}</Lg>
            ))}
          </>
        }
      >
        <div className="ct-wrap" ref={wrapRef}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={buckets}
              margin={{ top: 5, right: 8, left: -18, bottom: 0 }}
              barCategoryGap="25%"
              onMouseMove={(st: any) => setCol(st?.activeTooltipIndex ?? null)}
              onMouseLeave={() => setCol(null)}
              onMouseEnter={(st: any) => setCol(st?.activeTooltipIndex ?? null)}
            >
              <HGrid />
              <XAxis dataKey="time" {...AXIS} />
              <YAxis width={38} {...AXIS} allowDecimals={false} />
              {PRODUCTS.map((p) => (
                <Bar
                  key={p}
                  dataKey={p}
                  name={p}
                  stackId="c"
                  fill={PCOLORS[p]}
                  radius={p === last ? [4, 4, 0, 0] : undefined}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <Callout col={col} buckets={buckets} wrapRef={wrapRef} />
        </div>
      </ChartCard>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <ChartCard title="Output & cycle time by product" sub={`${s.completed_items} items completed`}>
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Completed</th>
                <th className="num">Share</th>
                <th className="num">Avg cycle</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCTS.map((p) => {
                const c = s.throughput_by_product[p] ?? 0
                const share = s.completed_items ? Math.round((c / s.completed_items) * 100) : 0
                return (
                  <tr key={p}>
                    <td className="strong">
                      <span className="stat-chip" style={{ background: PCOLORS[p] }} />
                      {p}
                    </td>
                    <td className="num">{c}</td>
                    <td className="num">{share}%</td>
                    <td className="num">
                      {s.cycle_time_by_product[p] !== undefined
                        ? `${s.cycle_time_by_product[p]} min`
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ChartCard>

        <ChartCard title="Route map" sub="which stations each product visits">

          {PRODUCTS.map((p) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0' }}>
              <span
                style={{
                  fontWeight: 600,
                  width: 78,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                <span className="stat-chip" style={{ background: PCOLORS[p] }} />
                {p}
              </span>
              <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {ROUTES[p].map((r, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {i > 0 && <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>→</span>}
                    <span
                      style={{
                        fontSize: 12,
                        padding: '3px 9px',
                        borderRadius: 99,
                        background: 'var(--bg)',
                        border: '1px solid var(--line)',
                      }}
                    >
                      {r}
                    </span>
                  </span>
                ))}
              </span>
            </div>
          ))}
        </ChartCard>
      </div>
    </>
  )
}

/**
 * Segment-level callout overlay for the cycle-time chart.
 * Reads the rendered SVG geometry (each stack's segment rects) and draws
 * leader lines from every present segment of the hovered column to a pinned
 * breakdown card — no floating tooltip, no cursor chasing, zero position lag.
 */
function Callout({
  col, buckets, wrapRef,
}: {
  col: number | null
  buckets: Record<string, any>[]
  wrapRef: React.RefObject<HTMLDivElement | null>
}) {
  const [geom, setGeom] = useState<{
    bands: { x: number; w: number }[]
    stackX: number
    stackW: number
    segments: { product: string; count: number; y: number; h: number }[]
    wrapW: number
  } | null>(null)

  // measure the hovered column's real segment geometry from the SVG
  useEffect(() => {
    if (col === null) {
      setGeom(null)
      return
    }
    const wrap = wrapRef.current
    if (!wrap) return
    const svg = wrap.querySelector('svg')
    if (!svg) return

    const groups = svg.querySelectorAll('g.recharts-bar')
    const bands: { x: number; w: number }[] = []
    let stackX = 0
    let stackW = 0
    const segments: { product: string; count: number; y: number; h: number }[] = []

    // per-series rectangles: g.recharts-bar > g.recharts-bar-rectangles > g.recharts-bar-rectangle > path
    groups.forEach((g, seriesIdx) => {
      const product = PRODUCTS[seriesIdx]
      if (!product) return
      const rects = g.querySelectorAll('g.recharts-bar-rectangle > path')
      const r = rects[col] as SVGPathElement | undefined
      if (r) {
        const x = parseFloat(r.getAttribute('x') ?? '0')
        const y = parseFloat(r.getAttribute('y') ?? '0')
        const w = parseFloat(r.getAttribute('width') ?? '0')
        const h = parseFloat(r.getAttribute('height') ?? '0')
        if (w > 0 && h > 0) {
          segments.push({ product, count: buckets[col]?.[product] ?? 0, y, h })
          stackX = x
          stackW = w
        }
      }
      if (seriesIdx === 0) {
        // background rects of series 0 span the full band for every column
        rects.forEach((rr) => {
          const x = parseFloat((rr as SVGPathElement).getAttribute('x') ?? '0')
          const w = parseFloat((rr as SVGPathElement).getAttribute('width') ?? '0')
          bands.push({ x, w })
        })
      }
    })

    if (!segments.length) {
      setGeom(null)
      return
    }
    segments.sort((a, b) => a.y - b.y) // top-to-bottom like the visual stack
    setGeom({
      bands,
      stackX,
      stackW,
      segments,
      wrapW: wrap.clientWidth,
    })
  }, [col, buckets, wrapRef])

  if (!geom || col === null) return null

  const side = geom.stackX + geom.stackW / 2 > geom.wrapW / 2 ? 'left' : 'right'
  const dir = side === 'right' ? 1 : -1
  const cardW = 158
  const gap = 18
  const cardX =
    side === 'right'
      ? Math.min(geom.wrapW - cardW - 4, geom.stackX + geom.stackW + gap)
      : Math.max(4, geom.stackX - gap - cardW)

  // band highlight over the hovered category
  const band = geom.bands[col]
  const bandTop = 4
  const bandBottom = Math.max(...geom.segments.map((s) => s.y + s.h))
  const topSeg = geom.segments[0]
  const cardY = Math.max(4, Math.min(topSeg.y, bandBottom - 90))

  return (
    <>
      <svg className={`ct-svg on`} width="100%" height="100%">
        {/* hovered-column band */}
        {band && (
          <rect
            x={band.x}
            y={bandTop}
            width={band.w}
            height={Math.max(10, bandBottom - bandTop)}
            fill="rgba(28,25,23,0.035)"
            rx={6}
          />
        )}
        {/* leader lines: one per present segment */}
        {geom.segments.map((s, i) => {
          const x0 = side === 'right' ? geom.stackX + geom.stackW : geom.stackX
          const y0 = s.y + s.h / 2
          const stub = side === 'right' ? x0 + 5 : x0 - 5
          const elbow = cardX - dir * 6
          const y1 = topSeg.y + i * 17 + 8
          return (
            <g key={s.product}>
              <line x1={stub} y1={y0} x2={elbow} y2={y0} stroke={PCOLORS[s.product]} strokeWidth={1.5} />
              <circle cx={stub} cy={y0} r={2.5} fill={PCOLORS[s.product]} />
              {/* vertical trunk beside the card */}
              {i === 0 && <line x1={elbow} y1={topSeg.y} x2={elbow} y2={topSeg.y + (geom.segments.length - 1) * 17} stroke="var(--line-2)" strokeWidth={1} />}
              <line x1={elbow} y1={y0} x2={elbow} y2={y1} stroke={PCOLORS[s.product]} strokeWidth={1} strokeDasharray="2 2" />
            </g>
          )
        })}
      </svg>
      <div
        className="ct-card on"
        style={{ left: cardX, top: cardY, width: cardW }}
      >
        <div className="ct-head">{buckets[col]?.time}</div>
        {geom.segments.map((s) => (
          <div className="ct-row" key={s.product}>
            <i style={{ background: PCOLORS[s.product] }} />
            <span>{s.product}</span>
            <b>{s.count}</b>
          </div>
        ))}
      </div>
    </>
  )
}
