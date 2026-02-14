
export function AppHeader(): JSX.Element {
  return (
    <header className="fixed top-0 w-full z-50 bg-gray-900 border-b border-gray-700 h-32 flex items-center overflow-hidden">
      {/* Background Placeholder */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-900/40 via-purple-900/20 to-gray-900/50"></div>
      
      {/* Content */}
      <div className="container mx-auto px-4 relative z-10 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">
            ATP Framework Installer
          </h1>
          <p className="text-blue-200/80 text-sm font-medium mt-1 drop-shadow-sm">
            Automated Deployment & Configuration
          </p>
        </div>
        <div className="text-xs text-gray-400 font-mono bg-black/30 px-2 py-1 rounded border border-white/10">v1.0.0</div>
      </div>
    </header>
  )
}
