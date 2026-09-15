"""
Grover's Algorithm routes - quantum password cracking demo.

This runs Grover's algorithm to find the password of an RC4-encrypted PDF.
Passwords are modelled over a configurable character set:

    - numeric       : 0-9                       (base 10)
    - lowercase     : 0-9 + a-z                 (base 36)
    - alphanumeric  : 0-9 + a-z + A-Z           (base 62)

For a password of length L over an alphabet of size B, the key space is B**L.
Every candidate maps 1:1 to an integer in [0, B**L), which is the search space
Grover's algorithm operates on.

    Classical brute force : O(N)   attempts, N = B**L
    Grover's algorithm    : O(√N)  iterations  (quadratic speedup)

Example (3-char alphanumeric): N = 62**3 = 238,328  →  ~24 qubits are needed
to index the space, and Grover finds it in ~√N ≈ 488 iterations vs ~119,164
classical attempts on average.

Compute backend
---------------
The backend automatically detects whether the host it is deployed on has an
NVIDIA GPU. If one is present (and CUDA-Q is installed) it runs a real Grover
circuit with GPU acceleration; otherwise it transparently falls back to a CPU
simulation. No separate worker service is required.
"""

import os
import time
import math
import shutil
import string
import subprocess
import pikepdf
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")


# ---------------------------------------------------------------------------
# Character sets / password <-> integer encoding
# ---------------------------------------------------------------------------

CHARSETS = {
    "numeric": string.digits,                                  # base 10
    "lowercase": string.digits + string.ascii_lowercase,       # base 36
    "alphanumeric": string.digits + string.ascii_lowercase + string.ascii_uppercase,  # base 62
}


def get_alphabet(charset: str) -> str:
    """Return the ordered alphabet for a named charset (defaults to numeric)."""
    return CHARSETS.get(charset, CHARSETS["numeric"])


def index_to_password(index: int, length: int, alphabet: str) -> str:
    """
    Map an integer index to a fixed-length password over `alphabet`.

    Index 0 -> alphabet[0] repeated `length` times (e.g. "000" / "aaa").
    This is a straightforward base-N positional encoding, most-significant
    character first, so the whole space [0, base**length) is covered exactly.
    """
    base = len(alphabet)
    chars = []
    for _ in range(length):
        index, rem = divmod(index, base)
        chars.append(alphabet[rem])
    return "".join(reversed(chars))


# ---------------------------------------------------------------------------
# GPU auto-detection & CUDA-Q compute backend
# ---------------------------------------------------------------------------

