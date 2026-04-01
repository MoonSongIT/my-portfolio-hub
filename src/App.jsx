import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Portfolio from './pages/Portfolio'
import Research from './pages/Research'
import Watchlist from './pages/Watchlist'
import Reports from './pages/Reports'
import Header from './components/common/Header'
import Sidebar from './components/common/Sidebar'

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/research" element={<Research />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/reports" element={<Reports />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
