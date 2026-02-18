import { useState, useEffect, useRef } from 'react'
import { 
    Terminal, 
    RefreshCw, 
    Play, 
    Square, 
    Wrench, 
    Cloud, 
    Check, 
    X,
    ExternalLink,
    PlusCircle,
    Settings2,
    Database,
    ShieldCheck,
    AlertTriangle,
    Activity,
    Server,
    ClipboardList,
    Globe,
    Info
} from 'lucide-react'
import { useInstaller } from '../context/InstallerContext'
import { AVAILABLE_MODULES, MigrationStatus, AwsResourceStatus } from '../../../shared/types'
import { ModuleSelector } from '../components/ModuleSelector'
import { ConfigDetails } from '../components/ConfigDetails'

interface LogMessage {
    message: string
    type: 'info' | 'error' | 'success'
    timestamp?: string
}

export function Manage(): JSX.Element {
    const { config } = useInstaller()
    const [logs, setLogs] = useState<LogMessage[]>([])
    const [awsStatus, setAwsStatus] = useState<AwsResourceStatus[] | null>(null)
    const [showAwsStatus, setShowAwsStatus] = useState(false)
    const [fixing, setFixing] = useState<string | null>(null)
    const [deploying, setDeploying] = useState<'api' | 'admin' | 'public' | 'all' | null>(null)
    const [dbHealthLocal, setDbHealthLocal] = useState<MigrationStatus>({ initialized: false, reason: 'Checking...' })
    const [dbHealthProd, setDbHealthProd] = useState<MigrationStatus>({ initialized: false, reason: 'Checking...' })
    const [showModulesModal, setShowModulesModal] = useState(false)
    const [pendingModules, setPendingModules] = useState<string[]>([])
    const [syncingModules, setSyncingModules] = useState(false)
    const [devStatus, setDevStatus] = useState<Record<string, 'Running' | 'Stopped'>>({
        api: 'Stopped',
        admin: 'Stopped',
        public: 'Stopped'
    })
    const [refreshingDb, setRefreshingDb] = useState(false)
    const [showConfigModal, setShowConfigModal] = useState(false)

    const logEndRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs])

    useEffect(() => {
        // Initial checks
        checkDbHealth()
        refreshDevStatus()

        // Polling for statuses (Only dev status now)
        const interval = setInterval(() => {
            refreshDevStatus()
        }, 5000)

        // IPC Listeners
        const unsubLog = window.api.onLog((log: LogMessage) => {
            setLogs(prev => [...prev, log])
        })

        const unsubInit = window.api.onAwsStatusInit((status: AwsResourceStatus[]) => {
            setAwsStatus(status)
        })

        const unsubUpdate = window.api.onAwsStatusUpdate((item: AwsResourceStatus) => {
            setAwsStatus((prev) => {
                if (!prev) return [item]
                return prev.map(p => p.name === item.name && p.type === item.type ? item : p)
            })
        })

        const unsubDeployComplete = window.api.onDeployComplete((success: boolean) => {
            setDeploying(null)
            if (success) {
                setLogs(prev => [...prev, { message: 'Deployment successfully completed', type: 'success', timestamp: new Date().toLocaleTimeString() }])
            } else {
                setLogs(prev => [...prev, { message: 'Deployment failed. Check logs for details.', type: 'error', timestamp: new Date().toLocaleTimeString() }])
            }
        })

        return () => {
            clearInterval(interval)
            unsubLog()
            unsubInit()
            unsubUpdate()
            unsubDeployComplete()
        }
    }, [config])

    const checkDbHealth = async () => {
        setRefreshingDb(true)
        setDbHealthLocal({ initialized: false, reason: 'Checking...' })
        setDbHealthProd({ initialized: false, reason: 'Checking...' })
        try {
            const localStatus = await window.api.getMigrationStatus(config, 'local')
            setDbHealthLocal(localStatus)

            const prodStatus = await window.api.getMigrationStatus(config, 'prod')
            setDbHealthProd(prodStatus)
        } catch (e) {
            console.error('Failed to check DB health:', e)
            setDbHealthLocal({ initialized: false, reason: 'Check failed' })
            setDbHealthProd({ initialized: false, reason: 'Check failed' })
        } finally {
            setRefreshingDb(false)
        }
    }

    const refreshDevStatus = async () => {
        try {
            const status = await window.api.devGetStatus()
            setDevStatus(status as Record<string, 'Running' | 'Stopped'>)
        } catch (e) {
            console.error('Failed to get dev status:', e)
        }
    }

    const handleStartAllDev = async () => {
        try {
            setLogs(prev => [...prev, { message: 'Starting all development services...', type: 'info', timestamp: new Date().toLocaleTimeString() }])
            await window.api.devStartAll(config)
            refreshDevStatus()
        } catch (e: any) {
            setLogs(prev => [...prev, { message: `Failed to start services: ${e.message}`, type: 'error', timestamp: new Date().toLocaleTimeString() }])
        }
    }

    const handleRestartDev = async (target: 'api' | 'admin' | 'public') => {
        try {
            setLogs(prev => [...prev, { message: `Restarting ${target} service...`, type: 'info', timestamp: new Date().toLocaleTimeString() }])
            await window.api.devRestart(config, target)
            refreshDevStatus()
        } catch (e: any) {
            setLogs(prev => [...prev, { message: `Failed to restart ${target}: ${e.message}`, type: 'error', timestamp: new Date().toLocaleTimeString() }])
        }
    }

    const handleStopDev = async (target: 'api' | 'admin' | 'public') => {
        try {
            await window.api.devStop(target)
            refreshDevStatus()
        } catch (e: any) {
            console.error(`Failed to stop ${target}:`, e)
        }
    }

    const handleDeployProject = async (target: 'api' | 'admin' | 'public' | 'all') => {
        setDeploying(target)
        setLogs(prev => [...prev, { message: `Starting deployment for: ${target}`, type: 'info', timestamp: new Date().toLocaleTimeString() }])
        window.api.startDeploy(config, target)
    }

    const handleOpenAwsStatus = () => {
        setShowAwsStatus(true)
        window.api.startCheckAwsStatus(config)
    }

    const handleFix = async (item: AwsResourceStatus): Promise<void> => {
        setFixing(item.id)
        try {
            const options = { profile: config.awsProfile, region: config.awsRegion }
            if (item.type === 'S3') {
                await window.api.ensureS3Bucket(item.id, options)
            } else if (item.type === 'IAM Role') {
                await window.api.ensureLambdaRole(item.id, options)
            } else if (item.type === 'Certificate') {
                await window.api.ensureCertificate(item.id, options)
            } else if (item.type === 'CloudFront') {
                let projectPath = ''
                let alternateDomain = ''
                if (item.name === 'API Distribution') {
                    projectPath = `${config.destination}/${config.projectName}/api`
                    alternateDomain = config.apiDomain
                } else if (item.name === 'Admin Distribution') {
                    projectPath = `${config.destination}/${config.projectName}/admin`
                    alternateDomain = config.adminDomain
                } else if (item.name === 'Public Distribution') {
                    projectPath = `${config.destination}/${config.projectName}/public`
                    alternateDomain = config.publicDomain
                }

                if (projectPath) {
                    const env = {
                        ORIGIN_DOMAIN_NAME: config.advanced.ORIGIN_DOMAIN_NAME || '',
                        ALTERNATE_DOMAIN_NAMES: alternateDomain,
                        CERTIFICATE_NAME: config.advanced.CERTIFICATE_NAME || '',
                        AWS_PROFILE: config.awsProfile,
                        AWS_REGION: config.awsRegion
                    }
                    await window.api.ensureCloudFrontDistribution(projectPath, env)
                }
            } else if (item.type === 'Lambda') {
                setShowAwsStatus(false)
                handleDeployProject('api')
                return
            }
            // Refresh status
            window.api.startCheckAwsStatus(config)
        } catch (e: any) {
            console.error('Fix failed:', e)
            setLogs(prev => [...prev, { message: `Fix failed for ${item.name}: ${e.message}`, type: 'error', timestamp: new Date().toLocaleTimeString() }])
        } finally {
            setFixing(null)
        }
    }

    const handleOpenModuleManagement = () => {
        setPendingModules([...config.modules])
        setShowModulesModal(true)
    }

    const togglePendingModule = (id: string) => {
        setPendingModules(prev => {
            if (prev.includes(id)) {
                return prev.filter(m => m !== id)
            } else {
                return [...prev, id]
            }
        })
    }

    const handleSaveModules = async () => {
        setSyncingModules(true)
        try {
            await window.api.updateProjectModules(config, pendingModules)
            // The main process will emit log events and eventually update the config
        } catch (e: any) {
            setLogs(prev => [...prev, { message: `Module sync failed: ${e.message}`, type: 'error', timestamp: new Date().toLocaleTimeString() }])
            setSyncingModules(false)
        }
    }

    const handleRunMigrationSync = async (env: 'local' | 'prod') => {
        setLogs(prev => [...prev, { message: `Running database migration sync for ${env}...`, type: 'info', timestamp: new Date().toLocaleTimeString() }])
        try {
            await window.api.runMigrationSync(config, env)
            setLogs(prev => [...prev, { message: `Database migration sync for ${env} completed.`, type: 'success', timestamp: new Date().toLocaleTimeString() }])
            checkDbHealth()
        } catch (e: any) {
            setLogs(prev => [...prev, { message: `Database migration sync for ${env} failed: ${e.message}`, type: 'error', timestamp: new Date().toLocaleTimeString() }])
        }
    }

    const handleRunDbSetup = async (env: 'local' | 'prod') => {
        setLogs(prev => [...prev, { message: `Initializing database for ${env}...`, type: 'info', timestamp: new Date().toLocaleTimeString() }])
        try {
            await window.api.runDbSetup(config, env)
            setLogs(prev => [...prev, { message: `Database initialization for ${env} completed.`, type: 'success', timestamp: new Date().toLocaleTimeString() }])
            checkDbHealth()
        } catch (e: any) {
            setLogs(prev => [...prev, { message: `Database initialization for ${env} failed: ${e.message}`, type: 'error', timestamp: new Date().toLocaleTimeString() }])
        }
    }

    // Helper for rendering
    const renderStatusBadge = (status: 'Ready' | 'Empty' | 'Error' | 'Checking' | 'Running' | 'Stopped') => {
        const colors = {
            'Ready': 'bg-green-900/20 text-green-400 border-green-500/20',
            'Running': 'bg-green-900/20 text-green-400 border-green-500/20',
            'Empty': 'bg-yellow-900/20 text-yellow-400 border-yellow-500/20',
            'Error': 'bg-red-900/20 text-red-400 border-red-500/20',
            'Stopped': 'bg-gray-800 text-gray-400 border-gray-700',
            'Checking': 'bg-blue-900/20 text-blue-400 border-blue-500/20 animate-pulse'
        }
        return (
            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${colors[status]}`}>
                {status}
            </span>
        )
    }

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
            {/* Header */}
            <header className="bg-gray-900/50 backdrop-blur border-b border-gray-800 p-6">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Activity className="w-8 h-8 text-blue-500" />
                            {config.projectName}
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">Project Command Center</p>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setShowConfigModal(true)}
                            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-all flex items-center gap-2 border border-gray-700"
                        >
                            <Info className="w-4 h-4" />
                            Detailed Config
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full p-8 space-y-8">
                {/* Top Row: Full-width Config Summary */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-800 pb-4">
                        <Globe className="w-5 h-5 text-blue-400" />
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                            Site Configuration Summary
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8">
                        <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Public Domain</div>
                            <div className="text-sm text-white font-medium truncate" title={config.publicDomain}>{config.publicDomain}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Admin Domain</div>
                            <div className="text-sm text-white font-medium truncate" title={config.adminDomain}>{config.adminDomain}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">API Domain</div>
                            <div className="text-sm text-white font-medium truncate" title={config.apiDomain}>{config.apiDomain}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">AWS Region</div>
                            <div className="text-sm text-white font-medium">{config.awsRegion}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">AWS Profile</div>
                            <div className="text-sm text-white font-medium">{config.awsProfile}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Access Key ID</div>
                            <div className="text-sm text-white font-medium truncate" title={config.advanced.AWS_ACCESS_KEY_ID}>{config.advanced.AWS_ACCESS_KEY_ID || 'Not set'}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Secret Access Key</div>
                            <div className="text-sm text-white font-medium">{config.advanced.AWS_SECRET_ACCESS_KEY ? '••••••••••••••••' : 'Not set'}</div>
                        </div>
                    </div>
                </div>

                {/* Middle Grid: Controls */}
                <div className="grid grid-cols-12 gap-8">
                    {/* Left Column: Modules Summary */}
                    <div className="col-span-12 lg:col-span-3">
                        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-xl h-full">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <PlusCircle className="w-4 h-4 text-purple-400" />
                                    Modules
                                </h2>
                                <button
                                    onClick={handleOpenModuleManagement}
                                    className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                                    title="Manage Modules"
                                >
                                    <Settings2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-2">
                                {config.modules.map(modId => {
                                    const mod = AVAILABLE_MODULES.find(m => m.id === modId)
                                    return (
                                        <div key={modId} className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800/30 px-3 py-2 rounded border border-gray-800/50">
                                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                            {mod?.name || modId}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Middle Column: Controls */}
                    <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
                        {/* Deployment Card */}
                        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-xl">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Server className="w-5 h-5 text-blue-400" />
                                    Deployment
                                </h2>
                                <button
                                    onClick={handleOpenAwsStatus}
                                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1.5 font-medium transition-colors"
                                >
                                    <Cloud className="w-4 h-4" />
                                    AWS Infra
                                </button>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                <button
                                    onClick={() => handleDeployProject('all')}
                                    disabled={!!deploying}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                                >
                                    {deploying === 'all' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                                    {deploying === 'all' ? 'Deploying Everything...' : 'Deploy All Projects'}
                                </button>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['api', 'admin', 'public'] as const).map(target => (
                                        <button
                                            key={target}
                                            onClick={() => handleDeployProject(target)}
                                            disabled={!!deploying}
                                            className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider border border-gray-700 transition-all"
                                        >
                                            {deploying === target ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : target}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Development Card */}
                        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-xl">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Wrench className="w-5 h-5 text-orange-400" />
                                Development
                            </h2>
                            <div className="space-y-4">
                                <button
                                    onClick={handleStartAllDev}
                                    className="w-full bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/30 font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
                                >
                                    <Play className="w-5 h-5" />
                                    Start All Dev Servers
                                </button>

                                <div className="space-y-3 pt-2">
                                    {(['api', 'admin', 'public'] as const).map(service => (
                                        <div key={service} className="bg-gray-800/30 rounded-lg p-3 border border-gray-800/50 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="uppercase text-[10px] font-bold text-gray-500 tracking-widest">{service}</div>
                                                {renderStatusBadge(devStatus[service])}
                                            </div>
                                            <div className="flex gap-1">
                                                {devStatus[service] === 'Running' ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleRestartDev(service)}
                                                            className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                                                            title="Restart"
                                                        >
                                                            <RefreshCw className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleStopDev(service)}
                                                            className="p-1.5 hover:bg-red-900/30 rounded text-gray-400 hover:text-red-400 transition-colors"
                                                            title="Stop"
                                                        >
                                                            <Square className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => handleRestartDev(service)}
                                                        className="p-1.5 hover:bg-green-900/30 rounded text-gray-400 hover:text-green-400 transition-colors"
                                                        title="Start"
                                                    >
                                                        <Play className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Health & Links */}
                    <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                        {/* Database Health Card */}
                        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-xl">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <Database className="w-4 h-4 text-green-400" />
                                    Database Health
                                </h2>
                                <button 
                                    onClick={checkDbHealth}
                                    disabled={refreshingDb}
                                    className={`p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors ${refreshingDb ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    title="Refresh Status"
                                >
                                    <RefreshCw className={`w-4 h-4 ${refreshingDb ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-800/50">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-gray-400">Local (Postgres)</span>
                                        <div className="flex items-center gap-1.5">
                                            {dbHealthLocal.initialized ? (
                                                <>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                    <span className="text-[10px] font-bold text-green-500 uppercase">Ready</span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${dbHealthLocal.reason === 'Checking...' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`} />
                                                    <span className={`text-[10px] font-bold uppercase ${dbHealthLocal.reason === 'Checking...' ? 'text-blue-500' : 'text-red-500'}`}>
                                                        {dbHealthLocal.reason === 'Checking...' ? 'Loading' : 'Action Required'}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {!dbHealthLocal.initialized && dbHealthLocal.reason !== 'Checking...' && (
                                        <div className="flex flex-col gap-2 mt-2">
                                            <div className="text-[10px] text-gray-500 italic">
                                                {dbHealthLocal.reason}
                                            </div>
                                            <button 
                                                onClick={() => handleRunDbSetup('local')}
                                                className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-[10px] font-bold py-1.5 rounded uppercase border border-blue-600/30 transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <Wrench className="w-3 h-3" />
                                                Fix it
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-800/50">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-gray-400">Prod (Cockroach)</span>
                                        <div className="flex items-center gap-1.5">
                                            {dbHealthProd.initialized ? (
                                                <>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                    <span className="text-[10px] font-bold text-green-500 uppercase">Ready</span>
                                                </>
                                            ) : (
                                                <>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${dbHealthProd.reason === 'Checking...' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`} />
                                                    <span className={`text-[10px] font-bold uppercase ${dbHealthProd.reason === 'Checking...' ? 'text-blue-500' : 'text-red-500'}`}>
                                                        {dbHealthProd.reason === 'Checking...' ? 'Loading' : 'Action Required'}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {!dbHealthProd.initialized && dbHealthProd.reason !== 'Checking...' && (
                                        <div className="flex flex-col gap-2 mt-2">
                                            <div className="text-[10px] text-gray-500 italic">
                                                {dbHealthProd.reason}
                                            </div>
                                            <button 
                                                onClick={() => handleRunDbSetup('prod')}
                                                className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-[10px] font-bold py-1.5 rounded uppercase border border-blue-600/30 transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <Wrench className="w-3 h-3" />
                                                Fix it
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 border-t border-gray-800 pt-4 mt-2">
                                    <button 
                                        onClick={() => handleRunMigrationSync('local')}
                                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-[10px] font-bold py-2 rounded uppercase transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        Sync Local
                                    </button>
                                    <button 
                                        onClick={() => handleRunMigrationSync('prod')}
                                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-[10px] font-bold py-2 rounded uppercase transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <RefreshCw className="w-3 h-3" />
                                        Sync Prod
                                    </button>
                                </div>
                            </div>
                        </div>
                        {/* Live Deployments Card */}
                        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 shadow-xl">
                            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                Live Sites
                            </h2>
                            <div className="grid grid-cols-1 gap-2">
                                <a
                                    href={`https://${config.publicDomain}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-between transition-all group"
                                >
                                    <span className="text-xs font-semibold">Public Site</span>
                                    <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-blue-400" />
                                </a>
                                <a
                                    href={`https://${config.adminDomain}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-between transition-all group"
                                >
                                    <span className="text-xs font-semibold">Admin Panel</span>
                                    <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-blue-400" />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Row: Logs (Full Width) */}
                <div className="bg-gray-900 rounded-xl border border-gray-800 flex flex-col h-[400px] overflow-hidden shadow-2xl relative">
                    <div className="bg-gray-800/50 p-4 border-b border-gray-700 flex justify-between items-center">
                        <h2 className="text-sm font-semibold flex items-center gap-2 text-gray-300">
                            <Terminal className="w-4 h-4" />
                            Project Activity & Deployment Logs
                        </h2>
                        <button 
                            onClick={() => setLogs([])}
                            className="text-xs text-gray-500 hover:text-white transition-colors"
                        >
                            Clear Logs
                        </button>
                    </div>
                    <div className="flex-1 p-4 font-mono text-[11px] overflow-y-auto bg-black/40 custom-scrollbar">
                        {logs.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-gray-600 italic">No activity logs recorded. Activity logs will appear here during deployment or module synchronization.</div>
                        ) : (
                            logs.map((log, i) => (
                                <div key={i} className={`mb-1.5 break-words leading-relaxed ${
                                    log.type === 'error' ? 'text-red-400' :
                                    log.type === 'success' ? 'text-green-400' : 'text-gray-400'
                                }`}>
                                    <span className="text-gray-600 mr-2 opacity-50">[{log.timestamp || i}]</span>
                                    {log.message}
                                </div>
                            ))
                        )}
                        <div ref={logEndRef} />
                    </div>
                </div>

                {/* Detailed Config Modal */}
                {showConfigModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 z-50 animate-in fade-in duration-200">
                        <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-200">
                            <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 p-6 flex justify-between items-center z-10">
                                <h2 className="text-xl font-bold text-white flex items-center">
                                    <ClipboardList className="w-6 h-6 mr-3 text-blue-400" />
                                    Detailed Configuration Listing
                                </h2>
                                <button 
                                    onClick={() => setShowConfigModal(false)}
                                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-8">
                                <ConfigDetails config={config} />
                            </div>
                        </div>
                    </div>
                )}

                {/* AWS Status Modal */}
                {showAwsStatus && awsStatus && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 z-50 animate-in fade-in duration-200">
                        <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-200">
                            <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 p-6 flex justify-between items-center z-10">
                                <h2 className="text-xl font-bold text-white flex items-center">
                                    <Cloud className="w-6 h-6 mr-3 text-purple-400" />
                                    AWS Deployment Status
                                </h2>
                                <button 
                                    onClick={() => setShowAwsStatus(false)}
                                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="space-y-4">
                                    {(() => {
                                        const AWS_DEPENDENCIES: Record<string, string[]> = {
                                            'API Lambda': ['Lambda Role', 'Deployment Bucket'],
                                            'API Distribution': ['API Lambda', 'SSL Certificate'],
                                            'Admin Distribution': ['Admin Site Bucket', 'SSL Certificate'],
                                            'Public Distribution': ['Public Site Bucket', 'SSL Certificate']
                                        }

                                        return awsStatus.map((item, idx) => {
                                            const missingDeps = (AWS_DEPENDENCIES[item.name] || []).filter(depName => {
                                                const dep = awsStatus!.find(s => s.name === depName)
                                                return !dep || dep.status !== 'Exists'
                                            })
                                            const hasMissingDeps = missingDeps.length > 0

                                            return (
                                                <div key={idx} className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex justify-between items-center">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-sm font-semibold text-white">{item.name}</span>
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">{item.type}</span>
                                                        </div>
                                                        <div className="text-xs text-gray-500 font-mono">{item.id}</div>
                                                        {hasMissingDeps && item.status !== 'Exists' && (
                                                            <div className="mt-2 flex flex-wrap gap-1">
                                                                <span className="text-[10px] text-gray-500 uppercase font-bold mr-1">Requires:</span>
                                                                {missingDeps.map(dep => (
                                                                    <span key={dep} className="text-[10px] bg-red-900/20 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20">
                                                                        {dep}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <div className={`flex items-center gap-2 text-sm font-semibold ${
                                                            item.status === 'Exists' ? 'text-green-400' :
                                                            item.status === 'Missing' ? 'text-yellow-400' : 
                                                            item.status === 'Loading' ? 'text-blue-400' :
                                                            'text-red-400'
                                                        }`}>
                                                            {item.status === 'Exists' && <Check className="w-4 h-4" />}
                                                            {item.status === 'Missing' && <X className="w-4 h-4" />}
                                                            {item.status === 'Error' && <X className="w-4 h-4" />}
                                                            {item.status === 'Loading' && <RefreshCw className="w-4 h-4 animate-spin" />}
                                                            {item.status}
                                                        </div>
                                                        {item.status === 'Missing' && (
                                                            <button
                                                                onClick={() => handleFix(item)}
                                                                disabled={fixing === item.id || (item.type === 'Lambda' && !!deploying) || hasMissingDeps}
                                                                className={`mt-2 px-3 py-1 bg-yellow-600/20 text-yellow-500 rounded border border-yellow-600/50 hover:bg-yellow-600/30 transition-colors text-xs flex items-center gap-1 ml-auto ${hasMissingDeps ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                                                                title={hasMissingDeps ? `Prerequisites missing: ${missingDeps.join(', ')}` : ''}
                                                            >
                                                                {item.type === 'Lambda' ? (
                                                                    <PlusCircle className={`w-3 h-3 ${deploying === 'api' ? 'animate-spin' : ''}`} />
                                                                ) : (
                                                                    <Wrench className={`w-3 h-3 ${fixing === item.id ? 'animate-spin' : ''}`} />
                                                                )}
                                                                {item.type === 'Lambda' ? (deploying === 'api' ? 'Deploying...' : 'Deploy') : (fixing === item.id ? 'Fixing...' : 'Fix')}
                                                            </button>
                                                        )}
                                                        {item.details && item.status === 'Exists' && (
                                                            <div className="text-xs text-gray-500 mt-1">{item.details}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Module Management Modal */}
                {showModulesModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 z-50 animate-in fade-in duration-200">
                        <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-200">
                            <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 p-6 flex justify-between items-center z-10">
                                <h2 className="text-xl font-bold text-white flex items-center">
                                    <Settings2 className="w-6 h-6 mr-3 text-purple-400" />
                                    Manage Project Modules
                                </h2>
                                <button 
                                    onClick={() => !syncingModules && setShowModulesModal(false)}
                                    disabled={syncingModules}
                                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white disabled:opacity-50"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg text-sm text-yellow-200 flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold">Important Notes:</p>
                                        <ul className="list-disc ml-4 mt-1 space-y-1 opacity-90">
                                            <li>Disabling a module will delete its source directories and remove its repository entries.</li>
                                            <li>Enabling a module will add its repositories and run installation scripts.</li>
                                            <li>The installation process can take several minutes.</li>
                                        </ul>
                                    </div>
                                </div>
                                
                                <ModuleSelector 
                                    selectedModules={pendingModules} 
                                    onToggle={togglePendingModule}
                                    disabled={syncingModules}
                                />

                                <div className="mt-8 pt-6 border-t border-gray-800 flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowModulesModal(false)}
                                        disabled={syncingModules}
                                        className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveModules}
                                        disabled={syncingModules}
                                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {syncingModules ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                Syncing Modules...
                                            </>
                                        ) : (
                                            'Save Changes'
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
