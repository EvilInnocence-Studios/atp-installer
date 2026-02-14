import { useNavigate } from 'react-router-dom'
import { useInstaller } from '../context/InstallerContext'
import { ArrowLeft, Rocket, Wrench, Folder } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'

export function SelectMode(): JSX.Element {
  const navigate = useNavigate()
  const { updateConfig } = useInstaller()

  const handleNewSite = (): void => {
    navigate('/config') 
  }

  const handleExistingSite = async (): Promise<void> => {
    try {
        const path = await window.api.openDirectory()
        if (path) {
            const loadedConfig = await window.api.loadProjectConfig(path)
            updateConfig(loadedConfig)
            navigate('/manage')
        }
    } catch (e) {
        console.error('Failed to load project:', e)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      <AppHeader />
      
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl pt-40">
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate('/prerequisites')}
            className="mr-4 p-2 hover:bg-gray-800 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
            Select Operation Mode
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* New Site Card */}
          <div
            onClick={handleNewSite}
            className="bg-gray-800/50 p-8 rounded-xl border border-gray-700 hover:border-blue-500 cursor-pointer transition-all transform hover:scale-[1.02] active:scale-[0.98] group"
          >
              <div className="flex justify-center mb-6">
                  <div className="p-4 bg-blue-500/10 rounded-full group-hover:bg-blue-500/20 transition-colors">
                      <Rocket className="w-16 h-16 text-blue-400" />
                  </div>
              </div>
              <h2 className="text-2xl font-bold text-center mb-4">Configure New Site</h2>
              <p className="text-gray-400 text-center">
                  Start a fresh installation of the ATP Framework. We'll guide you through setting up AWS, Databases, and your initial configuration.
              </p>
          </div>

          {/* Existing Site Card */}
          <div
            onClick={handleExistingSite}
            className="bg-gray-800/50 p-8 rounded-xl border border-gray-700 hover:border-purple-500 cursor-pointer transition-all transform hover:scale-[1.02] active:scale-[0.98] group"
          >
              <div className="flex justify-center mb-6">
                  <div className="p-4 bg-purple-500/10 rounded-full group-hover:bg-purple-500/20 transition-colors">
                      <Wrench className="w-16 h-16 text-purple-400" />
                  </div>
              </div>
              <h2 className="text-2xl font-bold text-center mb-4">Manage Existing Site</h2>
              <p className="text-gray-400 text-center mb-6">
                  Load an existing project configuration to manage deployments, update settings, or check status.
              </p>
              <div className="flex items-center justify-center text-sm text-gray-500 bg-gray-900/50 py-2 rounded-lg">
                  <Folder className="w-4 h-4 mr-2" />
                  <span>Select Project Root</span>
              </div>
          </div>
        </div>
      </main>
    </div>
  )
}
