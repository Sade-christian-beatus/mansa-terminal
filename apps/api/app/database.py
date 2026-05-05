from sqlalchemy import create_engine  # type: ignore[import]
from sqlalchemy.orm import declarative_base, sessionmaker  # type: ignore[import]

from app.config import settings

engine = create_engine(settings.DATABASE_URL, echo=settings.DEBUG)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()