# Next designer pass: source review

Section 2 of ORDERED-PLAN.md was implemented 17 November 2026. The designer compares the existing sourced 175/215/550 W modules and exact 48 V-capable controllers, evaluating series length, independent controller count, cold Voc, estimated hot Vmp, input current, nameplate power, minimum-bank-voltage output current and optional panel footprint. The UI exposes alternatives and temperature/space inputs. Each controller has its own collectors, strings and output protection.

Ranking minimises module count plus three units per controller, then excess power and footprint. It uses an equipment-count objective because installed prices are unavailable. Hot Vmp is estimated from Pmax/Isc temperature coefficients. Input current includes an explicit 1.25 allowance. Footprint excludes roof packing gaps. Battery packs and coordinated inverters remain generic pending the later electrical/product sections.

Daily appliance blocks determine energy, concurrent running demand and simultaneous startup, including overnight periods. Automatic/explicit phase assignment sizes each inverter. The selected schedule hour controls actual generated loads and is editable under Environment. Split phase uses the US 120/240 V profile with 180° outputs. Three-phase uses 120° outputs, regional phase-neutral voltage and a shared neutral. Model phase angles and daily blocks appear in exports.

Official controller and panel sources below were reopened on 17 November. Added the documented BlueSolar temperature coefficients to the two existing module records. Focused designer/group/export checks passed (19 cases), as did three real-ngspice designer checks and TypeScript. These include measured line-to-line voltages and schedule switching. Broader verification remains deferred until all ordered sections are implemented.

Primary sources opened:

- [Victron VE.Can controller technical manual](https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_150-70_up_to_250-100_VE.Can/en/technical-specifications.html). Verify exact variants and part numbers, including the explicit 12/24 V-only exceptions in footnote 7. Do not assign a generic family-wide 48 V capability. Follow its connection overview, installation and dimensional drawings before upgrading catalogue evidence status. Parallel MC4 connectors do not imply independent trackers.
- [Canadian Solar HiKu6 CS6W-MS, 2278 mm, datasheet v2.7](https://www.canadiansolar.com/na/wp-content/uploads/sites/3/2026/01/CS-Datasheet-HiKu6_CS6W-MS_v2.7_EN-2278mm.pdf). A candidate source for larger-module alternatives. Keep exact model/variant, STC versus NMOT conditions, dimensional revision, temperature coefficients, fuse and connector-option distinctions. Installation and connector compatibility still require manual review.
- [Jinko Tiger Pro JKM530–550M-72HL4(-V), F1](https://www.jinkosolar.com/uploads/5ff587a0/JKM530-550M-72HL4-(V)-F1-EN.pdf). Another candidate family. Table extraction interleaves STC and NOCT columns; visually verify the selected model column before adding data. Follow module installation references and distinguish the system-voltage variant.

Implementation requirements:

1. Evaluate multiple real module specifications and counts, with explicit energy assumptions, count/space tradeoffs and no invented price ranking.
2. Enumerate compatible series/parallel layouts against cold open-circuit voltage, hot operating headroom, input short-circuit current, controller operating/absolute voltage and output/charging limits. Distinguish nominal design sizing from the generic sandbox converter model.
3. Partition real strings among independently modelled MPPTs. Each needs its own collector path, output protection/conductors and limits; do not model multiple trackers as one multiplied controller.
4. Retain actual source units, group metadata, bank limits, individual protection, measured lengths, voltage-drop paths and complete export quantities/references. New settings and source-backed parameters must agree across checks, catalogue application, simulation and designer output.
5. Keep uncertain parameters and regional/manufacturer constraints explicit. Existing generic models do not reproduce manufacturer tracking firmware, detailed thermal control or semiconductor damage.

No new open-source solver is needed for this pass: use the existing ngspice worker, graph layout and common project model. Additional numerical/weather libraries should be introduced only for an identified capability, with pinned versions, licensing and independent validation.
