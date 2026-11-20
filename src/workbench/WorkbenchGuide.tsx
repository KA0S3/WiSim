import { useState } from 'react'
import { Cable, Box, Gauge, ArrowRight } from 'lucide-react'

const lessons = [
  { title: 'Trace a connection', icon: Cable, action: 'Open schematic', body: 'Select a conductor to see both ends in the inspector. Follow its current on the scope, or turn on wire labels in the toolbar to compare cables on the drawing.', tip: 'Right-click a conductor and choose Show endpoints to bring both connected devices into view.' },
  { title: 'Measure a voltage', icon: Gauge, action: 'Pick meter probes', body: 'Choose two circular terminals in the schematic. The first click places the red probe and the second places the black probe. Read the voltage difference in the meter.', tip: 'Try the positive and negative terminals of the same battery. Switch their order to reverse the DC reading.' },
  { title: 'Inspect the layout', icon: Box, action: 'Open 3D workbench', body: 'Open the physical layout and select a device. Use the Top view to see its placement relative to the other equipment. Switch to Terminal detail for a closer look at its connections.', tip: 'A cable can use a specified length or its measured 3D route. Select it in the schematic to review the length source.' },
] as const

export function WorkbenchGuide({ onTry }: { onTry: (lesson: number) => void }) {
  const [step, setStep] = useState(0)
  const lesson = lessons[step]
  return <div className="workbench-guide">
    <div className="guide-steps" role="group" aria-label="Quick start lessons">
      {lessons.map(({ title, icon: Icon }, index) => <button key={title} aria-pressed={step === index} onClick={() => setStep(index)}><Icon size={16}/>{title}</button>)}
    </div>
    <section aria-live="polite"><h3>{lesson.title}</h3><p>{lesson.body}</p><p>{lesson.tip}</p></section>
    <button className="primary-button" onClick={() => onTry(step)}>{lesson.action}<ArrowRight size={14}/></button>
  </div>
}
