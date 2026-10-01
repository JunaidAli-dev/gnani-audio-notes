import os
import uuid
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
import httpx
from google import genai

from database import get_db
from models import AudioNote
from storage import s3_client, BUCKET_NAME

# Load environment variables
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Initialize Gemini Client using official google-genai SDK
gemini_api_key = os.getenv("LLM_API_KEY") or os.getenv("GEMINI_API_KEY")
ai_client = genai.Client(api_key=gemini_api_key)

app = FastAPI(title="Gnani Audio Notes API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GNANI_API_KEY = os.getenv("GNANI_API_KEY")
GNANI_BATCH_URL = "https://api.vachana.ai/stt/v3/batch"

ALLOWED_AUDIO_EXTENSIONS = {"wav", "mp3", "m4a", "aac", "flac", "ogg"}


class StartJobRequest(BaseModel):
    public_url: str
    filename: str


async def generate_gemini_summary(full_transcript: str) -> str:
    prompt = f"Summarize this audio transcript clearly in 2-3 concise bullet points:\n\n{full_transcript}"
    
    # Active Gemini models in order of priority
    candidate_models = ["gemini-3.8-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"]

    for model_name in candidate_models:
        for attempt in range(2):
            try:
                response = ai_client.models.generate_content(
                    model=model_name,
                    contents=prompt
                )
                if response and response.text:
                    return response.text
            except Exception as e:
                err_str = str(e)
                print(f"⚠️ Gemini ({model_name}) attempt {attempt + 1} failed: {err_str}")
                
                # If rate-limited (429), pause before attempting the next fallback/retry
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    await asyncio.sleep(5)
                else:
                    await asyncio.sleep(1)

    raise Exception("Daily Gemini Free Tier quota exceeded across all fallback models.")


@app.post("/api/presigned-url")
def get_presigned_url(filename: str):
    ext = filename.split(".")[-1].lower() if "." in filename else ""

    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '.{ext}'. Please upload a valid audio file (WAV, MP3, M4A, AAC, FLAC, OGG)."
        )

    unique_key = f"{uuid.uuid4()}.{ext}"
    content_type = "audio/mpeg" if ext == "mp3" else f"audio/{ext}"

    presigned_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": BUCKET_NAME,
            "Key": unique_key,
            "ContentType": content_type,
        },
        ExpiresIn=300,
    )

    storage_endpoint = os.getenv("STORAGE_ENDPOINT", "")
    base_public_url = storage_endpoint.replace(
        "/storage/v1/s3", "/storage/v1/object/public"
    )
    public_url = f"{base_public_url}/{BUCKET_NAME}/{unique_key}"

    return {"upload_url": presigned_url, "public_url": public_url, "content_type": content_type,}


