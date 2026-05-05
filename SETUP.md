# MANSA Terminal — Installation sur Windows 11

> Guide spécifique **Windows 11** pour HP EliteBook (et tout autre PC Windows)
> Estimation : **45–60 minutes** la première fois (téléchargements compris)

---

## 📋 Sommaire

1. [Installer les prérequis](#1-installer-les-prérequis)
2. [Configuration PowerShell](#2-configuration-powershell)
3. [Installation MANSA — méthode rapide](#3-installation-rapide)
4. [Installation manuelle pas-à-pas](#4-installation-manuelle)
5. [Démarrer MANSA Terminal](#5-démarrer-mansa-terminal)
6. [Première utilisation](#6-première-utilisation)
7. [Troubleshooting Windows](#7-troubleshooting-windows)

---

## 1. Installer les prérequis

Windows 11 a besoin de 4 outils. **Installe-les dans cet ordre.**

### 1.1 — Docker Desktop pour Windows

📥 **Télécharger** : https://docs.docker.com/desktop/install/windows-install/

Pendant l'installation :
- ✅ Cocher « **Use WSL 2 instead of Hyper-V** »
- ✅ Cocher « Add shortcut to desktop »
- Redémarrer l'ordinateur quand demandé

Après le redémarrage, **lance Docker Desktop** depuis le menu démarrer. La première fois, ça prend 1-2 minutes pour démarrer (icône baleine en bas à droite passe au vert).

⚠️ **Docker Desktop doit toujours être lancé avant MANSA Terminal.**

### 1.2 — Node.js 22 (LTS)

📥 **Télécharger** : https://nodejs.org/ (clique sur la version LTS, actuellement 22.x)

Pendant l'installation :
- ✅ Cocher « Automatically install necessary tools » (en bas)
- Ne touche à rien d'autre, clique « Next » jusqu'à la fin

Une fenêtre PowerShell va s'ouvrir pour installer Chocolatey + outils — laisse-la finir (5–10 minutes).

### 1.3 — Python 3.12

📥 **Télécharger** : https://www.python.org/downloads/

⚠️ **TRÈS IMPORTANT** sur le premier écran d'installation :
- ✅ **Cocher « Add python.exe to PATH »** (en bas, avant de cliquer Install)

Sinon Python ne sera pas reconnu en ligne de commande et tu devras tout réinstaller.

### 1.4 — Git pour Windows

📥 **Télécharger** : https://git-scm.com/download/win

Pendant l'installation, garde toutes les options par défaut. Ça installe aussi **Git Bash** au passage (utile en backup).

### 1.5 — Vérification

Ouvre une nouvelle **PowerShell** (Windows + R → `powershell` → Entrée) et tape :

```powershell
docker --version
node --version
python --version
git --version
```

Tu dois voir 4 versions affichées. Si l'une dit « non reconnu », réinstalle l'outil concerné en t'assurant de bien cocher « Add to PATH ».

---

## 2. Configuration PowerShell

Windows bloque par défaut l'exécution de scripts PowerShell. Il faut autoriser l'exécution **une seule fois**.

Ouvre **PowerShell en tant qu'Administrateur** (clic droit sur le menu démarrer → « Terminal (Admin) ») et tape :

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Tape `O` (ou `Y`) puis Entrée pour confirmer. Ferme cette fenêtre Admin.

---

## 3. Installation rapide

### Étape 3.1 — Décompresser le projet

Décompresse `mansa-terminal-phase1.zip` à l'emplacement de ton choix. Recommandé : `C:\Users\HP EliteBook\mansa-terminal`

⚠️ **Évite les noms de dossiers avec espaces** si possible. Si ton chemin contient un espace (`HP EliteBook`), pas de souci, le script gère ça.

### Étape 3.2 — Récupérer ta clé Anthropic

Va sur https://console.anthropic.com → **API Keys** → **Create Key** → copie la clé qui commence par `sk-ant-...`

### Étape 3.3 — Lancer l'installation

Ouvre une **PowerShell normale** (pas admin) et tape :

```powershell
cd "C:\Users\HP EliteBook\mansa-terminal"
.\setup.ps1
```

Le script va :
- ✅ Vérifier que Docker, Node, Python, Git sont installés
- ✅ Vérifier que Docker Desktop tourne
- ✅ Générer les secrets (SECRET_KEY, JWT_SECRET_KEY)
- ✅ Lancer PostgreSQL + Redis dans Docker
- ✅ Créer le venv Python et installer les dépendances backend
- ✅ Appliquer les migrations Alembic (54 pays africains)
- ✅ Installer les dépendances npm du frontend
- ✅ Préparer les pipelines Dagster

Durée : 8–12 minutes selon ta connexion internet.

### Étape 3.4 — Ajouter ta clé Anthropic

```powershell
notepad .env
```

Cherche la ligne `ANTHROPIC_API_KEY=sk-ant-...` et remplace par ta vraie clé. Sauvegarde et ferme Notepad.

---

## 4. Installation manuelle

Si `setup.ps1` plante quelque part, voici comment tout faire à la main.

### 4.1 — Variables d'environnement

Dans PowerShell, dans le dossier du projet :

```powershell
# Copier le template
Copy-Item .env.example .env

# Générer SECRET_KEY (64 caractères hex)
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$secret = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
Write-Host "SECRET_KEY = $secret"

# Générer JWT_SECRET_KEY (128 caractères)
$bytes = New-Object byte[] 64
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$jwtSecret = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
Write-Host "JWT_SECRET_KEY = $jwtSecret"
```

Ouvre `.env` dans Notepad (`notepad .env`) et remplace les placeholders par les valeurs générées + ta clé Anthropic.

### 4.2 — Démarrer Docker

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d db redis

# Attendre 10 secondes
Start-Sleep -Seconds 10

# Vérifier
docker compose -f infra/docker/docker-compose.dev.yml ps
```

Tu dois voir `mansa_db` et `mansa_redis` avec le statut `healthy`.

### 4.3 — Backend FastAPI

```powershell
cd apps\api

# Créer le virtualenv
python -m venv venv

# Activer le virtualenv
.\venv\Scripts\Activate.ps1

# Installer les dépendances
pip install -r requirements.txt

# Charger les variables d'env (PowerShell)
Get-Content ..\..\.env | ForEach-Object {
    if ($_ -match '^\s*([^#=\s][^=]*?)\s*=\s*(.*)$') {
        [System.Environment]::SetEnvironmentVariable(
            $Matches[1].Trim(),
            $Matches[2].Trim().Trim('"').Trim("'"),
            "Process"
        )
    }
}

# Migrations Alembic (crée les tables + 54 pays)
alembic upgrade head

# Vérifier que ça a marché
docker exec mansa_db psql -U mansa -d mansa_db -c "SELECT COUNT(*) FROM countries;"
# → Devrait afficher 54

# Retour au dossier racine
cd ..\..
```

### 4.4 — Frontend Next.js

```powershell
cd apps\web
Copy-Item .env.local.example .env.local
npm install
cd ..\..
```

### 4.5 — Pipelines Dagster

```powershell
cd data\pipelines
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
deactivate
cd ..\..
```

---

## 5. Démarrer MANSA Terminal

### Méthode 1 : Tout en un clic (recommandé)

Double-clique sur **`start-all.bat`** dans l'explorateur Windows. Ça ouvre 3 fenêtres automatiquement (API, Web, Dagster) et lance ton navigateur sur http://localhost:3000.

### Méthode 2 : Service par service

Double-clique sur les `.bat` dans cet ordre :
1. **`start-docker.bat`** — Lance PostgreSQL + Redis
2. **`start-api.bat`** — Lance l'API FastAPI (port 8000)
3. **`start-web.bat`** — Lance Next.js (port 3000)
4. **`start-dagster.bat`** — Lance Dagster (port 3001) — optionnel

### Méthode 3 : PowerShell manuel

Ouvre 3 fenêtres PowerShell.

**Fenêtre 1 — API :**
```powershell
cd "C:\Users\HP EliteBook\mansa-terminal\apps\api"
.\venv\Scripts\Activate.ps1
Get-Content ..\..\.env | ForEach-Object {
    if ($_ -match '^\s*([^#=\s][^=]*?)\s*=\s*(.*)$') {
        [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim().Trim('"').Trim("'"), "Process")
    }
}
uvicorn app.main:app --reload
```

**Fenêtre 2 — Frontend :**
```powershell
cd "C:\Users\HP EliteBook\mansa-terminal\apps\web"
npm run dev
```

**Fenêtre 3 — Dagster :**
```powershell
cd "C:\Users\HP EliteBook\mansa-terminal\data\pipelines"
.\venv\Scripts\Activate.ps1
dagster dev -f definitions.py --port 3001
```

### URLs

| Service | URL |
|---------|-----|
| **Frontend MANSA** | http://localhost:3000 |
| **API Documentation Swagger** | http://localhost:8000/docs |
| **Dagster UI (pipelines)** | http://localhost:3001 |

---

## 6. Première utilisation

### 6.1 — Charger des données de test (rapide)

Dans une **nouvelle fenêtre PowerShell** :

```powershell
cd "C:\Users\HP EliteBook\mansa-terminal\apps\api"
.\venv\Scripts\Activate.ps1
Get-Content ..\..\.env | ForEach-Object {
    if ($_ -match '^\s*([^#=\s][^=]*?)\s*=\s*(.*)$') {
        [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim().Trim('"').Trim("'"), "Process")
    }
}
python scripts\seed_test_data.py
```

→ Insère ~100 points de données pour Nigeria, South Africa, Kenya, Ghana, Sénégal.

### 6.2 — Charger les vraies données (Dagster)

Va sur http://localhost:3001 :
1. Clique « Assets » dans la sidebar
2. Sélectionne `imf_weo_all_indicators`
3. Clique « Materialize » → attends 5–10 minutes
4. Puis lance `imf_weo_to_database` pour charger en base

### 6.3 — Créer un compte utilisateur

```powershell
# PowerShell
$body = @{
    email = "test@mansa.ai"
    password = "TestPassword123!"
    full_name = "Dr. Kodzovi"
    organization = "MANSA"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/api/auth/register" `
    -Method POST -Body $body -ContentType "application/json"
```

### 6.4 — Activer un abonnement (sans Stripe)

```powershell
cd "C:\Users\HP EliteBook\mansa-terminal\apps\api"
.\venv\Scripts\Activate.ps1
python scripts\activate_test_subscription.py test@mansa.ai professional
```

### 6.5 — Tester l'AI Analyst

Sur http://localhost:3000 → clique « AI Analyst » dans la sidebar → pose une question :
> « Compare la dette publique du Nigeria et du Ghana sur 5 ans »

---

## 7. Troubleshooting Windows

### ❌ « .ps1 ne peut pas être chargé car l'exécution de scripts est désactivée »

```powershell
# PowerShell en Admin :
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### ❌ « python n'est pas reconnu »

Réinstalle Python en cochant **« Add python.exe to PATH »** au début de l'installation. Ou ajoute manuellement `C:\Users\<TonUser>\AppData\Local\Programs\Python\Python312` au PATH système.

### ❌ « docker n'est pas reconnu »

- Vérifie que Docker Desktop est installé
- Lance Docker Desktop depuis le menu démarrer
- Attends que l'icône baleine en bas à droite passe au vert
- Réessaie

### ❌ « Cannot connect to the Docker daemon »

Docker Desktop n'est pas démarré. Lance-le depuis le menu démarrer.

### ❌ Port 5432 ou 3000 déjà utilisé

```powershell
# Voir ce qui utilise le port
netstat -ano | findstr :5432

# Tuer le processus (remplace PID par le numéro affiché)
taskkill /PID <PID> /F
```

Ou modifie le port dans `infra/docker/docker-compose.dev.yml` :
```yaml
ports:
  - "5433:5432"  # Au lieu de 5432:5432
```
Et adapte `DATABASE_URL` dans `.env`.

### ❌ Erreur « Cannot find module » dans le frontend

```powershell
cd apps\web
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### ❌ Erreur Alembic « target_metadata is None »

Vérifie que `apps/api/.env` est bien chargé dans la session courante :
```powershell
Get-Content ..\..\.env | ForEach-Object {
    if ($_ -match '^\s*([^#=\s][^=]*?)\s*=\s*(.*)$') {
        [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim().Trim('"').Trim("'"), "Process")
    }
}
```

### ❌ « ANTHROPIC_API_KEY missing » quand tu testes l'AI

Édite `.env` et ajoute la clé :
```powershell
notepad .env
```
Puis **redémarre l'API** (Ctrl+C dans la fenêtre puis relance `start-api.bat`).

### ❌ Reset complet (tout recommencer)

```powershell
# Stopper et supprimer Docker
docker compose -f infra/docker/docker-compose.dev.yml down -v

# Supprimer les venvs et node_modules
Remove-Item -Recurse -Force apps\api\venv
Remove-Item -Recurse -Force apps\web\node_modules
Remove-Item -Recurse -Force data\pipelines\venv

# Relancer l'installation
.\setup.ps1
```

---

## ✅ Checklist Phase 1

- [ ] Docker Desktop tourne (icône baleine verte)
- [ ] PowerShell ExecutionPolicy = RemoteSigned
- [ ] `.env` rempli avec ta clé Anthropic
- [ ] PostgreSQL + Redis healthy (`docker compose ps`)
- [ ] 54 pays dans la base (`SELECT COUNT(*) FROM countries`)
- [ ] API accessible sur http://localhost:8000/docs
- [ ] Next.js accessible sur http://localhost:3000
- [ ] Dagster accessible sur http://localhost:3001
- [ ] Compte créé via `/api/auth/register`
- [ ] Abonnement activé manuellement
- [ ] AI Analyst répond aux questions

---

## 💡 Astuce : Crée des raccourcis sur ton bureau

Clic droit sur le bureau → Nouveau → Raccourci → entre le chemin vers `start-all.bat`. Tu pourras lancer tout MANSA Terminal en double-cliquant sur le raccourci.

---

**Contact :** Dr. Kodzovi Senu Abalo · kodzovi@mansa.ai
