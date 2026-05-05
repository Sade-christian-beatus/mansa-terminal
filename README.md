# MANSA Terminal 🌍

> Africa's AI-Powered Macro-Fiscal Intelligence Platform

**Version :** 1.0 — Phase 1 MVP  
**Stack :** Next.js 14 · FastAPI · PostgreSQL/TimescaleDB · Dagster · Claude API  
**Cible :** DFIs, fonds PE/VC, gouvernements, sociétés minières

---

## 🚀 Démarrage rapide

### Sur Windows 11

1. **Installer les prérequis** : Docker Desktop, Node.js 22, Python 3.12, Git
2. **Décompresser** le projet (ex: `C:\Users\HP EliteBook\mansa-terminal`)
3. **Ouvrir PowerShell** dans le dossier du projet
4. **Autoriser les scripts** (une seule fois) :
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```
5. **Lancer l'installation** :
   ```powershell
   .\setup.ps1
   ```
6. **Ajouter ta clé Anthropic** dans `.env` :
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
7. **Démarrer tout** : double-clique sur `start-all.bat`

📖 **Guide complet Windows** → [SETUP.md](./SETUP.md)

### Sur Mac / Linux

```bash
bash setup.sh
```

---

## 📁 Structure du projet

```
mansa-terminal/
├── apps/
│   ├── api/          # Backend FastAPI (Python 3.12)
│   └── web/          # Frontend Next.js 14 (TypeScript)
├── data/
│   └── pipelines/    # Dagster — ingestion IMF, World Bank...
├── infra/
│   └── docker/       # Docker Compose dev
├── setup.ps1         # 🪟 Installation Windows 11
├── setup.sh          # 🐧 Installation Linux/Mac
├── start-all.bat     # 🪟 Démarrage tout-en-un Windows
├── start-api.bat     # 🪟 Démarrage API
├── start-web.bat     # 🪟 Démarrage frontend
├── start-dagster.bat # 🪟 Démarrage pipelines
└── start-docker.bat  # 🪟 Démarrage PostgreSQL+Redis
```

## 🗺️ Roadmap

| Phase | Timeline | Objectif |
|-------|----------|----------|
| **1 — MVP** ✅ | Mois 1–3 | 10 beta testers, Macro Dashboard + AI Analyst |
| **2 — Expansion** | Mois 4–6 | 54 pays, Markets + Climate, 25–50 seats payants |
| **3 — HF Data** | Mois 7–12 | MEAI, Nightlights, AIS, 100+ seats |
| **4 — Scale** | Mois 12–24 | Nowcasts, Mobile App, Série A |

## 🌐 URLs locales

Une fois démarré :
- **Frontend MANSA** : http://localhost:3000
- **API Documentation** : http://localhost:8000/docs
- **Dagster UI** : http://localhost:3001

## 🔐 Configuration

Tous les secrets sont dans `.env` (jamais commit dans Git).

Variables obligatoires :
- `ANTHROPIC_API_KEY` — clé Claude API ([console.anthropic.com](https://console.anthropic.com))
- `SECRET_KEY` — généré automatiquement par `setup.ps1` / `setup.sh`
- `JWT_SECRET_KEY` — généré automatiquement

Variables optionnelles (Phase 2) :
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — paiements
- `AWS_*` — déploiement production

## 📚 Documentation

- [SETUP.md](./SETUP.md) — Guide d'installation détaillé Windows 11
- API Docs interactives : http://localhost:8000/docs (après démarrage)

## 👤 Contact

**Dr. Kodzovi Senu Abalo** — kodzovi@mansa.ai — [mansa.ai](https://mansa.ai)
