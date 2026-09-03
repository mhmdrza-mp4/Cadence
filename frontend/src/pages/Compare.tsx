import { Fragment } from 'react'
import { GitCompareArrows, Play } from 'lucide-react'
import {
  Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useStore } from '../store'
import { AXIS, ChartCard, ChartTip, HGrid, Lg } from '../chart'
import { SERIES } from '../api'

export default function Compare() {
  const { compare, running, runCompare } = useStore()

  if (!compare) {
    return (
      <>
        <div className="page-head">
          <h1>Compare</h1>
          <p>
            Run the current configuration against a variant with one extra machine
            at the detected bottleneck.
          </p>
        </div>
        <div className="empty">
          <div className="empty-icon" style={{ background: 'linear-gradient(135deg, var(--orange), var(--yellow))' }}>
            <GitCompareArrows size={24} />
          </div>
          <h2>No scenario yet</h2>
          <p>
            The comparison needs a baseline result first, then it re-runs the line
            with +1 machine at the bottleneck.
          </p>
          <button className="btn btn-primary btn-lg" onClick={runCompare} disabled={running}>
            <Play size={15} fill="currentColor" />
            {running ? 'Comparing…' : 'Run comparison'}
          </button>
        </div>
      </>
    )
  }

  const { baseline: b, comparison: c, takeaway } = compare
  const bs = b.summary
  const cs = c.summary
  const dT = cs.throughput_per_hour - bs.throughput_per_hour
  const dC = cs.average_cycle_time_minutes - bs.average_cycle_time_minutes
  const dU = cs.overall_utilization - bs.overall_utilization

  const metrics = [
    { label: 'Throughput', a: bs.throughput_per_hour, b: cs.throughput_per_hour, u: '/hr', d: dT, good: dT >= 0, n: 2 },
    { label: 'Avg cycle time', a: bs.average_cycle_time_minutes, b: cs.average_cycle_time_minutes, u: 'min', d: dC, good: dC <= 0, n: 1 },
    { label: 'Utilization', a: bs.overall_utilization, b: cs.overall_utilization, u: '%', d: dU, good: null, n: 1 },
  ]

  return (
    <>
      <div className="page-head">
        <h1>Compare</h1>
        <p>{takeaway}</p>
      </div>

      <div className="vs">
        {[
          { title: 'Scenario A', sub: 'baseline', sum: bs, side: 0 },
          { title: 'Scenario B', sub: `+1 machine at ${bs.bottleneck_station}`, sum: cs, side: 1 },
        ].map((x) => (
          <Fragment key={x.title}>
            <div className="card">
              <div className="card-head">
                <h3>
                  <span
                    className="stat-chip"
                    style={{ background: x.side === 0 ? SERIES[0] : SERIES[1] }}
                  />
                  {x.title}
                </h3>
                <div className="card-sub">{x.sub}</div>
              </div>
              {metrics.map((m) => (
                <div
                  key={m.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    padding: '9px 0',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <span style={{ color: 'var(--ink-2)' }}>{m.label}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                    <b style={{ fontSize: 19, fontWeight: 650 }}>
                      {(x.side === 0 ? m.a : m.b).toFixed(m.n)}
                      <small style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>
                        {' '}
                        {m.u}
                      </small>
                    </b>
                    {x.side === 1 && m.good !== null && (
                      <span className={`delta ${m.good ? 'up' : 'down'}`}>
                        {m.d >= 0 ? '+' : ''}
                        {m.d.toFixed(m.n)}
                      </span>
                    )}
                  </span>
                </div>
              ))}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '9px 0 0',
                }}
              >
                <span style={{ color: 'var(--ink-2)' }}>Bottleneck</span>
                <b>{x.sum.bottleneck_station}</b>
              </div>
            </div>
          </Fragment>
        ))}
        <div className="vs-badge">VS</div>
      </div>

      <div style={{ marginTop: 16 }}>
        <ChartCard
          title="Throughput overlay"
          sub="items per hour across the run"
          legend={
            <>
              <Lg color={SERIES[0]}>Scenario A</Lg>
              <Lg color={SERIES[1]}>Scenario B</Lg>
            </>
          }
        >
          <ResponsiveContainer width="100%" height={250}>
            <LineChart
              data={b.throughput_series.map((p, i) => ({
                time: p.time,
                A: p.throughput,
                B: c.throughput_series[i]?.throughput ?? 0,
              }))}
              margin={{ top: 5, right: 8, left: -18, bottom: 0 }}
            >
              <HGrid />
              <XAxis dataKey="time" {...AXIS} tickFormatter={(v) => `${v}h`} />
              <YAxis width={38} {...AXIS} allowDecimals={false} />
              <Tooltip content={<ChartTip />} />
              <Line type="monotone" dataKey="A" name="Scenario A" stroke={SERIES[0]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="B" name="Scenario B" stroke={SERIES[1]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  )
}
