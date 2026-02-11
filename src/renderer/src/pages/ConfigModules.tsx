import { useEffect } from 'react'
import { WizardLayout } from '../components/WizardLayout'
import { useInstaller } from '../context/InstallerContext'
import { AVAILABLE_MODULES } from '../../../shared/types'

export function ConfigModules(): JSX.Element {
  const { config, updateConfig } = useInstaller()

  useEffect(() => {
    // Ensure required modules are selected
    const required = AVAILABLE_MODULES.filter(m => m.required).map(m => m.id)
    const newModules = Array.from(new Set([...config.modules, ...required]))
    if (newModules.length !== config.modules.length) {
      updateConfig({ modules: newModules })
    }
  }, [])

  const toggleModule = (id: string): void => {
    const module = AVAILABLE_MODULES.find(m => m.id === id)
    if (module?.required) return

    const current = new Set(config.modules)
    
    if (current.has(id)) {
      // Deselect logic
      current.delete(id)
      // Also deselect any modules that require this one?
      // For now, let's just allow deselecting a dependency, but maybe warn or auto-deselect children?
      // Simpler: Just deselect. The user can re-fix.
      // BUT if we want to be strict: 
      // specific use case: if store is unchecked, we should probably uncheck plugins.
      const dependentModules = AVAILABLE_MODULES.filter(m => m.requiredModules?.includes(id))
      dependentModules.forEach(m => current.delete(m.id))

    } else {
      // Select logic
      current.add(id)
      // Auto-select dependencies
      if (module?.requiredModules) {
        module.requiredModules.forEach(reqId => current.add(reqId))
      }
    }
    
    updateConfig({ modules: Array.from(current) })
  }

  return (
    <WizardLayout
      title="Module Selection"
      backLink="/config"
      nextLink="/config/db"
      nextLabel="Next: Database"
    >
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">Select Modules</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {AVAILABLE_MODULES.map((module) => (
              <div 
                key={module.id} 
                className={`p-3 rounded border transition-colors ${
                  config.modules.includes(module.id) 
                    ? 'bg-blue-900/30 border-blue-500' 
                    : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                } ${module.required ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                onClick={() => toggleModule(module.id)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={config.modules.includes(module.id)}
                    disabled={module.required}
                    onChange={() => {}} // Handled by div click
                    className="mt-1 rounded text-blue-500 focus:ring-blue-500 bg-gray-700 border-gray-600 disabled:opacity-50"
                  />
                  <div>
                    <div className="font-medium text-white">
                      {module.name}
                      {module.required && <span className="ml-2 text-xs text-blue-400">(Required)</span>}
                    </div>
                    {/* Description added */}
                    {module.description && <div className="text-xs text-gray-400 mt-1">{module.description}</div>}
                    {module.requiredModules && module.requiredModules.length > 0 && (
                      <div className="text-xs text-blue-300 mt-1">
                        Requires: {module.requiredModules.map(mid => 
                          AVAILABLE_MODULES.find(m => m.id === mid)?.name || mid
                        ).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </WizardLayout>
  )
}

