# Exporte tous les modèles pour qu'Alembic les détecte via Base.metadata
from app.models.models import (  # noqa: F401
    User,
    Subscription,
    Country,
    MacroIndicator,
    FXRate,
    AIQuery,
    KnowledgeDocument,
    DataIngestionLog,
)
