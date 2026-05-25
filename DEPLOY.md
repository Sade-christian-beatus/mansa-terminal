# MANSA Terminal — Guide de déploiement production

Ce guide couvre les étapes manuelles qui ne peuvent pas être automatisées
(accès à des dashboards tiers). Les étapes code sont gérées automatiquement
par `render.yaml` (migration Alembic) et GitHub Actions (CI/CD + pipeline data).

---

## Prérequis

- Compte [Supabase](https://supabase.com) avec un projet créé
- Compte [Render](https://render.com) connecté à ce repo GitHub
- Compte [Upstash](https://upstash.com) pour Redis
- Compte [Anthropic](https://console.anthropic.com) pour la clé API Claude
- `gh` CLI installé (`winget install GitHub.cli` sur Windows)

---

## Étape 1 — Activer pgvector sur Supabase

**À faire UNE FOIS, avant le premier déploiement.**

pgvector est utilisé pour la colonne `embedding` de la knowledge base.
La migration Alembic échoue si l'extension n'est pas activée au préalable.

1. Ouvrir [app.supabase.com](https://app.supabase.com) → votre projet
2. Menu gauche : **Database** → **Extensions**
3. Chercher `vector` dans la liste
4. Cliquer le toggle → **Enable**
5. Vérifier que le statut passe à ✅ Enabled

---

## Étape 2 — Configurer les variables d'environnement sur Render

**À faire UNE FOIS après la création du service dans Render.**

1. Ouvrir [dashboard.render.com](https://dashboard.render.com)
2. Sélectionner le service **mansa-terminal**
3. Onglet **Environment** → Section **Environment Variables**
4. Renseigner les variables marquées `sync: false` dans `render.yaml` :

### Variables obligatoires (l'app ne démarre pas sans elles)

| Variable | Comment l'obtenir |
|----------|-------------------|
| `SECRET_KEY` | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_SECRET_KEY` | Même commande, valeur **différente** |
| `DATABASE_URL` | Supabase → Project Settings → Database → **Transaction pooler** (port 6543) → Connection string. Remplacer `postgresql://` par `postgresql+asyncpg://` |
| `DATABASE_URL_SYNC` | Supabase → Project Settings → Database → **Session pooler** (port 5432) → Connection string. Garder `postgresql://` |
| `REDIS_URL` | Upstash → Console → votre base → **Connection** → copier l'URL `rediss://...` |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys → Create key |

### Variables optionnelles (dégradation gracieuse si absentes)

| Variable | Utilité | Si absent |
|----------|---------|-----------|
| `SENTRY_DSN` | Monitoring erreurs | Désactivé silencieusement |
| `SMTP_USER` | Emails de vérification | Email non envoyé (log local) |
| `SMTP_PASSWORD` | Mot de passe application Gmail | Idem |
| `STRIPE_SECRET_KEY` | Paiements (Phase 2) | /billing/checkout retourne 503 |
| `STRIPE_WEBHOOK_SECRET` | Webhooks Stripe | Idem |
| `STRIPE_PRICE_STARTER` | Price ID plan Starter | Idem |
| `STRIPE_PRICE_PROFESSIONAL` | Price ID plan Professional | Idem |
| `STRIPE_PRICE_ENTERPRISE` | Price ID plan Enterprise | Idem |

> **Note Gmail SMTP** : utiliser un "Mot de passe d'application" (16 chars),
> pas le mot de passe de compte. Activer dans : Compte Google → Sécurité →
> Validation en 2 étapes → Mots de passe des applications.

### Vérifier que la migration a tourné

Après le premier déploiement, Render exécute automatiquement :
```
alembic upgrade head
```
Vérifier dans Render → **Logs** → chercher `Running migrations...` ou `INFO [alembic] Running upgrade`.

---

## Étape 3 — Ajouter le secret GitHub Actions pour le pipeline data

**À faire UNE FOIS pour activer l'ingestion automatique.**

1. Ouvrir votre repo GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Cliquer **New repository secret**
3. Nom : `DATABASE_URL_SYNC`
4. Valeur : la même URL que dans Render (Session pooler Supabase, port 5432, format `postgresql://...`)
5. Cliquer **Add secret**

Optionnel — Variable (pas secret) pour l'URL de l'API :
1. Onglet **Variables** → **New repository variable**
2. Nom : `RENDER_API_URL` / Valeur : `https://mansa-terminal.onrender.com`

---

## Étape 4 — Variable d'environnement Vercel (frontend)

`vercel.json` utilise `@api_url` — une variable Vercel à créer une seule fois.

1. Ouvrir [vercel.com](https://vercel.com) → votre projet `mansa-terminal`
2. **Settings** → **Environment Variables**
3. Ajouter :
   - Nom : `NEXT_PUBLIC_API_URL`
   - Valeur : `https://mansa-terminal.onrender.com`
   - Environnements : ✅ Production ✅ Preview
4. Redéployer le projet (ou push sur `main`)

---

## Étape 6 — Première ingestion de données

Une fois les étapes 1-4 terminées, déclencher l'ingestion initiale :

```bash
# Option A : depuis le terminal (nécessite gh CLI)
bash scripts/trigger_ingestion.sh both

# Option B : depuis GitHub
# Actions → MANSA Data Ingestion → Run workflow → Source: both
```

L'ingestion dure ~20 min (IMF WEO + World Bank WDI + seed knowledge base).
Résultat : les graphiques affichent des données réelles (badge "DEMO" disparaît).

Pour tester sans écrire en DB :
```bash
bash scripts/trigger_ingestion.sh both true   # dry-run
```

---

## Étape 7 — Seed de la knowledge base AI (optionnel — inclus dans l'ingestion)

Peuple la base de connaissances pour améliorer les réponses de l'AI Analyst :

```bash
# Depuis le repo local (nécessite DATABASE_URL_SYNC)
DATABASE_URL_SYNC="postgresql://..." python scripts/seed_knowledge.py

# Dry-run pour vérifier le contenu
python scripts/seed_knowledge.py --dry-run
```

10 documents analytiques (FMI Article IV + rapports BM) pour :
NGA, ZAF, KEN, EGY, GHA, MAR, SEN, CIV, CMR, ETH.

---

## Keepalive — Render Free cold start

Le fichier `.github/workflows/keepalive.yml` ping `/health` toutes les **5 minutes**
pour empêcher Render Free de s'endormir (seuil : 15 min d'inactivité).

Ce workflow est activé automatiquement sur push vers `main`.
Aucune configuration supplémentaire nécessaire.

Pour vérifier que ça tourne :
GitHub → **Actions** → **Render Keepalive** → vérifier les runs récents.

---

## Checklist de go-live

```
[ ] pgvector activé dans Supabase Dashboard (Étape 1)
[ ] Variables Render configurées — 6 obligatoires minimum (Étape 2)
[ ] Premier deploy Render réussi — "alembic upgrade head" dans les logs (Étape 2)
[ ] Secret DATABASE_URL_SYNC ajouté dans GitHub Actions (Étape 3)
[ ] NEXT_PUBLIC_API_URL configuré dans Vercel Dashboard (Étape 4)
[ ] Première ingestion déclenchée et terminée sans erreur (Étape 6)
[ ] seed_knowledge.py exécuté — 10 documents en DB (inclus dans l'ingestion)
[ ] Test manuel : s'inscrire → accéder au dashboard → poser une question AI
[ ] Workflow keepalive visible dans GitHub Actions (runs toutes les 5 min)
```

---

## Commandes utiles

```bash
# Générer des clés sécurisées
python -c "import secrets; print(secrets.token_hex(32))"

# Tester la migration localement
DATABASE_URL_SYNC="postgresql://..." alembic upgrade head

# Vérifier les tables créées (psql)
psql "$DATABASE_URL_SYNC" -c "\dt"

# Déclencher l'ingestion manuellement
bash scripts/trigger_ingestion.sh imf          # IMF seulement
bash scripts/trigger_ingestion.sh worldbank    # World Bank seulement
bash scripts/trigger_ingestion.sh both         # Les deux

# Seed la knowledge base
DATABASE_URL_SYNC="postgresql://..." python scripts/seed_knowledge.py
```
