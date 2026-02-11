import { useEffect, useState } from 'react'
import { useInstaller } from '../context/InstallerContext'
import { TerminalView } from '../components/TerminalView'
import { LogMessage } from '../env.d'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { WizardLayout } from '../components/WizardLayout'

export function Install(): JSX.Element {
  const { config } = useInstaller()
  const [started, setStarted] = useState(false)
  const [complete, setComplete] = useState(false)
  const [success, setSuccess] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [deployComplete, setDeployComplete] = useState(false)
  const [deploySuccess, setDeploySuccess] = useState(false)
  const [logs, setLogs] = useState<LogMessage[]>([])

  useEffect(() => {
    // Listen for logs
    const unsubscribeLogs = window.api.onLog((log) => {
      setLogs((prev) => [...prev, log])
    })

    // Listen for completion
    const unsubscribeComplete = window.api.onComplete((isSuccess) => {
      setComplete(true)
      setSuccess(isSuccess)
    })

    const unsubscribeDeploy = window.api.onDeployComplete((isSuccess) => {
      setDeployComplete(true)
      setDeploySuccess(isSuccess)
    })

    return () => {
      unsubscribeLogs()
      unsubscribeComplete()
      unsubscribeDeploy()
    }
  }, [])

  const startInstall = (): void => {
    setStarted(true)
    setLogs([{ message: 'Initializing installation...', type: 'info' }])
    window.api.startInstall(config)
  }

  const startDeploy = (): void => {
    setDeploying(true)
    setLogs((prev) => [...prev, { message: 'Starting deployment to AWS...', type: 'info' }])
    window.api.startDeploy(config)
  }


  return (
    <WizardLayout
      title="Installation"
      backLink={!started ? "/config/aws" : undefined}
    >
      <div className="space-y-6">
        {!started ? (
          <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700 text-center">
            <h3 className="text-xl font-semibold text-white mb-2">Ready to Install</h3>
            <p className="text-gray-400 mb-6">
              We are about to install <strong>{config.projectName}</strong> to <code>{config.destination}</code>.
              <br />
              This will clone the repositories, install dependencies, and setup your local database.
            </p>
            <button
              onClick={startInstall}
              className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-lg transition-colors shadow-lg hover:shadow-green-500/20"
            >
              Start Installation
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                {complete ? (
                  success ? <CheckCircle className="w-8 h-8 text-green-500" /> : <XCircle className="w-8 h-8 text-red-500" />
                ) : (
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                )}
                <div>
                  <div className="font-semibold text-lg text-white">
                    {complete ? (success ? 'Installation Complete' : 'Installation Failed') : 'Installing...'}
                  </div>
                  <div className="text-sm text-gray-400">
                    {complete ? 'Check the logs below for details.' : 'Please wait while we set up your environment.'}
                  </div>
                </div>
              </div>
            </div>

            <TerminalView logs={logs} />

            {complete && success && (
              <div className="flex justify-end gap-4">
                {!deploying && !deployComplete ? (
                    <button 
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
                    onClick={startDeploy}
                  >
                    Deploy to AWS
                  </button>
                ) : deployComplete ? (
                   <div className="text-green-500 font-semibold self-center">Deployment {deploySuccess ? 'Success' : 'Failed'}</div>
                ) : (
                  <div className="text-blue-400 font-semibold self-center">Deploying...</div>
                )}
                
                <button 
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  onClick={() => window.location.reload()} // Reset for now
                >
                  Start Over
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </WizardLayout>
  )
}

