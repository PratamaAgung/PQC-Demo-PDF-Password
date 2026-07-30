"""
PDF routes - lock/unlock PDF with weakened RC4 encryption.
Uses a small key space (numeric passwords up to 4 digits = ~13 bits)
to make brute force feasible for demo purposes.
"""

import os
import uuid
import pikepdf
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")


@router.post("/lock")
async def lock_pdf(file: UploadFile = File(...), password: str = Form(...)):
    """
    Lock a PDF with RC4 encryption using a numeric password.
    Password must be numeric and max 4 digits (for demo crackability).
    """
    # Validate password - must be numeric and max 4 digits
    if not password.isdigit():
        raise HTTPException(status_code=400, detail="Password harus numerik (angka saja)")
    if len(password) > 4:
        raise HTTPException(
            status_code=400,
            detail="Password maksimal 4 digit (untuk demo, agar bisa di-crack)",
        )
    if len(password) == 0:
        raise HTTPException(status_code=400, detail="Password tidak boleh kosong")

    # Save uploaded file
    file_id = str(uuid.uuid4())
    input_path = os.path.join(UPLOAD_DIR, f"{file_id}_input.pdf")
    output_path = os.path.join(UPLOAD_DIR, f"{file_id}_locked.pdf")

    content = await file.read()
    with open(input_path, "wb") as f:
        f.write(content)

    try:
        # Open and encrypt with AES-128 (R=4)
        # The weakness here is the SHORT PASSWORD (4 digits = 10,000 possibilities)
        # not the cipher itself. This demonstrates that even AES can be broken
        # by Grover's if the key space is small enough.
        pdf = pikepdf.open(input_path)
        encryption = pikepdf.Encryption(
            owner=password,
            user=password,
            R=4,  # AES-128 encryption
        )
        pdf.save(output_path, encryption=encryption)
        pdf.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal mengenkripsi PDF: {str(e)}")
    finally:
        # Clean up input file
        if os.path.exists(input_path):
            os.remove(input_path)

    return {
        "file_id": file_id,
        "filename": file.filename,
        "password_length": len(password),
        "encryption": "AES-128 (password lemah)",
        "message": f"PDF berhasil di-lock dengan password {len(password)} digit",
    }


@router.get("/download/{file_id}")
async def download_locked_pdf(file_id: str):
    """Download the locked PDF file."""
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_locked.pdf")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    return FileResponse(
        file_path, media_type="application/pdf", filename=f"locked_{file_id}.pdf"
    )


@router.post("/verify")
async def verify_password(file: UploadFile = File(...), password: str = Form(...)):
    """
    Verify if a password can unlock a PDF.
    Returns the PDF content preview if successful.
    """
    file_id = str(uuid.uuid4())
    temp_path = os.path.join(UPLOAD_DIR, f"{file_id}_verify.pdf")

    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)

    try:
        pdf = pikepdf.open(temp_path, password=password)
        num_pages = len(pdf.pages)
        # Extract text from first page if possible
        first_page_text = ""
        try:
            page = pdf.pages[0]
            first_page_text = page.extract_text() if hasattr(page, "extract_text") else ""
        except Exception:
            first_page_text = "(Tidak bisa extract text preview)"
        pdf.close()

        return {
            "success": True,
            "message": "Password benar! PDF berhasil dibuka.",
            "num_pages": num_pages,
            "preview": first_page_text[:500] if first_page_text else "(No text content)",
        }
    except pikepdf.PasswordError:
        return {"success": False, "message": "Password salah! PDF tidak bisa dibuka."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/upload-locked")
async def upload_locked_pdf(file: UploadFile = File(...)):
    """Upload a locked PDF for cracking."""
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_locked.pdf")

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Verify it's actually encrypted
    try:
        pdf = pikepdf.open(file_path)
        pdf.close()
        # If we can open without password, it's not encrypted
        os.remove(file_path)
        raise HTTPException(
            status_code=400, detail="PDF ini tidak di-enkripsi. Upload PDF yang sudah di-lock."
        )
    except pikepdf.PasswordError:
        # Good - it's encrypted
        return {
            "file_id": file_id,
            "filename": file.filename,
            "message": "PDF terenkripsi berhasil di-upload. Siap untuk di-crack!",
        }
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/view/{file_id}")
async def view_unlocked_pdf(file_id: str, password: str = ""):
    """View/download an unlocked PDF."""
    locked_path = os.path.join(UPLOAD_DIR, f"{file_id}_locked.pdf")
    unlocked_path = os.path.join(UPLOAD_DIR, f"{file_id}_unlocked.pdf")

    if not os.path.exists(locked_path):
        raise HTTPException(status_code=404, detail="File tidak ditemukan")

    try:
        pdf = pikepdf.open(locked_path, password=password)
        pdf.save(unlocked_path)
        pdf.close()
        return FileResponse(
            unlocked_path, media_type="application/pdf", filename=f"unlocked_{file_id}.pdf"
        )
    except pikepdf.PasswordError:
        raise HTTPException(status_code=401, detail="Password salah")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.post("/unlock-preview")
async def unlock_preview(file: UploadFile = File(...), password: str = Form(...)):
    """Unlock a PDF and return it as a downloadable/viewable file."""
    file_id = str(uuid.uuid4())
    temp_path = os.path.join(UPLOAD_DIR, f"{file_id}_temp.pdf")
    unlocked_path = os.path.join(UPLOAD_DIR, f"{file_id}_preview.pdf")

    content = await file.read()
    with open(temp_path, "wb") as f:
        f.write(content)

    try:
        pdf = pikepdf.open(temp_path, password=password)
        pdf.save(unlocked_path)
        pdf.close()
        return FileResponse(
            unlocked_path,
            media_type="application/pdf",
            filename="preview.pdf",
            headers={"Content-Disposition": "inline; filename=preview.pdf"},
        )
    except pikepdf.PasswordError:
        raise HTTPException(status_code=401, detail="Password salah")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
