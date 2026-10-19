@echo off
cd /d "%~dp0"
py -3.13 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
if errorlevel 1 (
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
)