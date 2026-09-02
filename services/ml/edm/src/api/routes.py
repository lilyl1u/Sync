"""
API routes for ML service - Frontend integration with Modal
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Optional, Literal
import json
from pathlib import Path
from datetime import datetime
import asyncio
import uuid

router = APIRouter()

# In-memory job store (in production, use Redis or database)
job_store: Dict[str, Dict] = {}

class JobResponse(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "failed"]
    message: str
    created_at: str
    updated_at: str
    progress: Optional[float] = None
    result: Optional[Dict] = None
    error: Optional[str] = None

class GenerationRequest(BaseModel):
    num_samples: int = 10
    temperature: float = 0.9
    model_type: str = "vae"
    model_path: str = "pretrained_model.pt"


class UserSong(BaseModel):
    """User-entered song (no Spotify required)."""
    artist: str = ""
    name: str


class MatchSongsRequest(BaseModel):
    """Request to match user-entered songs to LMD MIDI files."""
    songs: List[UserSong]
    min_similarity: float = 0.75


class PipelineResponse(BaseModel):
    job_id: str
    status: str
    message: str
    pipeline_steps: List[str]




@router.post("/match-songs")
async def match_songs(request: MatchSongsRequest):
    """
    Match user-entered songs to LMD MIDI files (string/fuzzy matching).

    No Spotify required. User provides artist + song name.
    Output is saved to Modal volume for generate_from_matched.py.

    Example body:
        {"songs": [{"artist": "Noah Kahan", "name": "Call Your Mom"}]}
    """
    try:
        import sys
        scripts_path = Path(__file__).parent.parent.parent / "scripts"
        sys.path.insert(0, str(scripts_path))

        from match_songs_to_midi import app as match_app, match_tracks

        tracks = [{"artist": s.artist, "name": s.name} for s in request.songs]
        with match_app.run():
            result = match_tracks.remote(tracks, request.min_similarity)

        return {
            "status": "success",
            "matched_count": result["statistics"]["matched_count"],
            "unmatched_count": result["statistics"]["unmatched_count"],
            "match_rate": result["statistics"]["match_rate"],
            "total_tracks": result["statistics"]["total_user_tracks"],
            "message": f"Matched {result['statistics']['matched_count']} of {result['statistics']['total_user_tracks']} tracks",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/start-training")
async def start_training(user_id: str):
    """
    Start personalized model training

    Note: Training endpoint is a placeholder. In production, this would:
    1. Load matched MIDI files from Modal volume
    2. Trigger Modal training job with GPU resources
    3. Return job_id for tracking
    """
    job_id = str(uuid.uuid4())
    job_store[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "message": "Training pipeline not yet implemented - use pretrain_model.py directly",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "progress": 0.0,
        "type": "training",
        "user_id": user_id
    }

    return {
        "status": "pending",
        "job_id": job_id,
        "message": "Training requires manual execution: modal run scripts/pretrain_model.py",
        "user_id": user_id,
        "check_status": f"/api/ml/training-status/{job_id}"
    }


@router.get("/training-status/{job_id}", response_model=JobResponse)
async def get_training_status(job_id: str):
    """
    Get real-time status of any job (training, generation, etc.)

    Args:
        job_id: Unique job identifier returned from start endpoints

    Returns:
        JobResponse with current status, progress, and results

    Raises:
        HTTPException: If job_id not found
    """
    if job_id not in job_store:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    job = job_store[job_id]

    return JobResponse(
        job_id=job["job_id"],
        status=job["status"],
        message=job["message"],
        created_at=job["created_at"],
        updated_at=job["updated_at"],
        progress=job.get("progress"),
        result=job.get("result"),
        error=job.get("error")
    )

@router.get("/jobs")
async def list_jobs(
    status: Optional[str] = None,
    job_type: Optional[str] = None,
    limit: int = 50
):
    """
    List all jobs with optional filtering

    Args:
        status: Filter by status (queued, running, completed, failed)
        job_type: Filter by type (training, generation, etc.)
        limit: Maximum number of jobs to return

    Returns:
        List of jobs with their current status
    """
    jobs = list(job_store.values())

    # Apply filters
    if status:
        jobs = [j for j in jobs if j.get("status") == status]
    if job_type:
        jobs = [j for j in jobs if j.get("type") == job_type]

    # Sort by created_at descending (most recent first)
    jobs.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    # Limit results
    jobs = jobs[:limit]

    return {
        "total": len(jobs),
        "jobs": jobs,
        "filters": {
            "status": status,
            "type": job_type,
            "limit": limit
        }
    }

@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """
    Delete a job from the job store

    Args:
        job_id: Job identifier to delete

    Returns:
        Success confirmation

    Raises:
        HTTPException: If job_id not found
    """
    if job_id not in job_store:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    job = job_store.pop(job_id)

    return {
        "status": "success",
        "message": f"Job {job_id} deleted",
        "job_type": job.get("type"),
        "job_status": job.get("status")
    }


@router.get("/health")
async def health_check():
    """
    Health check endpoint with system status

    Returns:
        Service health status and basic statistics
    """
    total_jobs = len(job_store)
    running_jobs = len([j for j in job_store.values() if j.get("status") == "running"])
    failed_jobs = len([j for j in job_store.values() if j.get("status") == "failed"])
    completed_jobs = len([j for j in job_store.values() if j.get("status") == "completed"])

    return {
        "status": "healthy",
        "service": "ml-service",
        "modal_integration": "enabled",
        "job_statistics": {
            "total": total_jobs,
            "running": running_jobs,
            "completed": completed_jobs,
            "failed": failed_jobs
        }
    }
