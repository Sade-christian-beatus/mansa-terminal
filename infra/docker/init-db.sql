-- ============================================================
-- MANSA Terminal — Init PostgreSQL
-- Exécuté automatiquement au premier lancement Docker
-- ============================================================

-- Extensions requises
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Optimisations TimescaleDB pour MANSA workload
ALTER DATABASE mansa_db SET timezone = 'UTC';
ALTER DATABASE mansa_db SET statement_timeout = '60s';
ALTER DATABASE mansa_db SET work_mem = '32MB';

-- Création d'une base séparée pour Dagster (séparation des concerns)
SELECT 'CREATE DATABASE mansa_dagster'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mansa_dagster')\gexec
