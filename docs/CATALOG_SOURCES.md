# Catalogue source trail

Refocus rule: catalogue count is not a completion metric. A record is useful only when its exact simulation-relevant fields and source state are clear in context.

Reference records are deliberately labelled `partially verified` until every simulation-relevant rating and compatibility rule has been checked against the exact current manual.

Current source links in the app:

- SmartSolar MPPT 100/30: [Victron product documentation](https://www.victronenergy.com/solar-charge-controllers/smartsolar-mppt-100-30-up-to-98-voc)
- SmartSolar MPPT 75/15: [official technical specifications](https://www.victronenergy.com/media/pg/Manual_SmartSolar_MPPT_75-10_up_to_100-20/en/technical-specifications.html)
- MultiPlus: [Victron product documentation](https://www.victronenergy.com/inverters-chargers/multiplus)
- SmartShunt: [Victron product documentation](https://www.victronenergy.com/battery-monitors/smartshunt)
- Orion-Tr isolated DC-DC converters: [Victron product documentation](https://www.victronenergy.com/dc-dc-converters/orion-tr-dc-dc-converters-isolated)
- Blue Smart IP22 Charger: [Victron product documentation](https://www.victronenergy.com/chargers/blue-smart-ip22-charger)
- Cerbo GX and GX devices: [Victron product documentation](https://www.victronenergy.com/communication-centres/cerbo-gx)
- Lynx Distribution: [Victron product documentation](https://www.victronenergy.com/distribution-systems/lynx-distributor)
- BatteryProtect: [Victron product documentation](https://www.victronenergy.com/protection/batteryprotect)
- VE.Bus BMS: [Victron product documentation](https://www.victronenergy.com/battery-management/ve-bus-bms)

Verified core (2026-10-18):

- SmartSolar MPPT 100/30: the official technical specification lists 12/24 V battery support, 30 A charge current, 440 W nominal PV power at 12 V, 100 V maximum PV open-circuit voltage, and a 35 A PV short-circuit limit. The app stores the first four fields used by matching/simulation and links the technical page.
- SmartSolar MPPT 75/15: the official technical specification lists 12/24 V battery support, 15 A maximum battery current, 220 W nominal PV power at 12 V, 75 V maximum PV open-circuit voltage, and 15 A PV short-circuit current. The app stores the documented 12 V matching power, current, PV voltage limit, and four labeled power terminals.
- MultiPlus 12/1200/50 (230 V): the official datasheet lists 12 V DC input, 1000 W continuous output at 25 °C, 2400 W peak power, 230 V/50 Hz output and VE.Bus. The app stores those fields and links the datasheet.

The catalogue currently includes 105 records, including 84 source-linked Victron names across 12 product families. Most records remain `partially verified` until the exact model-level technical fields used by simulation and matching have been reviewed; catalogue size is not the completion metric.

Generic profiles are teaching templates and are not manufacturer claims. Source-linked records carry a `sourceChecked` date, but that date means the family source was checked—not that every model-level rating is verified. Each future real-device record still needs exact model fields, a source document/manual identifier, verification status, and the fields used by the matcher or simulator.