@app.post("/api/start-job")
async def start_job(req: StartJobRequest, db: Session = Depends(get_db)):
    headers = {
        "X-API-Key-ID": GNANI_API_KEY,
        "Content-Type": "application/json",
    }

    # Gnani V3 Batch Public URL Payload
    payload = {
        "config": {
            "model": "gnani-prisma-v2.5",
            "language_code": "en-IN",  # Supported: en-IN, hi-IN, ta-IN, te-IN, kn-IN, ml-IN, mr-IN, bn-IN
            "mode": "transcribe"
        },
        "source": {
            "type": "cloud_storage",
            "auth": {
                "mode": "public"
            },
            "paths": [req.public_url]
        }
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # 1. Create Job in Gnani
            res = await client.post(
                f"{GNANI_BATCH_URL}/jobs", json=payload, headers=headers
            )
            print(f"DEBUG - Create Job [{res.status_code}]: {res.text}")

            if res.status_code not in [200, 201, 202]:
                raise HTTPException(
                    status_code=res.status_code,
                    detail=f"Gnani Create Job failed: {res.text}",
                )

            res_data = res.json()
            gnani_job_id = (
                res_data.get("job_id")
                or res_data.get("jobId")
                or res_data.get("id")
            )
            if not gnani_job_id and "data" in res_data:
                gnani_job_id = res_data["data"].get("job_id") or res_data["data"].get("jobId")

            if not gnani_job_id:
                raise HTTPException(
                    status_code=500,
                    detail=f"Could not extract job_id from Gnani response: {res.text}",
                )

            # 2. Save note record to DB
            db_note = AudioNote(
                id=str(uuid.uuid4()),
                filename=req.filename,
                file_url=req.public_url,
                gnani_job_id=gnani_job_id,
                status="starting",
            )
            db.add(db_note)
            db.commit()

            # 3. Start job in Gnani with rate-limit retry
            for attempt in range(3):
                start_res = await client.post(
                    f"{GNANI_BATCH_URL}/jobs/{gnani_job_id}/start", headers=headers
                )
                print(f"DEBUG - Start Job [{start_res.status_code}]: {start_res.text}")

                if start_res.status_code in [200, 202]:
                    db_note.status = "processing"
                    db.commit()
                    return {"id": db_note.id, "status": "processing"}

                if start_res.status_code == 429:
                    print(f"⚠️ Start Job rate limited (attempt {attempt + 1}/3). Retrying in 2s...")
                    await asyncio.sleep(2)
                else:
                    db_note.status = "failed"
                    db.commit()
                    raise HTTPException(
                        status_code=start_res.status_code,
                        detail=f"Gnani Start Job failed: {start_res.text}",
                    )

            db_note.status = "failed"
            db.commit()
            raise HTTPException(
                status_code=429, detail="Gnani API rate limit reached after retries."
            )

        except HTTPException:
            raise
        except Exception as e:
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/notes/{note_id}")
async def get_note_status(note_id: str, db: Session = Depends(get_db)):
    note = db.query(AudioNote).filter(AudioNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if note.status in ["completed", "failed"]:
        return note

    headers = {"X-API-Key-ID": GNANI_API_KEY}

    async with httpx.AsyncClient(timeout=30.0) as client:
        status_res = await client.get(
            f"{GNANI_BATCH_URL}/jobs/{note.gnani_job_id}", headers=headers
        )

        if status_res.status_code == 429:
            return note

        if status_res.status_code != 200:
            return note

        job_data = status_res.json()
        gnani_status = job_data.get("status")

        if gnani_status in ["FAILED", "START_FAILED", "CANCELLED"]:
            note.status = "failed"
            db.commit()
            return note

        if gnani_status == "COMPLETED":
            files_data = None
            for attempt in range(4):
                files_res = await client.get(
                    f"{GNANI_BATCH_URL}/jobs/{note.gnani_job_id}/files",
                    headers=headers,
                )
                if (
                    files_res.status_code == 200
                    and "RATE_LIMITED" not in files_res.text
                ):
                    files_data = files_res.json()
                    break
                await asyncio.sleep(2.5 * (attempt + 1))

            if not files_data or not files_data.get("data"):
                return note

            file_info = files_data["data"][0]
            if file_info.get("status") != "COMPLETED":
                note.status = "failed"
                db.commit()
                return note

            # 1. Fetch transcript from Gnani S3 result
            transcript_url = file_info["transcript_url"]
            transcript_res = await client.get(transcript_url)
            full_transcript = transcript_res.json().get(
                "full_transcript", "No speech detected."
            )

            # 2. Safely generate summary
            try:
                summary_text = await generate_gemini_summary(full_transcript)
            except Exception as e:
                print(f"⚠️ Summary error fallback: {str(e)}")
                summary_text = f"Transcript available, but summary generation failed: {str(e)}"

            # 3. Save final state to database
            note.transcript = full_transcript
            note.summary = summary_text
            note.status = "completed"
            db.commit()
            print("✅ Successfully saved transcript and summary!")

    return note


@app.get("/api/notes")
async def list_notes(db: Session = Depends(get_db)):
    notes = db.query(AudioNote).order_by(AudioNote.created_at.desc()).all()
    return notes