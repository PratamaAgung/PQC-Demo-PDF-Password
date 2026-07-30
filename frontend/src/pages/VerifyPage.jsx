import React, { useState } from 'react'
import { Shield, Upload, KeyRound, CheckCircle, XCircle } from 'lucide-react'
import axios from 'axios'

function VerifyPage() {
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [pdfBlob, setPdfBlob] = useState(null)

  const handleVerify = async (e) => {
    e.preventDefault()
    if (!file || !password) {
      setError('Pilih file PDF dan masukkan password')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setPdfBlob(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('password', password)

    try {
      const response = await axios.post('/api/pdf/verify', formData)
      setResult(response.data)
      // If successful, create a blob URL for PDF preview
      if (response.data.success) {
        const pdfFormData = new FormData()
        pdfFormData.append('file', file)
        pdfFormData.append('password', password)
        const pdfResponse = await axios.post('/api/pdf/unlock-preview', pdfFormData, {
          responseType: 'blob'
        })
        const blob = new Blob([pdfResponse.data], { type: 'application/pdf' })
        setPdfBlob(URL.createObjectURL(blob))
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-600/20 rounded-2xl mb-4">
          <Shield size={32} className="text-green-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Verifikasi Password</h2>
        <p className="text-gray-400">
          Coba buka PDF terkunci dengan memasukkan password
        </p>
      </div>

      <div className="glass-card">
        <form onSubmit={handleVerify} className="space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              PDF Terkunci
            </label>
            <div className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center hover:border-green-500 transition-colors">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                id="pdf-verify-upload"
              />
              <label htmlFor="pdf-verify-upload" className="cursor-pointer">
                <Upload size={32} className="mx-auto text-gray-500 mb-3" />
                {file ? (
                  <p className="text-green-400 font-medium">{file.name}</p>
                ) : (
                  <p className="text-gray-500">Klik untuk memilih PDF terkunci</p>
                )}
              </label>
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <div className="relative">
              <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="input-field pl-10"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !file || !password}
            className="btn-success w-full py-3 text-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <Shield size={20} />
            )}
            {loading ? 'Memverifikasi...' : 'Buka PDF'}
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
          <div className={`mt-6 rounded-lg p-6 ${
            result.success
              ? 'bg-green-900/20 border border-green-700/30'
              : 'bg-red-900/20 border border-red-700/30'
          }`}>
            <div className="flex items-center gap-2">
              {result.success ? (
                <>
                  <CheckCircle size={24} className="text-green-400" />
                  <div>
                    <h3 className="font-medium text-green-300">Password Benar!</h3>
                    <p className="text-sm text-gray-400 mt-1">PDF berhasil dibuka — {result.num_pages} halaman</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle size={24} className="text-red-400" />
                  <div>
                    <h3 className="font-medium text-red-300">Password Salah</h3>
                    <p className="text-sm text-gray-400 mt-1">PDF tidak bisa dibuka dengan password ini</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PDF Preview */}
      {pdfBlob && (
        <div className="mt-6 glass-card border-green-900/30">
          <h3 className="text-sm font-medium text-green-300 mb-3 flex items-center gap-2">
            <CheckCircle size={16} />
            Preview Dokumen
          </h3>
          <div className="rounded-lg overflow-hidden bg-white">
            <iframe
              src={pdfBlob}
              className="w-full"
              style={{ height: '500px' }}
              title="PDF Preview"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default VerifyPage
