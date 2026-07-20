from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "Local accounting and financial statement preparation API."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    api_router,
    prefix=settings.api_prefix,
)


@app.get("/", tags=["Application"])
def application_information() -> dict[str, str]:
    return {
        "message": settings.app_name,
        "environment": settings.environment,
        "health": f"{settings.api_prefix}/health",
        "documentation": "/docs",
    }