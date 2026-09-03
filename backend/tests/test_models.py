"""Tests for Pydantic models."""

import pytest

from app.models import (
    ProductConfig,
    SimulationConfig,
    StationConfig,
    default_products,
)


def test_default_config():
    c = SimulationConfig()
    assert c.duration_hours == 8
    assert c.arrival_rate_per_hour == 26
    assert len(c.stations) == 4
    assert len(c.products) == 3


def test_station_config_defaults():
    s = StationConfig()
    assert s.machines == 2
    assert s.mtbf == 180
    assert s.mttr == 12


def test_product_validation():
    with pytest.raises(ValueError, match="route contains an unknown station"):
        ProductConfig(name="Bad", share=0.5, routes=["Cutting", "Mars"])


def test_empty_route_rejected():
    with pytest.raises(ValueError, match="route cannot be empty"):
        ProductConfig(name="Empty", share=0.5, routes=[])


def test_share_normalization():
    c = SimulationConfig(
        products=[
            ProductConfig(name="A", share=0.4, routes=["Cutting"]),
            ProductConfig(name="B", share=0.6, routes=["Cutting"]),
        ]
    )
    total = sum(p.share for p in c.products)
    assert abs(total - 1.0) < 0.01


def test_default_products():
    products = default_products()
    assert len(products) == 3
    names = [p.name for p in products]
    assert "Frame" in names
    assert "Panel" in names
    assert "Chassis" in names
