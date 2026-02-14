import { AVAILABLE_MODULES } from '../../../shared/types'

interface ModuleSelectorProps {
  selectedModules: string[]
  onToggle: (id: string) => void
  disabled?: boolean
}

export function ModuleSelector({ selectedModules, onToggle, disabled }: ModuleSelectorProps): JSX.Element {
  const toggleModule = (id: string): void => {
    if (disabled) return
    onToggle(id)
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {AVAILABLE_MODULES.map((module) => (
            <div 
              key={module.id} 
              className={`p-3 rounded border transition-colors ${
                selectedModules.includes(module.id) 
                  ? 'bg-blue-900/30 border-blue-500' 
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'
              } ${module.required || disabled ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
              onClick={() => toggleModule(module.id)}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedModules.includes(module.id)}
                  disabled={module.required || disabled}
                  onChange={() => {}} // Handled by div click
                  className="mt-1 rounded text-blue-500 focus:ring-blue-500 bg-gray-700 border-gray-600 disabled:opacity-50"
                />
                <div>
                  <div className="font-medium text-white">
                    {module.name}
                    {module.required && <span className="ml-2 text-xs text-blue-400">(Required)</span>}
                  </div>
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
  )
}
