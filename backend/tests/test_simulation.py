"""Tests for the simulation engine."""

from app.models import SimulationConfig, StationConfig
from app.simulation import run_simulation


def test_basic_run():
    c = SimulationConfig(duration_hours=1, arrival_rate_per_hour=10, seed=1)
    result = run_simulation(c)
    assert result.summary.completed_items > 0
    assert result.summary.throughput_per_hour > 0
    assert result.summary.average_cycle_time_minutes > 0


def test_stations_present():
    c = SimulationConfig(duration_hours=1, seed=2)
    result = run_simulation(c)
    names = [s.name for s in result.stations]
    assert names == ["Cutting", "Assembly", "Quality Inspection", "Packaging"]


def test_replay_frames_populated():
    c = SimulationConfig(duration_hours=2, seed=3)
    result = run_simulation(c)
    assert len(result.replay) > 0
    frame = result.replay[0]
    assert "Cutting" in frame.queues
    assert "Assembly" in frame.queues


def test_queue_series_populated():
    c = SimulationConfig(duration_hours=1, seed=4)
    result = run_simulation(c)
    assert len(result.queue_series) > 0


def test_breakdown_markers():
    c = SimulationConfig(
        duration_hours=4,
        seed=5,
        stations={
            "Cutting": StationConfig(machines=1, mtbf=10, mttr=2),
            "Assembly": StationConfig(machines=1, mtbf=10, mttr=2),
            "Quality Inspection": StationConfig(machines=1, mtbf=10, mttr=2),
            "Packaging": StationConfig(machines=1, mtbf=10, mttr=2),
        },
    )
    result = run_simulation(c)
    assert result.summary.total_breakdowns > 0
    assert len(result.breakdown_markers) > 0


def test_deterministic_with_seed():
    c1 = SimulationConfig(duration_hours=2, seed=42)
    c2 = SimulationConfig(duration_hours=2, seed=42)
    r1 = run_simulation(c1)
    r2 = run_simulation(c2)
    assert r1.summary.completed_items == r2.summary.completed_items
    assert r1.summary.throughput_per_hour == r2.summary.throughput_per_hour


def test_different_seeds_differ():
    c1 = SimulationConfig(duration_hours=2, seed=1)
    c2 = SimulationConfig(duration_hours=2, seed=99)
    r1 = run_simulation(c1)
    r2 = run_simulation(c2)
    assert r1.summary.completed_items != r2.summary.completed_items


def test_bottleneck_detected():
    c = SimulationConfig(
        duration_hours=4,
        seed=7,
        stations={
            "Cutting": StationConfig(machines=1),
            "Assembly": StationConfig(machines=4),
            "Quality Inspection": StationConfig(machines=2),
            "Packaging": StationConfig(machines=2),
        },
    )
    result = run_simulation(c)
    assert result.summary.bottleneck_station in [
        "Cutting", "Assembly", "Quality Inspection", "Packaging"
    ]


def test_product_throughput():
    c = SimulationConfig(duration_hours=4, seed=10)
    result = run_simulation(c)
    assert len(result.summary.throughput_by_product) > 0
    total = sum(result.summary.throughput_by_product.values())
    assert total == result.summary.completed_items
