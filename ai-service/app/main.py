from fastapi import FastAPI
from app.api import health, analyze
from app.middleware.correlation import CorrelationIdMiddleware

app = FastAPI(title="Fitness AI Service", version="0.1.0")
app.add_middleware(CorrelationIdMiddleware)
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(analyze.router, prefix="/api/v1", tags=["analyze"])