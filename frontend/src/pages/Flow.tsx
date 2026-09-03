import { useRef, useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../store'
import { AXIS, ChartCard, ChartTip, HGrid, Lg } from '../chart'
import { SERIES, SHORT, STATIONS, clk, fmtHour } from '../api'

const GRAY = '#d6d0c6' // de-emphasis hue for non-focus stations

export default function Flow() {
  const { result } = useStore()
  const [focus, setFocus] = useState<string | null>(null)

  if (!result) {
    return (
      <>
        <div className="page-head">
          <h1>Flow</h1>
          <p>How work moves through the line over time.</p>
        </div>
        <div className="empty">
          <div className="empty-icon" style={{ background: 'linear-gradient(135deg, var(--orange), var(--yellow))' }}>
            <BarChart3 size={24} />
          </div>
          <h2>No simulation yet</h2>
          <p>Run a simulation first — this page shows queue pressure and breakdown timing.</p>
        </div>
      </>
    )
  }

  const s = result.summary
  const bn = s.bottleneck_station

  return (
    <>
      <div className="page-head">
        <h1>Flow</h1>
        <p>How work moves through the line over time. Hover a chart for exact values.</p>
      </div>

      <ChartCard
        title="Queue length"
        sub={focus ? `showing ${focus}` : 'click a station to focus it'}
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={result.queue_series}
            margin={{ top: 5, right: 8, left: -18, bottom: 0 }}
            onClick={(e: any) => {
              const k = e?.activeLabel
              if (k && STATIONS.includes(k)) setFocus(focus === k ? null : k)
            }}
          >
            <HGrid />
            <XAxis dataKey="time" {...AXIS} tickFormatter={fmtHour} />
            <YAxis width={38} {...AXIS} allowDecimals={false} />
            <Tooltip content={<ChartTip />} />
            {STATIONS.map((name) => {
              const dim = focus !== null && focus !== name
              return (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  name={name}
                  stroke={dim ? GRAY : SERIES[STATIONS.indexOf(name)]}
                  strokeWidth={dim ? 1.5 : name === bn ? 2.5 : 2}
                  dot={false}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
        <div className="legend">
          {STATIONS.map((name) => (
            <Lg key={name} color={SERIES[STATIONS.indexOf(name)]}>
              {name === bn ? `${name} · bottleneck` : name}
            </Lg>
          ))}
        </div>
      </ChartCard>

      <ChartCard
        title="Line replay"
        sub="drag the timeline to inspect the line — frames every 5 simulated minutes"
      >
        <Replay />
      </ChartCard>

      <ChartCard
        title="Breakdown timeline"
        sub={`${s.total_breakdowns} failures across the run`}
      >
        <div className="bd-grid">
          {result.stations.map((st) => {
            const marks = result.breakdown_markers.filter((m) => m.station === st.name)
            return (
              <div className="meter-row bd-row" key={st.name}>
                <div className="meter-name">
                  {st.name}
                  <span>{st.total_downtime_minutes} min down</span>
                </div>
                <div
                  style={{
                    position: 'relative',
                    height: 8,
                    borderRadius: 5,
                    background: 'var(--bg)',
                    border: '1px solid var(--line)',
                  }}
                >
                  {marks.map((m, i) => (
                    <i
                      key={i}
                      title={`${m.machine} at ${fmtHour(m.time)}`}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: `${Math.min(100, (m.time / result.config.duration_hours) * 100)}%`,
                        width: 4,
                        height: 6,
                        borderRadius: 2,
                        background: 'var(--red)',
                      }}
                    />
                  ))}
                </div>
                <div className="meter-val" style={{ fontSize: 12.5 }}>
                  {marks.length ? `${marks.length} fails` : 'clean'}
                </div>
              </div>
            )
          })}
        </div>
      </ChartCard>
    </>
  )
}

function Replay() {
  const { result } = useStore()
  const [fi, setFi] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  if (!result) return null

  const frames = result.replay
  const len = frames.length
  const idx = Math.min(fi, len - 1)
  const frame = frames[idx]
  const prev = idx > 0 ? frames[idx - 1] : null
  const s = result.summary
  const events = result.events ?? []
  const bn = s.bottleneck_station

  const queueOf = (f: any, st: string) => f?.queues?.[st] ?? 0
  const totals = frames.map((f) => STATIONS.reduce((a, st) => a + queueOf(f, st), 0))
  const maxQueue = Math.max(1, ...totals)
  const maxStationQueue = Math.max(1, ...frames.flatMap((f) => STATIONS.map((st) => queueOf(f, st))))
  const timeOf = (f: any) => clk(f.t)

  // events inside (prev.t, frame.t] — what happened in the step that just ended
  const evs = events.filter((e) => (prev ? e.time > prev.t && e.time <= frame.t : e.time <= frame.t))
  const breakdowns = evs.filter((e) => e.event === 'breakdown')
  const repairs = evs.filter((e) => e.event === 'repair')
  const completions = evs.filter((e) => e.event === 'completion')

  // events between the playhead and the hovered frame, for the track preview
  const hoverEvs =
    hover !== null && hover !== idx
      ? events.filter((e) => e.time > frames[Math.min(idx, hover)].t && e.time <= frames[Math.max(idx, hover)].t)
      : []
  const hoverBreaks = hoverEvs.filter((e) => e.event === 'breakdown').length
  const hoverDone = hoverEvs.filter((e) => e.event === 'completion').length

  // machines whose state changed in this step (ring highlight)
  const machineChanges = new Set<string>()
  if (prev) {
    for (const [mid, state] of Object.entries(frame.machines)) {
      if (prev.machines[mid] !== state) machineChanges.add(mid)
    }
  }

  // analysis jumps
  const peakIdx = totals.indexOf(Math.max(...totals))
  const bdTimes = events.filter((e) => e.event === 'breakdown').map((e) => e.time)
  const lastBdIdx = bdTimes.length
    ? frames.reduce((acc, f, i) => (f.t <= bdTimes[bdTimes.length - 1] ? i : acc), 0)
    : -1

  const seekTo = (clientX: number) => {
    const el = trackRef.current
    if (!el || len < 2) return
    const r = el.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    setFi(Math.round(frac * (len - 1)))
  }
  const jumpTo = (target: number) => setFi(Math.min(len - 1, Math.max(0, target)))

  const chip = (bg: string, fg: string, outline = false) =>
    ({
      fontSize: 11.5,
      fontWeight: 600,
      color: fg,
      background: bg,
      border: outline ? '1px solid var(--line)' : undefined,
      borderRadius: 99,
      padding: '2px 9px',
    }) as const

  return (
    <div>
      {/* station grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {STATIONS.map((station) => {
          const st = result.stations.find((x) => x.name === station)!
          const q = queueOf(frame, station)
          const qDelta = q - queueOf(prev, station)
          const isBn = bn === station
          return (
            <div
              key={station}
              style={{
                border: `1px solid ${isBn ? 'var(--orange)' : 'var(--line)'}`,
                borderRadius: 12,
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 600, fontSize: 12.5 }}>
                  {SHORT[station]}
                  {isBn && (
                    <span style={{ color: 'var(--orange)', fontSize: 10, marginLeft: 6 }}>constraint</span>
                  )}
                </span>
                {prev && qDelta !== 0 && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: qDelta > 0 ? '#9c2b2a' : '#006300',
                    }}
                  >
                    {qDelta > 0 ? `+${qDelta}` : qDelta}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {st.machines.map((m) => {
                    const state = frame.machines[m.id] ?? 'idle'
                    const changed = machineChanges.has(m.id)
                    return (
                      <i
                        key={m.id}
                        title={`${m.id} — ${state}${changed ? ' · changed this step' : ''}`}
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 4,
                          background:
                            state === 'broken'
                              ? 'var(--red)'
                              : state === 'working'
                                ? 'var(--aqua)'
                                : 'var(--line-2)',
                          boxShadow: changed ? '0 0 0 2px #fff, 0 0 0 3.5px var(--blue)' : undefined,
                        }}
                      />
                    )
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginLeft: 'auto' }}>
                  <b style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{q}</b>
                  <span style={{ color: 'var(--ink-3)', fontSize: 10.5 }}>waiting</span>
                </div>
              </div>
              <div
                style={{
                  height: 4,
                  borderRadius: 3,
                  background: 'var(--line)',
                  marginTop: 8,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${(q / maxStationQueue) * 100}%`,
                    background: q > 0 ? (isBn ? 'var(--orange)' : 'var(--blue)') : 'transparent',
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* what changed in this step */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap',
          marginTop: 12,
          minHeight: 24,
        }}
      >
        <span
          style={{
            color: 'var(--ink-3)',
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {prev ? 'This step' : 'Start'}
        </span>
        {breakdowns.map((e, i) => (
          <span key={`bd-${i}`} style={chip('#fdeceb', '#9c2b2a')}>
            {e.machine} broke down
          </span>
        ))}
        {repairs.map((e, i) => (
          <span key={`rp-${i}`} style={chip('#e2f3e2', '#006300')}>
            {e.machine} repaired
          </span>
        ))}
        {completions.length > 0 && (
          <span style={chip('var(--bg)', 'var(--ink)', true)}>
            {completions.length} item{completions.length > 1 ? 's' : ''} finished
          </span>
        )}
        {STATIONS.map((st) => {
          if (!prev) return null
          const d = queueOf(frame, st) - queueOf(prev, st)
          if (d === 0) return null
          return (
            <span key={st} style={chip('var(--bg)', 'var(--ink-2)', true)}>
              {SHORT[st]} {d > 0 ? `+${d}` : d}
            </span>
          )
        })}
        {!breakdowns.length && !repairs.length && !completions.length && (
          <span style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>
            {prev ? 'quiet — nothing changed' : 'line is starting up'}
          </span>
        )}
      </div>

      {/* timeline data-strip: stacked queues per frame */}
      <div style={{ marginTop: 12 }}>
        <div
          ref={trackRef}
          tabIndex={0}
          onMouseDown={(e) => {
            seekTo(e.clientX)
            e.preventDefault()
          }}
          onMouseMove={(e) => {
            const el = trackRef.current
            if (!el) return
            const r = el.getBoundingClientRect()
            const f = Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (len - 1))
            setHover(f)
            if (e.buttons === 1) setFi(f) // drag to scrub
          }}
          onMouseLeave={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') jumpTo(idx - 1)
            if (e.key === 'ArrowRight') jumpTo(idx + 1)
          }}
          style={{ position: 'relative', height: 54, cursor: 'ew-resize', userSelect: 'none', touchAction: 'none' }}
        >
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 1 }}>
            {frames.map((f, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${Math.max(2, (totals[i] / maxQueue) * 100)}%`,
                  display: 'flex',
                  flexDirection: 'column-reverse',
                  borderRadius: 2,
                  overflow: 'hidden',
                  opacity: i <= idx ? 1 : 0.28,
                  background: 'var(--line)',
                }}
              >
                {STATIONS.map((st) =>
                  queueOf(f, st) > 0 ? (
                    <div
                      key={st}
                      style={{
                        height: `${(queueOf(f, st) / Math.max(1, totals[i])) * 100}%`,
                        background: SERIES[STATIONS.indexOf(st)],
                      }}
                    />
                  ) : null
                )}
              </div>
            ))}
          </div>
          {/* breakdown ticks under the strip */}
          {frames.map((f, i) => {
            const before = i > 0 ? frames[i - 1].t : -1
            const hasBd = bdTimes.some((t) => t > before && t <= f.t)
            return hasBd ? (
              <i
                key={`tick-${i}`}
                title="breakdown in this interval"
                style={{
                  position: 'absolute',
                  left: `${(i / Math.max(1, len - 1)) * 100}%`,
                  bottom: 0,
                  width: 2,
                  height: 7,
                  background: 'var(--red)',
                  borderRadius: 1,
                }}
              />
            ) : null
          })}
          {/* hover cue + preview */}
          {hover !== null && hover !== idx && (
            <div
              style={{
                position: 'absolute',
                left: `${(hover / Math.max(1, len - 1)) * 100}%`,
                top: 0,
                bottom: 9,
                borderLeft: '1px dashed var(--ink-3)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  bottom: -4,
                  transform: hover > len / 2 ? 'translateX(-100%)' : undefined,
                  whiteSpace: 'nowrap',
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--ink-2)',
                  background: 'var(--surface)',
                  border: '1px solid var(--line-2)',
                  borderRadius: 6,
                  padding: '1px 6px',
                }}
              >
                {timeOf(frames[hover])}
                {hoverBreaks > 0 && ` · ${hoverBreaks} broke`}
                {hoverDone > 0 && ` · ${hoverDone} finished`}
                {totals[hover] > 0 && ` · ${totals[hover]} waiting`}
              </div>
            </div>
          )}
          {/* playhead */}
          <div
            style={{
              position: 'absolute',
              left: `${(idx / Math.max(1, len - 1)) * 100}%`,
              top: -3,
              bottom: 7,
              width: 2,
              background: 'var(--ink)',
              borderRadius: 1,
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            color: 'var(--ink-3)',
            fontSize: 10.5,
            marginTop: 4,
          }}
        >
          <span>{timeOf(frames[0])}</span>
          <span>bar height = total waiting · red tick = breakdown</span>
          <span>{timeOf(frames[len - 1])}</span>
        </div>
      </div>

      {/* controls + readout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 10px', borderRadius: 9 }}
            onClick={() => jumpTo(idx - 1)}
            disabled={idx === 0}
            aria-label="Previous step"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 10px', borderRadius: 9 }}
            onClick={() => jumpTo(idx + 1)}
            disabled={idx === len - 1}
            aria-label="Next step"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <span style={{ fontWeight: 650, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{timeOf(frame)}</span>
        <span style={{ color: 'var(--ink-2)', fontSize: 12.5 }}>
          {totals[idx]} waiting ·{' '}
          {Object.values(frame.machines).filter((v) => v === 'working').length}/
          {Object.keys(frame.machines).length} working
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 10px', borderRadius: 9, fontSize: 12.5 }}
            onClick={() => jumpTo(peakIdx)}
            disabled={peakIdx <= 0}
          >
            Peak queue {totals[peakIdx]} @ {timeOf(frames[peakIdx])}
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 10px', borderRadius: 9, fontSize: 12.5 }}
            onClick={() => jumpTo(lastBdIdx)}
            disabled={lastBdIdx <= 0}
          >
            Last breakdown
          </button>
        </div>
      </div>
    </div>
  )
}
