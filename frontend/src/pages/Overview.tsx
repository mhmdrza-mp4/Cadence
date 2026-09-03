import { TriangleAlert, Zap } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import { AXIS, ChartCard, ChartTip, HGrid } from '../chart'
import { SERIES } from '../api'

function Stat({
  label, value, unit, sub, color,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  color?: string
}) {
  return (
    <div className="card stat">
      <div className="stat-label">
        {color && <span className="stat-chip" style={{ background: color }} />}
        {label}
      </div>
      <div className="stat-value">
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export default function Overview() {
  const { result } = useStore()

  if (!result) {
    return (
      <>
        <div className="page-head">
          <h1>Overview</h1>
          <p>Run a simulation to see throughput, cycle times and the bottleneck.</p>
        </div>
        <div className="empty">
          <div className="empty-icon" style={{ background: 'linear-gradient(135deg, var(--blue), var(--aqua))' }}>
            <Zap size={24} />
          </div>
          <h2>No simulation yet</h2>
          <p>
            Head to the <Link to="/simulate" className="inline-link">Simulate</Link> tab to
            configure the line and run your first simulation. Results will land here.
          </p>
        </div>
      </>
    )
  }

  const s = result.summary
  return (
    <>
      <div className="page-head">
        <h1>Overview</h1>
        <p>
          {s.completed_items} items completed in {result.config.duration_hours}h ·
          seed {result.config.seed}
        </p>
      </div>

      <div className="grid grid-kpi">
        <Stat
          label="Throughput"
          value={s.throughput_per_hour}
          unit="/hr"
          sub={`${s.arrivals} arrived`}
          color={SERIES[0]}
        />
        <Stat
          label="Avg cycle time"
          value={s.average_cycle_time_minutes}
          unit="min"
          sub={`p90 ${s.p90_cycle_time_minutes} min`}
          color={SERIES[1]}
        />
        <Stat
          label="Utilization"
          value={s.overall_utilization}
          unit="%"
          sub="mean of 4 stations"
          color={SERIES[2]}
        />
        <Stat
          label="Downtime"
          value={s.total_downtime_minutes}
          unit="min"
          sub={`${s.total_breakdowns} breakdowns`}
          color={SERIES[3]}
        />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="insight">
          <div
            className="insight-icon"
            style={{ background: 'linear-gradient(135deg, var(--orange), #f0925f)' }}
          >
            <TriangleAlert size={18} />
          </div>
          <div>
            <b>{s.bottleneck_station} is the constraint</b>
            <p>
              {s.bottleneck_reason}. {s.suggestion}
            </p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <ChartCard
          title="Throughput by hour"
          sub="items completed per simulated hour"
          legend={null}
        >
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={result.throughput_series} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="tp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <HGrid />
              <XAxis dataKey="time" {...AXIS} tickFormatter={(v) => `${v}h`} />
              <YAxis width={38} {...AXIS} allowDecimals={false} />
              <Tooltip content={<ChartTip />} />
              <Area
                type="monotone"
                dataKey="throughput"
                name="Throughput"
                stroke={SERIES[0]}
                strokeWidth={2}
                fill="url(#tp)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  )
}
