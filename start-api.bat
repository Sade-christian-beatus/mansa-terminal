@echo off
REM ============================================================
REM MANSA Terminal - Demarrage du backend API (Windows)
REM Double-cliquer ou lancer depuis cmd
REM ============================================================

cd /d "%~dp0\apps\api"

echo ============================================
echo  MANSA Terminal - API Backend
echo ============================================
echo.

if not exist "venv\Scripts\activate.bat" (
    echo [X] Virtualenv non trouve. Lance d'abord setup.ps1
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

REM Charger les variables d'environnement depuis .env
echo [*] Chargement des variables d'environnement...
for /f "usebackq tokens=1,* delims==" %%a in ("..\..\.env") do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" (
        set "%%a=%%b"
    )
)

echo [*] Demarrage d'Uvicorn sur http://localhost:8000
echo [*] Documentation : http://localhost:8000/docs
echo.
echo Pour arreter : Ctrl+C
echo.

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause
