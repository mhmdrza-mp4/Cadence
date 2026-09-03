# Cadence

Cadence is a full-stack discrete-event simulation dashboard for a four-stage
factory line. The backend uses SimPy and FastAPI; the frontend is a light,
colorful React app split across focused pages — Overview, Simulate, Stations,
Flow, Products, and Compare.

## Run locally

### Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API endpoints:

- `GET /health`
- `POST /api/simulate`
- `POST /api/compare`

### Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The frontend expects the API at `http://localhost:8000`.

## Pages

- **Overview** — KPIs (throughput, cycle time, utilization, downtime), the
  bottleneck callout, and throughput by hour
- **Simulate** — arrivals, horizon, rush orders, reliability, machines per
  station, seed
- **Stations** — utilization meters and per-machine tables
- **Flow** — queue length over time, breakdown timeline, line replay scrubber
- **Products** — cycle-time distribution, output by product, route map
- **Compare** — baseline vs. +1-machine-at-bottleneck, with a throughput overlay

## What is modeled

- Cutting, Assembly, Quality Inspection, and Packaging
- Parallel machines per station
- Product-specific routes, including skipped inspection and assembly rework loops
- Exponential arrivals and processing-time variation
- Priority queues for rush orders
- Machine MTBF/MTTR breakdowns and repairs
- Queue, utilization, downtime, throughput, event-log, and replay data
- Baseline vs. add-capacity scenario comparison
