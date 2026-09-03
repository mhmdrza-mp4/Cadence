from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .models import ScenarioRequest, SimulationConfig, SimulationResult
from .simulation import run_simulation

app = FastAPI(title="Cadence Factory Simulation API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/simulate", response_model=SimulationResult)
def simulate(config: SimulationConfig) -> SimulationResult:
    return run_simulation(config)


@app.post("/api/compare")
def compare(request: ScenarioRequest) -> dict:
    baseline = run_simulation(request.baseline)
    comparison = run_simulation(request.comparison)
    base = baseline.summary.throughput_per_hour
    alternative = comparison.summary.throughput_per_hour
    delta = ((alternative - base) / base * 100) if base else 0
    takeaway = (
        f"Scenario B increases throughput by {delta:.0f}% by adding capacity at {baseline.summary.bottleneck_station}."
        if delta >= 0
        else f"Scenario B reduces throughput by {abs(delta):.0f}%; {comparison.summary.bottleneck_station} remains the constraint."
    )
    return {"baseline": baseline, "comparison": comparison, "throughput_delta_percent": round(delta, 1), "takeaway": takeaway}
