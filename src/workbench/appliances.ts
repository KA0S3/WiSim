import type { Appliance, Project, Requirements } from './model'

export function activeAt(start: number, end: number, hour: number): boolean {
  if (start === end || start === 0 && end === 24) return true
  return start < end ? hour >= start && hour < end : hour >= start || hour < end
}

export function scheduleDemand(appliances: Appliance[]) {
  const boundaries = [...new Set([0, ...appliances.flatMap(item => [item.startHour % 24, item.endHour % 24])])].sort((a, b) => a - b)
  let peakW = 0, startupW = 0, peakHour = 0, dailyWh = 0
  for (const item of appliances) {
    if (!item.id || !item.name.trim() || ![item.watts, item.quantity, item.startHour, item.endHour, item.startupMultiplier, item.startupSeconds].every(Number.isFinite) || item.watts <= 0 || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.startHour < 0 || item.startHour >= 24 || item.endHour < 0 || item.endHour > 24 || item.startupMultiplier < 1 || item.startupSeconds < 0 || !['auto', 'A', 'B', 'C'].includes(item.phase)) throw new Error('Each appliance needs a name, positive power/quantity, valid daily hours, phase and startup values.')
    const duration = (item.endHour - item.startHour + 24) % 24 || 24
    dailyWh += item.watts * item.quantity * duration
  }
  for (const hour of boundaries) {
    const running = appliances.filter(item => activeAt(item.startHour, item.endHour, hour))
    const watts = running.reduce((sum, item) => sum + item.watts * item.quantity, 0)
    // All appliances starting together may start simultaneously.
    const startup = watts + running.filter(item => item.startHour === hour && item.startupSeconds > 0).reduce((sum, item) => sum + item.watts * item.quantity * (item.startupMultiplier - 1), 0)
    if (watts > peakW) { peakW = watts; peakHour = hour }
    startupW = Math.max(startupW, startup)
  }
  return { dailyKwh: dailyWh / 1000, peakW, startupW, peakHour }
}

export function resolvedRequirements(requirements: Requirements): Requirements {
  if (!requirements.appliances?.length) return requirements
  if (requirements.appliances.length > 100 || new Set(requirements.appliances.map(item => item.id)).size !== requirements.appliances.length) throw new Error('Use up to 100 uniquely identified appliances.')
  const demand = scheduleDemand(requirements.appliances)
  return { ...requirements, dailyKwh: demand.dailyKwh, peakW: demand.peakW }
}

/** Keep saved manual on/off state independent from the selected daily time. */
export function withSchedules(project: Project): Project {
  if (project.scheduleHour === undefined) return project
  return { ...project, devices: project.devices.map(device => device.schedule ? { ...device, on: device.on && activeAt(device.schedule.startHour, device.schedule.endHour, project.scheduleHour!) } : device) }
}
