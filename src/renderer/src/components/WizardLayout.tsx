import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from './AppHeader'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface WizardLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
  backLink?: string
  nextLink?: string
  nextLabel?: string
  isNextDisabled?: boolean
  onNextClick?: (e: React.MouseEvent) => void
}

export function WizardLayout({
  children,
  title,
  subtitle,
  backLink,
  nextLink,
  nextLabel = 'Next',
  isNextDisabled = false,
  onNextClick
}: WizardLayoutProps): JSX.Element {
  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-white">
      <AppHeader />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl pt-40">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-800">
          <div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            {subtitle && <p className="text-gray-400 mt-1">{subtitle}</p>}
          </div>

          <div className="flex gap-3">
            {backLink ? (
              <Link
                to={backLink}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </Link>
            ) : (
                <div className="w-20" /> // Spacer
            )}
            
            {nextLink ? (
                <Link
                to={nextLink}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                  isNextDisabled
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                onClick={(e) => {
                    if (isNextDisabled) e.preventDefault()
                    if (onNextClick) onNextClick(e)
                }}
              >
                {nextLabel}
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
                 <div className="w-20" /> // Spacer
            )}
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
        </div>
      </main>
    </div>
  )
}
