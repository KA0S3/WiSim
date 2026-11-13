# Sandbox warnings and optional fixes

The sandbox permits electrically wrong settings and connections. It does not silently correct them or prevent you from applying a product with connection warnings. The designer has a separate connection acceptance gate and rejects generated proposals that fail its implemented checks. That gate does not yet cover all regional installation rules or the remaining designer work listed in STATUS.md.

## Find a problem

- **Red** marks faults such as reversed supply polarity, incompatible battery/inverter voltage classes, direct AC/DC terminal crossovers, excessive PV Voc or a tripped path.
- **Amber** marks warnings such as an unsuitable charging target, conductor drop, overload or a partially connected active device.
- **Notes** include entirely unconnected newly placed equipment. They remain in the diagnostics panel without immediately filling the diagram with callouts.

Affected schematic equipment has a coloured border and exclamation badge. Conductors retain their insulation colour with a severity halo. Floating callout cards occupy a separate margin beside the schematic; phones use a separate bottom strip. Boxes do not cover the diagram. Dashed leader lines are issue pointers, not electrical connections, and route around equipment rectangles.

Multiple findings for one target share a callout. **Locate problem** centres the equipment or the conductor's endpoints. **Details & tips** opens the full panel. Offscreen targets or dense layouts without a clear leader rely on the severity marker and Locate action; the router never substitutes a line through equipment.

**System diagnostics** in the left rail is available in every view and on phones. It includes all findings, severity counts, a severity filter, search, equipment/conductor links, next-step guidance and engine errors. The old five-item truncation is removed. Static connection checks remain available when the solver is recalculating or cannot solve a mistaken network.

## Apply fixes one at a time

Where a supported repair is available, choose **Suggested fix…**. Read its proposed change, then choose **Apply this fix** or **Keep as is**. Nothing changes during the preview. Each application creates one project Undo step, updates measured cable lengths, and recalculates findings. Other faults can remain or become visible afterwards.

Current suggestions can remove a direct AC/DC crossover conductor, swap reversed converter input attachments, isolate a conflicting battery source, or adjust generic inverter/PV-input model settings to remove a specific voltage mismatch. Generic setting changes are labelled simulation assumptions; they do not upgrade real hardware. Named-product ratings are not silently rewritten to fit the circuit. Chemistry/charging profiles, arbitrary topology repairs, fuse coordination and conductor ampacity are not guessed; use the manual guidance for unsupported fixes.

## Product comparison

Closest-product cards retain nearest verified alternatives even outside strict rating limits. They list actual differences and known connected DC-bank/polarity/PV-voltage issues. Programmatic compatible-match selection still enforces its supported capacity, voltage, surge and frequency constraints. Applying a multi-voltage controller preserves a supported configured battery class and matching PV power table when available; any changed assumptions appear in the comparison.

Conflicting options show their reasons. Their Apply button remains usable in the sandbox so you can experiment. Programmatic compatible-match selection excludes those conflicts. Product presence, a clear diagnostics panel, or the absence of a warning does not establish firmware fidelity, complete compatibility or installation compliance.

The PV check uses the generic temperature coefficient already used by the solver, examines series/parallel source paths within a bounded search, and reports when a complex topology exceeds that bound. Unequal parallel PV Voc produces a review warning rather than treating nonlinear panels as contradictory ideal voltage sources.
