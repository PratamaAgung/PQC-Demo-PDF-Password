import React from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Lock, Shield, Skull, BookOpen } from 'lucide-react'
import LockPage from './pages/LockPage'
import VerifyPage from './pages/VerifyPage'
import HackerPage from './pages/HackerPage'
import LearnPage from './pages/LearnPage'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Shield size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold">Quantum Threat Demo</h1>
                <p className="text-xs text-gray-400">Post-Quantum Cryptography</p>
              </div>
            </div>
            <nav className="flex gap-1">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                    isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Lock size={16} />
                Kunci
              </NavLink>
              <NavLink
                to="/verify"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                    isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Shield size={16} />
                Verifikasi
              </NavLink>
              <NavLink
                to="/hacker"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                    isActive ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Skull size={16} />
                Serangan
              </NavLink>
              <NavLink
                to="/learn"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                    isActive ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <BookOpen size={16} />
                Penjelasan
              </NavLink>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<LockPage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/hacker" element={<HackerPage />} />
            <Route path="/learn" element={<LearnPage />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/10 py-4 text-center text-xs text-gray-500">
          Demo Edukasi — Simulasi Ancaman Quantum Computing
        </footer>
      </div>
    </BrowserRouter>
  )
}

export default App
