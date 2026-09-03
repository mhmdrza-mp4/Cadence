import { TriangleAlert } from 'lucide-react'
import { useStore } from '../store'
import { SHORT } from '../api'

export default function Stations() {
  const { result } = useStore()

  if (!result) {
    return (
      <>
        <div className="page-head">
          <h1>Stations</h1>
          <p>Utilization, queues and per-machine detail for the four stations.</p>
        </div>
        <div className="empty">
          <h2>No simulation yet</h2>
          <p>Run a simulation first — this page breaks the results down by station and machine.</p>
        </div>
      </>
    )
  }

  const s = result.summary

  return (
    <>
      <div className="page-head">
        <h1>Stations</h1>
        <p>Utilization, queues and per-machine detail for the four stations.</p>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Station utilization</h3>
          <div className="card-sub">
            share of run time each station's machines were busy
          </div>
        </div>
        {result.stations.map((st) => (
          <div className="meter-row" key={st.name}>
            <div className="meter-name">
              {st.name}
              <span>
                {SHORT[st.name]} · {st.machines.length} machines
              </span>
            </div>
            <div className="meter-track">
              <div
                className="meter-fill"
                style={{
                  width: `${Math.min(100, st.utilization)}%`,
                  background:
                    st.name === s.bottleneck_station ? 'var(--orange)' : 'var(--blue)',
                }}
              />
            </div>
            <div className="meter-val">{st.utilization}%</div>
          </div>
        ))}
        <div className="legend" style={{ marginTop: 16 }}>
          <span>
            <i style={{ background: 'var(--blue)' }} />
            Station
          </span>
          <span>
            <i style={{ background: 'var(--orange)' }} />
            Bottleneck
          </span>
        </div>
      </div>

      {result.stations.map((st) => (
        <div className="card" key={st.name} style={{ marginTop: 16 }}>
          <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3>
                {st.name}
                {st.name === s.bottleneck_station && (
                  <span
                    className="tag"
                    style={{ background: '#fdeadd', color: '#a34a1a' }}
                  >
                    bottleneck
                  </span>
                )}
              </h3>
              <div className="card-sub">
                {st.machines.length} machines · avg queue {st.average_queue} · max{' '}
                {st.max_queue} · {st.total_downtime_minutes} min down
              </div>
            </div>
            <div style={{ color: 'var(--ink-2)', fontSize: 13 }}>
              <TriangleAlert
                size={13}
                style={{ verticalAlign: -2, marginRight: 4, color: 'var(--yellow)' }}
              />
              {st.machines.reduce((n, m) => n + m.breakdowns, 0)} failures
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Machine</th>
                <th className="num">Utilization</th>
                <th className="num">Busy</th>
                <th className="num">Downtime</th>
                <th className="num">Failures</th>
              </tr>
            </thead>
            <tbody>
              {st.machines.map((m) => (
                <tr key={m.id}>
                  <td className="strong">{m.id}</td>
                  <td className="num">{m.utilization}%</td>
                  <td className="num">{m.busy_minutes} min</td>
                  <td className="num">{m.downtime_minutes} min</td>
                  <td className="num">{m.breakdowns}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  )
}
