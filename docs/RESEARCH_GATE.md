# Editor and solver research gate

Reviewed 2026-10-21 for the refocus plan and bounded MPPT update. No external code or assets were copied.

| Candidate | License / integration | Fit | Decision |
| --- | --- | --- | --- |
| [React Flow handles](https://reactflow.dev/learn/customization/handles) and [MIT project](https://reactflow.dev/index) | MIT; mature React node editor with multiple custom handles and connection validation | Strong canvas foundation and extensibility, but adds a dependency and would require migrating the existing SVG editor and persistence shape | Defer; retain a focused custom editor for this release |
| [CircuitJS](https://github.com/ikiwihome/circuitjs) | GPL; browser simulator | Useful circuit behavior reference, but GPL integration and electronics-oriented scope do not match the product model | Reject for direct reuse |
| [ngspice](https://github.com/ngspice/ngspice) and [license notes](https://ngspice.sourceforge.io/devel.html) | Native mixed-signal simulator with modified-BSD plus mixed upstream provenance | Powerful, but not a browser-native drop-in and too broad for the bounded educational device model | Defer; use as future research, not a dependency |

The selected path is a custom terminal-aware SVG workbench plus a deterministic bounded solver. It preserves the current React/TypeScript/Vite foundation, keeps license obligations simple, and makes unsupported topology explicit. The plan's next solver stage can replace the calculation adapter behind the same terminal model after coverage and browser performance are proven.

## Manufacturer-rule check: MPPT ratings

Before connecting sourced controller limits to the solver, the current official Victron technical-specification pages were checked:

- [SmartSolar 75/10 through 100/20 specifications](https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_75-10_up_to_100-20/en/technical-specifications.html) list battery-system-dependent nominal PV power and maximum battery current by exact model.
- [SmartSolar 100/30 and 100/50 specifications](https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_100-30__100-50/en/technical-specifications.html) list nominal PV power by 12 V / 24 V battery systems and rated charge current.

The solver now uses only the matching nominal-PV-power value and rated charge-current value already present in verified catalogue records. It does not turn the documented PV short-circuit-current or open-circuit-voltage values into solver checks, because the current PV model does not represent string count or string current. The controller behavior remains a teaching cap, not a manufacturer-accurate controller simulation or design check.

## Inverter rating fields

The [Victron Phoenix VE.Direct datasheet](https://www.victronenergy.com/upload/documents/Datasheet-Inverter-VE.Direct-250VA-1600VA-EN.pdf) covers the exact 12/1200, 230 V model used in the verified catalogue: 12 V nominal input, 230 V / 50 Hz nominal output, 1000 W continuous output at 25 °C, and 2200 W peak output. The datasheet also lists configurable product output variants/ranges; the catalogue record remains the exact named 230 V/50 Hz model, and the learner's generic values are not treated as that product's verified ratings. The editor now exposes DC input class, AC voltage/frequency, continuous power, and surge values. AC profile and battery-class mismatch diagnostics mark the affected inverter terminals unsupported rather than silently converting values. Low-voltage cut-off, efficiency curves, configurable output range, temperature derating, and transfer/charger behavior remain outside this solver.

## Conductor resistance reference for the learning meter

The ABB SACE electrical installation handbook's Annex E table lists electrical resistivity at 20 °C as 0.0175 Ω·mm²/m for copper and 0.0287 Ω·mm²/m for aluminium ([ABB handbook, Annex E](https://library.e.abb.com/public/7a93440e8c790852c125716c0033f7a9/1SDC010002D0204.pdf)). The meter uses these as nominal material constants to calculate a single saved wire's DC conductor resistance: `R = ρ × length / (area × parallel conductors)`. It does not apply temperature correction, contact resistance, AC reactance, conductor tolerances, or certification rules. This calculation supports an educational comparison only and does not contribute to the existing whole-system voltage-drop solver.
