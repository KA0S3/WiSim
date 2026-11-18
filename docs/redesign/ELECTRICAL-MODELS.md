# Electrical model assumptions and power balance

These are generic behavioural models solved together in ngspice. Applying catalogue ratings does not provide manufacturer firmware, protection curves or a validated chemistry model. The sandbox permits wiring/rating mistakes and reports the checks it actually performs. Automatic design remains provisional until the open items in STATUS.md are finished.

Section 5 adds optional regional ampacity/protection/earthing inputs and checks, exact selected end-hardware compatibility, real chassis PE ports/source bonds and directional BMS pack equivalents. See [ENGINEERING.md](ENGINEERING.md) for sources, model behaviour and boundaries. BMS voltage inhibits latch at the next solver segment and clear on simulation reset. MPPTs now use configured startup/run headroom and retained tracking state; the search/taper algorithm remains generic.

## Solar source

The generic PV assumption is `I = Isc × sunlight × exposure × (1 - exp((V - Voc) / a))`, where `a = max(1 V, 0.065 × Voc)`. Temperature adjusts Voc with the existing generic -0.29%/degree coefficient. This does not replace a sourced panel-specific temperature/yield model.

The equivalent implementation uses a native diode and photocurrent source. `Is = Isc_effective × exp(-Voc/a)` and `Iph = Isc_effective - Is`, so the same I/V curve benefits from ngspice diode voltage limiting. A tiny minimum saturation current avoids an invalid zero diode parameter at night. The native diode model is held at its reference temperature because the generic Voc temperature adjustment is already applied explicitly.

An illuminated, disconnected panel reaches its open-circuit voltage with negligible current. It must not prevent other circuits from producing readings. Extremely weak 1 Gohm numerical references define otherwise-floating island common mode; their nanoamp-scale currents are numerical references, not measured manufacturer leakage. No firmware or detailed cell/shading/bypass model is claimed.

## Solar controller

The controller is a generic buck operating-point equivalent. The configured PV operating voltage and power define an input resistance `R = Vop² / Prated`; the model does not run a manufacturer MPPT search algorithm.

One shared conductance expression sets both sides:

- Start with input conductance `1/R`.
- Apply charge taper as the battery approaches the configured charge-voltage target.
- Limit input draw so output current cannot exceed the configured current rating.
- Require positive battery supply and PV voltage above battery voltage. The generic enable/headroom ramps are numerical model assumptions, not sourced hardware thresholds.
- Calculate `Pin = Vpv × Ipv` and `Iout = efficiency × Pin / Vbattery` in the active region.

Thus output power equals input power times the configured efficiency. Conversion loss is the remainder. Current limiting and charge taper reduce PV input demand; they do not discard unreported power inside a permanent input resistor. A full battery, a charge target below battery voltage, reversed battery supply or insufficient PV voltage curtails both input and output. Disconnected output does not invent a charging battery.

Both PV-input voltage/current/power and battery-output voltage/current/power are exposed in Live readings. The schematic hover uses “PV input”; charger inputs retain “AC input”. A controller producing zero charging current can still have open-circuit voltage at its PV terminals. In the user's reproduced example, a 14.4 V target with a 54.5 V nominal battery therefore leaves the connected array near 96 V at negligible current; the mismatch warning remains visible.

This is not a multi-stage charger/BMS simulation. Reverse polarity, overvoltage and overload are reported where implemented; detailed semiconductor damage, thermal foldback, startup sequencing and manufacturer protections remain open work.

## Verification

Power-coupled domains share an observation window. At 50 or 60 Hz, converter inputs, outputs, source readings and conductor RMS losses use the same complete source period (or the available shorter transient segment). AC/DC classification remains separate: a battery feeding a 60 Hz inverter is still DC. Different AC frequencies on independent outputs sharing a DC bank use the entire common solved window, with an information finding; this does not create a direct AC frequency-conflict fault.

This fixes a reproduced 60 Hz battery/display imbalance caused by comparing a fixed 20 ms DC average with a 16.67 ms AC period. Regression fixtures independently balance battery source power against inverter output/efficiency, idle consumption and DC conductor loss at both frequencies over 100, 40 and 20 ms segments. The nonlinear fixtures allow 0.05% power discrepancy for solver/interpolated-sample error. The stable ngspice relative tolerance remains 0.1%; a tighter tolerance exposed an unloaded-rectifier convergence failure and was not adopted. These are numerical model checks, not a claim of exact manufacturer behaviour.

Real-ngspice regressions cover full charging, output current limiting, taper, full/mismatched targets, reverse supply, switched-off controller, night and insufficient PV voltage. They independently balance PV-source power against controller input plus conductor losses, controller input against output and efficiency, and controller output against battery absorption plus conductor losses. Curve regressions vary sunlight and load. A disconnected illuminated panel is tested alongside a running AC/storage network across motor startup.

The browser suite checks input readings, curtailment after changing the target and charging restoration after Undo. The user's unchanged project is separately imported, observed through continuing frames and reloaded. See IMPLEMENTATION.md for counts and artifacts. Passing these cases establishes those behaviours; it does not establish all manufacturer or installation constraints.
# Instrument and retained-energy update, 17 November 2026

The workbench multimeter now exposes voltage/current AC and DC modes, sampled frequency, equipment active power and de-energised linear resistance/continuity. See DIAGNOSTICS.md for probe semantics and limits. The sparse DC test solve includes cable/contact resistance and supported passive paths. It rejects active sources, unresolved stored energy and connected nonlinear/dynamic elements.

Frames report stored reactive energy. Isolating capacitors, inductors, motors and chargers preserves their retained state. Previously interpretation replaced an isolated device's retained state with its disconnected terminal reading. A real-ngspice regression verifies that an isolated 10 V / 1 mF capacitor retains 0.05 J and blocks resistance testing. This correction supports the new meter's retained-energy check.
