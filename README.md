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
┌─────────────────────┐     ┌──────────────────────────┐
│   React Frontend    │────▶│   FastAPI Backend         │
│   (Vite + Tailwind) │     │                          │
│                     │     │  • PDF Lock/Unlock        │
│  • Lock Page        │     │  • Grover Simulation      │
│  • Verify Page      │     │  • pikepdf (RC4)          │
│  • Hacker Mode      │     │  • Auto GPU/CPU compute   │
│  • Learn Page       │     │    (CUDA-Q bila ada GPU)  │
│                     │     └──────────────────────────┘
└─────────────────────┘
```

### Compute backend (GPU otomatis)

Backend mendeteksi otomatis apakah host tempat ia berjalan punya NVIDIA GPU:

- **Ada GPU + CUDA-Q terpasang** → Grover circuit dijalankan dengan akselerasi
  GPU (CUDA-Q target `nvidia`).
- **Tidak ada GPU** → otomatis fallback ke simulasi Grover di CPU.

Tidak ada worker/EC2 terpisah yang perlu dinyalakan atau dimatikan. Deteksi
memakai `nvidia-smi` / device node `/dev/nvidia*`, dan bisa dipaksa lewat env
var `PQC_FORCE_GPU=1` atau `PQC_FORCE_CPU=1`. Cek backend yang aktif via
`GET /api/grover/backend`.

### Dua image (two-image model)

Ada **dua image Docker**, dibangun dari dua Dockerfile:

| Image | Dockerfile | cudaq? | Dipakai untuk |
|-------|-----------|--------|---------------|
| `pqc-demo` (slim) | `Dockerfile` | ❌ tidak | Web app CPU di ECS Express Mode (selalu nyala, murah) |
| `pqc-demo-gpu` | `Dockerfile.gpu` | ✅ ya | Runner GPU on-demand (g4dn.xlarge) |

Kenapa dipisah: image webapp yang selalu nyala tetap ramping (tanpa cudaq
yang ratusan MB), sedangkan cudaq hanya ikut di image GPU yang jarang jalan.
Kode aplikasinya sama; auto-detect GPU akan fallback ke CPU kalau cudaq tidak
ada (image slim), dan memakai target `nvidia` kalau ada (image GPU).

**Catatan build cudaq:** wheel `cudaq` butuh Linux **x86_64** + Python 3.11,
di-download dari index NVIDIA saat build (pip >= 24.0) — **tidak** butuh GPU
saat build. Kedua image di-pin ke `linux/amd64`. Deteksi runtime bisa dipaksa
lewat `PQC_FORCE_GPU=1` / `PQC_FORCE_CPU=1`; cek backend aktif via
`GET /api/grover/backend`.

### Deploy web app (CPU, CI/CD)

- **Otomatis:** push ke `main` → GitHub Actions (`.github/workflows/deploy.yml`)
  build image **slim** (`Dockerfile`) dan deploy ke ECS Express Mode. Pipeline
  ini **tidak** menyentuh image/stack GPU.
- **Manual:** `./deploy.sh` (build + push `pqc-demo`, deploy ECS Express).

### Demo GPU on-demand (hemat biaya)

Runner GPU adalah stack terpisah yang **scale-to-zero**: idle = $0, hanya bayar
(~$0.53/jam, g4dn.xlarge on-demand, NVIDIA T4) saat dipakai demo.

```bash
# 1. Build + push image GPU (Dockerfile.gpu, dengan cudaq) ke repo pqc-demo-gpu
./gpu-demo.sh build

# 2. Buat stack GPU (tetap di desired=0, belum ada biaya)
./gpu-demo.sh deploy

# 3. Nyalakan GPU untuk demo (~2-3 menit)
./gpu-demo.sh start

# 4. Cek status + dapatkan URL demo (public IP instance GPU)
./gpu-demo.sh status
#    → http://<public-ip>/           (web app di GPU instance)
#    → http://<public-ip>/api/grover/backend  (harus gpu_available: true)

# 5. Selesai demo — matikan supaya berhenti bayar
./gpu-demo.sh stop
```

Definisi infra ada di `infra/gpu-cfn.yml` (ASG min=0/max=1/desired=0, ECS
GPU-optimized AMI, task minta 1 GPU, image `pqc-demo-gpu`). Tidak ada
worker/service terpisah di kode aplikasi — hanya toggle infra via
`gpu-demo.sh`.

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
- Pilih jenis karakter (charset) dan panjang password:
  - **Numeric** (0-9, base 10)
  - **Lowercase + angka** (base 36)
  - **Alphanumeric** (0-9 a-z A-Z, base 62)
- Panjang 1-3 karakter. Contoh: 3 karakter alphanumeric = 238,328 kemungkinan
  (~18 qubit yang disimulasikan CUDA-Q)
- Klik "Mulai Serangan Quantum"
- Lihat proses pencarian quantum, jumlah qubit, dan backend (GPU/CPU) yang dipakai
- Bandingkan iterasi Grover vs classical brute force
- View PDF yang sudah di-unlock

Keyspace & qubit untuk alphanumeric (base 62):

| Panjang | Key space | Qubit | Iterasi Grover (~) |
|---------|-----------|-------|--------------------|
| 1 char  | 62        | 6     | 7                  |
| 2 char  | 3,844     | 12    | 49                 |
| 3 char  | 238,328   | 18    | 384                |

### 4. Learn
- Penjelasan tentang Grover's Algorithm
- Perbandingan classical vs quantum
- Mengapa PQC diperlukan sekarang

## Catatan Penting

- Grover circuit yang dijalankan CUDA-Q **nyata** (state-vector simulation);
  di GPU (target `nvidia`) seluruh state vector 2^n diproses paralel. Ini
  simulasi quantum, bukan quantum computer fisik.
- RC4 40-bit encryption sudah dianggap tidak aman sejak lama
- Password bisa numeric/alphanumeric, 1-3 karakter. Default 3-char alphanumeric
  (~18 qubit) dipilih agar cepat di GPU T4 sekaligus cukup besar untuk
  menunjukkan bedanya GPU vs CPU. 4-char alphanumeric = ~24 qubit (jauh lebih berat)
- Pada quantum computer nyata, Grover's Algorithm memberikan quadratic speedup O(√N)
- Demo ini bertujuan menunjukkan KONSEP ancaman quantum terhadap kriptografi

## Key Takeaways untuk Senior Management

1. **Quantum computers akan memecahkan kriptografi saat ini** - RSA, ECC akan sepenuhnya rusak (Shor's Algorithm)
2. **Symmetric crypto setengah lebih lemah** - AES-128 → setara AES-64 (Grover's Algorithm)
3. **Harvest Now, Decrypt Later** - Data sensitif yang dienkripsi hari ini bisa didekripsi di masa depan
4. **Solusi sudah tersedia** - NIST PQC standards (ML-KEM, ML-DSA) sudah final
5. **Migrasi harus dimulai sekarang** - Proses migrasi kriptografi membutuhkan bertahun-tahun
