@echo off
echo ========================================================
echo Iniciando Sistema Hospital de Ubate MVP
echo ========================================================
echo Iniciando Backend en puerto 8000...
start "Backend FastAPI (Puerto 8000)" cmd /k "cd /d %~dp0backend && start.bat"

echo Iniciando Frontend en puerto 5500...
start "Frontend Web (Puerto 5500)" cmd /k "cd /d %~dp0frontend && start.bat"

echo.
echo Todo listo! Puedes acceder en tu navegador a:
echo  - Formulario de Pre-registro: http://localhost:5500/index.html
echo  - Modulo Acompanante:         http://localhost:5500/companion.html
echo  - Documentacion Swagger API:  http://localhost:8000/docs
echo ========================================================
pause
