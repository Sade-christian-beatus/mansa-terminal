@echo off
REM ============================================================
REM MANSA Terminal - Demarrage complet (TOUT EN UN)
REM Ouvre 4 fenetres : Docker + API + Web + Dagster
REM ============================================================

cd /d "%~dp0"

echo ============================================
echo  MANSA Terminal - Demarrage complet
echo ============================================
echo.

REM Verifier Docker
docker info >nul 2>&1
if errorlevel 1 (
    echo [X] Docker Desktop n'est pas demarre.
    echo     Lance Docker Desktop puis relance ce script.
    pause
    exit /b 1
)

echo [1/4] Demarrage des services Docker...
docker compose -f infra/docker/docker-compose.dev.yml up -d db redis
timeout /t 8 /nobreak >nul

echo [2/4] Ouverture du backend API...
start "MANSA - API Backend" cmd /k "%~dp0start-api.bat"
timeout /t 3 /nobreak >nul

echo [3/4] Ouverture du frontend Next.js...
start "MANSA - Frontend" cmd /k "%~dp0start-web.bat"
timeout /t 3 /nobreak >nul

echo [4/4] Ouverture des pipelines Dagster...
start "MANSA - Dagster" cmd /k "%~dp0start-dagster.bat"

echo.
echo [OK] Tous les services sont en cours de demarrage !
echo.
echo URLs :
echo   - Frontend  : http://localhost:3000
echo   - API docs  : http://localhost:8000/docs
echo   - Dagster   : http://localhost:3001
echo.
echo Patiente 30 secondes puis ouvre http://localhost:3000 dans ton navigateur
echo.
timeout /t 30 /nobreak
start http://localhost:3000

pause
