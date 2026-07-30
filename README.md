# PQC Demo - Grover's Algorithm vs PDF Password

Demo edukasi untuk menunjukkan kepada senior management mengapa Post-Quantum Cryptography (PQC) penting.

## Konsep

Aplikasi ini mendemonstrasikan:
1. **Lock PDF** - Enkripsi dokumen PDF dengan password menggunakan RC4 (dilemahkan)
2. **Verify** - Verifikasi bahwa PDF sudah terkunci dengan password
3. **Hacker Mode** - Simulasi serangan Grover's Algorithm untuk membobol password
4. **Learn** - Penjelasan edukasi tentang quantum threat dan PQC

## Arsitektur

```
┌─────────────────────┐     ┌──────────────────────┐
│   React Frontend    │────▶│   FastAPI Backend     │
│   (Vite + Tailwind) │     │                      │
│                     │     │  • PDF Lock/Unlock    │
│  • Lock Page        │     │  • Grover Simulation  │
│  • Verify Page      │     │  • pikepdf (RC4)      │
│  • Hacker Mode      │     │                      │
│  • Learn Page       │     └──────────────────────┘
└─────────────────────┘
```

## Setup & Run

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm atau yarn

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
python run.py
```

Backend berjalan di http://localhost:8000

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend berjalan di http://localhost:3000 (proxy ke backend)

## Cara Penggunaan

### 1. Lock PDF
- Buka halaman "Lock PDF"
- Upload dokumen PDF apapun
- Masukkan password numerik (1-4 digit)
- Download PDF yang sudah ter-lock

### 2. Verify
- Upload PDF yang sudah di-lock
- Masukkan password untuk memverifikasi
- Jika benar, bisa melihat preview konten

### 3. Hacker Mode (Grover's Algorithm)
- Upload PDF yang sudah di-lock
- Konfigurasi jumlah digit password yang akan dicari
- Klik "Start Grover Attack"
- Lihat proses pencarian quantum (simulasi)
- Bandingkan iterasi Grover vs classical brute force
- View PDF yang sudah di-unlock

### 4. Learn
- Penjelasan tentang Grover's Algorithm
- Perbandingan classical vs quantum
- Mengapa PQC diperlukan sekarang

## Catatan Penting

- **Ini adalah simulasi edukasi**, bukan implementasi quantum computing sesungguhnya
- RC4 40-bit encryption sudah dianggap tidak aman sejak lama
- Password dibatasi 4 digit numerik agar demo bisa berjalan cepat di laptop
- Pada quantum computer nyata, Grover's Algorithm memberikan quadratic speedup O(√N)
- Demo ini bertujuan menunjukkan KONSEP ancaman quantum terhadap kriptografi

## Key Takeaways untuk Senior Management

1. **Quantum computers akan memecahkan kriptografi saat ini** - RSA, ECC akan sepenuhnya rusak (Shor's Algorithm)
2. **Symmetric crypto setengah lebih lemah** - AES-128 → setara AES-64 (Grover's Algorithm)
3. **Harvest Now, Decrypt Later** - Data sensitif yang dienkripsi hari ini bisa didekripsi di masa depan
4. **Solusi sudah tersedia** - NIST PQC standards (ML-KEM, ML-DSA) sudah final
5. **Migrasi harus dimulai sekarang** - Proses migrasi kriptografi membutuhkan bertahun-tahun
