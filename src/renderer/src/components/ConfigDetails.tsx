
import { AppConfig } from '../../../shared/types'

export function ConfigDetails({ config }: { config: AppConfig }): JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 bg-gray-900/50 p-6 rounded-lg border border-gray-800/50">
      {/* Project Section */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-blue-400 uppercase">Project</h4>
        <div className="space-y-2">
          <Detail label="Project Name" value={config.projectName} />
          <Detail label="Destination" value={config.destination} />
          <Detail label="Modules" value={config.modules.join(', ')} />
        </div>
      </div>

      {/* Domains Section */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-purple-400 uppercase">Domains</h4>
        <div className="space-y-2">
          <Detail label="Public Domain" value={config.publicDomain} />
          <Detail label="Admin Domain" value={config.adminDomain} />
          <Detail label="API Domain" value={config.apiDomain} />
        </div>
      </div>

      {/* AWS Section */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-orange-400 uppercase">AWS</h4>
        <div className="space-y-2">
          <Detail label="Profile" value={config.awsProfile} />
          <Detail label="Region" value={config.awsRegion} />
        </div>
      </div>

      {/* Local DB Section */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-green-400 uppercase">Local Database</h4>
        <div className="space-y-2">
          <Detail label="Host" value={`${config.dbLocal.host}:${config.dbLocal.port}`} />
          <Detail label="User" value={config.dbLocal.user} />
          <Detail label="Database" value={config.dbLocal.name} />
        </div>
      </div>

      {/* Prod DB Section */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-indigo-400 uppercase">Production Database</h4>
        <div className="space-y-2">
          <Detail label="Host" value={config.dbProd.host} />
          <Detail label="User" value={config.dbProd.user} />
          <Detail label="Database" value={config.dbProd.name} />
        </div>
      </div>

      {/* Environment Variables */}
      <div className="md:col-span-2 mt-4 pt-6 border-t border-gray-800">
        <h4 className="text-xs font-bold text-gray-400 uppercase mb-4">Generated Environment Variables</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {config.advanced && Object.entries(config.advanced).map(([key, value]) => (
                <Detail 
                key={key} 
                label={key} 
                value={key === 'COCKROACH_API_KEY' ? '••••••••••••••••' : String(value)} 
                mono 
                />
            ))}
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
      <div>
        <div className="text-[10px] text-gray-500 font-medium mb-0.5">{label}</div>
        <div className={`text-sm text-gray-300 break-all ${mono ? 'font-mono' : ''}`}>
          {value || <span className="text-gray-600 italic">Not set</span>}
        </div>
      </div>
    )
}
