import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import {
  BarChart3, Factory, GitCompareArrows, Layers,
  Package, SlidersHorizontal,
} from 'lucide-react'
import { StoreProvider, useStore } from './store'
import Overview from './pages/Overview'
import Simulate from './pages/Simulate'
import Stations from './pages/Stations'
import Flow from './pages/Flow'
import Products from './pages/Products'
import Compare from './pages/Compare'
import NotFound from './pages/NotFound'

const NAV = [
  { to: '/', label: 'Overview', icon: Factory, end: true },
  { to: '/stations', label: 'Stations', icon: Layers },
  { to: '/flow', label: 'Flow', icon: BarChart3 },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/compare', label: 'Compare', icon: GitCompareArrows },
  { to: '/simulate', label: 'Simulate', icon: SlidersHorizontal },
]

function Shell() {
  const { running, error, dismiss } = useStore()
  const navigate = useNavigate()
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-name">Cadence</div>
        </div>
        <nav>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={17} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="btn btn-primary" onClick={() => navigate('/simulate')}>
            {running ? 'Running…' : 'New run'}
          </button>
        </div>
      </aside>

      <main className="main">
        {error && (
          <div className="error">
            <span>{error}</span>
            <button onClick={dismiss}>Dismiss</button>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/simulate" element={<Simulate />} />
          <Route path="/stations" element={<Stations />} />
          <Route path="/flow" element={<Flow />} />
          <Route path="/products" element={<Products />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {running && (
        <div className="spinner-overlay">
          <div className="spinner" />
          <span className="spinner-text">Running simulation…</span>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
