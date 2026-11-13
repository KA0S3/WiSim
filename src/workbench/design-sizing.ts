import { wireResistance, type Wire } from './model'

const copperAreas = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240]

/** Size the complete outgoing/return path using the same resistance model as the sandbox.
 * This establishes a voltage-drop constraint, not installation ampacity compliance.
 */
export function sizeVoltageDropPath(wires: Wire[], current: number, voltage: number, fraction: number, temperature: number, label: string, minimumArea = 1.5): number {
  if (!wires.length || ![current, voltage, fraction, temperature].every(Number.isFinite) || current <= 0 || voltage <= 0 || fraction <= 0) throw new Error(`Invalid ${label} sizing inputs.`)
  const area = copperAreas.find(area => area >= minimumArea && current * wires.reduce((sum, wire) => sum + wireResistance({ ...wire, area }, temperature), 0) <= voltage * fraction)
  if (area === undefined) throw new Error(`${label}: no available conductor up to 240 mm² meets the ${(fraction * 100).toFixed(0)}% voltage-drop target. Shorten the route or revise the system architecture.`)
  wires.forEach(wire => { wire.area = area })
  return area
}
