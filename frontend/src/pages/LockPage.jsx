import React, { useState } from 'react'
import { Lock, Upload, Download, CheckCircle } from 'lucide-react'
import axios from 'axios'

function LockPage() {
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleLock = async (e) => {
    e.preventDefault()
    if (!file || !password) {
      setError('Pilih file PDF dan masukkan password')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('password', password)

    try {
      const response = await axios.post('/api/pdf/lock', formData)
      setResult(response.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (result?.file_id) {
      window.open(`/api/pdf/download/${result.file_id}`, '_blank')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 rounded-2xl mb-4">
          <Lock size={32} className="text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Kunci Dokumen PDF</h2>
        <p className="text-gray-400">
          Lindungi dokumen PDF dengan password
        </p>
      </div>

      <div className="glass-card">
        <form onSubmit={handleLock} className="space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Dokumen PDF
            </label>
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-blue-500 transition-colors">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                id="pdf-upload"
              />
              <label htmlFor="pdf-upload" className="cursor-pointer">
                <Upload size={32} className="mx-auto text-gray-500 mb-3" />
                {file ? (
                  <p className="text-blue-400 font-medium">{file.name}</p>
                ) : (
                  <p className="text-gray-500">Klik untuk memilih file PDF</p>
                )}
              </label>
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password (4 digit angka)
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Contoh: 1234"
              className="input-field text-2xl tracking-widest text-center"
              maxLength={4}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !file || !password}
            className="btn-primary w-full py-3 text-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <Lock size={20} />
            )}
            {loading ? 'Mengenkripsi...' : 'Kunci PDF'}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-700/50 rounded-lg p-4 text-red-300">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-6 bg-green-900/20 border border-green-700/30 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={20} className="text-green-400" />
              <h3 className="font-medium text-green-300">PDF Berhasil Dikunci!</h3>
            </div>
            <button
              onClick={handleDownload}
              className="btn-success w-full flex items-center justify-center gap-2"
            >
              <Download size={16} />
              Download PDF Terkunci
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default LockPage
