import { useState } from 'react'
import { CheckResult } from '../../../shared/types'
import { Check, X, Loader2, Download } from 'lucide-react'
import { useInstaller } from '../context/InstallerContext'

interface PrerequisiteCheckProps {
  check: CheckResult
  isLoading?: boolean
  onRefresh?: () => void
}

export function PrerequisiteCheck({ check, isLoading, onRefresh }: PrerequisiteCheckProps): JSX.Element {
  const [installing, setInstalling] = useState(false)
  const { config, updateConfig } = useInstaller()

  const handleInstall = async (): Promise<void> => {
    // ...
    setInstalling(true)
    try {
      const success = await window.api.installTool(check.tool)
      if (success) {
        if (check.tool === 'psql') {
          // Set the default credentials immediately
          updateConfig({ 
            dbLocal: { 
              ...config.dbLocal, 
              user: 'postgres',
              pass: 'postgres' 
            }
          })
        }
        if (onRefresh) onRefresh()
      } else {
        alert('Installation failed. Please try installing manually.')
      }
    } catch (error) {
       console.error(error)
       alert('Installation failed.')
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg mb-2 border border-gray-700">
      <div className="flex items-center gap-3">
        {isLoading ? (
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        ) : check.installed ? (
          <Check className="w-6 h-6 text-green-500" />
        ) : (
          <X className="w-6 h-6 text-red-500" />
        )}
        
        <div className="flex-1">
          <div className="text-lg font-medium text-white">{check.name}</div>
          {check.description && <div className="text-xs text-gray-500 mb-1 leading-relaxed">{check.description}</div>}
          <div className="text-sm text-gray-400">
             {check.installed ? `Installed (${check.version})` : check.error || 'Not installed'}
          </div>
        </div>
      </div>
      
      {!check.installed && !isLoading && (
        <button
          onClick={handleInstall}
          disabled={installing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {installing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Installing...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span style={{whiteSpace: 'nowrap'}}>Fix It</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}

