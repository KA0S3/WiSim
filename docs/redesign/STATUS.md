# Current WiSim status

WiSim's active entry point is `src/workbench-entry.tsx`. The workbench combines live electrical simulation, a schematic, linked 3D views, provisional system sizing, and guided training. Start with the [README](../../README.md), [review checklist](REVIEW.md), or [product audit](AUDIT.md).

- Design supports single-, split- and three-phase inverter output, optional charger input, appliance schedules, panel/string alternatives, multiple MPPTs and hot/cold PV checks. See [design assumptions](DESIGNER-SOURCE-NOTES.md).
- Building fit and cable routing support modeled mounting surfaces. Review failed routes and field assumptions before using cable lengths. See [buildings](BUILDINGS.md) and [routing](ROUTING.md).
- The catalogue validator reports 32 verified records among 131. The workbench has 63 simulation-ready profiles. Readiness measures sufficient input for a supported model. See [catalogue sources](../CATALOG_SOURCES.md) and [engineering boundaries](ENGINEERING.md).
- Projects and versions are stored in the current browser. Use JSON exports for portable backups. See [saving](SAVING.md).

[Implementation notes](IMPLEMENTATION.md) and the [ordered plan](ORDERED-PLAN.md) record earlier milestones. The audit records the latest verification performed for this checkout.
