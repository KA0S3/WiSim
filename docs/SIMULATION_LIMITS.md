# Simulation boundaries

WireSim is a deterministic educational model driven by the shared terminal-aware project. It currently exposes PV output and cold Voc, simplified MPPT capping, battery current/SOC, conductor and modeled lug voltage drop with I²R loss, bounded parallel-conductor effects, AC apparent power/current, inverter overload, protection diagnostics, topology validation, active paths, open terminals, terminal readings, device state, and explicit AC profile compatibility.

Supported teaching profiles are 120 V/60 Hz single-phase, 230 V/50 Hz single-phase, 120/240 V/60 Hz split-phase, and 400 V/50 Hz three-phase. The profile is part of the project model; it is not a decorative label. Split/three-phase templates expose A/B/C terminals and the engine refuses a profile until the required phase endpoints are wired. The current bounded engine does not yet solve arbitrary Kirchhoff networks, waveform-level AC, transfer switching, certification-grade protection, installation derating, physical telemetry, or every three-phase branch behavior. Unsupported or invalid terminal connections are reported rather than given fabricated readings.

A green result is not installation approval. Verify real systems against current manufacturer documentation and applicable standards.
