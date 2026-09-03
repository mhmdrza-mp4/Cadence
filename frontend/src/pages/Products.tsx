import { Fragment, useMemo } from 'react'
import {
  Bar, BarChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Package } from 'lucide-react'
import { useStore } from '../store'
import { AXIS, ChartCard, ChartTip, HGrid, Lg } from '../chart'
import { PRODUCTS, PCOLORS, fmtMin } from '../api'

const ROUTES: Record<string, string[]> = {
  Frame: ['Cutting', 'Assembly', 'Quality Inspection', 'Packaging'],
  Panel: ['Cutting', 'Assembly', 'Packaging'],
  Chassis: ['Cutting', 'Assembly', 'Quality Inspection', 'Assembly', 'Packaging'],
}

export default function Products() {
  const { result } = useStore()

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
          <div className="empty-icon" style={{ background: 'linear-gradient(135deg, var(--aqua), var(--green))' }}>
            <Package size={24} />
          </div>
          <h2>No simulation yet</h2>
          <p>Run a simulation first — this page compares product mixes and cycle times.</p>
        </div>
      </>
    )
  }

  const s = result.summary
  const last = PRODUCTS[PRODUCTS.length - 1]
  const shareOf = (p: string) =>
    s.completed_items ? Math.round((s.throughput_by_product[p] ?? 0) / s.completed_items * 100) : 0

  return (
    <>
      <div className="page-head">
        <h1>Products</h1>
        <p>How each product type flows through the line.</p>
      </div>

      <div className="products-grid">
        <div className="products-left">
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
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={buckets}
                margin={{ top: 5, right: 8, left: -18, bottom: 0 }}
                barCategoryGap="25%"
              >
                <HGrid />
                <XAxis dataKey="time" {...AXIS} />
                <YAxis width={38} {...AXIS} allowDecimals={false} />
                <Tooltip
                  content={<ChartTip />}
                  cursor={{ fill: 'rgba(28,25,23,0.045)' }}
                  isAnimationActive={false}
                />
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
          </ChartCard>

          <ChartCard title="Route map" sub="which stations each product visits" className="route-card">
            <div className="routes">
              <div className="routes-block">
                {PRODUCTS.map((p) => (
                  <div className="route-row" key={p}>
                    <span className="route-name">
                      <span className="stat-chip" style={{ background: PCOLORS[p] }} />
                      {p}
                    </span>
                    <span className="route-steps">
                      {ROUTES[p].map((r, i) => (
                        <Fragment key={i}>
                          {i > 0 && <span className="route-arrow">→</span>}
                          <span className="route-step">{r}</span>
                        </Fragment>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </div>

        <ChartCard
          title="Output & cycle time by product"
          className="mix-card"
        >
          <div className="mix-kpi">
            <span className="stat-label">Completed items</span>
            <span className="mix-kpi-value">
              {s.completed_items}
              <small>items</small>
            </span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Items</th>
                <th className="num">Share</th>
                <th className="num">Cycle</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCTS.map((p) => (
                <tr key={p}>
                  <td className="strong">
                    <span className="stat-chip" style={{ background: PCOLORS[p] }} />
                    {p}
                  </td>
                  <td className="num">{s.throughput_by_product[p] ?? 0}</td>
                  <td className="num">{shareOf(p)}%</td>
                  <td className="num">
                    {s.cycle_time_by_product[p] !== undefined
                      ? `${fmtMin(s.cycle_time_by_product[p])} min`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mix-foot">
            <div className="group-label">Output mix</div>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Tooltip content={<ChartTip />} isAnimationActive={false} />
                <Pie
                  data={PRODUCTS.map((p) => ({
                    name: p,
                    value: s.throughput_by_product[p] ?? 0,
                    fill: PCOLORS[p],
                  }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={68}
                  paddingAngle={2}
                  cornerRadius={3}
                  strokeWidth={0}
                  isAnimationActive={false}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </>
  )
}
