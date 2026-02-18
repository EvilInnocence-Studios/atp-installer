import { WizardLayout } from '../components/WizardLayout'
import { useInstaller } from '../context/InstallerContext'
import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, CheckCircle, ChevronRight } from 'lucide-react'

export function ConfigAWS(): JSX.Element {
  const { config, updateConfig } = useInstaller()
  const [profiles, setProfiles] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Direct Input State
  const [accessKey, setAccessKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
console.log(config);
  const loadProfiles = async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.api.getAwsProfiles()
      setProfiles(result)
      
      const currentProfile = config.awsProfile || (result.includes('default') ? 'default' : result[0])
      if (currentProfile) {
          updateConfig({ awsProfile: currentProfile })
          const accountId = await window.api.getAwsAccountId(currentProfile)
          const creds = await window.api.getAwsProfileCredentials(currentProfile)
          
          updateConfig({ 
            awsAccountId: accountId || config.awsAccountId,
            advanced: {
              ...config.advanced,
              AWS_ACCESS_KEY_ID: creds?.accessKeyId || config.advanced.AWS_ACCESS_KEY_ID,
              AWS_SECRET_ACCESS_KEY: creds?.secretAccessKey || config.advanced.AWS_SECRET_ACCESS_KEY
            }
          })
      }
    } catch (err) {
      console.error(err)
      setError('Failed to load profiles')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveCredentials = async (): Promise<void> => {
    if (!accessKey || !secretKey) return
    
    setIsSaving(true)
    setError(null)
    try {
      await window.api.saveAwsCredentials(accessKey, secretKey, config.awsRegion)
      updateConfig({
        advanced: {
          ...config.advanced,
          AWS_ACCESS_KEY_ID: accessKey,
          AWS_SECRET_ACCESS_KEY: secretKey
        }
      })
      // Clear inputs
      setAccessKey('')
      setSecretKey('')
      // Refresh
      await loadProfiles()
      // Auto select default
      updateConfig({ awsProfile: 'default' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  return (
    <WizardLayout
      title="AWS Configuration"
      subtitle="We need AWS credentials to deploy your infrastructure."
      backLink="/config/db"
      nextLink="/config/overview"
      nextLabel="Next: Overview"
      isNextDisabled={!config.awsProfile}
    >
      <div className="space-y-6">
        {/* Profile Selection */}
        <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">AWS Profile</h3>
              <p className="text-xs text-gray-500">
                Select an existing profile from your machine or add new credentials below.
              </p>
            </div>
            <div className="flex items-center gap-4">
               <a 
                href="https://aws.amazon.com/" 
                target="_blank" 
                rel="noreferrer" 
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Need an account?
              </a>
              <button 
                onClick={loadProfiles} 
                className="p-1 text-gray-400 hover:text-white transition-colors"
                title="Refresh Profiles"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {profiles.length > 0 ? (
             <div className="space-y-4">
              <div className="flex gap-4 items-center">
                <select
                  value={config.awsProfile}
                  onChange={async (e) => {
                    const profile = e.target.value
                    updateConfig({ awsProfile: profile })
                    setShowAddForm(false)
                    
                    // Fetch and sync credentials
                    const creds = await window.api.getAwsProfileCredentials(profile)
                    const accountId = await window.api.getAwsAccountId(profile)
                    
                    updateConfig({ 
                      awsAccountId: accountId || config.awsAccountId,
                      advanced: {
                        ...config.advanced,
                        AWS_ACCESS_KEY_ID: creds?.accessKeyId || config.advanced.AWS_ACCESS_KEY_ID,
                        AWS_SECRET_ACCESS_KEY: creds?.secretAccessKey || config.advanced.AWS_SECRET_ACCESS_KEY
                      }
                    })
                  }}
                  className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {profiles.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <div className="text-xs text-green-500 flex items-center gap-1 min-w-[80px]">
                  <CheckCircle className="w-4 h-4" /> 
                  {config.awsAccountId ? <span title={config.awsAccountId}>Linked</span> : 'Ready'}
                </div>
              </div>
              {config.awsAccountId && (
                <p className="mt-2 text-[10px] text-gray-500 font-mono">
                  Account ID: <span className="text-gray-400">{config.awsAccountId}</span>
                </p>
              )}
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  + Add New Credentials
                </button>
              )}
            </div>
          ) : (
            <div className="py-2 text-sm text-gray-400 italic">
              No profiles found. Please add your credentials below.
            </div>
          )}
        </div>

        {/* Direct Entry */}
        {(showAddForm || profiles.length === 0) && (
          <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Add / Update Credentials</h3>
              {profiles.length > 0 && (
                <button 
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  Cancel
                </button>
              )}
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">AWS Access Key ID</label>
                  <input
                    type="text"
                    value={accessKey}
                    onChange={(e) => setAccessKey(e.target.value)}
                    placeholder="AKIA..."
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white placeholder:text-gray-700 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">AWS Secret Access Key</label>
                  <input
                    type="password"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white placeholder:text-gray-700 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  onClick={handleSaveCredentials}
                  disabled={!accessKey || !secretKey || isSaving}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded transition-colors flex items-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save and Use Default Profile
                </button>
              </div>
              
              {error && (
                <div className="p-3 bg-red-900/20 border border-red-500/50 rounded text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Global Advanced (Existing) */}
        <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer list-none text-gray-400 font-medium hover:text-white transition-colors">
              <span>Other Deployment Settings</span>
              <span className="transform group-open:rotate-180 transition-transform">
                <ChevronRight className="w-5 h-5 rotate-90" />
              </span>
            </summary>
            <div className="mt-4 pt-4 border-t border-gray-700 space-y-6">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">AWS Account ID</label>
                  <input
                    type="text"
                    value={config.awsAccountId}
                    onChange={(e) => updateConfig({ awsAccountId: e.target.value })}
                    placeholder="123456789012"
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-600 mt-2">
                    Used for resource identification in deployment scripts.
                  </p>
                </div>

               {/* Region Setting (Moved here) */}
               <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Target AWS Region</label>
                  <select
                    value={config.awsRegion}
                    onChange={(e) => updateConfig({ awsRegion: e.target.value })}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="us-east-1">us-east-1 (N. Virginia)</option>
                    <option value="us-east-2">us-east-2 (Ohio)</option>
                    <option value="us-west-1">us-west-1 (N. California)</option>
                    <option value="us-west-2">us-west-2 (Oregon)</option>
                    <option value="eu-west-1">eu-west-1 (Ireland)</option>
                    <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                  </select>
                  <p className="text-[10px] text-gray-600 mt-2">
                    This region will be used for all AWS resources provisioned by the installer.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">AWS Access Key ID</label>
                    <input
                      type="text"
                      value={config.advanced.AWS_ACCESS_KEY_ID || ''}
                      onChange={(e) => updateConfig({ 
                        advanced: { ...config.advanced, AWS_ACCESS_KEY_ID: e.target.value } 
                      })}
                      placeholder="AKIA..."
                      className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-2">AWS Secret Access Key</label>
                    <input
                      type="password"
                      value={config.advanced.AWS_SECRET_ACCESS_KEY || ''}
                      onChange={(e) => updateConfig({ 
                        advanced: { ...config.advanced, AWS_SECRET_ACCESS_KEY: e.target.value } 
                      })}
                      placeholder="••••••••••••••••"
                      className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(config.advanced)
                    .filter(([key]) => !['ACCOUNT', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'].includes(key))
                    .map(([key, value]) => (
                      <div key={key}>
                        <label className="block text-xs font-mono text-gray-500 mb-1">{key}</label>
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => updateConfig({ 
                            advanced: { ...config.advanced, [key]: e.target.value } 
                          })}
                          className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    ))}
                </div>
            </div>
          </details>
        </div>
      </div>
    </WizardLayout>
  )
}


