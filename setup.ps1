# ============================================================
# MANSA Terminal — Script d'installation Windows 11
# Equivalent PowerShell de setup.sh
#
# Usage (depuis PowerShell dans le dossier du projet) :
#   .\setup.ps1
#
# Si erreur "execution policy" :
#   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
# ============================================================

$ErrorActionPreference = "Stop"

# Couleurs (compatibles PowerShell 5.1 et 7+)
function Write-Info($msg)    { Write-Host $msg -ForegroundColor Cyan }
function Write-Step($msg)    { Write-Host $msg -ForegroundColor Yellow }
function Write-Success($msg) { Write-Host $msg -ForegroundColor Green }
function Write-Err($msg)     { Write-Host $msg -ForegroundColor Red }

Write-Info "============================================"
Write-Info "  MANSA Terminal - Installation Phase 1"
Write-Info "  Windows 11 - PowerShell"
Write-Info "============================================"

# ============================================================
# ETAPE 1 : Verifier les prerequis
# ============================================================
Write-Step "`n[1/7] Verification des prerequis..."

function Test-Command($cmd, $installUrl) {
    try {
        $null = Get-Command $cmd -ErrorAction Stop
        $version = & $cmd --version 2>&1 | Select-Object -First 1
        Write-Host "  [OK] $cmd ($version)" -ForegroundColor Green
        return $true
    } catch {
        Write-Err "  [X] $cmd non trouve. Installer : $installUrl"
        return $false
    }
}

$allOk = $true
$allOk = (Test-Command "docker"  "https://docs.docker.com/desktop/install/windows-install/") -and $allOk
$allOk = (Test-Command "node"    "https://nodejs.org/")                                       -and $allOk
$allOk = (Test-Command "python"  "https://python.org/")                                       -and $allOk
$allOk = (Test-Command "git"     "https://git-scm.com/")                                      -and $allOk

if (-not $allOk) {
    Write-Err "`nInstalle les outils manquants puis relance .\setup.ps1"
    exit 1
}

# Verifier Node version
$nodeVer = (node -v) -replace 'v',''
$nodeMajor = [int]($nodeVer.Split('.')[0])
if ($nodeMajor -lt 20) {
    Write-Err "  [X] Node.js >= 20 requis (actuel: v$nodeVer)"
    exit 1
}

# Verifier Python version
$pyVer = python --version 2>&1
if ($pyVer -match "Python (\d+)\.(\d+)") {
    $pyMajor = [int]$Matches[1]
    $pyMinor = [int]$Matches[2]
    if ($pyMajor -lt 3 -or ($pyMajor -eq 3 -and $pyMinor -lt 11)) {
        Write-Err "  [X] Python >= 3.11 requis (actuel: $pyVer)"
        exit 1
    }
}

# Verifier que Docker Desktop tourne
try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Docker non demarre" }
    Write-Host "  [OK] Docker Desktop est en cours d'execution" -ForegroundColor Green
} catch {
    Write-Err "  [X] Docker Desktop n'est pas demarre. Lance Docker Desktop puis relance ce script."
    exit 1
}

Write-Success "  [OK] Tous les prerequis sont OK"

# ============================================================
# ETAPE 2 : Variables d'environnement
# ============================================================
Write-Step "`n[2/7] Configuration des variables d'environnement..."

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"

    # Generer secrets aleatoires
    $bytes32 = New-Object byte[] 32
    $bytes64 = New-Object byte[] 64
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes32)
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes64)
    $secret    = ($bytes32 | ForEach-Object { $_.ToString("x2") }) -join ""
    $jwtSecret = ($bytes64 | ForEach-Object { $_.ToString("x2") }) -join ""

    # Substituer dans .env
    $content = Get-Content ".env" -Raw
    $content = $content -replace 'change-me-generate-with-openssl-rand-hex-32', $secret
    $content = $content -replace 'change-me-generate-with-openssl-rand-hex-64', $jwtSecret
    Set-Content ".env" -Value $content -NoNewline

    Write-Success "  [OK] .env cree avec secrets generes"
    Write-Step   "  [!] N'oublie pas d'ajouter ANTHROPIC_API_KEY dans .env"
} else {
    Write-Success "  [OK] .env existe deja"
}

# Frontend env
if (-not (Test-Path "apps\web\.env.local")) {
    Copy-Item "apps\web\.env.local.example" "apps\web\.env.local"
    Write-Success "  [OK] apps\web\.env.local cree"
}

