import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="not-found">
      <h1>404</h1>
      <p>This page doesn't exist.</p>
      <button className="btn btn-primary" onClick={() => navigate('/')}>
        Back to Overview
      </button>
    </div>
  )
}
