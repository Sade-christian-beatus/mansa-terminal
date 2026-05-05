@echo off
REM ============================================================
REM MANSA Terminal - Demarrage des pipelines Dagster (Windows)
REM ============================================================

cd /d "%~dp0\data\pipelines"

echo ============================================
echo  MANSA Terminal - Pipelines Dagster
echo ============================================
echo.

if not exist "venv\Scripts\activate.bat" (
    echo [X] Virtualenv non trouve. Lance d'abord setup.ps1
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

REM Charger les variables d'environnement
for /f "usebackq tokens=1,* delims==" %%a in ("..\..\.env") do (
    if not "%%a"=="" if not "%%a:~0,1%"=="#" (
        set "%%a=%%b"
    )
)

echo [*] Demarrage de Dagster sur http://localhost:3001
echo.

dagster dev -f definitions.py --port 3001

pause
