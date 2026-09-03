"""Discrete-event factory model powered by SimPy."""

from __future__ import annotations

import random
from collections import defaultdict
from dataclasses import dataclass, field
from statistics import mean, median

import simpy

from .models import (
    STATIONS,
    MachineResult,
    ReplayFrame,
    SimulationConfig,
    SimulationResult,
    SimulationSummary,
    StationResult,
)


@dataclass
class Item:
    id: str
    product: object
    priority: int
    arrival: float
    route_index: int = 0


@dataclass
class Machine:
    id: str
    station: str
    broken: bool = False
    busy: bool = False
    busy_minutes: float = 0
    downtime_minutes: float = 0
    breakdowns: int = 0
    down_started: float | None = None


@dataclass
class StationState:
    name: str
    queue: simpy.PriorityStore
    machines: list[Machine]
    queue_length: int = 0
    queue_area: float = 0
    queue_max: int = 0
    last_queue_update: float = 0
    processed: int = 0


class FactorySimulation:
    def __init__(self, config: SimulationConfig):
        self.config = config
        self.env = simpy.Environment()
        self.rng = random.Random(config.seed)
        self.duration = config.duration_hours * 60
        self.sequence = 0
        self.arrivals = 0
        self.completed: list[dict] = []
        self.events: list[dict] = []
        self.breakdown_markers: list[dict] = []
        self.states: dict[str, StationState] = {}
        self.products = config.products
        self.frames: list[ReplayFrame] = []

        for station in STATIONS:
            count = config.stations[station].machines
            machines = [Machine(f"{station[:3].upper()}-{i + 1:02d}", station) for i in range(count)]
            self.states[station] = StationState(station, simpy.PriorityStore(self.env), machines)

    def log(self, event: str, **payload):
        self.events.append({"time": round(self.env.now, 2), "event": event, **payload})

    def update_queue(self, station: str, value: int):
        state = self.states[station]
        elapsed = self.env.now - state.last_queue_update
        state.queue_area += max(0, elapsed) * state.queue_length
        state.last_queue_update = self.env.now
        state.queue_length = value
        state.queue_max = max(state.queue_max, value)

    def processing_time(self, item: Item, station: str) -> float:
        avg = item.product.mean_processing.get(station, 2.0)
        return max(0.2, self.rng.gauss(avg, avg * item.product.processing_cv))

    def machine_failures(self, machine: Machine):
        settings = self.config.stations[machine.station]
        while True:
            yield self.env.timeout(self.rng.expovariate(1 / settings.mtbf))
            if self.env.now >= self.duration:
                return
            machine.broken = True
            machine.breakdowns += 1
            machine.down_started = self.env.now
            repair_time = max(0.5, self.rng.expovariate(1 / settings.mttr))
            self.breakdown_markers.append({"time": round(self.env.now / 60, 2), "station": machine.station, "machine": machine.id})
            self.log("breakdown", station=machine.station, machine=machine.id, duration=round(repair_time, 2))
            yield self.env.timeout(repair_time)
            machine.broken = False
            machine.downtime_minutes += self.env.now - (machine.down_started or self.env.now)
            machine.down_started = None
            self.log("repair", station=machine.station, machine=machine.id)

    def dispatcher(self, state: StationState):
        while True:
            available = next((machine for machine in state.machines if not machine.busy and not machine.broken), None)
            if available is None:
                yield self.env.timeout(0.2)
                continue
            _, _, item = yield state.queue.get()
            self.update_queue(state.name, len(state.queue.items))
            self.env.process(self.process_item(state, available, item))

    def process_item(self, state: StationState, machine: Machine, item: Item):
        machine.busy = True
        started = self.env.now
        state.processed += 1
        self.log("station_entry", item_id=item.id, station=state.name, machine=machine.id, priority=item.priority)
        yield self.env.timeout(self.processing_time(item, state.name))
        machine.busy_minutes += self.env.now - started
        machine.busy = False
        self.log("station_exit", item_id=item.id, station=state.name, machine=machine.id)
        item.route_index += 1
        if item.route_index < len(item.product.routes):
            next_station = item.product.routes[item.route_index]
            self.sequence += 1
            yield self.states[next_station].queue.put((item.priority, self.sequence, item))
            self.update_queue(next_station, len(self.states[next_station].queue.items))
        else:
            cycle = self.env.now - item.arrival
            self.completed.append({"id": item.id, "product": item.product.name, "cycle": cycle, "time": self.env.now})
            self.log("completion", item_id=item.id, product=item.product.name, cycle_time=round(cycle, 2))

    def arrivals_process(self):
        while True:
            yield self.env.timeout(self.rng.expovariate(self.config.arrival_rate_per_hour / 60))
            if self.env.now >= self.duration:
                return
            self.sequence += 1
            product = self.rng.choices(self.products, weights=[p.share for p in self.products])[0]
            priority = 0 if self.rng.random() < self.config.priority_ratio else 1
            item = Item(f"ORD-{self.sequence:04d}", product, priority, self.env.now)
            first = product.routes[0]
            yield self.states[first].queue.put((priority, self.sequence, item))
            self.update_queue(first, len(self.states[first].queue.items))
            self.arrivals += 1
            self.log("arrival", item_id=item.id, product=product.name, station=first, priority="rush" if priority == 0 else "standard")

    def recorder(self):
        while self.env.now <= self.duration:
            machines = {machine.id: ("broken" if machine.broken else "working" if machine.busy else "idle") for state in self.states.values() for machine in state.machines}
            queues = {name: state.queue_length for name, state in self.states.items()}
            self.frames.append(ReplayFrame(t=round(self.env.now, 1), queues=queues, machines=machines, moving=[]))
            yield self.env.timeout(5)

    def run(self) -> SimulationResult:
        self.env.process(self.arrivals_process())
        self.env.process(self.recorder())
        for state in self.states.values():
            self.env.process(self.dispatcher(state))
            for machine in state.machines:
                self.env.process(self.machine_failures(machine))
        self.env.run(until=self.duration)

        stations = self._station_results()
        queue_series = [{"time": round(f.t / 60, 3), **f.queues} for f in self.frames]
        utilization_series = [
            {"time": hour, **{s.name: s.utilization for s in stations}}
            for hour in range(int(self.config.duration_hours) + 1)
        ]
        throughput_series = [{"time": hour, "throughput": sum(1 for item in self.completed if int(item["time"] // 60) == hour)} for hour in range(int(self.config.duration_hours) + 1)]
        cycles = [i["cycle"] for i in self.completed]
        by_product: dict[str, list[float]] = defaultdict(list)
        throughput_by_product: dict[str, int] = defaultdict(int)
        for item in self.completed:
            by_product[item["product"]].append(item["cycle"])
            throughput_by_product[item["product"]] += 1
        bottleneck = max(stations, key=lambda station: (station.average_queue, station.utilization))
        breakdowns = sum(machine.breakdowns for station in stations for machine in station.machines)
        downtime = sum(machine.downtime_minutes for station in stations for machine in station.machines)
        summary = SimulationSummary(
            throughput_per_hour=round(len(self.completed) / self.config.duration_hours, 2),
            completed_items=len(self.completed),
            average_cycle_time_minutes=round(mean(cycles), 2) if cycles else 0,
            p50_cycle_time_minutes=round(median(cycles), 2) if cycles else 0,
            p90_cycle_time_minutes=round(sorted(cycles)[min(len(cycles) - 1, int(len(cycles) * 0.9))], 2) if cycles else 0,
            overall_utilization=round(mean(s.utilization for s in stations), 1),
            bottleneck_station=bottleneck.name,
            bottleneck_score=round(bottleneck.utilization, 1),
            bottleneck_reason=f"{bottleneck.utilization:.0f}% utilization and {bottleneck.average_queue:.1f} average queue",
            suggestion=f"Add one machine at {bottleneck.name} first; it has the highest constraint score.",
            cycle_time_by_product={key: round(mean(value), 2) for key, value in by_product.items()},
            throughput_by_product=dict(throughput_by_product),
            arrivals=self.arrivals,
            total_breakdowns=breakdowns,
            total_downtime_minutes=round(downtime, 2),
        )
        distribution = [{"cycle_time": round(i["cycle"], 2), "product": i["product"]} for i in self.completed]
        return SimulationResult(config=self.config, summary=summary, stations=stations, queue_series=queue_series,
                                utilization_series=utilization_series, throughput_series=throughput_series,
                                breakdown_markers=self.breakdown_markers, cycle_time_distribution=distribution,
                                events=self.events, replay=self.frames)

    def _station_results(self) -> list[StationResult]:
        results = []
        for state in self.states.values():
            for state_machine in state.machines:
                if state_machine.down_started is not None and self.env.now > state_machine.down_started:
                    state_machine.downtime_minutes += self.env.now - state_machine.down_started
                    state_machine.down_started = self.env.now
            machines = [MachineResult(id=m.id, station=m.station, utilization=round(m.busy_minutes / self.duration * 100, 1),
                                      busy_minutes=round(m.busy_minutes, 2), downtime_minutes=round(m.downtime_minutes, 2), breakdowns=m.breakdowns) for m in state.machines]
            utilization = sum(m.busy_minutes for m in state.machines) / (len(state.machines) * self.duration) * 100
            results.append(StationResult(name=state.name, utilization=round(utilization, 1),
                                         average_queue=round(state.queue_area / self.duration, 2), max_queue=state.queue_max,
                                         total_downtime_minutes=round(sum(m.downtime_minutes for m in machines), 2), machines=machines))
        return results


def run_simulation(config: SimulationConfig) -> SimulationResult:
    return FactorySimulation(config).run()