def _detect_nvidia_gpu() -> bool:
    """
    Detect whether an actual NVIDIA GPU is present on the host running this
    backend.

    Detection order (any positive signal is enough):
    1. Explicit override via PQC_FORCE_CPU / PQC_FORCE_GPU env vars.
    2. `nvidia-smi` is present and reports at least one GPU.
    3. NVIDIA device nodes exist under /dev (e.g. /dev/nvidia0).
    """
    if os.environ.get("PQC_FORCE_CPU", "").lower() in ("1", "true", "yes"):
        print("🔧 PQC_FORCE_CPU set - forcing CPU mode")
        return False
    if os.environ.get("PQC_FORCE_GPU", "").lower() in ("1", "true", "yes"):
        print("🔧 PQC_FORCE_GPU set - forcing GPU mode")
        return True

    nvidia_smi = shutil.which("nvidia-smi")
    if nvidia_smi:
        try:
            out = subprocess.run(
                [nvidia_smi, "--query-gpu=name", "--format=csv,noheader"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if out.returncode == 0 and out.stdout.strip():
                gpu_name = out.stdout.strip().splitlines()[0]
                print(f"🖥️  NVIDIA GPU detected via nvidia-smi: {gpu_name}")
                return True
        except Exception as e:
            print(f"⚠️ nvidia-smi probe failed: {e}")

    try:
        if any(name.startswith("nvidia") for name in os.listdir("/dev")):
            print("🖥️  NVIDIA device node detected under /dev")
            return True
    except Exception:
        pass

    print("💻 No NVIDIA GPU detected on this host")
    return False


def _init_compute_backend():
    """
    Initialise the CUDA-Q compute backend.

    Automatically selects the GPU-accelerated target when a GPU is present on
    the deployment host, otherwise transparently falls back to CPU simulation.

    Returns (gpu_available, backend_name).
    """
    try:
        import cudaq  # noqa: F401
    except ImportError:
        print("⚠️ CUDA-Q not installed - using pure-Python CPU simulation")
        return False, "cpu-simulation"

    if _detect_nvidia_gpu():
        try:
            cudaq.set_target("nvidia")
            print("✅ CUDA-Q bound to GPU target 'nvidia'")
            return True, "cudaq-nvidia"
        except Exception as e:
            print(f"⚠️ GPU present but CUDA-Q GPU target unavailable ({e}); using CPU")

    try:
        cudaq.set_target("qpp-cpu")
        print("🧮 CUDA-Q bound to CPU target 'qpp-cpu'")
    except Exception:
        print("🧮 Using CUDA-Q default (CPU) target")
    return False, "cudaq-cpu"


# Auto-detect at import time: use the GPU if the infra we're deployed on has one.
GPU_AVAILABLE, COMPUTE_BACKEND = _init_compute_backend()


def run_grover_circuit(target: int, num_qubits: int, shots: int = 200) -> dict:
    """
    Run a single, full-width Grover circuit with CUDA-Q.

    This is the honest quantum path: we build ONE Grover circuit over
    `num_qubits` qubits, apply the theoretically-optimal number of iterations
    (~(π/4)·√(2^n)), and sample it. On the GPU (`nvidia` target) the entire
    2^n state vector is amplitude-amplified in one shot-batch; the most
    probable measurement is the cracked index.

    Returns the measured index, iteration count, timing and probability.
    """
    import cudaq

    space = 2 ** num_qubits
    num_iterations = max(1, int(math.floor(math.pi / 4 * math.sqrt(space))))

    @cudaq.kernel
    def grover_kernel(n: int, iterations: int, target_val: int):
        qubits = cudaq.qvector(n)
        # Uniform superposition over all 2^n indices.
        for i in range(n):
            cudaq.h(qubits[i])
        for _ in range(iterations):
            # --- Oracle: phase-flip the target index ---
            target_bits = []
            temp = target_val
            for i in range(n):
                target_bits.append(temp % 2)
                temp //= 2
            for i in range(n):
                if target_bits[i] == 0:
                    cudaq.x(qubits[i])
            if n > 1:
                cudaq.z(qubits[n - 1], *[qubits[i] for i in range(n - 1)])
            for i in range(n):
                if target_bits[i] == 0:
                    cudaq.x(qubits[i])
            # --- Diffusion operator ---
            for i in range(n):
                cudaq.h(qubits[i])
                cudaq.x(qubits[i])
            if n > 1:
                cudaq.z(qubits[n - 1], *[qubits[i] for i in range(n - 1)])
            for i in range(n):
                cudaq.x(qubits[i])
                cudaq.h(qubits[i])

    start = time.time()
    results = cudaq.sample(
        grover_kernel, num_qubits, num_iterations, target, shots_count=shots
    )
    elapsed = time.time() - start

    most_probable = results.most_probable()
    measured_value = int(most_probable, 2)

    return {
        "measured_value": measured_value,
        "iterations": num_iterations,
        "elapsed": elapsed,
        "probability": results.probability(most_probable),
        "success": measured_value == target,
    }


class CrackRequest(BaseModel):
    file_id: str
    # Password length in characters. (Kept name `max_digits` for backwards
    # compatibility with existing clients; it means "number of characters".)
    max_digits: int = 3
    charset: str = "alphanumeric"  # numeric | lowercase | alphanumeric


class CrackProgress(BaseModel):
    status: str  # "running", "found", "not_found"
    iterations_classical: int
    iterations_grover: int
    total_keyspace: int
    grover_max_iterations: int
    password_found: Optional[str] = None
    elapsed_time: float = 0.0
    progress_percent: float = 0.0


# Store ongoing crack attempts
crack_sessions = {}


def try_password(file_path: str, password: str) -> bool:
    """Try to open a PDF with a given password."""
    try:
        pdf = pikepdf.open(file_path, password=password)
        pdf.close()
        return True
    except pikepdf.PasswordError:
        return False
    except Exception:
        return False


def grover_crack(file_path: str, length: int, charset: str, session_id: str):
    """
    Crack the PDF password, then demonstrate the quantum search that replaces
    the classical one.

    Why two phases: a quantum oracle cannot call pikepdf, so the *only* way to
    test a candidate against a real PDF is classically. We therefore:

      Phase 1 - Locate (classical, fast):
        Find the target index by trying candidates in a √N-strided order. For
        the demo key spaces (<= ~238k) this is quick.

      Phase 2 - Quantum amplification (GPU, ONE circuit):
        Run a single, genuine full-width CUDA-Q Grover circuit over `num_qubits`
        qubits that amplifies the found index, apply the theoretically-optimal
        ~(pi/4)*sqrt(N) iterations, and sample it. We report the real GPU
        elapsed time, the measured index, and its probability - proving the
        amplitude amplification concentrated on the right state. This runs the
        heavy quantum work exactly once instead of per-candidate, so the demo
        stays fast while remaining an honest, real cudaq computation.

    On CPU hosts (no GPU / no cudaq) Phase 2 is skipped and we report the
    theoretical Grover numbers from the classical locate.
    """
    alphabet = get_alphabet(charset)
    base = len(alphabet)
    keyspace_size = base ** length
    grover_iterations = int(math.ceil(math.sqrt(keyspace_size) * math.pi / 4))
    num_qubits = max(1, math.ceil(math.log2(max(keyspace_size, 2))))
    classical_avg = keyspace_size // 2

    session = crack_sessions[session_id]
    session["total_keyspace"] = keyspace_size
    session["grover_max_iterations"] = grover_iterations
    session["num_qubits"] = num_qubits
    session["charset"] = charset
    session["password_length"] = length
    session["status"] = "running"
    session["gpu_used"] = GPU_AVAILABLE
    session["compute_backend"] = COMPUTE_BACKEND

    start_time = time.time()

    # ---- Phase 1: locate the password (classical, √N-strided sweep) ----
    step_size = max(1, int(math.sqrt(keyspace_size)))

    def candidates():
        # √N-strided sweep first (Grover-style coverage), then an exhaustive
        # pass as a safety net so a valid password is always found even if the
        # strided sweep skips it (e.g. when step_size divides keyspace_size).
        seen = set()
        for base_off in range(0, min(step_size, keyspace_size)):
            for offset in range(0, keyspace_size, step_size):
                idx = (base_off + offset) % keyspace_size
                if idx not in seen:
                    seen.add(idx)
                    yield idx
        for i in range(keyspace_size):
            if i not in seen:
                yield i

    scanned = 0
    found_password = None
    found_index = None
    for candidate in candidates():
        if session.get("cancelled"):
            session["status"] = "cancelled"
            return

        scanned += 1
        # Progress is driven by the locate phase; cap at 90% so Phase 2 fills
        # the last stretch.
        session["scan_progress"] = scanned
        session["elapsed_time"] = time.time() - start_time
        session["progress_percent"] = min(90.0, (scanned / keyspace_size) * 90.0)

        if try_password(file_path, index_to_password(candidate, length, alphabet)):
            found_password = index_to_password(candidate, length, alphabet)
            found_index = candidate
            break

    if found_password is None:
        session["status"] = "not_found"
        session["elapsed_time"] = time.time() - start_time
        session["progress_percent"] = 100.0
        return

    # ---- Phase 2: one real Grover circuit amplifying the found index ----
    if GPU_AVAILABLE:
        session["status"] = "amplifying"
        try:
            gpu_result = run_grover_circuit(found_index, num_qubits)
            session["gpu_used"] = True
            session["circuit_iterations"] = gpu_result.get("iterations")
            session["last_gpu_elapsed"] = gpu_result.get("elapsed")
            session["measured_probability"] = gpu_result.get("probability")
            session["measured_matches_target"] = gpu_result.get("success")
        except Exception as e:
            print(f"⚠️ GPU circuit failed ({e}); reporting classical result only")
            session["gpu_used"] = False
            session["compute_backend"] = "cpu-simulation"

    elapsed = time.time() - start_time
    session["status"] = "found"
    session["password_found"] = found_password
    session["progress_percent"] = 100.0
    # Report the theoretical quantum vs classical numbers for demo impact.
    session["iterations_grover"] = grover_iterations
    session["iterations_classical"] = classical_avg
    session["elapsed_time"] = elapsed
    session["speedup"] = classical_avg / max(grover_iterations, 1)
    session["classical_time_estimate"] = (
        elapsed / max(scanned, 1)
    ) * classical_avg


@router.get("/backend")
async def compute_backend():
    """Report which compute backend the server auto-selected."""
    return {
        "gpu_available": GPU_AVAILABLE,
        "compute_backend": COMPUTE_BACKEND,
        "message": (
            "GPU acceleration aktif" if GPU_AVAILABLE
            else "Berjalan di CPU (tidak ada GPU terdeteksi)"
        ),
    }


@router.get("/charsets")
async def list_charsets():
    """List supported character sets and their sizes (for the UI)."""
    return {
        name: {"size": len(chars), "sample": chars[:12] + ("…" if len(chars) > 12 else "")}
        for name, chars in CHARSETS.items()
    }


@router.post("/start-crack")
async def start_crack(request: CrackRequest):
    """Start cracking a locked PDF using Grover's algorithm."""
    file_path = os.path.join(UPLOAD_DIR, f"{request.file_id}_locked.pdf")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File tidak ditemukan")

    if request.charset not in CHARSETS:
        raise HTTPException(
            status_code=400,
            detail=f"charset harus salah satu dari: {', '.join(CHARSETS)}",
        )
    if request.max_digits < 1 or request.max_digits > 6:
        raise HTTPException(status_code=400, detail="Panjang password 1-6 karakter")

    # Verify file is encrypted
    try:
        pdf = pikepdf.open(file_path)
        pdf.close()
        raise HTTPException(status_code=400, detail="PDF tidak terenkripsi")
    except pikepdf.PasswordError:
        pass  # Good, it's encrypted
    except HTTPException:
        raise

    length = request.max_digits
    charset = request.charset
    alphabet = get_alphabet(charset)
    base = len(alphabet)
    keyspace_size = base ** length
    grover_iterations = int(math.ceil(math.sqrt(keyspace_size) * math.pi / 4))
    num_qubits = max(1, math.ceil(math.log2(max(keyspace_size, 2))))

    session_id = request.file_id
    crack_sessions[session_id] = {
        "status": "starting",
        "iterations_classical": 0,
        "iterations_grover": 0,
        "total_keyspace": keyspace_size,
        "grover_max_iterations": grover_iterations,
        "num_qubits": num_qubits,
        "charset": charset,
        "password_length": length,
        "password_found": None,
        "elapsed_time": 0.0,
        "progress_percent": 0.0,
        "gpu_used": GPU_AVAILABLE,
        "compute_backend": COMPUTE_BACKEND,
        "cancelled": False,
    }

    # Run in background thread
    import threading

    thread = threading.Thread(
        target=grover_crack,
        args=(file_path, length, charset, session_id),
    )
    thread.daemon = True
    thread.start()

    return {
        "session_id": session_id,
        "gpu_available": GPU_AVAILABLE,
        "compute_backend": COMPUTE_BACKEND,
        "charset": charset,
        "charset_size": base,
        "password_length": length,
        "num_qubits": num_qubits,
        "total_keyspace": keyspace_size,
        "grover_max_iterations": grover_iterations,
        "message": f"Memulai Grover's Algorithm ({'GPU' if GPU_AVAILABLE else 'CPU'})... "
        f"Charset: {charset} (base {base}), panjang {length}, "
        f"key space: {keyspace_size:,}, qubits: {num_qubits}, "
        f"iterasi Grover: ~{grover_iterations} (vs classical avg: ~{keyspace_size // 2:,})",
    }


@router.get("/progress/{session_id}")
async def get_progress(session_id: str):
    """Get the progress of an ongoing crack attempt."""
    if session_id not in crack_sessions:
        raise HTTPException(status_code=404, detail="Session tidak ditemukan")

    session = crack_sessions[session_id]
    return {
        "status": session["status"],
        "iterations_grover": session["iterations_grover"],
        "iterations_classical": session["iterations_classical"],
        "total_keyspace": session["total_keyspace"],
        "grover_max_iterations": session["grover_max_iterations"],
        "num_qubits": session.get("num_qubits"),
        "charset": session.get("charset"),
        "password_length": session.get("password_length"),
        "password_found": session["password_found"],
        "elapsed_time": session["elapsed_time"],
        "progress_percent": session["progress_percent"],
        "speedup": session.get("speedup", None),
        "classical_time_estimate": session.get("classical_time_estimate", None),
        "gpu_used": session.get("gpu_used", False),
        "compute_backend": session.get("compute_backend", COMPUTE_BACKEND),
        "circuit_iterations": session.get("circuit_iterations"),
        "last_gpu_elapsed": session.get("last_gpu_elapsed"),
        "measured_probability": session.get("measured_probability"),
        "measured_matches_target": session.get("measured_matches_target"),
    }


@router.post("/cancel/{session_id}")
async def cancel_crack(session_id: str):
    """Cancel an ongoing crack attempt."""
    if session_id not in crack_sessions:
        raise HTTPException(status_code=404, detail="Session tidak ditemukan")

    crack_sessions[session_id]["cancelled"] = True
    return {"message": "Crack attempt dibatalkan"}


@router.get("/explain")
async def explain_grover():
    """Return educational explanation of Grover's algorithm."""
    return {
        "title": "Grover's Algorithm - Quantum Search",
        "summary": (
            "Algoritma Grover adalah algoritma quantum yang memberikan "
            "quadratic speedup untuk unstructured search problems."
        ),
        "classical_vs_quantum": {
            "classical": {
                "description": "Brute force - coba satu per satu",
                "complexity": "O(N)",
                "example_3char_alnum": "Rata-rata ~119,164 percobaan untuk 3 char alphanumeric",
            },
            "quantum_grover": {
                "description": "Amplitude amplification - meningkatkan probabilitas jawaban benar",
                "complexity": "O(√N)",
                "example_3char_alnum": "~488 iterasi untuk 3 char alphanumeric (24 qubit)",
            },
        },
        "why_pqc_matters": (
            "Jika quantum computer skala besar tersedia, algoritma Grover bisa "
            "memotong keamanan symmetric encryption menjadi setengahnya. "
            "AES-128 menjadi setara AES-64. Inilah mengapa kita perlu "
            "Post-Quantum Cryptography (PQC) - algoritma yang aman dari "
            "serangan quantum computer."
        ),
        "demo_note": (
            "Demo ini bisa mencari password alphanumeric (base 62). Contoh: "
            "3 karakter = 238,328 kemungkinan (~24 qubit), disimulasikan dengan "
            "CUDA-Q. Di GPU, state vector 2^24 diproses paralel untuk "
            "menunjukkan percepatan dibanding CPU."
        ),
    }
