# Equipment fields and model status

This page defines what the current WiSim workbench fields mean. A generic value is a learner assumption. A value copied from a verified catalogue record is source-backed until the learner edits a rating or terminal layout; that edit removes the exact model association and keeps the resulting values as a learner-defined setup.

The workbench uses a bounded teaching model. These fields do not establish installation suitability, product compatibility, standards compliance, or a safe real-world design.

## Shared fields

| Field | Unit | Meaning and status |
| --- | --- | --- |
| Name | — | Learner label; it does not identify or verify a manufacturer product. |
| Sunlight | % | Project input constrained to 0–100%; scales the simplified PV power estimate. |
| Panel temperature | °C | Project input constrained to finite values at or above absolute zero; used by the simplified PV temperature adjustment. |
| Ambient temperature | °C | Optional finite project input at or above absolute zero; used by the bounded thermal estimate. |
| Terminal ID | — | Stable connection identity. Moving or reordering a terminal must preserve its ID. |
| Terminal side/order | — | Learner display choice, or a sourced catalogue layout until changed. It changes presentation only. |

## Device fields

| Kind | Field | Unit | Current model use / boundary |
| --- | --- | --- | --- |
| PV | Array rated power | W | Generic input or sourced module rating; multiplied by sunlight and a simplified temperature factor to estimate PV power. |
| PV | Module voltage | V | Generic open-circuit voltage assumption, or sourced module Voc; used for a simplified cold-corrected Voc estimate. Series count, parallel-string current, wiring effects, and full module curves are not represented. |
| MPPT | PV input power limit | W | Generic input uses one cap. Verified models may provide a manufacturer-sourced nominal PV power table for 12 V, 24 V, and 48 V battery system classes; the matching table value is used when present. This is not a complete controller model. |
| MPPT | Charge current limit | A | Generic input or sourced rated output current. The modeled charge-current estimate is capped by the lower available controller and battery limit. Charge algorithms, voltage stages, thermal derating, and BMS control are not solved. |
| MPPT | Supported battery systems | V | Exact sourced controller compatibility classes are checked against the modeled battery class. This does not infer support beyond the verified list. |
| Battery | Nominal voltage | V | Generic assumption or sourced rating; sets the simplified battery operating-voltage basis. |
| Battery | Capacity | Ah | Generic assumption or sourced rating; used to scale the simplified state-of-charge change. |
| Battery | Charge limit | A | Generic assumption or sourced rating; caps the simplified charging estimate. |
| Battery | Discharge limit | A | Generic assumption or sourced rating; used by the simplified discharge-limit check. |
| Battery | Chemistry | — | Descriptive metadata only; chemistry-specific voltage curves and charging behavior are not modeled. |
| Inverter | Nominal DC input class | V | Generic assumption or sourced nominal input; compared by 12/24/48 V class to the modeled battery. A class mismatch marks the inverter DC terminals unsupported. Input range, low-voltage cutoff, and DC conversion are not solved. |
| Inverter | AC output voltage/frequency | V / Hz | Generic values follow the selected AC profile unless set, or sourced model ratings until edited. Mismatches mark inverter AC terminals unsupported; the solver does not convert voltage or frequency. |
| Inverter | Continuous output | W | Generic assumption or sourced rating; compared with modeled real load power. Apparent-power and phase-specific inverter behavior are incomplete. |
| Inverter | Surge capability | W | Generic assumption or sourced rating; compared with a simple load surge estimate, not a time-domain transient. |
| Load | Demand | W | Generic real-power demand used by the bounded load and current estimates. |
| Load | Power factor | 1 | Generic dimensionless estimate, limited in the solver to its supported 0.5–1 range, used to estimate apparent power. |
| Fuse / breaker | Modeled current threshold | A | Generic assumption or sourced rated current. The simplified warning/trip behavior is not a manufacturer time-current curve or a protection coordination study. |
| Legacy cable node | Area | mm² | Backward-compatibility input to the solver's shared DC conductor estimate. Cable nodes are not offered for new projects. |
| Legacy cable node | Length | m | Backward-compatibility input to the solver's shared DC conductor estimate. |
| Transfer switch | Open/closed state | — | Changes modeled path reachability; switching transients and transfer timing are not represented. |
| AC source / project profile | Voltage and frequency | V / Hz | Project-level profile selects the simplified AC assumptions; this is not a waveform solver. |
| Bus | — | — | Supports a bounded DC branch-current estimate by summing connected downstream load watts per bus branch and dividing by the simplified conversion efficiency and battery voltage. It has no configurable rating and does not solve Kirchhoff current distribution or branch conductor drop. |

Older projects that contain a cable node keep that node and its attached wire records when loaded. WiSim does not auto-convert it because the old node's terminal roles and attached path do not uniquely identify a replacement wire. The inspector explains this compatibility behavior. To migrate manually, create and verify the intended terminal-to-terminal wires first; deleting the legacy cable node also removes its attached legacy wire records.

## Connection wire fields

Each terminal-to-terminal connection stores conductor area (mm²), material, length (m), parallel count, insulation, and display color. These values remain visible and persist with the connection. **The current system loss solver does not calculate conductor loss separately for each wire:** it still uses the legacy cable-node area/length as the shared DC resistance input and uses connection parallel counts in that bounded estimate. Wire material and individual length/area do not currently change calculated loss. The learning meter's resistance mode separately estimates one active wire's nominal DC resistance at 20 °C using sourced material resistivity; it excludes terminals, temperature rise, AC reactance, and tolerances. Do not interpret either calculation as installation sizing or a physical measurement. Per-connection voltage-drop and loss integration remains an active plan item.

## Provenance and editing

- Generic template values are editable learner assumptions.
- Applying a verified catalogue model attaches its exact model ID and source-backed ratings/layout.
- Editing a rating or terminal layout detaches that exact model association. The copied values become a learner-defined setup; the solver keeps only fields it currently supports.
- Partially verified and reference-only records remain unapplyable. Adding learner-entered values does not complete manufacturer research.
- Older saved fuse nodes stored their ampere threshold in `watts`; schema migration copies that legacy value to `currentLimitA` and retains `watts` for export compatibility.
- Refer to [CATALOG_SOURCES.md](CATALOG_SOURCES.md) for evidence status and [SIMULATION_LIMITS.md](SIMULATION_LIMITS.md) for calculation boundaries.
