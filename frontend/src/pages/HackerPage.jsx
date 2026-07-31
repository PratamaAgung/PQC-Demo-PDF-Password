import React, { useState, useEffect, useRef } from 'react'
import { Skull, Upload, Zap, StopCircle, Eye, Terminal, Power, Cpu } from 'lucide-react'
import axios from 'axios'

function HackerPage() {
  const [file, setFile] = useState(null)
  const [fileId, setFileId] = useState(null)
  const [maxDigits, setMaxDigits] = useState(4)
  const [cracking, setCracking] = useState(false)
  const [progress, setProgress] = useState(null)
  const [logs, setLogs] = useState([])
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showPdf, setShowPdf] = useState(false)
  const [gpuStatus, setGpuStatus] = useState(null)
  const [gpuLoading, setGpuLoading] = useState(false)
  const logRef = useRef(null)
  const pollRef = useRef(null)

  const addLog = (msg, type = 'info') => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg, type }])
  }

  // Check GPU status on mount
  useEffect(() => {
    checkGpuStatus()
  }, [])

  const checkGpuStatus = async () => {
    try {
      const res = await axios.get('/api/gpu/status')
      setGpuStatus(res.data)
    } catch (err) {
      setGpuStatus({ status: 'error', message: 'Tidak bisa cek status GPU' })
    }
  }

  const toggleGpu = async () => {
    setGpuLoading(true)
    try {
      if (gpuStatus?.status === 'running') {
        await axios.post('/api/gpu/stop')
        addLog('GPU worker dimatikan', 'warning')
      } else {
        await axios.post('/api/gpu/start')
        addLog('GPU worker dinyalakan (~2-3 menit)...', 'quantum')
      }
      // Poll status until changed
      setTimeout(checkGpuStatus, 3000)
    } catch (err) {
      addLog('Gagal mengontrol GPU worker', 'error')
    } finally {
      setGpuLoading(false)
    }
  }

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setError('')
    setLogs([])
    setProgress(null)
    setShowPdf(false)

    const formData = new FormData()
    formData.append('file', file)

    try {
      addLog('Uploading dokumen target...', 'info')
      const response = await axios.post('/api/pdf/upload-locked', formData)
      setFileId(response.data.file_id)
      addLog('Dokumen berhasil di-upload', 'success')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Upload gagal'
      setError(msg)
      addLog(msg, 'error')
    } finally {
      setUploading(false)
    }
  }

  const startCrack = async () => {
    if (!fileId) return
    setCracking(true)
    setProgress(null)
    setError('')
    setShowPdf(false)

    const keyspace = Math.pow(10, maxDigits)
    const groverIters = Math.ceil(Math.sqrt(keyspace) * Math.PI / 4)

    addLog('', 'divider')
    addLog('MEMULAI SERANGAN QUANTUM (Grover\'s Algorithm)', 'quantum')
    addLog(`Mencari password dari ${keyspace.toLocaleString()} kemungkinan...`, 'info')
    addLog(`Komputer klasik butuh rata-rata ~${(keyspace/2).toLocaleString()} percobaan`, 'warning')
    addLog(`Quantum computer butuh ~${groverIters} percobaan`, 'quantum')
    addLog('', 'divider')

    try {
      const response = await axios.post('/api/grover/start-crack', {
        file_id: fileId,
        max_digits: maxDigits,
      })

      addLog('Quantum search berjalan...', 'quantum')

      // Start polling for progress
      pollRef.current = setInterval(async () => {
        try {
          const prog = await axios.get(`/api/grover/progress/${response.data.session_id}`)
          setProgress(prog.data)

          if (prog.data.status === 'found') {
            clearInterval(pollRef.current)
            setCracking(false)
            addLog('', 'divider')
            addLog(`PASSWORD DITEMUKAN: ${prog.data.password_found}`, 'success')
            addLog(`Quantum: ${prog.data.iterations_grover} percobaan`, 'quantum')
            addLog(`Klasik (rata-rata): ~${prog.data.iterations_classical.toLocaleString()} percobaan`, 'warning')
            if (prog.data.speedup && prog.data.speedup > 0) {
              addLog(`${Math.round(prog.data.speedup)}x lebih cepat dengan quantum!`, 'quantum')
            }
          } else if (prog.data.status === 'not_found' || prog.data.status === 'cancelled') {
            clearInterval(pollRef.current)
            setCracking(false)
            addLog('Pencarian dihentikan', 'warning')
          }
        } catch (err) {
          // Ignore polling errors
        }
      }, 500)
    } catch (err) {
      setCracking(false)
      const msg = err.response?.data?.detail || 'Gagal memulai'
      setError(msg)
      addLog(msg, 'error')
    }
  }

  const cancelCrack = async () => {
    if (fileId && pollRef.current) {
      clearInterval(pollRef.current)
      try {
        await axios.post(`/api/grover/cancel/${fileId}`)
        addLog('Serangan dihentikan', 'warning')
      } catch (err) {
        // ignore
      }
      setCracking(false)
    }
  }

  const viewUnlocked = () => {
    setShowPdf(true)
  }

  const pdfPreviewUrl = (fileId && progress?.password_found)
    ? `/api/pdf/view/${fileId}?password=${encodeURIComponent(progress.password_found)}`
    : null

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600/20 rounded-2xl mb-4 quantum-glow">
          <Skull size={32} className="text-red-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-red-300">Serangan Quantum</h2>
        <p className="text-gray-400">
          Simulasi: Quantum computer membobol password dokumen
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Controls */}
        <div className="space-y-4">
          {/* GPU Control */}
          <div className="glass-card border-purple-900/30">
            <h3 className="text-sm font-medium text-purple-300 mb-3 flex items-center gap-2">
              <Cpu size={16} />
              GPU Worker (NVIDIA T4)
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${
                  gpuStatus?.status === 'running' ? 'text-green-400' :
                  gpuStatus?.status === 'starting' ? 'text-yellow-400' :
                  'text-gray-500'
                }`}>
                  {gpuStatus?.status === 'running' ? '● Aktif' :
                   gpuStatus?.status === 'starting' ? '◐ Menyalakan...' :
                   '○ Mati'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {gpuStatus?.status === 'running'
                    ? 'Password hingga 8 digit'
                    : gpuStatus?.status === 'stopped'
                    ? 'Nyalakan untuk crack password lebih panjang'
                    : gpuStatus?.message || ''}
                </p>
              </div>
              <button
                onClick={toggleGpu}
                disabled={gpuLoading || gpuStatus?.status === 'starting'}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  gpuStatus?.status === 'running'
                    ? 'bg-red-600/20 text-red-300 hover:bg-red-600/30'
                    : 'bg-green-600/20 text-green-300 hover:bg-green-600/30'
                } disabled:opacity-50`}
              >
                <Power size={14} />
                {gpuLoading ? '...' : gpuStatus?.status === 'running' ? 'Matikan' : 'Nyalakan'}
              </button>
            </div>
            {gpuStatus?.status === 'running' && (
              <p className="text-xs text-yellow-400/70 mt-2">
                ⚡ ~$0.53/jam — matikan setelah demo selesai
              </p>
            )}
          </div>

          {/* Upload Section */}
          <div className="glass-card border-red-900/30">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              1. Upload dokumen terkunci
            </h3>
            <div className="border-2 border-dashed border-red-900/50 rounded-xl p-6 text-center hover:border-red-500 transition-colors">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => { setFile(e.target.files[0]); setFileId(null); setProgress(null); setShowPdf(false); }}
                className="hidden"
                id="hacker-upload"
              />
              <label htmlFor="hacker-upload" className="cursor-pointer">
                <Upload size={24} className="mx-auto text-gray-600 mb-2" />
                {file ? (
                  <p className="text-red-400 font-medium text-sm">{file.name}</p>
                ) : (
                  <p className="text-gray-600 text-sm">Pilih PDF terkunci</p>
                )}
              </label>
            </div>
            <button
              onClick={handleUpload}
              disabled={!file || uploading || !!fileId}
              className="btn-danger w-full mt-3 text-sm"
            >
              {uploading ? 'Uploading...' : fileId ? '✓ Siap' : 'Upload'}
            </button>
          </div>

          {/* Attack Section */}
          <div className="glass-card border-red-900/30">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              2. Jalankan serangan
            </h3>
            <div className="mb-3">
              <label className="block text-xs text-gray-400 mb-1">Panjang Password</label>
              <select
                value={maxDigits}
                onChange={(e) => setMaxDigits(Number(e.target.value))}
                className="input-field text-sm"
                disabled={cracking}
              >
                <option value={2}>2 digit (100 kemungkinan)</option>
                <option value={3}>3 digit (1,000 kemungkinan)</option>
                <option value={4}>4 digit (10,000 kemungkinan)</option>
                {gpuStatus?.status === 'running' && (
                  <>
                    <option value={5}>5 digit (100,000) — GPU ⚡</option>
                    <option value={6}>6 digit (1,000,000) — GPU ⚡</option>
                  </>
                )}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={startCrack}
                disabled={!fileId || cracking}
                className="btn-danger flex-1 flex items-center justify-center gap-2"
              >
                <Zap size={16} />
                {cracking ? 'Membobol...' : 'Mulai Serangan Quantum'}
              </button>
              {cracking && (
                <button onClick={cancelCrack} className="btn-primary flex items-center gap-2 px-3">
                  <StopCircle size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Progress */}
          {progress && cracking && (
            <div className="glass-card border-purple-900/30">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>Progress</span>
                <span>{progress.progress_percent?.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-purple-500 to-red-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, progress.progress_percent || 0)}%` }}
                />
              </div>
            </div>
          )}

          {/* Result */}
          {progress?.status === 'found' && (
            <div className="glass-card border-green-900/30">
              <h3 className="text-lg font-bold text-green-300 mb-4">🎉 Password Ditemukan!</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/30 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-green-400 font-mono">{progress.password_found}</p>
                  <p className="text-xs text-gray-500 mt-1">Password</p>
                </div>
                <div className="bg-black/30 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-purple-400">
                    {progress.speedup ? `${Math.round(progress.speedup)}x` : '-'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Lebih Cepat</p>
                </div>
                <div className="bg-black/30 rounded-lg p-4 text-center">
                  <p className="text-xl font-bold text-purple-300">{progress.iterations_grover}</p>
                  <p className="text-xs text-gray-500 mt-1">Percobaan Quantum</p>
                </div>
                <div className="bg-black/30 rounded-lg p-4 text-center">
                  <p className="text-xl font-bold text-yellow-300">{progress.iterations_classical?.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 mt-1">Percobaan Klasik</p>
                </div>
              </div>
              <button
                onClick={viewUnlocked}
                className="btn-success w-full mt-4 flex items-center justify-center gap-2"
              >
                <Eye size={16} />
                Lihat Dokumen
              </button>
            </div>
          )}
        </div>

        {/* Right Panel - Console */}
        <div className="glass-card border-green-900/30 flex flex-col" style={{ minHeight: '450px' }}>
          <h3 className="text-sm font-medium text-green-300 mb-3 flex items-center gap-2">
            <Terminal size={16} />
            Log Serangan
          </h3>
          <div
            ref={logRef}
            className="flex-1 bg-black/60 rounded-lg p-4 font-mono text-xs overflow-auto"
          >
            {logs.length === 0 && (
              <p className="text-gray-600">
                {'>'} Menunggu target...<br />
              </p>
            )}
            {logs.map((log, i) => (
              <div key={i} className={`mb-1 ${
                log.type === 'divider' ? 'border-t border-gray-800 my-2' :
                log.type === 'error' ? 'text-red-400' :
                log.type === 'success' ? 'text-green-400 font-bold' :
                log.type === 'warning' ? 'text-yellow-400' :
                log.type === 'quantum' ? 'text-purple-400' :
                'text-gray-400'
              }`}>
                {log.type !== 'divider' && (
                  <>
                    <span className="text-gray-600">[{log.time}]</span>{' '}
                    {log.msg}
                  </>
                )}
              </div>
            ))}
            {cracking && (
              <span className="text-green-500 animate-pulse">▊</span>
            )}
          </div>
        </div>
      </div>

      {/* PDF Preview */}
      {showPdf && pdfPreviewUrl && (
        <div className="mt-6 glass-card border-green-900/30">
          <h3 className="text-lg font-bold text-green-300 mb-4 flex items-center gap-2">
            <Eye size={20} />
            Dokumen Berhasil Dibuka
          </h3>
          <div className="rounded-lg overflow-hidden bg-white">
            <iframe
              src={pdfPreviewUrl}
              className="w-full"
              style={{ height: '600px' }}
              title="Unlocked PDF Preview"
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-900/30 border border-red-700/50 rounded-lg p-4 text-red-300 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}

export default HackerPage
