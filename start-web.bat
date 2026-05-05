@echo off
REM ============================================================
REM MANSA Terminal - Demarrage du frontend Next.js (Windows)
REM ============================================================

cd /d "%~dp0\apps\web"

echo ============================================
echo  MANSA Terminal - Frontend Next.js
echo ============================================
echo.

if not exist "node_modules" (
    echo [*] Installation des dependances npm...
    call npm install
)

echo [*] Demarrage de Next.js sur http://localhost:3000
echo.
echo Pour arreter : Ctrl+C
echo.

call npm run dev

pause
