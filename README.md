<div align="center">

# Cadence

**A discrete-event simulation of a four-station production line, designed to identify the system constraint and measure how capacity changes affect overall throughput.**

<p>
  <img src="https://img.shields.io/badge/simulation-SimPy-blue" alt="SimPy"/>
  <img src="https://img.shields.io/badge/backend-FastAPI-009688" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/frontend-React-61DAFB" alt="React"/>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License"/>
</p>

</div>

<p align="center">
  <img src="docs/screenshots/overview.png" alt="Overview page, KPIs and bottleneck callout" width="803.5"/><br/>
  <img src="docs/screenshots/flow.png" alt="Flow page, live line and replay" width="400"/>
  <img src="docs/screenshots/compare.png" alt="Compare page, scenario comparison" width="400"/>
</p>

*Cadence* models a production line consisting of four sequential stations, Cutting, Assembly, Quality Inspection, and Packaging, each operating a set of parallel machines. Orders arrive stochastically, are routed through the line based on product type, and accumulate in queues whenever a station reaches capacity. Machines may also experience periodic failures before orders continue downstream. The dashboard makes this behavior visible by showing where work-in-process accumulates, which station constrains overall throughput, and how the line responds to a proposed capacity change.
<br>



## Rationale

Testing capacity changes on a live production line can be costly and disruptive, as stopping production for a trial results in lost throughput. This project models the line as a queueing system, allowing proposed changes such as adding or reallocating machines to be evaluated in seconds and measured by their actual impact on throughput. The model also identifies the station that currently constrains overall line capacity, since adding capacity elsewhere may have little or no effect on throughput. The scope is intentionally focused on identifying the constraint and quantifying the impact of resolving it.

---

## Running it locally

Download the latest release as a ZIP from the [Releases](../../releases) page and extract it, and run the following commands from the project root.

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1        # Windows
# source .venv/bin/activate        # macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
  
**Frontend** (in a second terminal)

```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173`. The frontend expects the API at `http://localhost:8000`.

<br>

---

<div align="center">
<sub>Released under the MIT License · see <code>LICENSE</code> for details</sub>
</div>
