import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

DB_USERNAME = os.environ.get('POSTGRES_USER', 'postgres')
DB_PASSWORD = os.environ.get('POSTGRES_PASSWORD', 'postgres')
DB_HOST = os.environ.get('POSTGRES_HOST', 'db')
DATABASE_URL = os.environ.get(
    'DATABASE_URL',
    f'postgresql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}/{DB_USERNAME}',
)

# S3: pool_pre_ping keeps stale connections from causing silent errors
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        # H13: rollback on any unhandled exception so the session is clean
        db.rollback()
        raise
    finally:
        db.close()


def ensure_schema():
    with engine.connect() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS cart"))
        conn.commit()
