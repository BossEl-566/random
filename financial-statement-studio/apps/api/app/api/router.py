from fastapi import APIRouter

from app.api.routes.companies import (
    router as companies_router,
)
from app.api.routes.financial_reports import (
    router as financial_reports_router,
)
from app.api.routes.health import (
    router as health_router,
)


api_router = APIRouter()

api_router.include_router(
    health_router,
    prefix="/health",
    tags=["Health"],
)

api_router.include_router(
    companies_router,
    prefix="/companies",
    tags=["Companies"],
)

api_router.include_router(
    financial_reports_router,
    prefix="/financial-reports",
    tags=["Financial Reports"],
)