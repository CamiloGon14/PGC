@echo off
cd /d "%~dp0"
echo ========================================================
echo Servidor Frontend - Hospital de Ubate
echo Abriendo en: http://localhost:5500/index.html
echo ========================================================
py -3.13 -m http.server 5500
