#!/bin/bash
# ============================================================
# MANSA Terminal — Script d'installation Phase 1
# Automatise toute la mise en place locale
# Usage: bash setup.sh
# ============================================================

set -e  # Arrêter sur la première erreur

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  MANSA Terminal — Installation Phase 1${NC}"
echo -e "${BLUE}============================================${NC}"

# --- ÉTAPE 1 : Vérifier les prérequis ---
echo -e "\n${YELLOW}[1/7] Vérification des prérequis...${NC}"

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo -e "${RED}❌ $1 non trouvé. Installer : $2${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}✓${NC} $1 ($(command -v $1))"
}

check_command "docker" "https://docs.docker.com/get-docker/"
check_command "node" "https://nodejs.org/"
check_command "python3" "https://python.org/"
check_command "git" "https://git-scm.com/"

NODE_MAJOR=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo -e "${RED}❌ Node.js >= 20 requis (actuel: $(node -v))${NC}"
    exit 1
fi

PY_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)')
if [ "$PY_MINOR" -lt 11 ]; then
    echo -e "${RED}❌ Python >= 3.11 requis${NC}"
    exit 1
fi

echo -e "  ${GREEN}✓ Tous les prérequis sont OK${NC}"

# --- ÉTAPE 2 : Variables d'environnement ---
echo -e "\n${YELLOW}[2/7] Configuration des variables d'environnement...${NC}"

if [ ! -f .env ]; then
    cp .env.example .env

    # Générer des secrets sécurisés
    SECRET=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")
    JWT_SECRET=$(openssl rand -hex 64 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(64))")

    # Substitution selon le système (macOS vs Linux)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|change-me-generate-with-openssl-rand-hex-32|$SECRET|g" .env
        sed -i '' "s|change-me-generate-with-openssl-rand-hex-64|$JWT_SECRET|g" .env
    else
        sed -i "s|change-me-generate-with-openssl-rand-hex-32|$SECRET|g" .env
        sed -i "s|change-me-generate-with-openssl-rand-hex-64|$JWT_SECRET|g" .env
    fi

    echo -e "  ${GREEN}✓${NC} .env créé avec secrets générés"
    echo -e "  ${YELLOW}⚠ N'oublie pas d'ajouter ANTHROPIC_API_KEY dans .env${NC}"
else
    echo -e "  ${GREEN}✓${NC} .env existe déjà"
fi

# Frontend env
if [ ! -f apps/web/.env.local ]; then
    cp apps/web/.env.local.example apps/web/.env.local
    echo -e "  ${GREEN}✓${NC} apps/web/.env.local créé"
fi

# --- ÉTAPE 3 : Lancer la base de données ---
echo -e "\n${YELLOW}[3/7] Démarrage de PostgreSQL + Redis...${NC}"
docker compose -f infra/docker/docker-compose.dev.yml up -d db redis
echo -e "  ${GREEN}✓${NC} Services Docker démarrés"

# Attendre que PostgreSQL soit prêt
echo -n "  Attente de PostgreSQL"
for i in {1..30}; do
    if docker exec mansa_db pg_isready -U mansa &> /dev/null; then
        echo -e " ${GREEN}OK${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

# --- ÉTAPE 4 : Installer le backend ---
echo -e "\n${YELLOW}[4/7] Installation du backend FastAPI...${NC}"
cd apps/api

if [ ! -d venv ]; then
    python -m venv venv
    echo -e "  ${GREEN}✓${NC} Virtualenv créé"
fi

venv\Scripts\activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo -e "  ${GREEN}✓${NC} Dépendances Python installées"

# Charger les variables d'env
set -a
source ../../.env
set +a

# Migrations
alembic upgrade head
echo -e "  ${GREEN}✓${NC} Migrations Alembic appliquées (54 pays africains seedés)"

deactivate
cd ../..

# --- ÉTAPE 5 : Installer le frontend ---
echo -e "\n${YELLOW}[5/7] Installation du frontend Next.js...${NC}"
cd apps/web

if [ ! -d node_modules ]; then
    npm install --silent
    echo -e "  ${GREEN}✓${NC} Dépendances npm installées"
else
    echo -e "  ${GREEN}✓${NC} node_modules présent"
fi

cd ../..

# --- ÉTAPE 6 : Installer les pipelines Dagster ---
echo -e "\n${YELLOW}[6/7] Installation des pipelines Dagster...${NC}"
cd data/pipelines

if [ ! -d venv ]; then
    python -m venv venv
fi

venv\Scripts\activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
echo -e "  ${GREEN}✓${NC} Pipelines Dagster prêts"
deactivate
cd ../..

# --- ÉTAPE 7 : Récap final ---
echo -e "\n${BLUE}============================================${NC}"
echo -e "${GREEN}  ✓ Installation terminée !${NC}"
echo -e "${BLUE}============================================${NC}"

echo -e "\n${YELLOW}Pour démarrer MANSA Terminal :${NC}"
echo -e ""
echo -e "  ${BLUE}# Terminal 1 — API${NC}"
echo -e "  cd apps/api && venv\Scripts\activate"
echo -e "  uvicorn app.main:app --reload"
echo -e ""
echo -e "  ${BLUE}# Terminal 2 — Frontend${NC}"
echo -e "  cd apps/web && npm run dev"
echo -e ""
echo -e "  ${BLUE}# Terminal 3 — Pipelines (optionnel)${NC}"
echo -e "  cd data/pipelines && venv\Scripts\activate"
echo -e "  dagster dev -f definitions.py --port 3001"
echo -e ""
echo -e "${GREEN}Puis ouvrir :${NC}"
echo -e "  • Frontend  : http://localhost:3000"
echo -e "  • API docs  : http://localhost:8000/docs"
echo -e "  • Dagster   : http://localhost:3001"
echo -e ""
echo -e "${YELLOW}⚠ Avant de tester l'AI Analyst, ajoute ta clé Anthropic dans .env :${NC}"
echo -e "  ANTHROPIC_API_KEY=sk-ant-..."
