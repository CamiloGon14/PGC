from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.settings import settings
from app.api.auth import router as auth_router
from app.api.patients import router as patients_router
from app.api.staff import router as staff_router
from app.api.rooms import router as rooms_router
from app.api.doctors import router as doctors_router
from app.api.chatbot import router as chatbot_router

app = FastAPI(
    title="Hospital de Ubaté - API",
    version="1.0.0",
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url="/redoc" if settings.environment == "development" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins + ["null"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(patients_router)
app.include_router(staff_router)
app.include_router(rooms_router)
app.include_router(doctors_router)
app.include_router(chatbot_router)


@app.get("/")
async def root():
    return {
        "message": "API Hospital de Ubaté en línea",
        "docs": "/docs",
        "health": "/health",
        "frontend": "http://localhost:5500/index.html"
    }


@app.get("/health")
async def health():
    return {"status": "ok", "environment": settings.environment}