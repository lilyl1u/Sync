"""FastAPI entrypoint for the EDM / MIDI matching service."""

from datetime import datetime
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import router as ml_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Sync ML Service",
    description="MIDI matching, EDM generation, and Modal job routes",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ml_router, prefix="/api/ml", tags=["ml"])


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ml-service",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.on_event("startup")
async def startup_event():
    logger.info("ML service starting up")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
