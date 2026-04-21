from fastapi import FastAPI

from app.api.routers.analysis import router as analysis_router
from app.config.runtime import get_runtime_config

_runtime_config = get_runtime_config()

app = FastAPI(
    title=_runtime_config.service_metadata.title,
    description=_runtime_config.service_metadata.description,
    version=_runtime_config.service_metadata.version,
)

app.include_router(analysis_router, prefix="/analysis", tags=["analysis"])


@app.get("/health", tags=["health"])
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
