"""Pydantic models shared by the API and simulation engine."""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

STATIONS = ["Cutting", "Assembly", "Quality Inspection", "Packaging"]


class ProductConfig(BaseModel):
    """A product type: its demand share, routing, and per-station processing means."""

    name: str
    share: float = Field(ge=0, le=1)
    routes: list[str]
    mean_processing: dict[str, float] = Field(default_factory=dict)
    processing_cv: float = Field(default=0.18, gt=0, le=1)

    @model_validator(mode="after")
    def _validate(self):
        if not self.routes:
            raise ValueError("Product route cannot be empty")
        if any(s not in STATIONS for s in self.routes):
            raise ValueError(f"{self.name}: route contains an unknown station")
        return self


class StationConfig(BaseModel):
    machines: int = Field(default=2, ge=1, le=12)
    mtbf: float = Field(default=180, gt=0, description="Mean time between failures (min)")
    mttr: float = Field(default=12, gt=0, description="Mean time to repair (min)")


class SimulationConfig(BaseModel):
    duration_hours: float = Field(default=8, gt=0, le=72)
    arrival_rate_per_hour: float = Field(default=26, gt=0, le=400)
    priority_ratio: float = Field(default=0.25, ge=0, le=1, description="Share of rush orders")
    seed: int = Field(default=7, ge=0)
    stations: dict[str, StationConfig] = Field(default_factory=dict)
    products: list[ProductConfig] = Field(default_factory=list)

    @model_validator(mode="after")
    def _fill_defaults(self):
        for s in STATIONS:
            self.stations.setdefault(s, StationConfig())
        self.stations = {k: v for k, v in self.stations.items() if k in STATIONS}
        if not self.products:
            self.products = default_products()
        total = sum(p.share for p in self.products)
        if abs(total - 1) > 0.01:
            # Normalise instead of rejecting so the UI can send rounded shares.
            for p in self.products:
                p.share = p.share / total if total else 1 / len(self.products)
        return self


class ScenarioRequest(BaseModel):
    baseline: SimulationConfig
    comparison: SimulationConfig


class MachineResult(BaseModel):
    id: str
    station: str
    utilization: float
    busy_minutes: float
    downtime_minutes: float
    breakdowns: int


class StationResult(BaseModel):
    name: str
    utilization: float
    average_queue: float
    max_queue: int
    total_downtime_minutes: float
    machines: list[MachineResult]


class SimulationSummary(BaseModel):
    throughput_per_hour: float
    completed_items: int
    average_cycle_time_minutes: float
    p50_cycle_time_minutes: float
    p90_cycle_time_minutes: float
    overall_utilization: float
    bottleneck_station: str
    bottleneck_score: float
    bottleneck_reason: str
    suggestion: str
    cycle_time_by_product: dict[str, float]
    throughput_by_product: dict[str, int]
    arrivals: int
    total_breakdowns: int
    total_downtime_minutes: float


class ReplayFrame(BaseModel):
    """Snapshot of the line at one point in simulated time for the animation."""

    t: float
    queues: dict[str, int]
    machines: dict[str, str]  # machine id -> idle | working | broken
    moving: list[dict]  # particles flowing along a link


class SimulationResult(BaseModel):
    config: SimulationConfig
    summary: SimulationSummary
    stations: list[StationResult]
    queue_series: list[dict]
    utilization_series: list[dict]
    throughput_series: list[dict]
    breakdown_markers: list[dict]
    cycle_time_distribution: list[dict]
    events: list[dict]
    replay: list[ReplayFrame]


def default_products() -> list[ProductConfig]:
    return [
        ProductConfig(
            name="Frame",
            share=0.5,
            routes=list(STATIONS),
            mean_processing={"Cutting": 2.4, "Assembly": 4.1, "Quality Inspection": 1.8, "Packaging": 2.0},
        ),
        ProductConfig(
            name="Panel",
            share=0.3,
            # Skips Quality Inspection entirely.
            routes=["Cutting", "Assembly", "Packaging"],
            mean_processing={"Cutting": 1.6, "Assembly": 3.0, "Packaging": 1.4},
        ),
        ProductConfig(
            name="Chassis",
            share=0.2,
            # Loops back through Assembly after a failed inspection.
            routes=["Cutting", "Assembly", "Quality Inspection", "Assembly", "Packaging"],
            mean_processing={"Cutting": 3.0, "Assembly": 4.8, "Quality Inspection": 2.6, "Packaging": 2.3},
        ),
    ]
