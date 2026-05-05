@echo off
REM ============================================================
REM MANSA Terminal - Demarrage Docker (PostgreSQL + Redis)
REM ============================================================

cd /d "%~dp0"

echo ============================================
echo  MANSA Terminal - Docker Services
echo ============================================
echo.

echo [*] Verification de Docker Desktop...
docker info >nul 2>&1
if errorlevel 1 (
    echo [X] Docker Desktop n'est pas demarre.
    echo     Lance Docker Desktop puis relance ce script.
    pause
    exit /b 1
)

echo [*] Demarrage de PostgreSQL et Redis...
docker compose -f infra/docker/docker-compose.dev.yml up -d db redis

echo.
echo [*] Statut des services :
docker compose -f infra/docker/docker-compose.dev.yml ps

echo.
echo [OK] Services demarres. Tu peux maintenant lancer :
echo      - start-api.bat
echo      - start-web.bat
echo      - start-dagster.bat
echo.
pause
