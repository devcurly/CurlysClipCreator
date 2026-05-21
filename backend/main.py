import os
import json
import asyncio
import uuid
import traceback
import time
from pathlib import Path
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
import uvicorn

from detector import detect_scenes_ffmpeg, get_video_duration, build_scene_ranges
from splitter import split_all_scenes_sync

OUTPUT_ROOT = Path.home() / "Videos" / "Curlys Clip Creator"
STATIC_DIR = Path(os.environ.get("STATIC_DIR", str(Path(__file__).resolve().parent.parent / "frontend" / "dist")))

app = FastAPI(title="Curlys Clip Creator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_jobs: dict[str, dict] = {}
websocket_clients: dict[str, list[WebSocket]] = {}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(400, "No file provided")

    ext = Path(file.filename).suffix.lower()
    allowed = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".ts"}
    if ext not in allowed:
        raise HTTPException(400, f"Unsupported format: {ext}")

    title = Path(file.filename).stem
    safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in title)
    job_id = str(uuid.uuid4())
    output_dir = str(OUTPUT_ROOT / safe_title)

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    video_path = str(Path(output_dir) / f"input{ext}")

    content = await file.read()
    with open(video_path, "wb") as f:
        f.write(content)

    try:
        duration = get_video_duration(video_path)
    except Exception as e:
        raise HTTPException(500, f"Could not read video: {e}")

    timestamps = detect_scenes_ffmpeg(video_path)
    scenes = build_scene_ranges(timestamps, duration)

    active_jobs[job_id] = {
        "video_path": video_path,
        "output_dir": output_dir,
        "scenes": scenes,
        "duration": duration,
        "status": "analyzed",
        "title": title,
        "filename": file.filename
    }

    return {
        "job_id": job_id,
        "filename": file.filename,
        "title": title,
        "output_dir": output_dir,
        "duration": duration,
        "scene_count": len(scenes),
        "scenes": [
            {"index": s["index"], "start": round(s["start"], 2),
             "end": round(s["end"], 2), "duration": round(s["end"] - s["start"], 2)}
            for s in scenes
        ]
    }


@app.post("/api/split/{job_id}")
async def start_split(job_id: str):
    job = active_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found. Try re-uploading the video.")
    if job.get("status") == "splitting":
        raise HTTPException(400, "Already splitting")

    job["status"] = "splitting"
    job["progress"] = 0
    job["total"] = len(job["scenes"])

    asyncio.create_task(_run_split(job_id, job))
    return {"status": "splitting", "job_id": job_id}


async def _run_split(job_id: str, job: dict):
    try:
        def split_worker():
            return split_all_scenes_sync(
                job["video_path"], job["output_dir"], job["scenes"]
            )

        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(None, split_worker)

        job["status"] = "completed"
        job["results"] = results

        msg = json.dumps({"type": "complete", "scenes": len(results), "results": results})
    except Exception as e:
        job["status"] = "error"
        error_msg = f"{type(e).__name__}: {e}"
        msg = json.dumps({"type": "error", "message": error_msg})

    if job_id in websocket_clients:
        for ws in websocket_clients[job_id][:]:
            try:
                await ws.send_text(msg)
            except Exception:
                pass


@app.get("/api/status/{job_id}")
def get_status(job_id: str):
    job = active_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return {
        "job_id": job_id,
        "status": job["status"],
        "progress": job.get("progress", 0),
        "total": job.get("total", 0),
        "scene_count": len(job["scenes"]),
        "results": job.get("results", []),
        "output_dir": job.get("output_dir", "")
    }


@app.get("/api/download/{job_id}/{filename}")
def download_file(job_id: str, filename: str):
    job = active_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    file_path = Path(job["output_dir"]) / filename
    if not file_path.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(str(file_path), media_type="video/mp4", filename=filename)


@app.post("/api/clear/{job_id}")
def clear_job(job_id: str):
    active_jobs.pop(job_id, None)
    websocket_clients.pop(job_id, None)
    return {"status": "cleared"}


@app.websocket("/ws/{job_id}")
async def websocket_endpoint(websocket: WebSocket, job_id: str):
    await websocket.accept()
    if job_id not in websocket_clients:
        websocket_clients[job_id] = []
    websocket_clients[job_id].append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if job_id in websocket_clients:
            websocket_clients[job_id] = [ws for ws in websocket_clients[job_id] if ws != websocket]
            if not websocket_clients[job_id]:
                del websocket_clients[job_id]


@app.get("/")
async def serve_root():
    if not STATIC_DIR.exists():
        raise HTTPException(404, "Frontend not built")
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return HTMLResponse(index_path.read_text(), media_type="text/html")
    return HTMLResponse("<h1>Curlys Clip Creator</h1><p>Frontend not built</p>")


@app.get("/{full_path:path}")
async def serve_static(full_path: str):
    if not STATIC_DIR.exists():
        raise HTTPException(404, "Frontend not built")

    file_path = STATIC_DIR / full_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(str(file_path))

    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return HTMLResponse(index_path.read_text())

    raise HTTPException(404, "Not found")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False, log_level="warning")
