import { ChevronRight, ClipboardList, Database, Globe, Layers, Settings, Terminal } from 'lucide-react'
import { WizardLayout } from '../components/WizardLayout'
import { useInstaller } from '../context/InstallerContext'
import { useState } from 'react'

export function ConfigOverview(): JSX.Element {
  const { config } = useInstaller()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const separator = config.destination.includes('\\') ? '\\' : '/'
  const installPath = config.destination.endsWith(separator) 
    ? config.destination + config.projectName 
    : config.destination + separator + config.projectName

  const actions = [
    {
      title: 'Target Directory',
      description: `Create workspace at ${installPath}`,
      icon: <Terminal className="w-5 h-5 text-blue-400" />
    },
    {
      title: 'Repositories',
      description: `Clone atp-api, atp-admin, and atp-public into destination`,
      icon: <Layers className="w-5 h-5 text-purple-400" />
    },
    {
      title: 'Database Setup',
      description: `Configure local "${config.dbLocal.name}" and production "${config.dbProd.name}"`,
      icon: <Database className="w-5 h-5 text-green-400" />
    },
    {
      title: 'Cloud Infrastructure',
      description: `Prepare AWS configuration for ${config.awsRegion} using profile "${config.awsProfile}" (Deployment is a separate step)`,
      icon: <Globe className="w-5 h-5 text-orange-400" />
    }
  ]

  return (
    <WizardLayout
      title="Installation Overview"
      subtitle="Review the actions and settings before we begin the installation."
      backLink="/config/aws"
      nextLink="/install"
      nextLabel="Confirm & Install"
    >
      <div className="space-y-6">
        {/* Action List */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 divide-y divide-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gray-800/30">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Actions to be Performed
            </h3>
          </div>
          {actions.map((action, idx) => (
            <div key={idx} className="px-6 py-4 flex gap-4 items-start hover:bg-white/5 transition-colors">
              <div className="mt-1">{action.icon}</div>
              <div>
                <div className="text-white font-medium">{action.title}</div>
                <div className="text-sm text-gray-500 mt-1">{action.description}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Settings Panel */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="w-full px-6 py-4 flex items-center justify-between group hover:bg-white/5 transition-all text-left"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                Full Configuration Details
              </span>
            </div>
            <ChevronRight className={`w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-transform ${isSettingsOpen ? 'rotate-90' : ''}`} />
          </button>

          {isSettingsOpen && (
            <div className="px-6 pb-6 pt-2 animate-in fade-in slide-in-from-top-4 duration-300">
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
                    {Object.entries(config.advanced).map(([key, value]) => (
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
            </div>
          )}
        </div>
      </div>
    </WizardLayout>
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
