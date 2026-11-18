# Continue here

Updated 17 November 2026. The active objective and acceptance criteria are in docs/redesign/ORDERED-PLAN.md. Follow the requested order. Sections 1, 2, 3, 3.5 and 4 have focused verification. Section 5 electrical completeness is in progress, followed by section 6 products/models and final broad verification.

The user confirmed curved walls, all three regions (ZA/GB/US), completing existing catalogue records first, and the proposed meter/appliance schedule scope. Implementation takes priority over optional cleanup. Update relevant docs before sections and at completion. Preserve the pre-existing Learn changes in App.tsx, model.ts, workbench.css, learn.ts and workbench-learn.test.mjs.

## Current evidence

- Section 1 has 25 focused instrument/connection/measurement/retained-energy cases.
- Section 2 has 19 designer/group/export cases and three real-solver designer cases.
- Section 3 has seven routing and four geometry cases.
- Section 3.5 has twelve building, thirteen routing/mounting and one real-solver fitted-building cases.
- Section 4 has six isolated Edge scenarios with no page errors, plus reviewed desktop/phone/construction screenshots. The visual changes received targeted construction/phone rechecks. TypeScript passes.
- The full suite, catalogue validation and production build have not yet been run for the ordered goal. Reserve broad verification until sections 5 and 6 are implemented.

## Commands and browser review

Vite's config/dependency bundlers hit sandbox parent-directory access restrictions. A server with approved access runs in exec session 13676 at http://127.0.0.1:5173 using the runner config loader. Check the live handle before restarting.

The browser connector was unavailable and Windows Computer Use stopped on a browser URL policy check. The repository's isolated Playwright/Edge harness now provides UI evidence. During development set WISIM_URL to the known localhost server and run scripts/designer-browser-check.mjs. Optional WISIM_UI_CHECKS filters named scenarios. Without WISIM_URL, npm run ui:designer starts a production preview at port 4186. It is included in npm run verify.

Source entry point is src/workbench/App.tsx. Feature documentation includes DIAGNOSTICS.md, DESIGNER-SOURCE-NOTES.md, ROUTING.md, BUILDINGS.md and ENGINEERING.md. The plan and feature docs are tracked. Code and tests remain in the working tree, including new files. No commit has been made.


## Run closeout, 18 November 2026

The user cleared the goal and requested this run finish after cleanup/docs and final checks. All ordered sections have implementation, with bounded electrical coverage as documented in ENGINEERING.md. Section 6 currently has 63 simulation-ready profiles among 131 records, including 41 partially verified profiles, readiness-filtered sidebar insertion, sourced dimensions/specifications, and whole-bank/array replacement preserving collector connections. Existing source records were prioritised. No claim of full regional compliance or exact manufacturer firmware is made.

Final catalogue validation and production build passed. The full automated test run reported 10 failures (artifacts/final-tests.log): stale catalogue/status/revision assertions, external-BMS solver fixtures, a malformed-terminal validation crash and a diagram-routing regression. The validation crash was corrected and its focused regressions pass. Remaining failures have not been resolved; final acceptance is incomplete. Three engineering browser scenarios passed earlier; the final rerun is recorded in artifacts/engineering-ui-check.json. Broad UI suites were not all rerun. No commit was made. The goal is cleared and must not be recreated without a new user request.


### Electrical and routing follow-up, 18 November 2026

User prioritised electrical operation and automatic routing over catalogue cleanup. Corrected BMS nonlinear startup with a numerical nodeset estimate (directional limits remain active), connected external BMS explicitly in operational solver fixtures, and expanded generated diagram columns for longer PV strings. All 77 combined real-solver, engineering, designer, building, supported-route and drawing-routing tests pass (artifacts/electrical-routing-final.log). Two malformed-import regressions also pass. Final designer UI results are in artifacts/designer-ui-check.json; engineering UI passed three scenarios without page errors. Catalogue-only stale assertions remain outside this follow-up. The goal remains cleared.
