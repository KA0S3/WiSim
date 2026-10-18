# Editor and solver research gate

Reviewed 2026-10-18 for the refocus plan. No external code or assets were copied.

| Candidate | License / integration | Fit | Decision |
| --- | --- | --- | --- |
| [React Flow handles](https://reactflow.dev/learn/customization/handles) and [MIT project](https://reactflow.dev/index) | MIT; mature React node editor with multiple custom handles and connection validation | Strong canvas foundation and extensibility, but adds a dependency and would require migrating the existing SVG editor and persistence shape | Defer; retain a focused custom editor for this release |
| [CircuitJS](https://github.com/ikiwihome/circuitjs) | GPL; browser simulator | Useful circuit behavior reference, but GPL integration and electronics-oriented scope do not match the product model | Reject for direct reuse |
| [ngspice](https://github.com/ngspice/ngspice) and [license notes](https://ngspice.sourceforge.io/devel.html) | Native mixed-signal simulator with modified-BSD plus mixed upstream provenance | Powerful, but not a browser-native drop-in and too broad for the bounded educational device model | Defer; use as future research, not a dependency |

The selected path is a custom terminal-aware SVG workbench plus a deterministic bounded solver. It preserves the current React/TypeScript/Vite foundation, keeps license obligations simple, and makes unsupported topology explicit. The plan's next solver stage can replace the calculation adapter behind the same terminal model after coverage and browser performance are proven.
