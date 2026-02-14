import { MemoryRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Prerequisites } from './pages/Prerequisites'
import { ConfigProject } from './pages/ConfigProject'
import { ConfigModules } from './pages/ConfigModules'
import { ConfigDatabase } from './pages/ConfigDatabase'

import { ConfigAWS } from './pages/ConfigAWS'
import { ConfigOverview } from './pages/ConfigOverview'
import { Install } from './pages/Install'
import { SelectMode } from './pages/SelectMode'
import { Manage } from './pages/Manage'
import { InstallerProvider } from './context/InstallerContext'

function App(): JSX.Element {
  return (
    <InstallerProvider>
      <Router>
        <div className="min-h-screen bg-gray-900 text-white font-sans selection:bg-blue-500/30">
          <Routes>
            <Route path="/" element={<Navigate to="/prerequisites" replace />} />
            <Route path="/prerequisites" element={<Prerequisites />} />
            <Route path="/select-mode" element={<SelectMode />} />
            <Route path="/config" element={<ConfigProject />} />
            <Route path="/config/modules" element={<ConfigModules />} />
            <Route path="/config/db" element={<ConfigDatabase />} />

            <Route path="/config/aws" element={<ConfigAWS />} />
            <Route path="/config/overview" element={<ConfigOverview />} />
            <Route path="/install" element={<Install />} />
            <Route path="/manage" element={<Manage />} />
          </Routes>

        </div>
      </Router>
    </InstallerProvider>
  )
}


export default App
