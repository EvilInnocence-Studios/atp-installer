import { useEffect } from 'react'
import { WizardLayout } from '../components/WizardLayout'
import { useInstaller } from '../context/InstallerContext'
import { AVAILABLE_MODULES } from '../../../shared/types'
import { ModuleSelector } from '../components/ModuleSelector'

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
      current.delete(id)
      const dependentModules = AVAILABLE_MODULES.filter(m => m.requiredModules?.includes(id))
      dependentModules.forEach(m => current.delete(m.id))
    } else {
      current.add(id)
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
          <label className="block text-sm font-medium text-gray-400 mb-4">Select Modules</label>
          <ModuleSelector 
            selectedModules={config.modules} 
            onToggle={toggleModule} 
          />
        </div>
      </div>
    </WizardLayout>
  )
}

