# Sandbox warnings and optional fixes

The sandbox permits electrically wrong settings and connections. It does not silently correct them or prevent you from applying a product with connection warnings. The designer has a separate connection acceptance gate and rejects generated proposals that fail its implemented checks. That gate does not yet cover all regional installation rules or the remaining designer work listed in STATUS.md.

## Find a problem

Section 1 of ORDERED-PLAN.md was implemented on 17 November 2026. Static findings now include source terminal shorts, bypassed equipment/protection, parallel AC-source conflicts and inconsistent PV ratings. Unconnected-terminal findings are available before solving. Solved findings add capacitor overvoltage/reverse polarity and appliance overvoltage. Source isolation and direct protection-bridge removal use the existing preview/Apply/Undo workflow.

## Multimeter modes

Open the meter tool in Schematic, or place probes in Terminal detail, then choose a mode.

- Voltage uses two terminals. Auto selects signed DC or AC RMS. Explicit DC measures the mean. AC component mode removes DC offset before calculating RMS.
- Current uses the selected conductor's actual sampled branch current. Signed DC follows its saved From to To direction. Auto and AC component modes are also available.
- Frequency measures interpolated rising crossings between the probes over the solved sample window. It requires two crossings and periods consistent within 2%. Insufficient samples or distorted/mixed signals can remain unresolved.
- Power uses selected equipment's average instantaneous voltage times current. Converter output is the primary measured side. Input power remains in Live readings.
- Resistance calculates equivalent DC resistance of the connected linear network, including parallel/bridge paths, conductor/contact resistance, closed switches/fuses, linear loads and inductor windings. Discharged capacitors are open at DC. Nonlinear/dynamic paths require isolation.
- Continuity uses the same resistance calculation and an explicit 30 Ω threshold.

Resistance/continuity require isolated sources. Pausing leaves sources connected. Reactive equipment also requires a current solved frame that verifies negligible retained energy. Switching equipment off preserves its stored state. The model does not simulate physical discharge of an isolated component. Discharge through an appropriate connected path or use the explicit simulation reset for a fresh initial state.

Focused verification passed eight new instrument/fault cases, the 13 existing connection cases, three existing measurement cases and one real-ngspice retained-energy regression. TypeScript passed. The first focused run caught a missing shared window return field, which was corrected. The real-solver regression caught the isolated-energy state bug described above. See the [current audit](AUDIT.md) for browser verification and open issues.

- **Red** marks faults such as reversed supply polarity, incompatible battery/inverter voltage classes, direct AC/DC terminal crossovers, excessive PV Voc or a tripped path.
- **Amber** marks warnings such as an unsuitable charging target, conductor drop, overload or a partially connected active device.
- **Notes** include entirely unconnected newly placed equipment. They remain in the diagnostics panel and can be found using the Notes filter.

Affected schematic equipment has a coloured border and exclamation badge. Conductors retain their insulation colour with a severity halo. In System diagnostics, choose **Inspect** on a finding to locate its equipment or conductor. For a grouped device, inspection opens the group so you can see the individual unit.

**System diagnostics** in the left rail is available in every view and on phones. It includes all findings, severity counts, a severity filter, search, equipment/conductor links, next-step guidance and engine errors. The old five-item truncation is removed. Static connection checks remain available when the solver is recalculating or cannot solve a mistaken network.

## Apply fixes one at a time

Where a supported repair is available, choose **Auto-fix…**. Read its proposed change, then choose **Apply this fix** or **Keep as is**. Nothing changes during the preview. Each application creates one project Undo step, updates measured cable lengths, and recalculates findings. Other faults can remain or become visible afterwards.

Current suggestions can remove a direct AC/DC crossover conductor, swap reversed converter input attachments, isolate a conflicting battery source, or adjust generic inverter/PV-input model settings to remove a specific voltage mismatch. Generic setting changes are labelled simulation assumptions; they do not upgrade real hardware. Named-product ratings are not silently rewritten to fit the circuit. Chemistry/charging profiles, arbitrary topology repairs, fuse coordination and conductor ampacity are not guessed; use the manual guidance for unsupported fixes.

## Product comparison

Closest-product cards retain nearest verified alternatives even outside strict rating limits. They list actual differences and known connected DC-bank/polarity/PV-voltage issues. Programmatic compatible-match selection still enforces its supported capacity, voltage, surge and frequency constraints. Applying a multi-voltage controller preserves a supported configured battery class and matching PV power table when available; any changed assumptions appear in the comparison.

Conflicting options show their reasons. Their Apply button remains usable in the sandbox so you can experiment. Programmatic compatible-match selection excludes those conflicts. Product presence, a clear diagnostics panel, or the absence of a warning does not establish firmware fidelity, complete compatibility or installation compliance.

The PV check uses the generic temperature coefficient already used by the solver, examines series/parallel source paths within a bounded search, and reports when a complex topology exceeds that bound. Unequal parallel PV Voc produces a review warning rather than treating nonlinear panels as contradictory ideal voltage sources.

A repair preview identifies the exact action, including any cable endpoints it will reconnect or whether it will rebuild a generated design. For the original solar example with its battery deleted and its other wiring intact, Auto-fix restores the generic Home battery and previews the four connections before applying them. In Learn, expand **Reveal repair assistance (spoiler)** to see an available repair.

Auto design checks candidate systems under full sunlight, battery-only startup and auxiliary AC input where configured. If a candidate fails, it tries additional sizing headroom or alternative strings when allowed by the inputs. The saved notes identify a successful adjustment. If no checked candidate passes, the designer displays the failed check and leaves the open project in place.
