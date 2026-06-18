#!/usr/bin/env python3
"""
MANSA Terminal — Génération des embeddings de la knowledge base (RAG sémantique)

Calcule les vecteurs OpenAI text-embedding-3-small (1536 dim) pour les documents
de `knowledge_documents` et les écrit dans la colonne `embedding` (pgvector).
Active la recherche sémantique dans l'AI Analyst (app/routers/ai_analyst.py).

Pré-requis :
    • Colonne `embedding vector(1536)` (migration 0003) + extension pgvector.
    • OPENAI_API_KEY et DATABASE_URL_SYNC (Supabase → Session pooler).

Usage :
    OPENAI_API_KEY=sk-... DATABASE_URL_SYNC=postgresql://... \
        python scripts/embed_knowledge.py [--all] [--batch 64] [--dry-run]

    --all     : ré-embed TOUS les documents (par défaut : seulement embedding IS NULL)
    --batch N : nombre de documents par requête OpenAI (défaut 64)
    --dry-run : calcule sans écrire en base

Requis : openai psycopg2-binary
"""
import argparse
import logging
import os
import sys
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("embed_knowledge")

MODEL = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
MAX_CHARS = 8000  # ~marge sous la limite de tokens du modèle


def _to_vector_literal(vec: list[float]) -> str:
    return "[" + ",".join(f"{x:.7f}" for x in vec) + "]"


def main() -> int:
    parser = argparse.ArgumentParser(description="MANSA — Embeddings knowledge base")
    parser.add_argument("--all", action="store_true",
                        help="Ré-embed tous les documents (sinon seulement les NULL)")
    parser.add_argument("--batch", type=int, default=64, help="Taille de lot OpenAI")
    parser.add_argument("--dry-run", action="store_true", help="Aucune écriture DB")
    args = parser.parse_args()

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        log.error("OPENAI_API_KEY non définie. https://platform.openai.com/api-keys")
        return 1

    db_url = os.environ.get("DATABASE_URL_SYNC")
    if not db_url:
        log.error("DATABASE_URL_SYNC non définie (Supabase → Connection string → Session pooler)")
        return 1

    import psycopg2
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    where = "" if args.all else "WHERE embedding IS NULL"
    cur.execute(f"SELECT id, title, content FROM knowledge_documents {where} ORDER BY created_at")
    rows = cur.fetchall()
    if not rows:
        log.info("Aucun document à traiter (tous déjà vectorisés).")
        cur.close(); conn.close()
        return 0

    log.info("📚 %d documents à embedder (modèle %s, dim 1536)", len(rows), MODEL)
    t0 = time.time()
    total = 0

    for i in range(0, len(rows), args.batch):
        batch = rows[i:i + args.batch]
        inputs = [((r[1] or "") + "\n\n" + (r[2] or ""))[:MAX_CHARS] for r in batch]
        try:
            resp = client.embeddings.create(model=MODEL, input=inputs)
        except Exception as e:
            log.error("Échec batch %d : %s", i // args.batch, e)
            conn.rollback()
            cur.close(); conn.close()
            return 1

        for r, item in zip(batch, resp.data):
            if not args.dry_run:
                cur.execute(
                    "UPDATE knowledge_documents SET embedding = %s::vector WHERE id = %s",
                    (_to_vector_literal(item.embedding), r[0]),
                )
            total += 1

        if not args.dry_run:
            conn.commit()
        log.info("  … %d/%d", min(i + args.batch, len(rows)), len(rows))

    cur.close()
    conn.close()
    log.info("🏁 Terminé en %.1fs — %d documents%s",
             time.time() - t0, total, " (dry-run, non écrit)" if args.dry_run else " vectorisés")
    return 0


if __name__ == "__main__":
    sys.exit(main())
