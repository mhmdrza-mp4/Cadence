import { useNavigate } from 'react-router-dom'
import { Play, RotateCcw } from 'lucide-react'
import { useStore } from '../store'
import { STATIONS } from '../api'

function Field({
  label, display, min, max, step, value, onChange, hint,
}: {
  label: string
  display: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <label className="field">
      <span className="field-top">
        {label}
        <b>{display}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export default function Simulate() {
  const { config, setConfig, running, run } = useStore()
  const navigate = useNavigate()

  const bump = (s: string, d: number) =>
    setConfig({
      ...config,
      stations: {
        ...config.stations,
        [s]: {
          ...config.stations[s],
          machines: Math.max(1, Math.min(12, config.stations[s].machines + d)),
        },
      },
    })

  const setRel = (k: 'mtbf' | 'mttr', v: number) =>
    setConfig({
      ...config,
      stations: Object.fromEntries(
        Object.entries(config.stations).map(([n, st]) => [n, { ...st, [k]: v }])
      ),
    })

  const start = async () => {
    await run()
    navigate('/')
  }

  return (
    <>
      <div className="page-head">
        <h1>Simulate</h1>
        <p>Set up the run, then start it. Results appear on the Overview.</p>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="group">
            <div className="group-label">Production</div>
            <Field
              label="Arrival rate"
              display={`${config.arrival_rate_per_hour}/hr`}
              min={8}
              max={60}
              step={1}
              value={config.arrival_rate_per_hour}
              onChange={(v) => setConfig({ ...config, arrival_rate_per_hour: v })}
              hint="How many items arrive at the line each hour. More arrivals means more work — and longer queues if the line can't keep up."
            />
            <Field
              label="Horizon"
              display={`${config.duration_hours}h`}
              min={2}
              max={24}
              step={1}
              value={config.duration_hours}
              onChange={(v) => setConfig({ ...config, duration_hours: v })}
              hint="How long the simulated shift runs. A longer run gives steadier, more trustworthy numbers."
            />
            <Field
              label="Rush orders"
              display={`${Math.round(config.priority_ratio * 100)}%`}
              min={0}
              max={0.8}
              step={0.05}
              value={config.priority_ratio}
              onChange={(v) => setConfig({ ...config, priority_ratio: v })}
              hint="The share of items that skip the queue and get made first. More rush orders means everything else waits longer."
            />
          </div>

          <div className="group">
            <div className="group-label">Reliability — all stations</div>
            <Field
              label="Time between failures"
              display={`${config.stations.Assembly.mtbf} min`}
              min={60}
              max={360}
              step={5}
              value={config.stations.Assembly.mtbf}
              onChange={(v) => setRel('mtbf', v)}
              hint="How long a machine runs on average before it breaks down. Higher means fewer interruptions."
            />
            <Field
              label="Time to repair"
              display={`${config.stations.Assembly.mttr} min`}
              min={2}
              max={40}
              step={1}
              value={config.stations.Assembly.mttr}
              onChange={(v) => setRel('mttr', v)}
              hint="How long it takes to fix a broken machine. Longer repairs mean more lost production time."
            />
          </div>

          <div className="group">
            <div className="group-label">Random seed</div>
            <div className="stepper-row">
              <span>Reproducibility</span>
              <div className="stepper">
                <b>{config.seed}</b>
                <button
                  title="Randomize seed"
                  onClick={() =>
                    setConfig({ ...config, seed: Math.floor(Math.random() * 999) + 1 })
                  }
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>
            <span className="field-hint">
              Picks the exact pattern of randomness (arrival times, breakdowns) so the same
              seed always produces the same run. Change it to try a different day.
            </span>
          </div>

          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 26 }}
            onClick={start}
            disabled={running}
          >
            <Play size={15} fill="currentColor" />
            {running ? 'Simulating…' : 'Run simulation'}
          </button>
        </div>

        <div className="card">
          <div className="group" style={{ marginTop: 0 }}>
            <div className="group-label">Machines per station</div>
            {STATIONS.map((s) => (
              <div className="stepper-row" key={s}>
                <span>{s}</span>
                <div className="stepper">
                  <button onClick={() => bump(s, -1)}>−</button>
                  <b>{config.stations[s].machines}</b>
                  <button onClick={() => bump(s, 1)}>+</button>
                </div>
              </div>
            ))}
            <span className="field-hint">
              How many machines work side by side at each station. Adding machines at a busy
              station lets it process more items at once and clears its queue faster.
            </span>
          </div>

          <div className="group">
            <div className="group-label">The line</div>
            <p style={{ color: 'var(--ink-2)', fontSize: 13 }}>
              Cutting → Assembly → Quality Inspection → Packaging. Frames take the
              full route, Panels skip inspection, Chassis loop back through Assembly
              after a failed check.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
