import { useState, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import { WizardLayout } from '../components/WizardLayout'
import { useInstaller } from '../context/InstallerContext'

export function ConfigProject(): JSX.Element {
  const { config, updateConfig } = useInstaller()
  const [rootDomain, setRootDomain] = useState('')
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)

  // Initialize root domain from config if possible (heuristic)
  useEffect(() => {
    if (config.publicDomain && config.publicDomain !== 'www.example.com') {
      const parts = config.publicDomain.split('.')
      if (parts.length >= 2) {
         // Assuming www.domain.com or domain.com
         if (parts[0] === 'www') {
           setRootDomain(parts.slice(1).join('.'))
         } else {
           setRootDomain(config.publicDomain)
         }
      }
    }
  }, [])

  const handleRootDomainChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const domain = e.target.value
    setRootDomain(domain)
    
    // Auto-update subdomains
    if (domain) {
      updateConfig({
        publicDomain: `www.${domain}`,
        adminDomain: `admin.${domain}`,
        apiDomain: `api.${domain}`
      })
    } else {
       // Clear or keep defaults? Let's clear to reflect emptyness or minimal valid state
       // Actually, keeping them empty might fail validation if we add it. 
       // Let's just update them.
       updateConfig({
        publicDomain: '',
        adminDomain: '',
        apiDomain: ''
      })
    }
  }

  // Module logic moved to ConfigModules


  return (
    <WizardLayout
      title="Project Configuration"
      backLink="/prerequisites"
      nextLink="/config/modules"
      nextLabel="Next: Modules"
      isNextDisabled={!config.projectName || !config.destination}
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Project Name/Folder</label>
          <input
            type="text"
            value={config.projectName}
            onChange={(e) => updateConfig({ projectName: e.target.value })}
            className="w-full bg-gray-800 text-white rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Destination Directory</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={config.destination}
              className="flex-1 bg-gray-800 text-white rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none cursor-not-allowed"
              placeholder="Click Browse to select folder"
            />
            <button
               onClick={async () => {
                 const path = await window.api.selectDirectory()
                 if (path) updateConfig({ destination: path })
               }}
               className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
            >
              Browse
            </button>
          </div>
          {config.destination && config.projectName && (
            <p className="mt-2 text-xs text-gray-500">
              Project will be created at: <span className="text-gray-300 font-mono">{config.destination}\{config.projectName}</span>
            </p>
          )}

        </div>

        <div>
           <div className="flex items-center justify-between mb-3">
             <h3 className="block text-sm font-medium text-gray-400">Domain Configuration</h3>
             <button
               type="button"
               onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
               className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
             >
               {isAdvancedOpen ? 'Simple Configuration' : 'Advanced Configuration'}
               <ChevronRight className={`w-3 h-3 transform transition-transform ${isAdvancedOpen ? 'rotate-90' : ''}`} />
             </button>
           </div>
           
           {!isAdvancedOpen ? (
             <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Root Domain</label>
                <input
                  type="text"
                  value={rootDomain}
                  onChange={handleRootDomainChange}
                  placeholder="example.com"
                  className="w-full bg-gray-800 text-white rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-500">
                  <div className="bg-gray-800/50 p-2 rounded border border-gray-700">
                    <span className="block text-gray-600 mb-1">Public Site</span>
                    <span className="text-gray-300">{config.publicDomain || 'www.example.com'}</span>
                  </div>
                  <div className="bg-gray-800/50 p-2 rounded border border-gray-700">
                    <span className="block text-gray-600 mb-1">Admin Panel</span>
                    <span className="text-gray-300">{config.adminDomain || 'admin.example.com'}</span>
                  </div>
                  <div className="bg-gray-800/50 p-2 rounded border border-gray-700">
                    <span className="block text-gray-600 mb-1">API Endpoint</span>
                    <span className="text-gray-300">{config.apiDomain || 'api.example.com'}</span>
                  </div>
                </div>
             </div>
           ) : (
             <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div>
                   <label className="block text-xs text-gray-500 mb-1">Public Domain</label>
                   <input
                    type="text"
                    value={config.publicDomain}
                    onChange={(e) => updateConfig({ publicDomain: e.target.value })}
                    placeholder="www.example.com"
                    className="w-full bg-gray-800 text-white rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                   />
                </div>
                <div>
                   <label className="block text-xs text-gray-500 mb-1">Admin Domain</label>
                   <input
                    type="text"
                    value={config.adminDomain}
                    onChange={(e) => updateConfig({ adminDomain: e.target.value })}
                    placeholder="admin.example.com"
                    className="w-full bg-gray-800 text-white rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                   />
                </div>
                <div>
                   <label className="block text-xs text-gray-500 mb-1">API Domain</label>
                   <input
                    type="text"
                    value={config.apiDomain}
                    onChange={(e) => updateConfig({ apiDomain: e.target.value })}
                    placeholder="api.example.com"
                    className="w-full bg-gray-800 text-white rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                   />
                </div>
             </div>
           )}
        </div>
      </div>
    </WizardLayout>
  )
}

