import { useState, useEffect } from 'react'
import { ChevronRight, Loader2, Plus, CheckCircle, Copy, Check } from 'lucide-react'
import { WizardLayout } from '../components/WizardLayout'
import { useInstaller } from '../context/InstallerContext'
import { DatabaseConfig } from '../../../shared/types'

export function ConfigDatabase(): JSX.Element {
  const { config, updateConfig, uiState, updateUIState } = useInstaller()
  const { clusters, selectedClusterId, dbUsers, prodDbs, localDbs, isLocalConnected, dbActiveTab } = uiState
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // CockroachDB State
  const [apiKey, setApiKey] = useState(config.advanced.COCKROACH_API_KEY || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isProdDbLoading, setIsProdDbLoading] = useState(false)
  const [prodDbError, setProdDbError] = useState<string | null>(null)
  
  // Local DB State
  const [isLocalLoading, setIsLocalLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  
  // Wipe Dialog State
  const [showWipeDialog, setShowWipeDialog] = useState(false)
  const [wipeTarget, setWipeTarget] = useState<'local' | 'prod' | null>(null)
  const [wipeConfirmText, setWipeConfirmText] = useState('')
  const [isWiping, setIsWiping] = useState(false)

  const handleConnectLocal = async (): Promise<void> => {
    setIsLocalLoading(true)
    setLocalError(null)
    try {
      const connected = await window.api.testPostgresConnection(config.dbLocal)
      if (!connected) throw new Error('Could not connect to local PostgreSQL. Ensure it is running and credentials are correct.')
      
      const dbs = await window.api.listPostgresDatabases(config.dbLocal)
      updateUIState({ localDbs: dbs, isLocalConnected: true })
      
      // Auto-check if current local DB is empty
      if (config.dbLocal.name) {
        checkDbEmpty('local', config.dbLocal)
      }
    } catch (err) {
      setLocalError((err as Error).message)
    } finally {
      setIsLocalLoading(false)
    }
  }

  const checkDbEmpty = async (type: 'local' | 'prod', dbConfig: DatabaseConfig): Promise<void> => {
    try {
      const isEmpty = await window.api.isDatabaseEmpty(dbConfig)
      if (!isEmpty) {
        setWipeTarget(type)
        setShowWipeDialog(true)
      }
    } catch (err) {
      console.error('Failed to check database emptiness:', err)
    }
  }

  const handleWipeDatabase = async (): Promise<void> => {
    if (wipeConfirmText !== 'delete all data') return
    
    setIsWiping(true)
    try {
      const dbConfig = wipeTarget === 'local' ? config.dbLocal : config.dbProd
      await window.api.wipeDatabase(dbConfig)
      setShowWipeDialog(false)
      setWipeConfirmText('')
      alert('Database wiped successfully!')
    } catch (err) {
      alert(`Wipe failed: ${(err as Error).message}`)
    } finally {
      setIsWiping(false)
    }
  }

  const handleCreateLocalDb = async (): Promise<void> => {
    setIsLocalLoading(true)
    setLocalError(null)
    try {
      await window.api.createPostgresDatabase(config.dbLocal, config.dbLocal.name)
      const dbs = await window.api.listPostgresDatabases(config.dbLocal)
      updateUIState({ localDbs: dbs })
    } catch (err) {
      setLocalError((err as Error).message)
    } finally {
      setIsLocalLoading(false)
    }
  }

  const handleConnect = async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    try {
      const list = await window.api.listClusters(apiKey)
      updateUIState({ clusters: list })
      updateConfig({ advanced: { ...config.advanced, COCKROACH_API_KEY: apiKey } })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectCluster = async (id: string): Promise<void> => {
    updateUIState({ selectedClusterId: id })
    updateConfig({ selectedClusterId: id })
    setIsLoading(true)
    setProdDbError(null)
    try {
      const info = await window.api.getConnectionInfo(apiKey, id)
      updateDb('dbProd', info)
      
      // Fetch users
      const users = await window.api.listUsers(apiKey, id)
      updateUIState({ dbUsers: users })
      
      // If current user is not in the list, select first one if available
      if (users.length > 0 && !users.includes(config.dbProd.user)) {
        updateDb('dbProd', { user: users[0] })
      }
      
      // Fetch Databases
      setIsProdDbLoading(true)
      const dbs = await window.api.listCockroachDatabases(apiKey, id)
      updateUIState({ prodDbs: dbs })
      
      // Check if project db already exists and select it
      if (dbs.includes(config.dbProd.name)) {
        checkDbEmpty('prod', { ...config.dbProd, ...info })
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsLoading(false)
      setIsProdDbLoading(false)
    }
  }

  const handleCreateCluster = async (): Promise<void> => {
    setIsProvisioning(true)
    setError(null)
    try {
      // Use project name as cluster name (sanitized)
      const name = config.projectName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
      const cluster = await window.api.createCluster(apiKey, name)
      
      // Wait for it to be active
      let status = 'CREATING'
      let attempts = 0
      while (status !== 'CREATED' && status !== 'RUNNING' && attempts < 60) {
        await new Promise(resolve => setTimeout(resolve, 3000))
        status = await window.api.getClusterStatus(apiKey, cluster.id)
        console.log("Cluster creation status", status);
        attempts++
      }

      if (status !== 'CREATED' && status !== 'RUNNING') {
        throw new Error('Cluster provisioning timed out. Please refresh in a few minutes.')
      }

      // Create a default user named after the project (sanitized)
      const username = config.projectName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + '_admin'
      const password = await window.api.createUser(apiKey, cluster.id, username)
      console.log("Renderer: createCockroachUser password:", password);

      // Select it and wait for it to finish its state updates (populates host/port)
      await handleSelectCluster(cluster.id)
      
      // Create a new database named after the project via Cockroach API
      const prodDbName = config.projectName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
      await window.api.createCockroachDatabase(apiKey, cluster.id, prodDbName)
      
      // Refresh list
      const list = await window.api.listClusters(apiKey)
      
      // Fetch and Update databases list
      const dbs = await window.api.listCockroachDatabases(apiKey, cluster.id)
      updateUIState({ clusters: list, prodDbs: dbs })
      
      // Update config one final time
      updateConfig({ selectedClusterId: cluster.id })
      updateDb('dbProd', { user: username, pass: password, name: prodDbName })
      
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsProvisioning(false)
    }
  }

  const handleCreateProdDb = async (): Promise<void> => {
    if (!selectedClusterId) return
    setIsProdDbLoading(true)
    setProdDbError(null)
    try {
      await window.api.createCockroachDatabase(apiKey, selectedClusterId, config.dbProd.name)
      const dbs = await window.api.listCockroachDatabases(apiKey, selectedClusterId)
      updateUIState({ prodDbs: dbs })
    } catch (err) {
      setProdDbError((err as Error).message)
    } finally {
      setIsProdDbLoading(false)
    }
  }

  const handleCopyProdPassword = (): void => {
    navigator.clipboard.writeText(config.dbProd.pass)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const updateDb = (type: 'dbLocal' | 'dbProd', updates: Partial<DatabaseConfig>): void => {
    updateConfig({ [type]: updates as any }) 
  }

  // Load users on mount if cluster is already selected
  useEffect(() => {
    updateUIState({ dbActiveTab: 'local' })
    if (apiKey && selectedClusterId && dbUsers.length === 0) {
      window.api.listUsers(apiKey, selectedClusterId).then(users => updateUIState({ dbUsers: users })).catch(console.error)
    }
  }, [])

  return (
    <WizardLayout
      title="Database Setup"
      backLink="/config/modules"
      nextLink="/config/aws"
      nextLabel="Next: AWS"
    >
      <div className="space-y-6">
        {/* Tab Switcher */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => updateUIState({ dbActiveTab: 'local' })}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-[2px] ${
              dbActiveTab === 'local'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            Local Development
          </button>
          <button
            onClick={() => updateUIState({ dbActiveTab: 'prod' })}
            className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-[2px] ${
              dbActiveTab === 'prod'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            Production (CockroachDB)
          </button>
        </div>

        <div>
          {/* Local DB */}
          {dbActiveTab === 'local' && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white">Local PostgreSQL</h3>
                  <button
                    type="button"
                    onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    {isAdvancedOpen ? 'Simple Configuration' : 'Advanced Configuration'}
                    <ChevronRight className={`w-3 h-3 transform transition-transform ${isAdvancedOpen ? 'rotate-90' : ''}`} />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Always Visible */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">User</label>
                    <input
                      type="text"
                      value={config.dbLocal.user}
                      onChange={(e) => updateDb('dbLocal', { user: e.target.value })}
                      className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Password</label>
                    <input
                      type="password"
                      value={config.dbLocal.pass}
                      onChange={(e) => updateDb('dbLocal', { pass: e.target.value })}
                      className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Advanced Only */}
                  {isAdvancedOpen && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Host</label>
                        <input
                          type="text"
                          value={config.dbLocal.host}
                          onChange={(e) => updateDb('dbLocal', { host: e.target.value })}
                          className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Port</label>
                        <input
                          type="number"
                          value={config.dbLocal.port}
                          onChange={(e) => updateDb('dbLocal', { port: parseInt(e.target.value) || 5432 })}
                          className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </>
                  )}

                  <div className="col-span-2 space-y-6 pt-2">
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-2">
                          Connect to your local PostgreSQL instance to see available databases or create a new one.
                        </p>
                      </div>
                      <button
                        onClick={handleConnectLocal}
                        disabled={isLocalLoading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded transition-colors h-[38px] flex items-center gap-2"
                      >
                        {isLocalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isLocalConnected ? 'Refresh' : 'Connect'}
                      </button>
                    </div>

                    {localError && (
                      <div className="p-3 bg-red-900/20 border border-red-500/50 rounded text-red-400 text-sm">
                        {localError}
                      </div>
                    )}

                    {isLocalConnected && !localError && (
                      <div className="animate-in fade-in slide-in-from-top-4 duration-300 space-y-4">
                          <label className="block text-sm font-medium text-gray-400">Select Local Database</label>
                          <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {localDbs.map((db) => (
                              <button
                                key={db}
                                onClick={() => {
                                  updateDb('dbLocal', { name: db })
                                  checkDbEmpty('local', { ...config.dbLocal, name: db })
                                }}
                                className={`p-3 text-left rounded border transition-colors ${
                                  config.dbLocal.name === db
                                    ? 'bg-blue-900/30 border-blue-500'
                                    : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <div className="font-medium text-white">{db}</div>
                                  {config.dbLocal.name === db && <div className="text-blue-400"><CheckCircle className="w-5 h-5" /></div>}
                                </div>
                              </button>
                            ))}
                          </div>

                          <div className="pt-2 border-t border-gray-700 flex justify-between items-center">
                            <span className="text-xs text-gray-500">
                              {localDbs.length > 0 ? "Don't see your database?" : "No databases found."}
                            </span>
                            <button
                              onClick={handleCreateLocalDb}
                              disabled={isLocalLoading}
                              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                              <Plus className="w-4 h-4" />
                              Create "{config.projectName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}"
                            </button>
                          </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Prod DB */}
          {dbActiveTab === 'prod' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-semibold text-white">Production CockroachDB</h3>
                  <a 
                    href="https://www.cockroachlabs.com/" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    Need an account?
                  </a>
                </div>
                <p className="text-xs text-gray-500 mb-6">
                  Connecting to your CockroachDB Cloud account allows the installer to automatically provision or select a cluster for your production environment.
                </p>
                
                <div className="space-y-6">
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs text-gray-500">CockroachDB Cloud API Key</label>
                        <a 
                          href="https://www.cockroachlabs.com/docs/cockroachcloud/managing-access#manage-service-accounts" 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[10px] text-blue-400 hover:text-blue-300"
                        >
                          How to create?
                        </a>
                      </div>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your API Key"
                        className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      onClick={handleConnect}
                      disabled={!apiKey || isLoading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded transition-colors h-[38px] flex items-center gap-2"
                    >
                      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      {clusters.length > 0 ? 'Refresh' : 'Connect'}
                    </button>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-900/20 border border-red-500/50 rounded text-red-400 text-sm">
                      {error}
                    </div>
                  )}

                  {apiKey && !error && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                      {isProvisioning && (
                        <div className="flex items-center gap-2 text-blue-400 py-6">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Provisioning cluster... This may take a minute.</span>
                        </div>
                      )}
                      
                      {isLoading && !isProvisioning && (
                        <div className="flex items-center gap-2 text-gray-400 py-6">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Loading...</span>
                        </div>
                      )}
                      
                      {!isLoading && !isProvisioning && clusters.length > 0 && (
                        <div className="space-y-4">
                          <label className="block text-sm font-medium text-gray-400 mb-2">Select Cluster</label>
                          <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {clusters.map((cluster) => (
                              <button
                                key={cluster.id}
                                onClick={() => handleSelectCluster(cluster.id)}
                                className={`p-3 text-left rounded border transition-colors ${
                                  selectedClusterId === cluster.id
                                    ? 'bg-blue-900/30 border-blue-500'
                                    : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <div>
                                    <div className="font-medium text-white">{cluster.name}</div>
                                    <div className="text-xs text-gray-500">{cluster.cloud_provider} • {cluster.plan}</div>
                                  </div>
                                  {selectedClusterId === cluster.id && <div className="text-blue-400"><CheckCircle className="w-5 h-5" /></div>}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                        <span className="text-xs text-gray-500">
                          {clusters.length > 0 ? "Don't see your cluster?" : "Start your project database:"}
                        </span>
                        <button
                          onClick={handleCreateCluster}
                          disabled={isLoading || isProvisioning}
                          className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          Create New Serverless Cluster
                        </button>
                      </div>

                      {selectedClusterId && !isLoading && !isProvisioning && (
                        <div className="mt-6 pt-6 border-t border-gray-700 animate-in fade-in slide-in-from-top-4 duration-300 space-y-4">
                          <label className="block text-sm font-medium text-gray-400">Select Production Database</label>
                          <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {isProdDbLoading ? (
                              <div className="flex items-center justify-center p-8 text-gray-400">
                                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                <span>Fetching databases...</span>
                              </div>
                            ) : (
                              prodDbs.map((db) => (
                                <button
                                  key={db}
                                  onClick={() => {
                                    updateDb('dbProd', { name: db })
                                    checkDbEmpty('prod', { ...config.dbProd, name: db })
                                  }}
                                  className={`p-3 text-left rounded border transition-colors ${
                                    config.dbProd.name === db
                                      ? 'bg-blue-900/30 border-blue-500'
                                      : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                                  }`}
                                >
                                  <div className="flex justify-between items-center">
                                    <div className="font-medium text-white">{db}</div>
                                    {config.dbProd.name === db && <div className="text-blue-400"><CheckCircle className="w-5 h-5" /></div>}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">
                              {prodDbs.length > 0 ? "Don't see your database?" : "No databases found in cluster."}
                            </span>
                            <button
                              onClick={handleCreateProdDb}
                              disabled={isProdDbLoading}
                              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                              <Plus className="w-4 h-4" />
                              Create "{config.projectName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}"
                            </button>
                          </div>

                          {prodDbError && (
                            <div className="p-3 bg-red-900/20 border border-red-500/50 rounded text-red-400 text-sm">
                              {prodDbError}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {(selectedClusterId || config.dbProd.host) && (
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700 animate-in fade-in duration-500">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">User</label>
                        {dbUsers.length > 0 ? (
                          <select
                            value={config.dbProd.user || ''}
                            onChange={(e) => updateDb('dbProd', { user: e.target.value })}
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {dbUsers.map(user => (
                              <option key={user} value={user}>{user}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={config.dbProd.user || ''}
                            onChange={(e) => updateDb('dbProd', { user: e.target.value })}
                            placeholder="e.g. root"
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-white outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Password</label>
                        <div className="relative">
                          <input
                            type="password"
                            value={config.dbProd.pass}
                            onChange={(e) => updateDb('dbProd', { pass: e.target.value })}
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 pr-10 text-white outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            onClick={handleCopyProdPassword}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors"
                            title="Copy Password"
                          >
                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showWipeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-900/30 border border-red-500/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-red-500 rotate-45" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Database is Not Empty</h3>
              <p className="text-gray-400 text-sm">
                The selected {wipeTarget === 'local' ? 'local' : 'production'} database <span className="text-white font-mono bg-white/10 px-1 rounded">"{wipeTarget === 'local' ? config.dbLocal.name : config.dbProd.name}"</span> contains existing data. 
                To ensure a clean installation, it must be wiped.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-xs font-medium">
                WARNING: This action is irreversible. All tables and data will be permanently deleted.
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-2 text-center">
                  Type <span className="text-white font-mono">delete all data</span> to confirm
                </label>
                <input
                  type="text"
                  value={wipeConfirmText}
                  onChange={(e) => setWipeConfirmText(e.target.value)}
                  placeholder="Type here..."
                  className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white text-center font-mono"
                  disabled={isWiping}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowWipeDialog(false)
                    setWipeConfirmText('')
                  }}
                  disabled={isWiping}
                  className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWipeDatabase}
                  disabled={wipeConfirmText !== 'delete all data' || isWiping}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white rounded transition-colors flex items-center justify-center gap-2"
                >
                  {isWiping ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Wipe Database'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </WizardLayout>
  )
}
