import { useEffect, useState } from 'react'
import { CheckResult } from '../../../shared/types'
import { PrerequisiteCheck } from '../components/PrerequisiteCheck'
import { WizardLayout } from '../components/WizardLayout'
import { useInstaller } from '../context/InstallerContext'

export function Prerequisites(): JSX.Element {
  const { uiState, updateUIState } = useInstaller()
  const { checks } = uiState
  const [isLoading, setIsLoading] = useState(checks.length === 0)

  const runChecks = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const results = await window.api.checkPrerequisites()
      updateUIState({ checks: results })
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (checks.length === 0) {
      runChecks()
    } else {
      setIsLoading(false)
    }
  }, [])

  const allPassed = checks.every((c: CheckResult) => c.installed)

  return (
    <WizardLayout
      title="System Requirements"
      subtitle="Checking if your system has the necessary tools installed."
      nextLink="/select-mode"
      nextLabel="Next: Select Mode"
      isNextDisabled={!allPassed}
    >
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center text-gray-400 py-12">Running checks...</div>
        ) : (
          checks.map((check: CheckResult) => (
            <PrerequisiteCheck key={check.tool} check={check} onRefresh={runChecks} />
          ))
        )}
      </div>
    </WizardLayout>
  )
}

