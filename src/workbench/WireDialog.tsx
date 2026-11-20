import { useRef, useState } from 'react'
import { Cable } from 'lucide-react'
import type { Connection } from '@xyflow/react'
import type { Project } from './model'

export function WireDialog({project, onConnect}: {project: Project; onConnect: (connection: Connection) => void}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const endpoints = project.devices.flatMap(device => device.ports.map(port => ({
    key: JSON.stringify([device.id, port.id]), device: device.id, port: port.id,
    label: [device.reference, device.name, port.label].filter(Boolean).join(' / ')
  })))
  const source = endpoints.find(endpoint => endpoint.key === from)
  const target = endpoints.find(endpoint => endpoint.key === to)
  const valid = source && target && source.key !== target.key
  function open() {
    setFrom('')
    setTo('')
    dialog.current?.showModal()
  }
  return <>
    <button aria-label="Connect terminals" title="Connect terminals" onClick={open}><Cable size={17}/></button>
    <dialog ref={dialog} aria-label="Connect terminals">
      <form onSubmit={event => {
        event.preventDefault()
        if (!valid) return
        onConnect({source: source.device, sourceHandle: source.port, target: target.device, targetHandle: target.port})
        dialog.current?.close()
      }}>
        <h2>Connect terminals</h2>
        {(['From', 'To'] as const).map(label => <label className="field" key={label}>{label}
          <select aria-label={label} value={label === 'From' ? from : to} onChange={event => (label === 'From' ? setFrom : setTo)(event.target.value)}>
            <option value="">Choose a terminal</option>
            {endpoints.map(endpoint => <option key={endpoint.key} value={endpoint.key}>{endpoint.label}</option>)}
          </select>
        </label>)}
        <button type="button" onClick={() => dialog.current?.close()}>Cancel</button>
        <button type="submit" disabled={!valid}>Connect</button>
      </form>
    </dialog>
  </>
}
