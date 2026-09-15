"""
PQC Demo - Grover's Algorithm PDF Password Cracker
Educational demo showing why Post-Quantum Cryptography matters.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.routes import pdf_routes, grover_routes

app = FastAPI(
    title="PQC Demo - Grover's Algorithm",
    description="Demo edukasi: Cracking PDF passwords with Grover's Algorithm",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure upload directory exists
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.include_router(pdf_routes.router, prefix="/api/pdf", tags=["PDF"])
app.include_router(grover_routes.router, prefix="/api/grover", tags=["Grover"])


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "PQC Demo Backend Running"}