# ============================================================
# ETAPE 3 : Lancer la base de donnees
# ============================================================
Write-Step "`n[3/7] Demarrage de PostgreSQL + Redis..."
docker compose -f infra/docker/docker-compose.dev.yml up -d db redis
if ($LASTEXITCODE -ne 0) {
    Write-Err "Erreur Docker Compose. Verifier que Docker Desktop tourne."
    exit 1
}
Write-Success "  [OK] Services Docker demarres"

# Attendre PostgreSQL
Write-Host -NoNewline "  Attente de PostgreSQL"
$ready = $false
for ($i = 1; $i -le 30; $i++) {
    docker exec mansa_db pg_isready -U mansa 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host " OK" -ForegroundColor Green
        $ready = $true
        break
    }
    Write-Host -NoNewline "."
    Start-Sleep -Seconds 1
}
if (-not $ready) {
    Write-Err "`nPostgreSQL n'a pas demarre dans les temps. Verifier les logs Docker."
    exit 1
}

# ============================================================
# ETAPE 4 : Backend FastAPI
# ============================================================
Write-Step "`n[4/7] Installation du backend FastAPI..."
Push-Location apps\api

if (-not (Test-Path "venv")) {
    python -m venv venv
    Write-Success "  [OK] Virtualenv cree"
}

# Activer le venv (Windows)
& "venv\Scripts\Activate.ps1"

python -m pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
Write-Success "  [OK] Dependances Python installees"

# Charger .env dans la session courante
Get-Content "..\..\.env" | ForEach-Object {
    if ($_ -match '^\s*([^#=\s][^=]*?)\s*=\s*(.*)$') {
        $name  = $Matches[1].Trim()
        $value = $Matches[2].Trim().Trim('"').Trim("'")
        [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

# Migrations Alembic
alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    Write-Err "Erreur migrations Alembic"
    Pop-Location
    exit 1
}
Write-Success "  [OK] Migrations Alembic appliquees (54 pays africains seedes)"

deactivate
Pop-Location

# ============================================================
# ETAPE 5 : Frontend Next.js
# ============================================================
Write-Step "`n[5/7] Installation du frontend Next.js..."
Push-Location apps\web

if (-not (Test-Path "node_modules")) {
    npm install --silent
    Write-Success "  [OK] Dependances npm installees"
} else {
    Write-Success "  [OK] node_modules present"
}

Pop-Location

# ============================================================
# ETAPE 6 : Pipelines Dagster
# ============================================================
Write-Step "`n[6/7] Installation des pipelines Dagster..."
Push-Location data\pipelines

if (-not (Test-Path "venv")) {
    python -m venv venv
}

& "venv\Scripts\Activate.ps1"
python -m pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
Write-Success "  [OK] Pipelines Dagster prets"
deactivate

Pop-Location

# ============================================================
# ETAPE 7 : Recap final
# ============================================================
Write-Info "`n============================================"
Write-Success "  [OK] Installation terminee !"
Write-Info "============================================"

Write-Step "`nPour demarrer MANSA Terminal, ouvre 3 fenetres PowerShell :`n"

Write-Info "  # Fenetre 1 - API Backend"
Write-Host "  cd apps\api"
Write-Host "  .\venv\Scripts\Activate.ps1"
Write-Host "  uvicorn app.main:app --reload"
Write-Host ""

Write-Info "  # Fenetre 2 - Frontend"
Write-Host "  cd apps\web"
Write-Host "  npm run dev"
Write-Host ""

Write-Info "  # Fenetre 3 - Pipelines (optionnel)"
Write-Host "  cd data\pipelines"
Write-Host "  .\venv\Scripts\Activate.ps1"
Write-Host "  dagster dev -f definitions.py --port 3001"
Write-Host ""

Write-Success "Puis ouvre dans ton navigateur :"
Write-Host "  - Frontend  : http://localhost:3000"
Write-Host "  - API docs  : http://localhost:8000/docs"
Write-Host "  - Dagster   : http://localhost:3001"
Write-Host ""

Write-Step "[!] Avant de tester l'AI Analyst, ajoute ta cle Anthropic dans .env :"
Write-Host "    ANTHROPIC_API_KEY=sk-ant-..."
Write-Host ""
Write-Step "Pour ouvrir .env :"
Write-Host "    notepad .env"
