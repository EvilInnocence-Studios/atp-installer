import { ChevronRight, ClipboardList, Database, Globe, Layers, Settings, Terminal } from 'lucide-react'
import { WizardLayout } from '../components/WizardLayout'
import { useInstaller } from '../context/InstallerContext'
import { useState } from 'react'
import { ConfigDetails } from '../components/ConfigDetails'

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
      description: `Prepare AWS configuration for ${config.awsRegion} using profile "${config.awsProfile}"${config.advanced.AWS_ACCESS_KEY_ID ? ` (${config.advanced.AWS_ACCESS_KEY_ID})` : ''} (Deployment is a separate step)`,
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
               <ConfigDetails config={config} />
            </div>
          )}
        </div>
      </div>
    </WizardLayout>
  )
}
