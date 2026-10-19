# Wi-Sim goal and current handoff

## Product goal

Wi-Sim is an educational solar and electrical wiring sandbox. Help people understand connections and modeled behavior by letting them build safely, see what happens, and learn from mistakes. Clear, efficient, readable interaction matters more than decorative effects or feature count.

## Current scope

**The current work is analysis and planning only. No application code has been changed or requested.** The existing app has been reviewed and the previous broad rebuild plan has been replaced with a narrow, staged plan in [SANDBOX_REFOCUS_PLAN.md](SANDBOX_REFOCUS_PLAN.md).

Future implementation should make small, focused changes in the existing React/TypeScript/SVG workbench. Do not rebuild the app or replace its editor, simulation engine, or persistence system without a specific demonstrated need. The plan prioritizes:

1. Rename the user-facing product to Wi-Sim; make a new sandbox empty; confirm before resetting to empty; clarify saving/export.
2. Improve bounded canvas controls and finish direct cable routing/property and terminal-position editing.
3. Expose solar irradiance as a percentage and make modeled current/output changes understandable.
4. Research and build a compact active-warning list that locates and highlights each issue.
5. Improve component and symbol legibility, then add common equipment selectively with researched terminals and behavior.

## Essential product rule

**This is first and foremost an educational experience.** Keep it safe to experiment, make mistakes understandable, show the evidence and limits behind warnings/readings, and do not imply that a simplified simulation approves real-world wiring.

## Handoff notes

- The current app already includes a terminal-aware workbench, cable metadata and draggable bends, bounded live simulation, diagnostics, catalogue records, and local project persistence. The detailed gaps and implementation order are in the plan.
- Browser interaction QA across laptop, tablet, and phone widths remains an outstanding check in [docs/BROWSER_QA_CHECKLIST.md](docs/BROWSER_QA_CHECKLIST.md).
- This document and the plan are the only changes in this handoff; no code, tests, or builds were run.
