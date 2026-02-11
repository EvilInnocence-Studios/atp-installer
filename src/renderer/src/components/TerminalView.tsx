import { useEffect, useRef } from 'react'
import { LogMessage } from '../env.d'

interface TerminalViewProps {
  logs: LogMessage[]
}

export function TerminalView({ logs }: TerminalViewProps): JSX.Element {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div className="bg-black rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm border border-gray-700">
      {logs.map((log, i) => (
        <div key={i} className={`${
          log.type === 'error' ? 'text-red-400' : 
          log.type === 'success' ? 'text-green-400' : 
          'text-gray-300'
        }`}>
          <span className="opacity-50 mr-2">[{log.timestamp || new Date().toLocaleTimeString()}]</span>
          {log.message}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}
