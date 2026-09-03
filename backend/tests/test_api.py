"""Tests for the FastAPI endpoints."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_simulate_default():
    r = client.post("/api/simulate", json={})
    assert r.status_code == 200
    data = r.json()
    assert data["summary"]["completed_items"] > 0
    assert data["summary"]["throughput_per_hour"] > 0
    assert len(data["stations"]) == 4
    assert len(data["replay"]) > 0


def test_simulate_custom_config():
    config = {
        "duration_hours": 2,
        "arrival_rate_per_hour": 10,
        "seed": 42,
        "stations": {
            "Cutting": {"machines": 1, "mtbf": 120, "mttr": 10},
            "Assembly": {"machines": 3, "mtbf": 200, "mttr": 8},
            "Quality Inspection": {"machines": 2, "mtbf": 180, "mttr": 12},
            "Packaging": {"machines": 1, "mtbf": 150, "mttr": 15},
        },
    }
    r = client.post("/api/simulate", json=config)
    assert r.status_code == 200
    data = r.json()
    assert data["config"]["duration_hours"] == 2
    assert data["config"]["stations"]["Cutting"]["machines"] == 1
    assert data["config"]["stations"]["Assembly"]["machines"] == 3


def test_compare():
    config = {
        "duration_hours": 2,
        "arrival_rate_per_hour": 20,
        "seed": 99,
    }
    r = client.post("/api/compare", json={"baseline": config, "comparison": config})
    assert r.status_code == 200
    data = r.json()
    assert "baseline" in data
    assert "comparison" in data
    assert "throughput_delta_percent" in data
    assert "takeaway" in data
