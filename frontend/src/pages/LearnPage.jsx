import React from 'react'
import { BookOpen, Shield, AlertTriangle, ArrowRight, Clock, Lock, Zap } from 'lucide-react'

function LearnPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600/20 rounded-2xl mb-4">
          <BookOpen size={32} className="text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Mengapa Ini Penting?</h2>
        <p className="text-gray-400">
          Ancaman quantum computing terhadap keamanan data kita
        </p>
      </div>

      <div className="space-y-6">
        {/* What just happened */}
        <div className="glass-card">
          <h3 className="text-lg font-bold text-blue-300 mb-4">Apa yang Baru Saja Terjadi?</h3>
          <div className="space-y-3 text-gray-300">
            <p>
              Anda baru saja melihat simulasi bagaimana <strong className="text-white">quantum computer</strong> bisa 
              membobol password yang melindungi dokumen.
            </p>
            <p>
              Komputer biasa perlu mencoba <strong className="text-yellow-300">ribuan</strong> kemungkinan satu per satu.
              Quantum computer bisa menemukan jawabannya dalam <strong className="text-purple-300">puluhan</strong> percobaan saja.
            </p>
          </div>
        </div>

        {/* Simple comparison */}
        <div className="glass-card">
          <h3 className="text-lg font-bold text-purple-300 mb-4">Perbandingan Kecepatan</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-yellow-900/10 rounded-xl p-4">
              <div className="w-12 h-12 bg-yellow-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock size={24} className="text-yellow-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-yellow-300">Komputer Biasa</p>
                <p className="text-sm text-gray-400">Harus mencoba satu per satu — sangat lambat untuk password panjang</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-yellow-400">5,000</p>
                <p className="text-xs text-gray-500">percobaan</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-purple-900/10 rounded-xl p-4">
              <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap size={24} className="text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-purple-300">Quantum Computer</p>
                <p className="text-sm text-gray-400">Mencari secara parallel — jauh lebih cepat</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-purple-400">~79</p>
                <p className="text-xs text-gray-500">percobaan</p>
              </div>
            </div>
          </div>
        </div>

        {/* Real world impact */}
        <div className="glass-card border-red-900/30">
          <h3 className="text-lg font-bold text-red-300 mb-4 flex items-center gap-2">
            <AlertTriangle size={20} />
            Dampak di Dunia Nyata
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-lg font-bold text-red-400">1</span>
              </div>
              <div>
                <p className="font-medium text-white">Enkripsi saat ini bisa dipatahkan</p>
                <p className="text-sm text-gray-400 mt-1">
                  Sistem keamanan yang kita gunakan hari ini (RSA, ECC) akan 
                  sepenuhnya rusak ketika quantum computer cukup besar tersedia.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-lg font-bold text-red-400">2</span>
              </div>
              <div>
                <p className="font-medium text-white">"Curi Sekarang, Buka Nanti"</p>
                <p className="text-sm text-gray-400 mt-1">
                  Pihak yang tidak bertanggung jawab bisa menyimpan data terenkripsi kita hari ini,
                  lalu membukanya ketika quantum computer tersedia di masa depan.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-lg font-bold text-red-400">3</span>
              </div>
              <div>
                <p className="font-medium text-white">Timeline: 5-15 tahun</p>
                <p className="text-sm text-gray-400 mt-1">
                  Quantum computer yang cukup kuat diperkirakan tersedia dalam 5-15 tahun.
                  Migrasi keamanan membutuhkan waktu bertahun-tahun — kita harus mulai sekarang.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Solution */}
        <div className="glass-card border-green-900/30">
          <h3 className="text-lg font-bold text-green-300 mb-4 flex items-center gap-2">
            <Shield size={20} />
            Solusi: Post-Quantum Cryptography (PQC)
          </h3>
          <div className="space-y-3 text-gray-300">
            <p>
              Kabar baiknya, sudah ada solusi. <strong className="text-green-300">Post-Quantum Cryptography</strong> adalah 
              algoritma enkripsi baru yang tahan terhadap serangan quantum computer.
            </p>
            <div className="bg-green-900/20 rounded-xl p-4 space-y-2 mt-4">
              <p className="flex items-center gap-2 text-sm">
                <ArrowRight size={14} className="text-green-400" />
                <span>NIST sudah menerbitkan standar PQC (2024)</span>
              </p>
              <p className="flex items-center gap-2 text-sm">
                <ArrowRight size={14} className="text-green-400" />
                <span>ML-KEM (Kyber) untuk pertukaran kunci</span>
              </p>
              <p className="flex items-center gap-2 text-sm">
                <ArrowRight size={14} className="text-green-400" />
                <span>ML-DSA (Dilithium) untuk tanda tangan digital</span>
              </p>
              <p className="flex items-center gap-2 text-sm">
                <ArrowRight size={14} className="text-green-400" />
                <span>Perusahaan besar sudah mulai migrasi (Google, Apple, Cloudflare)</span>
              </p>
            </div>
          </div>
        </div>

        {/* Call to action */}
        <div className="glass-card bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-blue-900/30 text-center py-8">
          <Lock size={32} className="mx-auto text-blue-400 mb-4" />
          <h3 className="text-xl font-bold mb-2">Apa yang Harus Kita Lakukan?</h3>
          <div className="max-w-lg mx-auto space-y-2 text-gray-300 text-sm mt-4">
            <p className="flex items-center gap-2 justify-center">
              <span className="w-6 h-6 bg-blue-600/30 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              Audit sistem kriptografi yang digunakan saat ini
            </p>
            <p className="flex items-center gap-2 justify-center">
              <span className="w-6 h-6 bg-blue-600/30 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              Buat roadmap migrasi ke algoritma PQC
            </p>
            <p className="flex items-center gap-2 justify-center">
              <span className="w-6 h-6 bg-blue-600/30 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              Mulai implementasi hybrid (klasik + PQC) di sistem kritikal
            </p>
            <p className="flex items-center gap-2 justify-center">
              <span className="w-6 h-6 bg-blue-600/30 rounded-full flex items-center justify-center text-xs font-bold">4</span>
              Alokasikan budget dan timeline untuk transisi penuh
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LearnPage
